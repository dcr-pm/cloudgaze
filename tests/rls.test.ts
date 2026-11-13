import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, createUser, type Db } from "./helpers/db";

/**
 * Runs the real migration files against an embedded Postgres and checks the
 * access rules as each kind of circle member.
 *
 *   alex    parent, full (created the child)
 *   sam     parent, view_expenses
 *   rosa    grandparent, log_only
 *   nina    caregiver, log_only
 *   mallory signed in, not in the circle
 */
let db: Db;
let alex: string, sam: string, rosa: string, nina: string, mallory: string;
let maya: string;
let routine: string;
const ids: Record<string, string> = {};

const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

async function invite(by: string, role: string, permission: string) {
  return as(db, by, async () => {
    const r = await rows<{ token: string }>(
      `insert into invites (child_id, role, permission, created_by)
       values ($1, $2, $3, $4) returning token`,
      [maya, role, permission, by],
    );
    return r[0].token;
  });
}

async function log(by: string, type: string, title: string, amount: number | null = null) {
  return as(db, by, async () => {
    const r = await rows<{ id: string }>(
      `insert into entries (child_id, author_id, type, title, amount)
       values ($1, $2, $3, $4, $5) returning id`,
      [maya, by, type, title, amount],
    );
    return r[0].id;
  });
}

beforeAll(async () => {
  db = await createDb();
  [alex, sam, rosa, nina, mallory] = await Promise.all(
    ["Alex", "Sam", "Rosa", "Nina", "Mallory"].map((n) => createUser(db, n)),
  );

  maya = await as(db, alex, async () =>
    (await rows<{ id: string }>(`select create_child('Maya', '2018-03-14') as id`))[0].id,
  );
  for (const [user, role, permission] of [
    [sam, "parent", "view_expenses"],
    [rosa, "grandparent", "log_only"],
    [nina, "caregiver", "log_only"],
  ] as const) {
    const token = await invite(alex, role, permission);
    await as(db, user, () => db.query(`select accept_invite($1)`, [token]));
  }

  routine = await as(db, alex, async () =>
    (await rows<{ id: string }>(
      `insert into routines (child_id, name) values ($1, 'Bedtime') returning id`, [maya],
    ))[0].id,
  );

  ids.alexActivity = await log(alex, "activity", "Swimming lesson");
  ids.alexExpense = await log(alex, "expense", "Swimming lesson", 40);
  ids.rosaActivity = await log(rosa, "activity", "Baked cookies");
  ids.rosaExpense = await log(rosa, "expense", "Ice cream", 6.5);
});

describe("signup and circles", () => {
  it("creates a profile for every new user", async () => {
    const r = await rows(`select display_name from profiles where id = $1`, [alex]);
    expect(r).toEqual([{ display_name: "Alex" }]);
  });

  it("makes the child's creator a parent with full permission", async () => {
    const r = await rows(
      `select role, permission from circle_members where child_id = $1 and user_id = $2`,
      [maya, alex],
    );
    expect(r).toEqual([{ role: "parent", permission: "full" }]);
  });

  it("lets members see the child and the circle, and nobody else", async () => {
    for (const user of [alex, sam, rosa, nina]) {
      await as(db, user, async () => {
        expect(await rows(`select id from children`)).toHaveLength(1);
        expect(await rows(`select user_id from circle_members`)).toHaveLength(4);
      });
    }
    await as(db, mallory, async () => {
      expect(await rows(`select id from children`)).toHaveLength(0);
      expect(await rows(`select user_id from circle_members`)).toHaveLength(0);
      expect(await rows(`select id from entries`)).toHaveLength(0);
      expect(await rows(`select id from routines`)).toHaveLength(0);
      expect(await rows(`select id from entry_edits`)).toHaveLength(0);
    });
  });

  it("shows nothing at all to a signed-out visitor", async () => {
    await as(db, null, async () => {
      for (const table of ["profiles", "children", "circle_members", "invites", "routines", "entries", "entry_edits"]) {
        await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
      }
    });
  });

  it("only shows profiles of people you share a circle with", async () => {
    await as(db, rosa, async () => {
      const names = (await rows<{ display_name: string }>(`select display_name from profiles`))
        .map((r) => r.display_name).sort();
      expect(names).toEqual(["Alex", "Nina", "Rosa", "Sam"]);
    });
    await as(db, mallory, async () => {
      expect(await rows(`select display_name from profiles`)).toEqual([{ display_name: "Mallory" }]);
    });
  });

  it("lets you change your own profile only", async () => {
    await as(db, rosa, async () => {
      await db.query(`update profiles set simple_mode = true where id = $1`, [rosa]);
      const other = await db.query(`update profiles set display_name = 'Hacked' where id = $1`, [alex]);
      expect(other.affectedRows).toBe(0);
    });
    expect(await rows(`select display_name from profiles where id = $1`, [alex]))
      .toEqual([{ display_name: "Alex" }]);
  });

  it("blocks adding yourself to a circle directly", async () => {
    await as(db, mallory, async () => {
      await expect(
        db.query(
          `insert into circle_members (child_id, user_id, role, permission) values ($1, $2, 'parent', 'full')`,
          [maya, mallory],
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("blocks creating a child without going through create_child", async () => {
    await as(db, mallory, async () => {
      await expect(
        db.query(`insert into children (name, created_by) values ('X', $1)`, [mallory]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

describe("invites", () => {
  it("only full members can create or see invites", async () => {
    for (const user of [sam, rosa, mallory]) {
      await expect(invite(user, "caregiver", "full")).rejects.toThrow(/row-level security/);
      await as(db, user, async () => {
        expect(await rows(`select token from invites`)).toHaveLength(0);
      });
    }
    await as(db, alex, async () => {
      expect((await rows(`select token from invites`)).length).toBeGreaterThan(0);
    });
  });

  it("previews an invite by token, even when signed out", async () => {
    const token = await invite(alex, "caregiver", "log_only");
    await as(db, null, async () => {
      const r = await rows(`select child_name, role, permission, invited_by_name, valid from invite_preview($1)`, [token]);
      expect(r).toEqual([
        { child_name: "Maya", role: "caregiver", permission: "log_only", invited_by_name: "Alex", valid: true },
      ]);
      expect(await rows(`select * from invite_preview('nope')`)).toHaveLength(0);
    });
  });

  it("is single use", async () => {
    const token = await invite(alex, "caregiver", "full");
    const first = await createUser(db, "First");
    await as(db, first, () => db.query(`select accept_invite($1)`, [token]));
    await as(db, mallory, async () => {
      await expect(db.query(`select accept_invite($1)`, [token])).rejects.toThrow(/expired or was already used/);
    });
    // Tidy up so later counts stay at four members.
    await db.query(`delete from circle_members where user_id = $1`, [first]);
  });

  it("rejects expired and unknown invites", async () => {
    const token = await invite(alex, "caregiver", "full");
    await db.query(`update invites set expires_at = now() - interval '1 minute' where token = $1`, [token]);
    await as(db, mallory, async () => {
      await expect(db.query(`select accept_invite($1)`, [token])).rejects.toThrow(/expired/);
      await expect(db.query(`select accept_invite('nope')`)).rejects.toThrow(/not valid/);
    });
  });

  it("cannot be used by a signed-out visitor", async () => {
    const token = await invite(alex, "caregiver", "full");
    await as(db, null, async () => {
      await expect(db.query(`select accept_invite($1)`, [token])).rejects.toThrow(/permission denied/);
    });
  });
});

describe("managing the circle", () => {
  it("only full members can change someone's permission", async () => {
    await as(db, rosa, async () => {
      const r = await db.query(
        `update circle_members set permission = 'full' where child_id = $1 and user_id = $2`,
        [maya, rosa],
      );
      expect(r.affectedRows).toBe(0);
    });
    await as(db, sam, async () => {
      const r = await db.query(
        `update circle_members set permission = 'full' where child_id = $1 and user_id = $2`,
        [maya, sam],
      );
      expect(r.affectedRows).toBe(0);
    });
    await as(db, alex, async () => {
      const r = await db.query(
        `update circle_members set role = 'caregiver' where child_id = $1 and user_id = $2`,
        [maya, nina],
      );
      expect(r.affectedRows).toBe(1);
    });
  });

  it("keeps at least one full member in every circle", async () => {
    await as(db, alex, async () => {
      await expect(
        db.query(`update circle_members set permission = 'log_only' where child_id = $1 and user_id = $2`, [maya, alex]),
      ).rejects.toThrow(/at least one person with full access/);
      await expect(
        db.query(`delete from circle_members where child_id = $1 and user_id = $2`, [maya, alex]),
      ).rejects.toThrow(/at least one person with full access/);
    });
  });

  it("lets a member leave, but not remove others", async () => {
    const temp = await createUser(db, "Temp");
    const token = await invite(alex, "caregiver", "log_only");
    await as(db, temp, async () => {
      await db.query(`select accept_invite($1)`, [token]);
      const others = await db.query(`delete from circle_members where user_id = $1`, [rosa]);
      expect(others.affectedRows).toBe(0);
      const self = await db.query(`delete from circle_members where user_id = $1`, [temp]);
      expect(self.affectedRows).toBe(1);
    });
  });

  it("only full members can edit the child or manage routines", async () => {
    for (const user of [sam, rosa]) {
      await as(db, user, async () => {
        const r = await db.query(`update children set name = 'Changed' where id = $1`, [maya]);
        expect(r.affectedRows).toBe(0);
        await expect(
          db.query(`insert into routines (child_id, name) values ($1, 'Screen time')`, [maya]),
        ).rejects.toThrow(/row-level security/);
        const u = await db.query(`update routines set name = 'Changed' where id = $1`, [routine]);
        expect(u.affectedRows).toBe(0);
        expect(await rows(`select name from routines`)).toEqual([{ name: "Bedtime" }]);
      });
    }
  });
});

describe("entries", () => {
  it("log_only members see activities and routines, but only their own expenses", async () => {
    await as(db, rosa, async () => {
      const seen = (await rows<{ id: string }>(`select id from entries`)).map((r) => r.id);
      expect(seen).toContain(ids.alexActivity);
      expect(seen).toContain(ids.rosaActivity);
      expect(seen).toContain(ids.rosaExpense);
      expect(seen).not.toContain(ids.alexExpense);
    });
    await as(db, nina, async () => {
      const seen = (await rows<{ id: string }>(`select id from entries`)).map((r) => r.id);
      expect(seen).not.toContain(ids.alexExpense);
      expect(seen).not.toContain(ids.rosaExpense);
    });
  });

  it("view_expenses and full members see every entry", async () => {
    for (const user of [sam, alex]) {
      await as(db, user, async () => {
        const seen = (await rows<{ id: string }>(`select id from entries`)).map((r) => r.id);
        expect(seen).toEqual(expect.arrayContaining(Object.values(ids)));
      });
    }
  });

  it("every member can log, including a routine check-off", async () => {
    for (const user of [alex, sam, rosa, nina]) {
      const id = await as(db, user, async () =>
        (await rows<{ id: string; author_id: string }>(
          `insert into entries (child_id, type, title, routine_id, source)
           values ($1, 'routine', 'Bedtime', $2, 'routine') returning id, author_id`,
          [maya, routine],
        ))[0],
      );
      expect(id.author_id).toBe(user); // author defaults to the signed-in user
    }
  });

  it("nobody can log as someone else, or into a circle they're not in", async () => {
    await as(db, rosa, async () => {
      await expect(
        db.query(`insert into entries (child_id, author_id, type, title) values ($1, $2, 'activity', 'Fake')`, [maya, alex]),
      ).rejects.toThrow(/row-level security/);
    });
    await expect(log(mallory, "activity", "Intruder")).rejects.toThrow(/row-level security/);
  });

  it("an expense needs an amount, and other entries can't have one", async () => {
    await expect(log(alex, "expense", "No amount")).rejects.toThrow(/entries_amount_iff_expense/);
    await expect(log(alex, "activity", "With amount", 5)).rejects.toThrow(/entries_amount_iff_expense/);
  });

  it("a routine check-off must use a routine of the same child", async () => {
    const leo = await as(db, alex, async () =>
      (await rows<{ id: string }>(`select create_child('Leo') as id`))[0].id,
    );
    await as(db, alex, async () => {
      await expect(
        db.query(`insert into entries (child_id, type, title, routine_id) values ($1, 'routine', 'Bedtime', $2)`, [leo, routine]),
      ).rejects.toThrow(/different child/);
    });
  });

  it("entries cannot be hard-deleted by anyone", async () => {
    for (const user of [alex, rosa]) {
      await as(db, user, async () => {
        await expect(db.query(`delete from entries where id = $1`, [ids.rosaActivity])).rejects.toThrow(/permission denied/);
      });
    }
  });
});

describe("edits are always recorded", () => {
  it("records who changed what, with before and after", async () => {
    await as(db, rosa, () =>
      db.query(`update entries set title = 'Baked oat cookies', note = 'Two trays' where id = $1`, [ids.rosaActivity]),
    );
    const edits = await rows(`select editor_id, before, after from entry_edits where entry_id = $1`, [ids.rosaActivity]);
    expect(edits).toEqual([
      {
        editor_id: rosa,
        before: { title: "Baked cookies", note: null },
        after: { title: "Baked oat cookies", note: "Two trays" },
      },
    ]);
  });

  it("the author and full members can edit; others cannot", async () => {
    // sam (view_expenses) and nina (log_only) can't edit rosa's entry
    for (const user of [sam, nina]) {
      await as(db, user, async () => {
        const r = await db.query(`update entries set title = 'Nope' where id = $1`, [ids.rosaActivity]);
        expect(r.affectedRows).toBe(0);
      });
    }
    // alex (full) can, and it's attributed to alex
    await as(db, alex, () => db.query(`update entries set amount = 7 where id = $1`, [ids.rosaExpense]));
    const edits = await rows(`select editor_id, before, after from entry_edits where entry_id = $1`, [ids.rosaExpense]);
    expect(edits).toEqual([{ editor_id: alex, before: { amount: 6.5 }, after: { amount: 7 } }]);
  });

  it("records removal as an edit (soft delete)", async () => {
    const id = await log(nina, "activity", "Wrong child");
    await as(db, nina, () => db.query(`update entries set deleted_at = now() where id = $1`, [id]));
    const edits = await rows<{ before: Record<string, unknown>; after: Record<string, unknown> }>(
      `select before, after from entry_edits where entry_id = $1`, [id],
    );
    expect(edits).toHaveLength(1);
    expect(edits[0].before).toEqual({ deleted_at: null });
    expect(edits[0].after.deleted_at).toBeTruthy();
  });

  it("does not record an update that changes nothing", async () => {
    await as(db, alex, () =>
      db.query(`update entries set title = title where id = $1`, [ids.alexActivity]),
    );
    expect(await rows(`select id from entry_edits where entry_id = $1`, [ids.alexActivity])).toHaveLength(0);
  });

  it("an entry's author and child can never be changed", async () => {
    await as(db, alex, async () => {
      await expect(
        db.query(`update entries set author_id = $2 where id = $1`, [ids.alexActivity, sam]),
      ).rejects.toThrow(/permission denied/);
    });
    // Even with table-level rights (service role), the trigger refuses.
    await expect(
      db.query(`update entries set author_id = $2 where id = $1`, [ids.alexActivity, sam]),
    ).rejects.toThrow(/cannot be changed/);
  });

  it("history cannot be written, changed or removed by clients", async () => {
    await as(db, alex, async () => {
      await expect(
        db.query(`insert into entry_edits (entry_id, editor_id, before, after) values ($1, $2, '{}', '{}')`, [ids.alexActivity, sam]),
      ).rejects.toThrow(/permission denied/);
      await expect(db.query(`update entry_edits set after = '{}'`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`delete from entry_edits`)).rejects.toThrow(/permission denied/);
    });
  });

  it("history is visible only to people who can see the entry", async () => {
    // alex edited rosa's expense above; alex's own expense gets an edit here
    await as(db, alex, () => db.query(`update entries set amount = 45 where id = $1`, [ids.alexExpense]));
    await as(db, sam, async () => {
      expect(await rows(`select id from entry_edits where entry_id = $1`, [ids.alexExpense])).toHaveLength(1);
    });
    await as(db, rosa, async () => {
      expect(await rows(`select id from entry_edits where entry_id = $1`, [ids.alexExpense])).toHaveLength(0);
      expect(await rows(`select id from entry_edits where entry_id = $1`, [ids.rosaExpense])).toHaveLength(1);
    });
  });
});

describe("receipts storage", () => {
  const put = (by: string, name: string) =>
    as(db, by, () => db.query(`insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [name]));

  it("members upload under the child's folder; outsiders can't", async () => {
    await put(rosa, `${maya}/rosa.jpg`);
    await put(alex, `${maya}/alex.jpg`);
    await expect(put(mallory, `${maya}/mallory.jpg`)).rejects.toThrow(/row-level security/);
    await expect(put(rosa, `not-a-child/x.jpg`)).rejects.toThrow(/row-level security/);
  });

  it("log_only members see only their own receipts; expense viewers see all", async () => {
    const names = async (user: string) =>
      as(db, user, async () =>
        (await rows<{ name: string }>(`select name from storage.objects where bucket_id = 'receipts'`))
          .map((r) => r.name.split("/")[1]).sort(),
      );
    expect(await names(rosa)).toEqual(["rosa.jpg"]);
    expect(await names(nina)).toEqual([]);
    expect(await names(sam)).toEqual(["alex.jpg", "rosa.jpg"]);
    expect(await names(alex)).toEqual(["alex.jpg", "rosa.jpg"]);
    expect(await names(mallory)).toEqual([]);
  });
});

describe("seed data", () => {
  it("loads 2 children, 2 parents, 1 grandparent and 20 entries", async () => {
    const seeded = await createDb({ seed: true });
    const count = async (sql: string) => Number((await seeded.query<{ n: number }>(sql)).rows[0].n);
    expect(await count(`select count(*) n from children`)).toBe(2);
    expect(await count(`select count(distinct user_id) n from circle_members where role = 'parent'`)).toBe(2);
    expect(await count(`select count(distinct user_id) n from circle_members where role = 'grandparent'`)).toBe(1);
    expect(await count(`select count(*) n from entries`)).toBe(20);
    expect(await count(`select count(*) n from entry_edits`)).toBe(2);
    expect(await count(`select count(*) n from profiles where simple_mode`)).toBe(1);
  });
});

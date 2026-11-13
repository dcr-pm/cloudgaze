import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/** A fresh in-memory Postgres with the Supabase shim and every migration applied. */
export async function createDb(opts: { seed?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(read("tests/helpers/supabase-shim.sql"));
  const dir = "supabase/migrations";
  for (const file of readdirSync(path.join(root, dir)).sort()) {
    await db.exec(read(`${dir}/${file}`));
  }
  if (opts.seed) await db.exec(read("supabase/seed.sql"));
  return db;
}

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Runs `fn` as a signed-in user (role `authenticated`, auth.uid() = userId). */
export async function as<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Creates an auth user (and, via trigger, a profile). Runs as superuser. */
export async function createUser(db: Db, name: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('display_name', $2::text)) returning id`,
    [`${name.toLowerCase()}@test.local`, name],
  );
  return res.rows[0].id;
}

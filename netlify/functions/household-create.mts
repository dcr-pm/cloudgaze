import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { zCreateHouseholdRequest } from '../../shared/schema';
import { emptyState } from '../../shared/ops';
import type { CreateHouseholdResponse, Household } from '../../shared/types';
import { codeToKey, formatCode, generateFamilyCode } from './_lib/familyCode';
import { createFamily, readFamily } from './_lib/store';
import { fail, guard, json, readJson } from './_lib/http';

const MAX_CODE_ATTEMPTS = 5;

export default guard(async (req: Request) => {
  if (req.method !== 'POST') return fail('invalid_input', 'POST only');

  const parsed = zCreateHouseholdRequest.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail('invalid_input', parsed.error.issues[0]?.message);
  }
  const input = parsed.data;

  const now = new Date().toISOString();
  const household: Household = {
    id: randomUUID(),
    createdAt: now,
    timezone: input.timezone,
    parents: [
      { id: randomUUID(), name: input.parents[0].name, color: input.parents[0].color },
      { id: randomUUID(), name: input.parents[1].name, color: input.parents[1].color },
    ],
    kids: input.kids.map((k) => ({
      id: randomUUID(),
      name: k.name,
      ...(k.emoji ? { emoji: k.emoji } : {}),
    })),
  };

  const state = emptyState(household, now);

  // onlyIfNew makes a code collision impossible to lose a household to: the
  // write is simply rejected and we generate another. No read-then-write race.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateFamilyCode();
    const key = await codeToKey(code);
    if (await createFamily(key, state)) {
      const { rev } = await readFamily(key);
      const body: CreateHouseholdResponse = {
        familyCode: formatCode(code),
        state,
        rev,
      };
      return json(body, 201);
    }
  }

  console.error('[household-create] exhausted code attempts');
  return fail('server_error', 'Could not allocate a family code');
});

export const config: Config = {
  path: '/api/household',
  // Caps junk-household spam, which would otherwise burn storage credits.
  rateLimit: { windowSize: 3600, windowLimit: 5, aggregateBy: 'ip' },
};

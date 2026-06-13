import { dbGet, dbSet } from "../store/db";

const STORE = "case_counter";

export async function nextCaseId(guildId: string): Promise<number> {
  const current = (await dbGet<number>(STORE, guildId)) ?? 0;
  const next = current + 1;
  await dbSet(STORE, guildId, next);
  return next;
}

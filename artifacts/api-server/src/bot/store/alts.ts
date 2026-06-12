import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";

const STORE = "alts";

type GuildAlts = Record<string, string[]>;
const cache = new Map<string, GuildAlts>();
const index = new Map<string, Record<string, string>>();

export async function initAltsStore(): Promise<void> {
  const rows = await dbGetAll<GuildAlts>(STORE);
  for (const { key: guildId, data } of rows) {
    cache.set(guildId, data);
    const guildIndex: Record<string, string> = {};
    for (const [mainId, alts] of Object.entries(data)) {
      for (const altId of alts) guildIndex[altId] = mainId;
    }
    index.set(guildId, guildIndex);
  }
  logger.info({ count: rows.length }, "Loaded alts store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId) ?? {}).catch((err) =>
    logger.error({ err }, "Failed to save alts")
  );
}

export function addAlt(guildId: string, mainId: string, altId: string): boolean {
  if (!cache.has(guildId)) cache.set(guildId, {});
  if (!index.has(guildId)) index.set(guildId, {});
  const guild = cache.get(guildId)!;
  const alts = guild[mainId] ?? [];
  if (alts.includes(altId)) return false;
  alts.push(altId);
  guild[mainId] = alts;
  index.get(guildId)![altId] = mainId;
  save(guildId);
  return true;
}

export function removeAlt(guildId: string, altId: string): boolean {
  const mainId = index.get(guildId)?.[altId];
  if (!mainId) return false;
  const guild = cache.get(guildId);
  if (!guild) return false;
  const alts = guild[mainId] ?? [];
  const idx = alts.indexOf(altId);
  if (idx === -1) return false;
  alts.splice(idx, 1);
  guild[mainId] = alts;
  delete index.get(guildId)![altId];
  save(guildId);
  return true;
}

export function getAlts(guildId: string, userId: string): string[] {
  return cache.get(guildId)?.[userId] ?? [];
}

export function getMainAccount(guildId: string, altId: string): string | null {
  return index.get(guildId)?.[altId] ?? null;
}

export function getAllAlts(guildId: string): Record<string, string[]> {
  return cache.get(guildId) ?? {};
}

export function clearAlts(guildId: string, userId: string): number {
  const guild = cache.get(guildId);
  if (!guild) return 0;
  const alts = guild[userId] ?? [];
  const guildIndex = index.get(guildId) ?? {};
  for (const altId of alts) delete guildIndex[altId];
  delete guild[userId];
  save(guildId);
  return alts.length;
}

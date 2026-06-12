import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";

const STORE = "infractions";

export type InfractionType = "Ban" | "Unban" | "Kick" | "Mute" | "Unmute" | "Warn" | "Note";

export interface Infraction {
  id: string;
  type: InfractionType;
  reason: string;
  moderatorId: string;
  moderatorTag: string;
  timestamp: number;
  expiresAt?: number;
  userId: string;
  automod?: boolean;
}

type InfractionList = Infraction[];

const cache = new Map<string, InfractionList>();
const caseIndex = new Map<string, { guildId: string; userId: string }>();

function userKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function rebuildIndex(): void {
  caseIndex.clear();
  for (const [key, list] of cache.entries()) {
    const [guildId, userId] = key.split(":") as [string, string];
    for (const inf of list) {
      caseIndex.set(inf.id, { guildId, userId });
    }
  }
}

export async function initInfractionsStore(): Promise<void> {
  const rows = await dbGetAll<InfractionList>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  rebuildIndex();
  logger.info({ count: rows.length }, "Loaded infractions store from DB");
}

function save(key: string, list: InfractionList): void {
  dbSet(STORE, key, list).catch((err) => logger.error({ err }, "Failed to save infractions"));
}

let counter = 0;
function generateCaseId(): string {
  counter = (counter + 1) % 4096;
  const ts = BigInt(Date.now() - 1420070400000) << 22n;
  const c = BigInt(counter);
  return (ts | c).toString();
}

export function addInfraction(
  guildId: string,
  userId: string,
  data: Omit<Infraction, "id" | "timestamp" | "userId">
): Infraction {
  const key = userKey(guildId, userId);
  const existing = cache.get(key) ?? [];
  const infraction: Infraction = {
    ...data,
    id: generateCaseId(),
    timestamp: Date.now(),
    userId,
  };
  existing.push(infraction);
  cache.set(key, existing);
  caseIndex.set(infraction.id, { guildId, userId });
  save(key, existing);
  return infraction;
}

export function getInfractions(guildId: string, userId: string): Infraction[] {
  return cache.get(userKey(guildId, userId)) ?? [];
}

export function clearInfractions(guildId: string, userId: string): void {
  const key = userKey(guildId, userId);
  for (const inf of cache.get(key) ?? []) caseIndex.delete(inf.id);
  cache.delete(key);
  dbDelete(STORE, key).catch((err) => logger.error({ err }, "Failed to delete infractions"));
}

export function findByCaseId(
  guildId: string,
  caseId: string
): { infraction: Infraction; userId: string } | null {
  const entry = caseIndex.get(caseId);
  if (!entry || entry.guildId !== guildId) return null;
  const list = cache.get(userKey(guildId, entry.userId)) ?? [];
  const infraction = list.find((i) => i.id === caseId);
  if (!infraction) return null;
  return { infraction, userId: entry.userId };
}

export function removeByCaseId(guildId: string, caseId: string): Infraction | null {
  const entry = caseIndex.get(caseId);
  if (!entry || entry.guildId !== guildId) return null;
  const key = userKey(guildId, entry.userId);
  const list = cache.get(key) ?? [];
  const idx = list.findIndex((i) => i.id === caseId);
  if (idx === -1) return null;
  const [removed] = list.splice(idx, 1);
  cache.set(key, list);
  caseIndex.delete(caseId);
  save(key, list);
  return removed!;
}

export function removeInfraction(guildId: string, userId: string, caseId: string): boolean {
  return removeByCaseId(guildId, caseId) !== null;
}

export function getActiveAutomodWarnCount(guildId: string, userId: string): number {
  const now = Date.now();
  return (cache.get(userKey(guildId, userId)) ?? []).filter(
    (i) => i.automod === true && i.type === "Warn" && (!i.expiresAt || i.expiresAt > now)
  ).length;
}

/**
 * Removes all expired Warn infractions (both manual and automod) from every
 * guild's records. A warning is expired when its expiresAt is set and in the past.
 * Returns the total number of records deleted.
 */
export function purgeExpiredWarnings(): number {
  let removed = 0;
  const now = Date.now();
  for (const [key, list] of cache.entries()) {
    const filtered = list.filter((i) => {
      if (i.type !== "Warn") return true;
      if (!i.expiresAt) return true;
      return i.expiresAt > now;
    });
    if (filtered.length !== list.length) {
      const delta = list.length - filtered.length;
      removed += delta;
      for (const inf of list) {
        if (!filtered.includes(inf)) caseIndex.delete(inf.id);
      }
      if (filtered.length === 0) {
        cache.delete(key);
        dbDelete(STORE, key).catch((err) =>
          logger.error({ err }, "Failed to delete empty infraction record after expiry purge"),
        );
      } else {
        cache.set(key, filtered);
        save(key, filtered);
      }
    }
  }
  return removed;
}

export function getAllInfractionsForGuild(guildId: string): Infraction[] {
  const prefix = `${guildId}:`;
  const result: Infraction[] = [];
  for (const [key, list] of cache.entries()) {
    if (key.startsWith(prefix)) result.push(...list);
  }
  return result;
}

export function updateReasonByCaseId(
  guildId: string,
  caseId: string,
  newReason: string
): Infraction | null {
  const entry = caseIndex.get(caseId);
  if (!entry || entry.guildId !== guildId) return null;
  const key = userKey(guildId, entry.userId);
  const list = cache.get(key) ?? [];
  const infraction = list.find((i) => i.id === caseId);
  if (!infraction) return null;
  infraction.reason = newReason;
  cache.set(key, list);
  save(key, list);
  return infraction;
}

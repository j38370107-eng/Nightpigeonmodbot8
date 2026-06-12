import { logger } from "../../lib/logger";
import { dbSet, dbDelete, dbGetAll } from "./db";

const STORE = "warnings";

export interface Warning {
  reason: string;
  moderatorId: string;
  moderatorTag: string;
  timestamp: number;
}

const cache = new Map<string, Warning[]>();

export async function initWarningsStore(): Promise<void> {
  const rows = await dbGetAll<Warning[]>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded warnings store from DB");
}

function storeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

function save(k: string, list: Warning[]): void {
  dbSet(STORE, k, list).catch((err) => logger.error({ err }, "Failed to save warnings"));
}

export function addWarning(
  guildId: string,
  userId: string,
  data: Omit<Warning, "timestamp">
): Warning[] {
  const k = storeKey(guildId, userId);
  const existing = cache.get(k) ?? [];
  existing.push({ ...data, timestamp: Date.now() });
  cache.set(k, existing);
  save(k, existing);
  return existing;
}

export function getWarnings(guildId: string, userId: string): Warning[] {
  return cache.get(storeKey(guildId, userId)) ?? [];
}

export function clearWarnings(guildId: string, userId: string): void {
  const k = storeKey(guildId, userId);
  cache.delete(k);
  dbDelete(STORE, k).catch((err) => logger.error({ err }, "Failed to delete warnings"));
}

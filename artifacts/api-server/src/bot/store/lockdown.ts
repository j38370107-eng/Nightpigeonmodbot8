import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "lockdown";

const cache = new Map<string, string[]>();

export async function initLockdownStore(): Promise<void> {
  const rows = await dbGetAll<string[]>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded lockdown store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId) ?? []).catch((err) =>
    logger.error({ err }, "Failed to save lockdown config")
  );
}

export function getLockdownChannels(guildId: string): string[] {
  return cache.get(guildId) ?? [];
}

export function addLockdownChannel(guildId: string, channelId: string): boolean {
  const channels = cache.get(guildId) ?? [];
  if (channels.includes(channelId)) return false;
  channels.push(channelId);
  cache.set(guildId, channels);
  save(guildId);
  return true;
}

export function removeLockdownChannel(guildId: string, channelId: string): boolean {
  const channels = cache.get(guildId) ?? [];
  const idx = channels.indexOf(channelId);
  if (idx === -1) return false;
  channels.splice(idx, 1);
  cache.set(guildId, channels);
  save(guildId);
  return true;
}

export function setLockdownChannels(guildId: string, channels: string[]): void {
  cache.set(guildId, [...channels]);
  save(guildId);
}

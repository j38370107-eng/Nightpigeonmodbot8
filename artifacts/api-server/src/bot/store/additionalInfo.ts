import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "additionalInfo";

export type PunishmentType = "warn" | "mute" | "kick" | "ban";
export const PUNISHMENT_TYPES: PunishmentType[] = ["warn", "mute", "kick", "ban"];

export interface AdditionalInfoConfig {
  warn?: string;
  mute?: string;
  kick?: string;
  ban?: string;
}

const cache = new Map<string, AdditionalInfoConfig>();

export async function initAdditionalInfoStore(): Promise<void> {
  const rows = await dbGetAll<AdditionalInfoConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded additionalInfo store from DB");
}

function save(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId) ?? {}).catch((err) =>
    logger.error({ err }, "Failed to save additionalInfo config")
  );
}

export function getAdditionalInfo(guildId: string, type: PunishmentType): string | undefined {
  return cache.get(guildId)?.[type];
}

export function getAdditionalInfoConfig(guildId: string): AdditionalInfoConfig {
  return cache.get(guildId) ?? {};
}

export function setAdditionalInfo(guildId: string, type: PunishmentType, text: string): void {
  if (!cache.has(guildId)) cache.set(guildId, {});
  cache.get(guildId)![type] = text;
  save(guildId);
}

export function clearAllAdditionalInfo(guildId: string): void {
  cache.delete(guildId);
  dbDelete(STORE, guildId).catch((err) => logger.error({ err }, "Failed to clear additionalInfo"));
}

export function clearAdditionalInfo(guildId: string, type: PunishmentType): boolean {
  const cfg = cache.get(guildId);
  if (!cfg || cfg[type] === undefined) return false;
  delete cfg[type];
  save(guildId);
  return true;
}

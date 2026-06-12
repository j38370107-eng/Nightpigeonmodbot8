import { logger } from "../../lib/logger";
import { dbSet, dbGetAll } from "./db";

const STORE = "tickets";

export interface TicketCategory {
  id: string;
  name: string;
  emoji?: string;
  categoryId?: string;
  supportRoleIds?: string[];
  openMessage?: string;
}

export interface TicketGuildConfig {
  categoryId?: string;
  logChannelId?: string;
  pingRoleId?: string;
  supportRoleId?: string;
  panelChannelId?: string;
  blacklist: string[];
  openMessage?: string;
  cooldownMs?: number;
  dmOnClose?: boolean;
  dmOnStaffResponse?: boolean;
  feedbackEnabled?: boolean;
  autoCloseHours?: number;
  alertNoResponseHours?: number;
  alertWaitingHours?: number;
}

export interface StaffStat {
  claimed: number;
  closed: number;
  transcripts: number;
}

export interface ActiveTicket {
  channelId: string;
  guildId: string;
  userId: string;
  userTag: string;
  number: number;
  panelId?: string;
  category?: string;
  claimedBy?: string;
  claimedByTag?: string;
  createdAt: number;
  lastActivityAt: number;
  closed: boolean;
  hasStaffResponse: boolean;
  alertedNoResponse?: boolean;
  alertedWaiting?: boolean;
  feedbackSent?: boolean;
}

interface TicketStoreData {
  guilds: Record<string, TicketGuildConfig>;
  tickets: Record<string, ActiveTicket>;
  counter: Record<string, number>;
  cooldowns: Record<string, number>;
  stats: Record<string, Record<string, StaffStat>>;
}

const SINGLETON_KEY = "__tickets__";
let cache: TicketStoreData = { guilds: {}, tickets: {}, counter: {}, cooldowns: {}, stats: {} };

export async function initTicketsStore(): Promise<void> {
  const rows = await dbGetAll<TicketStoreData>(STORE);
  for (const { data } of rows) {
    cache = { cooldowns: {}, stats: {}, ...data };
  }
  // Backfill missing fields on legacy tickets
  for (const t of Object.values(cache.tickets)) {
    if (!t.guildId) (t as any).guildId = "";
    if (!t.lastActivityAt) t.lastActivityAt = t.createdAt;
    if (t.hasStaffResponse === undefined) t.hasStaffResponse = false;
    if (t.number === undefined) t.number = 0;
  }
  logger.info("Loaded tickets store from DB");
}

function save(): void {
  dbSet(STORE, SINGLETON_KEY, cache).catch((err) =>
    logger.error({ err }, "Failed to save tickets")
  );
}

export function getTicketConfig(guildId: string): TicketGuildConfig {
  return cache.guilds[guildId] ?? { blacklist: [] };
}

export function resetTicketConfig(guildId: string): void {
  cache.guilds[guildId] = { blacklist: [] };
  save();
}

export function updateTicketConfig(guildId: string, partial: Partial<TicketGuildConfig>): void {
  cache.guilds[guildId] = { ...getTicketConfig(guildId), ...partial };
  save();
}

export function blacklistUser(guildId: string, userId: string): void {
  const cfg = getTicketConfig(guildId);
  if (!cfg.blacklist.includes(userId)) {
    cfg.blacklist.push(userId);
    cache.guilds[guildId] = cfg;
    save();
  }
}

export function unblacklistUser(guildId: string, userId: string): boolean {
  const cfg = getTicketConfig(guildId);
  const idx = cfg.blacklist.indexOf(userId);
  if (idx === -1) return false;
  cfg.blacklist.splice(idx, 1);
  cache.guilds[guildId] = cfg;
  save();
  return true;
}

export function isBlacklisted(guildId: string, userId: string): boolean {
  return getTicketConfig(guildId).blacklist.includes(userId);
}

export function checkCooldown(guildId: string, userId: string, cooldownMs: number): number {
  if (!cooldownMs) return 0;
  const key = `${guildId}:${userId}`;
  const last = cache.cooldowns[key] ?? 0;
  const remaining = last + cooldownMs - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setCooldown(guildId: string, userId: string): void {
  cache.cooldowns[`${guildId}:${userId}`] = Date.now();
  save();
}

export function nextTicketNumber(guildId: string): number {
  cache.counter[guildId] = (cache.counter[guildId] ?? 0) + 1;
  save();
  return cache.counter[guildId]!;
}

export function openTicket(ticket: ActiveTicket): void {
  cache.tickets[ticket.channelId] = ticket;
  save();
}

export function getTicket(channelId: string): ActiveTicket | null {
  return cache.tickets[channelId] ?? null;
}

export function updateTicket(channelId: string, partial: Partial<ActiveTicket>): void {
  if (!cache.tickets[channelId]) return;
  cache.tickets[channelId] = { ...cache.tickets[channelId]!, ...partial };
  save();
}

export function closeTicketRecord(channelId: string): void {
  if (cache.tickets[channelId]) {
    cache.tickets[channelId]!.closed = true;
    save();
  }
}

export function deleteTicketRecord(channelId: string): void {
  delete cache.tickets[channelId];
  save();
}

export function getUserOpenTicket(guildId: string, userId: string): ActiveTicket | null {
  return (
    Object.values(cache.tickets).find(
      (t) => (t.guildId === guildId || !t.guildId) && t.userId === userId && !t.closed
    ) ?? null
  );
}

export function getAllOpenTickets(): ActiveTicket[] {
  return Object.values(cache.tickets).filter((t) => !t.closed);
}

export function recordActivity(channelId: string): void {
  if (cache.tickets[channelId]) {
    cache.tickets[channelId]!.lastActivityAt = Date.now();
    save();
  }
}

export function getStaffStats(guildId: string): Record<string, StaffStat> {
  return cache.stats[guildId] ?? {};
}

export function incrementStat(guildId: string, userId: string, field: keyof StaffStat): void {
  if (!cache.stats[guildId]) cache.stats[guildId] = {};
  const s = cache.stats[guildId]![userId] ?? { claimed: 0, closed: 0, transcripts: 0 };
  s[field]++;
  cache.stats[guildId]![userId] = s;
  save();
}

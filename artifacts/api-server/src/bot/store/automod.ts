import { logger } from "../../lib/logger";
import { dbGet, dbSet, dbGetAll } from "./db";

const STORE = "automod";

export type AutomodAction = "warn" | "delete" | "mute" | "kick" | "ban";

export interface PunishmentStep {
  strikes: number;
  action: AutomodAction;
  duration?: string;
}

export interface RulePermissions {
  action?: AutomodAction;
  actionDuration?: string;
  affectedRoles?: string[];
  ignoredRoles?: string[];
  affectedChannels?: string[];
  ignoredChannels?: string[];
}

export interface AutomodRule extends RulePermissions {
  id: string;
  name: string;
  words: string[];
  wildcardWords: string[];
  enabled: boolean;
}

export interface AutomodModule extends RulePermissions {
  enabled: boolean;
}

export interface FilterModule extends AutomodModule {
  words:         string[];
  wildcardWords: string[];
}

export interface MentionModule extends AutomodModule {
  threshold: number;
}

export interface SpamModule extends AutomodModule {
  limit:    number;
  windowMs: number;
}

export interface DuplicateModule extends AutomodModule {
  count: number;
}

export interface CharFloodModule extends AutomodModule {
  maxRepeat: number;
  maxEmoji:  number;
}

export interface LinkSpamModule extends AutomodModule {
  limit:    number;
  windowMs: number;
}

export interface UrlFilterModule extends AutomodModule {
  mode:     "blacklist" | "whitelist";
  blockAll: boolean;
  domains:  string[];
}

export interface WallTextModule extends AutomodModule {
  maxLength: number;
  maxLines:  number;
}

export interface FileFilterModule extends AutomodModule {
  blockedExtensions: string[];
}

export interface AutomodConfig {
  exemptRoles:    string[];
  exemptChannels: string[];
  punishment:     { steps: PunishmentStep[] };
  silent:         boolean;
  rules:          AutomodRule[];
  filter?:     FilterModule;
  invite?:     AutomodModule;
  mention?:    MentionModule;
  spam?:       SpamModule;
  duplicate?:  DuplicateModule;
  charFlood?:  CharFloodModule;
  linkSpam?:   LinkSpamModule;
  urlFilter?:  UrlFilterModule;
  wallText?:   WallTextModule;
  phishing?:   AutomodModule;
  fileFilter?: FileFilterModule;
}

const DEFAULT_CONFIG: AutomodConfig = {
  exemptRoles:    [],
  exemptChannels: [],
  punishment:     { steps: [] },
  silent:         false,
  rules:          [],
};

const cache = new Map<string, AutomodConfig>();

export async function initAutomodStore(): Promise<void> {
  const rows = await dbGetAll<AutomodConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
  logger.info({ count: rows.length }, "Loaded automod store from DB");
}

export async function refreshAutomodFromDb(): Promise<void> {
  const rows = await dbGetAll<AutomodConfig>(STORE);
  for (const { key, data } of rows) cache.set(key, data);
}

export async function refreshAutomodForGuild(guildId: string): Promise<void> {
  const data = await dbGet<AutomodConfig>(STORE, guildId);
  if (data) cache.set(guildId, data);
}

function getConfig(guildId: string): AutomodConfig {
  if (!cache.has(guildId)) {
    const cfg: AutomodConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    cache.set(guildId, cfg);
    dbSet(STORE, guildId, cfg).catch((err) =>
      logger.error({ err }, "Failed to save default automod config")
    );
  }
  const cfg = cache.get(guildId)!;
  cfg.exemptRoles    ??= [];
  cfg.exemptChannels ??= [];
  cfg.punishment     ??= { steps: [] };
  cfg.punishment.steps ??= [];
  cfg.silent         ??= false;
  cfg.rules          ??= [];
  for (const rule of cfg.rules) {
    rule.action           ??= "warn";
    rule.words            ??= [];
    rule.wildcardWords    ??= [];
    rule.ignoredRoles     ??= [];
    rule.ignoredChannels  ??= [];
    rule.affectedRoles    ??= [];
    rule.affectedChannels ??= [];
  }
  return cfg;
}

function persistConfig(guildId: string): void {
  dbSet(STORE, guildId, cache.get(guildId)!).catch((err) =>
    logger.error({ err }, "Failed to save automod config")
  );
}

export function getAutomodConfig(guildId: string): AutomodConfig {
  return getConfig(guildId);
}

// ── Named rules ───────────────────────────────────────────────────────────────

export function createRule(guildId: string, name: string): AutomodRule | null {
  const cfg = getConfig(guildId);
  if (cfg.rules.some((r) => r.name.toLowerCase() === name.toLowerCase())) return null;
  const rule: AutomodRule = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    words: [],
    wildcardWords: [],
    enabled: true,
    action: "warn",
    actionDuration: undefined,
    ignoredRoles: [],
    ignoredChannels: [],
    affectedRoles: [],
    affectedChannels: [],
  };
  cfg.rules.push(rule);
  persistConfig(guildId);
  return rule;
}

export function deleteRule(guildId: string, name: string): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.rules.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) return false;
  cfg.rules.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

export function getRuleByName(guildId: string, name: string): AutomodRule | null {
  return getConfig(guildId).rules.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export function setRuleEnabled(guildId: string, name: string, enabled: boolean): boolean {
  const rule = getRuleByName(guildId, name);
  if (!rule) return false;
  rule.enabled = enabled;
  persistConfig(guildId);
  return true;
}

export function setRuleAction(guildId: string, name: string, action: AutomodAction, duration?: string): boolean {
  const rule = getRuleByName(guildId, name);
  if (!rule) return false;
  rule.action = action;
  rule.actionDuration = duration;
  persistConfig(guildId);
  return true;
}

export function addRuleIgnoredRole(guildId: string, name: string, roleId: string): "ok" | "norule" | "exists" {
  const rule = getRuleByName(guildId, name);
  if (!rule) return "norule";
  rule.ignoredRoles ??= [];
  if (rule.ignoredRoles.includes(roleId)) return "exists";
  rule.ignoredRoles.push(roleId);
  persistConfig(guildId);
  return "ok";
}

export function removeRuleIgnoredRole(guildId: string, name: string, roleId: string): "ok" | "norule" | "notfound" {
  const rule = getRuleByName(guildId, name);
  if (!rule) return "norule";
  rule.ignoredRoles ??= [];
  const idx = rule.ignoredRoles.indexOf(roleId);
  if (idx === -1) return "notfound";
  rule.ignoredRoles.splice(idx, 1);
  persistConfig(guildId);
  return "ok";
}

export function addRuleIgnoredChannel(guildId: string, name: string, channelId: string): "ok" | "norule" | "exists" {
  const rule = getRuleByName(guildId, name);
  if (!rule) return "norule";
  rule.ignoredChannels ??= [];
  if (rule.ignoredChannels.includes(channelId)) return "exists";
  rule.ignoredChannels.push(channelId);
  persistConfig(guildId);
  return "ok";
}

export function removeRuleIgnoredChannel(guildId: string, name: string, channelId: string): "ok" | "norule" | "notfound" {
  const rule = getRuleByName(guildId, name);
  if (!rule) return "norule";
  rule.ignoredChannels ??= [];
  const idx = rule.ignoredChannels.indexOf(channelId);
  if (idx === -1) return "notfound";
  rule.ignoredChannels.splice(idx, 1);
  persistConfig(guildId);
  return "ok";
}

export function addWordToRule(guildId: string, ruleName: string, word: string, wildcard: boolean): "ok" | "norule" | "exists" {
  const rule = getRuleByName(guildId, ruleName);
  if (!rule) return "norule";
  const w = word.toLowerCase();
  if (wildcard) {
    rule.wildcardWords ??= [];
    if (rule.wildcardWords.includes(w)) return "exists";
    rule.wildcardWords.push(w);
  } else {
    if (rule.words.includes(w)) return "exists";
    rule.words.push(w);
  }
  persistConfig(guildId);
  return "ok";
}

export function removeWordFromRule(guildId: string, ruleName: string, word: string): "ok" | "norule" | "notfound" {
  const rule = getRuleByName(guildId, ruleName);
  if (!rule) return "norule";
  const w = word.toLowerCase();
  let idx = rule.words.indexOf(w);
  if (idx !== -1) { rule.words.splice(idx, 1); persistConfig(guildId); return "ok"; }
  idx = (rule.wildcardWords ?? []).indexOf(w);
  if (idx !== -1) { rule.wildcardWords!.splice(idx, 1); persistConfig(guildId); return "ok"; }
  return "notfound";
}

export function listRules(guildId: string): AutomodRule[] {
  return getConfig(guildId).rules;
}

// ── Exempt roles / channels ───────────────────────────────────────────────────

export function addExemptRole(guildId: string, roleId: string): boolean {
  const cfg = getConfig(guildId);
  if (cfg.exemptRoles.includes(roleId)) return false;
  cfg.exemptRoles.push(roleId);
  persistConfig(guildId);
  return true;
}

export function removeExemptRole(guildId: string, roleId: string): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.exemptRoles.indexOf(roleId);
  if (idx === -1) return false;
  cfg.exemptRoles.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

export function addExemptChannel(guildId: string, channelId: string): boolean {
  const cfg = getConfig(guildId);
  if (cfg.exemptChannels.includes(channelId)) return false;
  cfg.exemptChannels.push(channelId);
  persistConfig(guildId);
  return true;
}

export function removeExemptChannel(guildId: string, channelId: string): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.exemptChannels.indexOf(channelId);
  if (idx === -1) return false;
  cfg.exemptChannels.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

// ── Silent mode ───────────────────────────────────────────────────────────────

export function setSilentMode(guildId: string, enabled: boolean): void {
  getConfig(guildId).silent = enabled;
  persistConfig(guildId);
}

// ── Punishment steps ──────────────────────────────────────────────────────────

export function setPunishmentStep(guildId: string, step: PunishmentStep): void {
  const cfg = getConfig(guildId);
  const existing = cfg.punishment.steps.findIndex((s) => s.strikes === step.strikes);
  if (existing !== -1) cfg.punishment.steps[existing] = step;
  else cfg.punishment.steps.push(step);
  cfg.punishment.steps.sort((a, b) => a.strikes - b.strikes);
  persistConfig(guildId);
}

export function removePunishmentStep(guildId: string, strikes: number): boolean {
  const cfg = getConfig(guildId);
  const idx = cfg.punishment.steps.findIndex((s) => s.strikes === strikes);
  if (idx === -1) return false;
  cfg.punishment.steps.splice(idx, 1);
  persistConfig(guildId);
  return true;
}

export function resetPunishmentSteps(guildId: string): void {
  getConfig(guildId).punishment.steps = [];
  persistConfig(guildId);
}

export function getPunishmentForStrikes(guildId: string, strikeCount: number): PunishmentStep | null {
  const steps = getConfig(guildId).punishment.steps;
  if (!steps.length) return null;
  const sorted = [...steps].sort((a, b) => b.strikes - a.strikes);
  return sorted.find((s) => strikeCount >= s.strikes) ?? null;
}

// ── Strike tracking ───────────────────────────────────────────────────────────

const strikesMap = new Map<string, number>();

function strikeKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

export function incrementStrikes(guildId: string, userId: string): number {
  const key = strikeKey(guildId, userId);
  const count = (strikesMap.get(key) ?? 0) + 1;
  strikesMap.set(key, count);
  return count;
}

export function getStrikes(guildId: string, userId: string): number {
  return strikesMap.get(strikeKey(guildId, userId)) ?? 0;
}

export function clearStrikes(guildId: string, userId: string): void {
  strikesMap.delete(strikeKey(guildId, userId));
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export function setAutomodConfig(guildId: string, config: Partial<AutomodConfig>): void {
  const current = getConfig(guildId);
  const merged  = { ...current, ...config };
  cache.set(guildId, merged as AutomodConfig);
  persistConfig(guildId);
}

export function resetAutomodConfig(guildId: string): void {
  cache.set(guildId, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  persistConfig(guildId);
}

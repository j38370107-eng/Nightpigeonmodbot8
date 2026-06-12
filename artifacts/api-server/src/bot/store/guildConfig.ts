import yaml from "js-yaml";
import { pool } from "./db";
import { logger } from "../../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YamlEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface YamlEmbed {
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: YamlEmbedField[];
}

export type YamlMessage = string | { embed: YamlEmbed } | { content?: string; embed: YamlEmbed };

export interface LevelsConfig {
  users: Record<string, number>;
  roles: Record<string, number>;
  commands: Record<string, number>;
}

export interface GuildConfig {
  prefix: string;
  levels: LevelsConfig;
  tags: Record<string, string>;
  plugins: {
    command_aliases?: {
      config: { aliases: Record<string, string> };
    };
    preset_reasons?: {
      config: { presets: Record<string, string> };
    };
    moderation?: {
      enabled?: boolean;
      mute_role?: string | null;
      dm_on_action?: boolean;
      messages?: Record<string, YamlMessage>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Default config ─────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: GuildConfig = {
  prefix: "!",
  levels: {
    users: {},
    roles: {},
    commands: {
      ban: 50, forceban: 75, unban: 50, kick: 25,
      mute: 25, forcemute: 75, unmute: 25, forceunmute: 75,
      warn: 25, forcewarn: 25,
      addcase: 25, forceaddcase: 50, editcase: 50, deletecase: 75,
      case: 25, cases: 25, servercases: 25, casecount: 25, exportcases: 50,
      purge: 25, slowmode: 25,
      masswarn: 75, massforcewarn: 75, massmute: 75, massforcemute: 75,
      massunmute: 75, masskick: 75, massforcekick: 75,
      massban: 100, massforceban: 100, massunban: 75,
      note: 25, forcenote: 25, viewnote: 25, viewnotes: 25,
      deletenote: 50, notesearch: 25, editnote: 50,
      addrole: 50, removerole: 50, temprole: 50, temproles: 25,
      tag: 0,
      remind: 0, reminders: 0, delreminder: 0,
      raidmode: 100,
      lockdown: 50, unlock: 50,
      modnick: 25, history: 25,
      watch: 50, unwatch: 50, watchlist: 25,
      roleban: 75, unroleban: 75, rolebanned: 25,
      nick: 50, resetnick: 50, locknick: 75, unlocknick: 75,
      seen: 25, cleanup: 50,
      rr: 100,
      ticket: 0, ticket_close: 0, ticket_claim: 25, ticket_delete: 75,
      ticket_adduser: 25, ticket_removeuser: 25,
      ticket_blacklist: 50, ticket_unblacklist: 50, ticket_panel: 100,
      starboard: 0, starboard_top: 0, starboard_stats: 0,
      starboard_clear: 100, starboard_ignore: 75,
      timezone: 0, time: 0, timefor: 0, timeconvert: 0,
      autoreply: 50, autoreaction: 50, autoclean: 100,
      slowmode_auto: 100, welcome_test: 100,
      level: 0, levels: 100,
      userinfo: 0, avatar: 0, banner: 0, serverinfo: 0,
      channelinfo: 0, roleinfo: 0, membercount: 0,
      botstats: 0, botinfo: 0, snowflake: 0,
      permissions: 0, inrole: 25, charcount: 0,
      bansearch: 25, casesearch: 25, warncount: 25,
      modstats: 25, inviteinfo: 25, help: 0,
    },
  },
  tags: {},
  plugins: {
    command_aliases: {
      config: {
        aliases: {
          b: "ban", fb: "forceban", ub: "unban",
          k: "kick",
          m: "mute", fm: "forcemute", um: "unmute", fum: "forceunmute",
          w: "warn", fw: "forcewarn",
          p: "purge", sm: "slowmode",
          ac: "addcase", ec: "editcase", dc: "deletecase", sc: "servercases",
          mw: "masswarn", mm: "massmute", mk: "masskick", mb: "massban", mub: "massunban",
          r: "reason", l: "level",
        },
      },
    },
    preset_reasons: {
      config: {
        presets: {
          spam: "Spamming in chat",
          ads: "Advertising without permission",
          toxic: "Toxic behavior towards members",
          nsfw: "Posting NSFW content outside designated channels",
          raid: "Raiding the server",
          slurs: "Using slurs or hate speech",
          threats: "Threatening other members",
          dox: "Doxxing or sharing personal information",
          impersonation: "Impersonating staff or other members",
          evade: "Ban or mute evasion",
        },
      },
    },
    moderation: {
      enabled: true,
      mute_role: null,
      dm_on_action: true,
      messages: {
        ban_success: "{user} has been banned | Case: {case_id}",
        unban_success: "{user} has been unbanned | Case: {case_id}",
        kick_success: "{user} has been kicked | Case: {case_id}",
        mute_success: "{user} has been muted | Duration: {duration} | Case: {case_id}",
        unmute_success: "{user} has been unmuted | Case: {case_id}",
        warn_success: "{user} has been warned | Case: {case_id}",
        purge_success: "{count} messages deleted",
        slowmode_success: "Slowmode set to {count}s in {channel}",
        slowmode_off: "Slowmode removed in {channel}",
      },
    },
  },
};

// ── DB helpers ─────────────────────────────────────────────────────────────────

async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id TEXT PRIMARY KEY,
      config   TEXT NOT NULL DEFAULT ''
    )
  `);
}

export async function getRawYaml(guildId: string): Promise<string | null> {
  const res = await pool.query(
    "SELECT config FROM guild_configs WHERE guild_id = $1",
    [guildId]
  );
  return (res.rows[0]?.config as string) ?? null;
}

export async function setRawYaml(guildId: string, rawYaml: string): Promise<void> {
  await pool.query(
    `INSERT INTO guild_configs (guild_id, config)
     VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET config = EXCLUDED.config`,
    [guildId, rawYaml]
  );
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const configCache = new Map<string, { data: GuildConfig; ts: number }>();

function deepMerge(target: any, source: any): any {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function parseAndMerge(rawYaml: string): GuildConfig {
  try {
    const parsed = yaml.load(rawYaml) as Partial<GuildConfig>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_CONFIG;
    return deepMerge(DEFAULT_CONFIG, parsed) as GuildConfig;
  } catch (err) {
    logger.warn({ err }, "Failed to parse guild YAML config — using defaults");
    return DEFAULT_CONFIG;
  }
}

export async function loadGuildConfig(guildId: string): Promise<GuildConfig> {
  const raw = await getRawYaml(guildId);
  const config = raw ? parseAndMerge(raw) : DEFAULT_CONFIG;
  configCache.set(guildId, { data: config, ts: Date.now() });
  return config;
}

export function getCachedConfig(guildId: string): GuildConfig {
  const entry = configCache.get(guildId);
  if (entry) return entry.data;
  return DEFAULT_CONFIG;
}

export async function getGuildConfig(guildId: string): Promise<GuildConfig> {
  const entry = configCache.get(guildId);
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
  return loadGuildConfig(guildId);
}

export function invalidateCache(guildId: string): void {
  configCache.delete(guildId);
}

// ── Initialise ─────────────────────────────────────────────────────────────────

export async function initGuildConfigStore(): Promise<void> {
  await ensureTable();
  logger.info("guild_configs table ensured");
}

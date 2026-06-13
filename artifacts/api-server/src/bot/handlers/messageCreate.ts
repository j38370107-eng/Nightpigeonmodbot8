import { Client, Message } from "discord.js";
import type { Command } from "../commands/types";
import { getGuildConfig, getCachedConfig } from "../store/guildConfig";
import { runAutomod } from "../lib/runAutomod";
import { logger } from "../../lib/logger";

// ── Command registry ──────────────────────────────────────────────────────────

import warnCmd, { forcewarnCmd } from "../commands/mod/warn";
import banCmd, { forcebanCmd, unbanCmd } from "../commands/mod/ban";
import kickCmd from "../commands/mod/kick";
import muteCmd, { unmuteCmd, forceMuteCmd, forceUnmuteCmd } from "../commands/mod/mute";
import purgeCmd from "../commands/mod/purge";
import slowmodeCmd from "../commands/mod/slowmode";
import tagCmd from "../commands/util/tag";
import userinfoCmd from "../commands/util/userinfo";
import helpCmd from "../commands/util/help";

const ALL_COMMANDS: Command[] = [
  warnCmd, forcewarnCmd,
  banCmd, forcebanCmd, unbanCmd,
  kickCmd,
  muteCmd, unmuteCmd, forceMuteCmd, forceUnmuteCmd,
  purgeCmd,
  slowmodeCmd,
  tagCmd,
  userinfoCmd,
  helpCmd,
];

/** name → Command (including built-in aliases) */
const REGISTRY = new Map<string, Command>();
for (const cmd of ALL_COMMANDS) {
  REGISTRY.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) {
    REGISTRY.set(alias, cmd);
  }
}

// ── Resolver ──────────────────────────────────────────────────────────────────

function resolveCommand(guildId: string, rawName: string): Command | null {
  const lower = rawName.toLowerCase();

  // 1. Direct match
  if (REGISTRY.has(lower)) return REGISTRY.get(lower)!;

  // 2. YAML config aliases  (plugins.command_aliases.config.aliases)
  const cfg = getCachedConfig(guildId);
  const yamlAliases = cfg.plugins.command_aliases?.config?.aliases ?? {};
  const resolved = yamlAliases[lower];
  if (resolved && REGISTRY.has(resolved)) return REGISTRY.get(resolved)!;

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function handleMessage(client: Client, message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const guildId = message.guild.id;

  // Ensure config is loaded (uses TTL cache so cheap after first load)
  const cfg = await getGuildConfig(guildId);
  const prefix = cfg.prefix ?? "!";

  // ── Automod (runs on every non-bot message) ────────────────────────────────
  const blocked = await runAutomod(client, message).catch((err) => {
    logger.warn({ err, guildId }, "Automod error");
    return false;
  });
  if (blocked) return;

  // ── Prefix check ──────────────────────────────────────────────────────────
  if (!message.content.startsWith(prefix)) return;

  const parts = message.content.slice(prefix.length).trim().split(/\s+/);
  const rawName = parts[0] ?? "";
  const args = parts.slice(1);

  if (!rawName) return;

  // ── Command lookup ────────────────────────────────────────────────────────
  const cmd = resolveCommand(guildId, rawName);

  if (cmd) {
    logger.debug({ guildId, command: cmd.name, userId: message.author.id }, "Executing command");
    try {
      await cmd.execute(message, args, client);
    } catch (err) {
      logger.error({ err, command: cmd.name, guildId }, "Command execution error");
      await message.reply("❌ An error occurred while running that command.").catch(() => {});
    }
    return;
  }

  // ── Tag fallback: !tagname ────────────────────────────────────────────────
  const tags = cfg.tags ?? {};
  const tagKey = rawName.toLowerCase();
  if (tags[tagKey]) {
    await message.channel
      .send(tags[tagKey]!.replace(/\{user\}/g, `<@${message.author.id}>`))
      .catch((err) => logger.warn({ err }, "Failed to send tag response"));
  }
}

import { Client, Message, TextChannel, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import { getPrefix } from "../store/prefixes";
import { getShortcut } from "../store/shortcuts";
import { memberHasModRole } from "../store/modroles";
import { getAlias } from "../store/aliases";
import { isGuildBlacklisted, isUserBlacklisted, OWNER_ID } from "../store/ownerBlacklists";
import { runAutomod } from "../lib/runAutomod";
import { isCommandDisabled } from "../store/disabledCommands";
import { checkCommandPerm } from "../store/commandPerms";
import { getCustomCommand } from "../store/customCommands";
import { getCachedConfig } from "../store/guildConfig";
import { getUserLevel, getRequiredLevel } from "../lib/yamlLevels";

// ── Cooldown tracker (in-memory, resets on restart) ──────────────────────────
// key: `cmdId:scope` where scope = userId | channelId | "global"
const cooldownMap = new Map<string, number>();

function checkCooldown(cmdId: string, type: string, scopeId: string, seconds: number): number {
  if (!seconds || seconds <= 0) return 0;
  const key = `${cmdId}:${type === "global" ? "global" : scopeId}`;
  const lastUsed = cooldownMap.get(key) ?? 0;
  const remaining = Math.ceil((lastUsed + seconds * 1000 - Date.now()) / 1000);
  if (remaining > 0) return remaining;
  cooldownMap.set(key, Date.now());
  return 0;
}

function resolveCustomCommandResponse(response: string, message: Message, args: string[]): string {
  const author = message.author;
  const member = message.member;
  const guild = message.guild!;
  const ch = message.channel as TextChannel;
  const now = Math.floor(Date.now() / 1000);

  // ── Caller (user) variables ───────────────────────────────────────────────
  const callerRoles = member
    ? [...member.roles.cache.values()].filter(r => r.name !== "@everyone")
    : [];
  const callerTopRole = callerRoles.sort((a, b) => b.position - a.position)[0];

  response = response.replace(/\{user\}/g, `<@${author.id}>`);
  response = response.replace(/\{user\.mention\}/g, `<@${author.id}>`);
  response = response.replace(/\{user\.name\}/g, author.username);
  response = response.replace(/\{user\.tag\}/g, author.tag ?? author.username);
  response = response.replace(/\{user\.id\}/g, author.id);
  response = response.replace(/\{user\.avatar\}/g, author.displayAvatarURL());
  response = response.replace(/\{user\.nickname\}/g, member?.nickname ?? author.username);
  response = response.replace(/\{user\.joinedAt\}/g, member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : "Unknown");
  response = response.replace(/\{user\.createdAt\}/g, `<t:${Math.floor(author.createdTimestamp / 1000)}:D>`);
  response = response.replace(/\{user\.roles\}/g, callerRoles.map(r => `<@&${r.id}>`).join(", ") || "None");
  response = response.replace(/\{user\.roleCount\}/g, String(callerRoles.length));
  response = response.replace(/\{user\.color\}/g, callerTopRole ? `#${callerTopRole.color.toString(16).padStart(6, "0")}` : "#000000");
  response = response.replace(/\{user\.topRole\}/g, callerTopRole ? `<@&${callerTopRole.id}>` : "None");

  // ── Targeted member ($N) variables ────────────────────────────────────────
  const mentionedUsers = [...message.mentions.users.values()];
  mentionedUsers.forEach((u, idx) => {
    const n = idx + 1;
    const m = guild.members.cache.get(u.id);
    const mRoles = m
      ? [...m.roles.cache.values()].filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position)
      : [];
    const mTopRole = mRoles[0];
    const rolesStr = mRoles.map(r => `<@&${r.id}>`).join(", ") || "None";

    // longer patterns first to avoid partial replacement
    response = response.replace(new RegExp(`\\{\\$${n}\\.roles\\}`, "g"), rolesStr);
    response = response.replace(new RegExp(`\\{\\$${n}\\.roleCount\\}`, "g"), String(mRoles.length));
    response = response.replace(new RegExp(`\\{\\$${n}\\.topRole\\}`, "g"), mTopRole ? `<@&${mTopRole.id}>` : "None");
    response = response.replace(new RegExp(`\\{\\$${n}\\.color\\}`, "g"), mTopRole ? `#${mTopRole.color.toString(16).padStart(6, "0")}` : "#000000");
    response = response.replace(new RegExp(`\\{\\$${n}\\.nickname\\}`, "g"), m?.nickname ?? u.username);
    response = response.replace(new RegExp(`\\{\\$${n}\\.name\\}`, "g"), u.username);
    response = response.replace(new RegExp(`\\{\\$${n}\\.tag\\}`, "g"), u.tag ?? u.username);
    response = response.replace(new RegExp(`\\{\\$${n}\\.id\\}`, "g"), u.id);
    response = response.replace(new RegExp(`\\{\\$${n}\\.avatar\\}`, "g"), u.displayAvatarURL());
    response = response.replace(new RegExp(`\\{\\$${n}\\.joinedAt\\}`, "g"), m?.joinedAt ? `<t:${Math.floor(m.joinedAt.getTime() / 1000)}:D>` : "Unknown");
    response = response.replace(new RegExp(`\\{\\$${n}\\.createdAt\\}`, "g"), `<t:${Math.floor(u.createdTimestamp / 1000)}:D>`);
    response = response.replace(new RegExp(`\\{\\$${n}\\}`, "g"), `<@${u.id}>`);
  });

  // ── Channel variables ─────────────────────────────────────────────────────
  response = response.replace(/\{channel\}/g, `<#${ch.id}>`);
  response = response.replace(/\{channel\.mention\}/g, `<#${ch.id}>`);
  response = response.replace(/\{channel\.name\}/g, ch.name ?? "unknown");
  response = response.replace(/\{channel\.id\}/g, ch.id);
  response = response.replace(/\{channel\.topic\}/g, (ch as any).topic ?? "");
  response = response.replace(/\{channel\.position\}/g, String((ch as any).position ?? 0));

  // ── Server variables ──────────────────────────────────────────────────────
  response = response.replace(/\{server\}/g, guild.name);
  response = response.replace(/\{server\.name\}/g, guild.name);
  response = response.replace(/\{server\.id\}/g, guild.id);
  response = response.replace(/\{server\.icon\}/g, guild.iconURL() ?? "");
  response = response.replace(/\{server\.memberCount\}/g, String(guild.memberCount));
  response = response.replace(/\{server\.roleCount\}/g, String(guild.roles.cache.size));
  response = response.replace(/\{server\.channelCount\}/g, String(guild.channels.cache.size));
  response = response.replace(/\{server\.emojiCount\}/g, String(guild.emojis.cache.size));
  response = response.replace(/\{server\.boostCount\}/g, String(guild.premiumSubscriptionCount ?? 0));
  response = response.replace(/\{server\.boostLevel\}/g, String(guild.premiumTier));
  response = response.replace(/\{server\.owner\}/g, `<@${guild.ownerId}>`);
  response = response.replace(/\{server\.ownerId\}/g, guild.ownerId);
  response = response.replace(/\{server\.createdAt\}/g, `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`);
  response = response.replace(/\{server\.description\}/g, guild.description ?? "");
  response = response.replace(/\{server\.vanity\}/g, guild.vanityURLCode ?? "None");

  // ── Time / date variables ─────────────────────────────────────────────────
  response = response.replace(/\{unix\}/g, String(now));
  response = response.replace(/\{date\}/g, `<t:${now}:D>`);
  response = response.replace(/\{time\}/g, `<t:${now}:T>`);
  response = response.replace(/\{datetime\}/g, `<t:${now}:f>`);
  response = response.replace(/\{relative\}/g, `<t:${now}:R>`);

  // ── Text manipulation: {upper:text}, {lower:text}, {length:text}, {repeat:text;N} ──
  response = response.replace(/\{upper:([^}]*)\}/g, (_, t: string) => t.toUpperCase());
  response = response.replace(/\{lower:([^}]*)\}/g, (_, t: string) => t.toLowerCase());
  response = response.replace(/\{length:([^}]*)\}/g, (_, t: string) => String(t.length));
  response = response.replace(/\{repeat:([^;]*);(\d+)\}/g, (_, t: string, n: string) =>
    t.repeat(Math.min(Number(n), 20)));
  response = response.replace(/\{trim:([^}]*)\}/g, (_, t: string) => t.trim());

  // ── Math: {math:expression} ───────────────────────────────────────────────
  response = response.replace(/\{math:([^}]+)\}/g, (_, expr: string) => {
    try {
      // Allow only safe characters: digits, operators, spaces, dots, parens
      if (!/^[\d\s+\-*/().%]+$/.test(expr)) return "[invalid math]";
      const result = Function(`"use strict"; return (${expr})`)();
      return typeof result === "number" ? String(parseFloat(result.toFixed(6))) : "[invalid math]";
    } catch { return "[invalid math]"; }
  });

  // ── Random number: {random:min;max} ──────────────────────────────────────
  response = response.replace(/\{random:(\d+);(\d+)\}/g, (_, min: string, max: string) =>
    String(Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min)));

  // ── Choose: {choose:a;b;c} picks one at random ───────────────────────────
  response = response.replace(/\{choose:([^}]+)\}/g, (_, items: string) => {
    const list = items.split(";").map((s: string) => s.trim()).filter(Boolean);
    return list[Math.floor(Math.random() * list.length)] ?? "";
  });

  // ── Input arguments — process $N+ before $N to avoid partial matches ──────
  response = response.replace(/\$\*/g, args.join(" "));
  response = response.replace(/\$(\d+)\+/g, (_, n: string) => args.slice(Number(n) - 1).join(" "));
  response = response.replace(/\$(\d+)/g, (_, n: string) => args[Number(n) - 1] ?? "");

  return response;
}

export function registerMessageHandler(client: Client) {
  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;

    // ── DM handler: only the backup command is allowed in DMs ────────────────
    if (!message.guild) {
      const DEFAULT_PREFIX = ">";
      if (!message.content.startsWith(DEFAULT_PREFIX)) return;
      const dmArgs = message.content.slice(DEFAULT_PREFIX.length).trim().split(/\s+/);
      const dmCommandName = dmArgs.shift()?.toLowerCase();
      if (dmCommandName !== "backup" && dmCommandName !== "bk") return;
      const backupCmd = (client as any).commands?.get("backup");
      if (!backupCmd) return;
      try {
        await backupCmd.execute(message, dmArgs);
      } catch (err) {
        logger.error({ err }, "DM backup command failed");
        await message.reply("❌ An error occurred.").catch(() => {});
      }
      return;
    }

    // Owner blacklist checks (owner is never blocked)
    if (message.author.id !== OWNER_ID) {
      if (isGuildBlacklisted(message.guild.id)) return;
      if (isUserBlacklisted(message.author.id)) return;
    }

    const guildId = message.guild.id;
    const guildCfg = getCachedConfig(guildId);
    const yamlPrefix = guildCfg.prefix;
    const dbPrefix = getPrefix(guildId);
    const isCommand = message.content.startsWith(yamlPrefix) || message.content.startsWith(dbPrefix);
    const prefix = message.content.startsWith(yamlPrefix) ? yamlPrefix : dbPrefix;

    // ── AutoMod (non-command messages only) ──────────────────────────────────
    if (!isCommand) {
      const triggered = await runAutomod(client, message);
      if (triggered) return;
    }

    // Non-command messages stop here
    if (!isCommand) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    let command = (client as any).commands?.get(commandName);
    let commandArgs = args;

    // ── YAML aliases (take priority over DB aliases) ──────────────────────────
    if (!command) {
      const yamlAliases = getCachedConfig(guildId).plugins?.command_aliases?.config?.aliases ?? {};
      const yamlAlias = yamlAliases[commandName];
      if (yamlAlias) command = (client as any).commands?.get(yamlAlias);
    }

    // ── DB aliases ────────────────────────────────────────────────────────────
    if (!command) {
      const customAlias = getAlias(guildId, commandName);
      if (customAlias) {
        command = (client as any).commands?.get(customAlias);
      }
    }

    if (!command) {
      const shortcut = getShortcut(guildId, commandName);
      if (shortcut) {
        command = (client as any).commands?.get(shortcut.type);
        const reasonWords = shortcut.reason.split(" ");
        if (shortcut.type === "mute") {
          commandArgs = shortcut.duration
            ? [args[0]!, shortcut.duration, ...reasonWords, ...args.slice(1)]
            : [args[0]!, ...reasonWords, ...args.slice(1)];
        } else if (shortcut.type === "ban" && shortcut.duration) {
          commandArgs = [args[0]!, shortcut.duration, ...reasonWords, ...args.slice(1)];
        } else {
          commandArgs = [args[0]!, ...reasonWords, ...args.slice(1)];
        }
      }
    }

    // ── Resolve $preset tokens in args (YAML preset_reasons) ─────────────────
    // e.g. "!ban @user $spam" → reason becomes "Spamming in chat"
    {
      const presets = getCachedConfig(guildId).plugins?.preset_reasons?.config?.presets ?? {};
      if (Object.keys(presets).length > 0) {
        commandArgs = commandArgs.map((arg) => {
          if (arg.startsWith("$")) {
            const key = arg.slice(1);
            return (presets as Record<string, string>)[key] ?? arg;
          }
          return arg;
        });
      }
    }

    // ── Custom commands ───────────────────────────────────────────────────────
    if (!command) {
      const customCmd = getCustomCommand(guildId, commandName);
      if (customCmd) {
        const channelId = message.channel.id;
        const memberRoleIds = message.member ? [...message.member.roles.cache.keys()] : [];

        // Blocked channels / roles → silently ignore
        if ((customCmd.blockedChannels ?? []).includes(channelId)) return;
        if ((customCmd.blockedRoles ?? []).some((r: string) => memberRoleIds.includes(r))) return;

        // Allowed channels whitelist (if set, channel must be in the list)
        if ((customCmd.allowedChannels ?? []).length > 0 && !(customCmd.allowedChannels ?? []).includes(channelId)) return;

        // Allowed roles whitelist (if set, member must have at least one)
        if ((customCmd.allowedRoles ?? []).length > 0 && !(customCmd.allowedRoles ?? []).some((r: string) => memberRoleIds.includes(r))) return;

        // Cooldown check
        const cdSeconds = customCmd.cooldown ?? 0;
        if (cdSeconds > 0) {
          const cdType = customCmd.cooldownType ?? "user";
          const scopeId = cdType === "user" ? message.author.id : cdType === "channel" ? channelId : "global";
          const remaining = checkCooldown(customCmd.id, cdType, scopeId, cdSeconds);
          if (remaining > 0) {
            await message.reply(`⏳ This command is on cooldown. Try again in **${remaining}s**.`).catch(() => {});
            return;
          }
        }

        let resolved = resolveCustomCommandResponse(customCmd.response, message, commandArgs);

        // {silent} — delete the triggering message then send the response
        const silent = resolved.includes("{silent}");
        resolved = resolved.replace(/\{silent\}/g, "").trim();
        if (silent) await message.delete().catch(() => {});

        const embedCfg = customCmd.embed;
        if (embedCfg?.enabled) {
          const embed = new EmbedBuilder();
          if (embedCfg.color) {
            const hex = parseInt(embedCfg.color.replace("#", ""), 16);
            if (!isNaN(hex)) embed.setColor(hex);
          }
          if (embedCfg.author) embed.setAuthor({ name: resolveCustomCommandResponse(embedCfg.author, message, commandArgs) });
          if (embedCfg.title) embed.setTitle(resolveCustomCommandResponse(embedCfg.title, message, commandArgs));
          if (embedCfg.description) embed.setDescription(resolveCustomCommandResponse(embedCfg.description, message, commandArgs));
          if (embedCfg.footer) embed.setFooter({ text: resolveCustomCommandResponse(embedCfg.footer, message, commandArgs) });
          if (embedCfg.imageUrl) embed.setImage(embedCfg.imageUrl);
          if (embedCfg.thumbnailUrl) embed.setThumbnail(embedCfg.thumbnailUrl);
          const content = resolved || undefined;
          await message.channel.send({ content, embeds: [embed] }).catch(() => {});
        } else {
          if (resolved) await message.channel.send(resolved).catch(() => {});
        }
        return;
      }
      return;
    }

    // ── Dashboard: disabled commands check ───────────────────────────────────
    if (isCommandDisabled(guildId, command.name)) {
      await message.reply("❌ This command has been disabled in this server.").catch(() => {});
      return;
    }

    // Owner-only guard
    if (command.ownerOnly && message.author.id !== OWNER_ID) return;

    // ── YAML level check ──────────────────────────────────────────────────────
    // If the user's YAML level meets the command requirement, bypass Discord
    // permission checks entirely. Otherwise fall through to the existing system.
    const userYamlLevel = getUserLevel(message);
    const requiredYamlLevel = getRequiredLevel(guildId, command.name);
    const yamlLevelPasses = userYamlLevel >= requiredYamlLevel;

    if (command.requiredPermissions?.length > 0 && message.guild && !yamlLevelPasses) {
      const member = message.member;
      if (!member) return;

      const memberRoleIds = [...member.roles.cache.keys()];
      const hasModRole = memberHasModRole(guildId, memberRoleIds);

      // ── Dashboard: command role/channel permissions ───────────────────────
      if (!hasModRole && !member.permissions.has(8n)) {
        const allowed = checkCommandPerm(
          guildId,
          command.name,
          memberRoleIds,
          message.channelId
        );
        if (!allowed) return;
      }

      if (!hasModRole) {
        const missing = command.requiredPermissions.filter(
          (perm: bigint) => !member.permissions.has(perm)
        );
        if (missing.length > 0) {
          return;
        }
      }
    }

    try {
      await command.execute(message, commandArgs);
    } catch (err) {
      logger.error({ err, commandName }, "Command execution failed");
      await message.reply("❌ An error occurred while running this command.").catch(() => {});
    }
  });
}

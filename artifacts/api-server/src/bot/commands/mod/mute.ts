import { Client, Message } from "discord.js";
import type { Command } from "../types";
import { resolveTarget, getArgs } from "../../lib/resolveUser";
import { checkYamlLevelAsync } from "../../lib/yamlLevels";
import { getCachedConfig } from "../../store/guildConfig";
import { nextCaseId } from "../../lib/cases";
import { buildPayload } from "../../lib/msgTemplate";
import { sendDmNotification } from "../../lib/dmNotify";
import { sendModLog } from "../../lib/modlog";
import { getExecutorMember, isHierarchyBlocked } from "../../lib/hierarchy";
import { parseDuration, formatDuration } from "../../lib/parseDuration";

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord limit: 28 days

function resolveReason(guildId: string, rawReason: string): string {
  if (!rawReason) return "No reason provided";
  const presets = getCachedConfig(guildId).plugins.preset_reasons?.config?.presets ?? {};
  return presets[rawReason] ?? rawReason;
}

const muteCmd: Command = {
  name: "mute",
  aliases: ["m"],
  usage: "@user [duration] [reason]",
  description: "Mute a member. Uses mute_role if configured, otherwise Discord timeout.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "mute"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const target = await resolveTarget(message, args);
    if (!target) return void message.reply("❌ Could not find that user.");
    if (!target.member) return void message.reply("❌ That user is not in this server.");
    if (target.user.id === message.author.id) return void message.reply("❌ You cannot mute yourself.");
    if (!target.member.moderatable) return void message.reply("❌ I cannot mute that member — they may have a higher role than me.");

    const executor = await getExecutorMember(message);
    if (executor && isHierarchyBlocked(executor, target.member)) {
      return void message.reply("❌ You cannot mute someone with an equal or higher role.");
    }

    const remaining = getArgs(message, args);
    let durationMs: number | null = null;
    let durationLabel = "Indefinite";

    if (remaining[0]) {
      const parsed = parseDuration(remaining[0]!);
      if (parsed !== null) {
        durationMs = Math.min(parsed, MAX_TIMEOUT_MS);
        durationLabel = formatDuration(durationMs);
        remaining.shift();
      }
    }

    const rawReason = remaining.join(" ");
    const reason = resolveReason(message.guild.id, rawReason);
    const caseId = await nextCaseId(message.guild.id);
    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const cfg = getCachedConfig(message.guild.id);
    const modCfg = cfg.plugins.moderation ?? {};
    const muteRole = (modCfg as any).mute_role as string | null | undefined;

    if (muteRole) {
      await target.member.roles.add(muteRole, reason);
    } else {
      await target.member.timeout(durationMs ?? MAX_TIMEOUT_MS, reason);
    }

    const msgs = (modCfg as any).messages ?? {};
    const vars = {
      user: target.user.tag,
      "user.mention": `<@${target.user.id}>`,
      "user.id": target.user.id,
      "user.name": target.user.username,
      mod: message.author.tag,
      "mod.mention": `<@${message.author.id}>`,
      "mod.id": message.author.id,
      reason,
      duration: durationLabel,
      case_id: caseId,
      expires_at: expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:F>` : "Never",
      timestamp: new Date().toLocaleString(),
      server: message.guild.name,
    };

    if ((modCfg as any).dm_on_action !== false) {
      await sendDmNotification(target.user, {
        action: "Muted",
        guildName: message.guild.name,
        reason,
        caseId: String(caseId),
        duration: durationLabel,
        expiresAt: expiresAt ?? undefined,
      });
    }

    await sendModLog(client, message.guild.id, {
      action: `Mute${durationMs ? ` (${durationLabel})` : ""}`,
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.user.tag, id: target.user.id },
      reason,
      color: 0xf39c12,
      caseId: String(caseId),
    });

    const payload = buildPayload(
      msgs.mute_success,
      vars,
      `🔇 **${target.user.tag}** has been muted${durationMs ? ` for ${durationLabel}` : ""}. Case: #${caseId}`
    );
    await message.channel.send(payload);
  },
};

export const unmuteCmd: Command = {
  name: "unmute",
  aliases: ["um"],
  usage: "@user [reason]",
  description: "Unmute a member.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "unmute"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const target = await resolveTarget(message, args);
    if (!target) return void message.reply("❌ Could not find that user.");
    if (!target.member) return void message.reply("❌ That user is not in this server.");

    const rawReason = getArgs(message, args).join(" ");
    const reason = rawReason || "No reason provided";
    const caseId = await nextCaseId(message.guild.id);

    const cfg = getCachedConfig(message.guild.id);
    const modCfg = cfg.plugins.moderation ?? {};
    const muteRole = (modCfg as any).mute_role as string | null | undefined;

    if (muteRole) {
      await target.member.roles.remove(muteRole, reason);
    } else {
      await target.member.timeout(null, reason);
    }

    const msgs = (modCfg as any).messages ?? {};
    const vars = {
      user: target.user.tag,
      "user.mention": `<@${target.user.id}>`,
      "user.id": target.user.id,
      mod: message.author.tag,
      reason,
      case_id: caseId,
    };

    if ((modCfg as any).dm_on_action !== false) {
      await sendDmNotification(target.user, {
        action: "Unmuted",
        guildName: message.guild.name,
        reason,
        caseId: String(caseId),
      });
    }

    await sendModLog(client, message.guild.id, {
      action: "Unmute",
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.user.tag, id: target.user.id },
      reason,
      color: 0x2ecc71,
      caseId: String(caseId),
    });

    const payload = buildPayload(
      msgs.unmute_success,
      vars,
      `🔊 **${target.user.tag}** has been unmuted. Case: #${caseId}`
    );
    await message.channel.send(payload);
  },
};

export const forceMuteCmd: Command = {
  name: "forcemute",
  aliases: ["fm"],
  usage: "<user_id> [duration] [reason]",
  description: "Mute a user by ID.",
  async execute(message: Message, args: string[], client: Client) {
    if (!(await checkYamlLevelAsync(message, "forcemute"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }
    await muteCmd.execute(message, args, client);
  },
};

export const forceUnmuteCmd: Command = {
  name: "forceunmute",
  aliases: ["fum"],
  usage: "<user_id> [reason]",
  description: "Unmute a user by ID.",
  async execute(message: Message, args: string[], client: Client) {
    if (!(await checkYamlLevelAsync(message, "forceunmute"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }
    await unmuteCmd.execute(message, args, client);
  },
};

export default muteCmd;

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

function resolveReason(guildId: string, rawReason: string): string {
  if (!rawReason) return "No reason provided";
  const presets = getCachedConfig(guildId).plugins.preset_reasons?.config?.presets ?? {};
  return presets[rawReason] ?? rawReason;
}

const banCmd: Command = {
  name: "ban",
  aliases: ["b"],
  usage: "@user [duration] [reason]",
  description: "Ban a member. Include a duration (e.g. 7d) for a temp ban.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "ban"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const target = await resolveTarget(message, args);
    if (!target) return void message.reply("❌ Could not find that user.");
    if (target.user.id === message.author.id) return void message.reply("❌ You cannot ban yourself.");
    if (target.user.id === client.user?.id) return void message.reply("❌ I cannot ban myself.");

    if (target.member) {
      if (!target.member.bannable) return void message.reply("❌ I cannot ban that member — they may have a higher role than me.");
      const executor = await getExecutorMember(message);
      if (executor && isHierarchyBlocked(executor, target.member)) {
        return void message.reply("❌ You cannot ban someone with an equal or higher role.");
      }
    }

    const remaining = getArgs(message, args);
    let durationMs: number | null = null;
    let durationLabel = "Permanent";

    if (remaining[0]) {
      const parsed = parseDuration(remaining[0]!);
      if (parsed !== null) {
        durationMs = parsed;
        durationLabel = formatDuration(parsed);
        remaining.shift();
      }
    }

    const rawReason = remaining.join(" ");
    const reason = resolveReason(message.guild.id, rawReason);
    const caseId = await nextCaseId(message.guild.id);
    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const cfg = getCachedConfig(message.guild.id);
    const modCfg = cfg.plugins.moderation ?? {};
    const msgs = (modCfg as any).messages ?? {};

    const vars = {
      user: target.user.tag,
      "user.mention": `<@${target.user.id}>`,
      "user.id": target.user.id,
      "user.name": target.user.username,
      mod: message.author.tag,
      "mod.mention": `<@${message.author.id}>`,
      "mod.id": message.author.id,
      "mod.name": message.author.username,
      reason,
      duration: durationLabel,
      case_id: caseId,
      expires_at: expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:F>` : "Never",
      timestamp: new Date().toLocaleString(),
      server: message.guild.name,
    };

    if ((modCfg as any).dm_on_action !== false) {
      await sendDmNotification(target.user, {
        action: "Banned",
        guildName: message.guild.name,
        reason,
        caseId: String(caseId),
        duration: durationLabel,
        expiresAt: expiresAt ?? undefined,
      });
    }

    await message.guild.members.ban(target.user.id, { reason: `[Case #${caseId}] ${reason}` });

    if (durationMs) {
      setTimeout(async () => {
        await message.guild!.members.unban(target.user.id, "Temp ban expired").catch(() => {});
      }, durationMs);
    }

    await sendModLog(client, message.guild.id, {
      action: durationMs ? `Temp Ban (${durationLabel})` : "Ban",
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.user.tag, id: target.user.id },
      reason,
      color: 0xe74c3c,
      caseId: String(caseId),
    });

    const payload = buildPayload(
      msgs.ban_success,
      vars,
      `🔨 **${target.user.tag}** has been banned${durationMs ? ` for ${durationLabel}` : ""}. Case: #${caseId}`
    );
    await message.channel.send(payload);
  },
};

export const forcebanCmd: Command = {
  name: "forceban",
  aliases: ["fb"],
  usage: "<user_id> [duration] [reason]",
  description: "Ban a user by ID — works even if they are not in the server.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "forceban"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }
    await banCmd.execute(message, args, client);
  },
};

export const unbanCmd: Command = {
  name: "unban",
  aliases: ["ub"],
  usage: "<user_id> [reason]",
  description: "Unban a user by ID.",
  async execute(message: Message, args: string[], _client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "unban"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const rawId = (args[0] ?? "").replace(/[<@!>]/g, "");
    if (!/^\d{15,20}$/.test(rawId)) return void message.reply("❌ Please provide a valid user ID.");

    const reason = args.slice(1).join(" ") || "No reason provided";
    const caseId = await nextCaseId(message.guild.id);

    let userTag = rawId;
    try {
      const u = await message.client.users.fetch(rawId);
      userTag = u.tag;
    } catch { /* unknown user */ }

    await message.guild.members.unban(rawId, reason).catch(() => {
      throw new Error("Could not unban — user may not be banned.");
    });

    await sendModLog(_client, message.guild.id, {
      action: "Unban",
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: userTag, id: rawId },
      reason,
      color: 0x2ecc71,
      caseId: String(caseId),
    });

    const cfg = getCachedConfig(message.guild.id);
    const msgs = (cfg.plugins.moderation as any)?.messages ?? {};
    const vars = {
      user: userTag,
      "user.mention": `<@${rawId}>`,
      "user.id": rawId,
      mod: message.author.tag,
      reason,
      case_id: caseId,
    };

    const payload = buildPayload(msgs.unban_success, vars, `✅ **${userTag}** has been unbanned. Case: #${caseId}`);
    await message.channel.send(payload);
  },
};

export default banCmd;

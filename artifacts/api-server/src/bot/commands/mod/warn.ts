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

function resolveReason(guildId: string, rawReason: string): string {
  if (!rawReason) return "No reason provided";
  const presets = getCachedConfig(guildId).plugins.preset_reasons?.config?.presets ?? {};
  return presets[rawReason] ?? rawReason;
}

const warnCmd: Command = {
  name: "warn",
  aliases: ["w"],
  usage: "@user [reason]",
  description: "Warn a member.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "warn"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const target = await resolveTarget(message, args);
    if (!target) return void message.reply("❌ Could not find that user.");
    if (target.user.id === message.author.id) return void message.reply("❌ You cannot warn yourself.");
    if (target.user.bot) return void message.reply("❌ You cannot warn a bot.");

    if (target.member) {
      const executor = await getExecutorMember(message);
      if (executor && isHierarchyBlocked(executor, target.member)) {
        return void message.reply("❌ You cannot warn someone with an equal or higher role.");
      }
    }

    const rawReason = getArgs(message, args).join(" ");
    const reason = resolveReason(message.guild.id, rawReason);
    const caseId = await nextCaseId(message.guild.id);

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
      case_id: caseId,
      count: "1",
      timestamp: new Date().toLocaleString(),
      server: message.guild.name,
    };

    if ((modCfg as any).dm_on_action !== false && target.user) {
      await sendDmNotification(target.user, {
        action: "Warned",
        guildName: message.guild.name,
        reason,
        caseId: String(caseId),
      });
    }

    await sendModLog(client, message.guild.id, {
      action: "Warn",
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.user.tag, id: target.user.id },
      reason,
      color: 0xf1c40f,
      caseId: String(caseId),
    });

    const payload = buildPayload(
      msgs.warn_success,
      vars,
      `⚠️ **${target.user.tag}** has been warned. Case: #${caseId}`
    );
    await message.channel.send(payload);
  },
};

export const forcewarnCmd: Command = {
  name: "forcewarn",
  aliases: ["fw"],
  usage: "<user_id> [reason]",
  description: "Warn a user by ID (works even if not in server).",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "forcewarn"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }
    await warnCmd.execute(message, args, client);
  },
};

export default warnCmd;

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

const kickCmd: Command = {
  name: "kick",
  aliases: ["k"],
  usage: "@user [reason]",
  description: "Kick a member from the server.",
  async execute(message: Message, args: string[], client: Client) {
    if (!message.guild) return;
    if (!(await checkYamlLevelAsync(message, "kick"))) {
      return void message.reply("❌ You don't have permission to use this command.");
    }

    const target = await resolveTarget(message, args);
    if (!target) return void message.reply("❌ Could not find that user.");
    if (!target.member) return void message.reply("❌ That user is not in this server.");
    if (!target.member.kickable) return void message.reply("❌ I cannot kick that member — they may have a higher role than me.");
    if (target.user.id === message.author.id) return void message.reply("❌ You cannot kick yourself.");

    const executor = await getExecutorMember(message);
    if (executor && isHierarchyBlocked(executor, target.member)) {
      return void message.reply("❌ You cannot kick someone with an equal or higher role.");
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
      timestamp: new Date().toLocaleString(),
      server: message.guild.name,
    };

    if ((modCfg as any).dm_on_action !== false) {
      await sendDmNotification(target.user, {
        action: "Kicked",
        guildName: message.guild.name,
        reason,
        caseId: String(caseId),
      });
    }

    await target.member.kick(reason);

    await sendModLog(client, message.guild.id, {
      action: "Kick",
      executor: { tag: message.author.tag, id: message.author.id },
      target: { tag: target.user.tag, id: target.user.id },
      reason,
      color: 0xe67e22,
      caseId: String(caseId),
    });

    const payload = buildPayload(
      msgs.kick_success,
      vars,
      `👢 **${target.user.tag}** has been kicked. Case: #${caseId}`
    );
    await message.channel.send(payload);
  },
};

export default kickCmd;

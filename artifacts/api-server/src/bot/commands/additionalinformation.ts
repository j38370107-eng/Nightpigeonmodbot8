import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getAdditionalInfoConfig,
  getAdditionalInfo,
  setAdditionalInfo,
  clearAdditionalInfo,
  PUNISHMENT_TYPES,
  type PunishmentType,
} from "../store/additionalInfo";
import { buildDmEmbed } from "../lib/dmNotify";

const TYPE_LABELS: Record<PunishmentType, string> = {
  warn: "Warn",
  mute: "Mute",
  kick: "Kick",
  ban: "Ban",
};

export const additionalInformationCommand: Command = {
  name: "additionalinformation",
  aliases: ["addinfo", "ai", "punishinfo"],
  description: "Set a custom message appended to DMs for each punishment type",
  usage: "<warn|mute|kick|ban> <message> | view | clear <warn|mute|kick|ban>",
  requiredPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === "view") {
      const cfg = getAdditionalInfoConfig(guildId);
      const lines = PUNISHMENT_TYPES.map((t) => {
        const val = cfg[t];
        return `**${TYPE_LABELS[t]}** — ${val ? `"${val}"` : "*not set*"}`;
      });
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Punishment Additional Information")
        .setDescription(
          "These messages are automatically added to DMs when members are punished.\n\n" +
            lines.join("\n")
        );
      return message.reply({ embeds: [embed] });
    }

    if (sub === "clear") {
      const type = args[1]?.toLowerCase() as PunishmentType | undefined;
      if (!type || !PUNISHMENT_TYPES.includes(type)) {
        return message.reply(usageErr(message, additionalInformationCommand, "Specify a type to clear: warn, mute, kick, or ban"));
      }
      const ok = clearAdditionalInfo(guildId, type);
      return message.reply(
        ok
          ? `✅ Cleared additional information for **${TYPE_LABELS[type]}**.`
          : `❌ No additional information was set for **${TYPE_LABELS[type]}**.`
      );
    }

    if (sub === "test") {
      const type = args[1]?.toLowerCase() as PunishmentType | undefined;
      if (!type || !PUNISHMENT_TYPES.includes(type)) {
        return message.reply(usageErr(message, additionalInformationCommand, "Specify a type to preview: warn, mute, kick, or ban"));
      }

      const ACTION_MAP: Record<PunishmentType, "Warned" | "Muted" | "Kicked" | "Banned"> = {
        warn: "Warned",
        mute: "Muted",
        kick: "Kicked",
        ban: "Banned",
      };

      const additionalInfo = getAdditionalInfo(guildId, type);
      const guildName = message.guild.name;

      const previewEmbed = buildDmEmbed(
        {
          action: ACTION_MAP[type],
          guildName,
          reason: "This is a preview — no action was taken.",
          additionalInfo,
          ...(type === "mute" ? { duration: "10 minutes", expiresAt: Date.now() + 600_000 } : {}),
          ...(type === "ban" ? { description: false as unknown as string } : {}),
          caseId: "PREVIEW",
        },
        guildName
      );

      const wrapperEmbed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setDescription(
          `📬 **DM Preview — ${TYPE_LABELS[type]}**\n` +
            (additionalInfo
              ? `Additional info: *"${additionalInfo}"*`
              : `⚠️ No additional information set for **${TYPE_LABELS[type]}**. Use \`>addinfo ${type} <message>\` to set one.`)
        );

      try {
        await message.author.send({ embeds: [wrapperEmbed, previewEmbed] });
        return message.reply(`✅ Preview sent to your DMs! Check what the **${TYPE_LABELS[type]}** DM looks like.`);
      } catch {
        return message.reply("❌ Couldn't send you a DM — please check your privacy settings.");
      }
    }

    if (PUNISHMENT_TYPES.includes(sub as PunishmentType)) {
      const type = sub as PunishmentType;
      const text = args.slice(1).join(" ").trim();
      if (!text) {
        return message.reply(usageErr(message, additionalInformationCommand, "Provide a message to set"));
      }
      setAdditionalInfo(guildId, type, text);
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✅ Additional Information Set — ${TYPE_LABELS[type]}`)
        .setDescription(`**"${text}"**\n\nThis will be included in DMs whenever a member is ${type === "warn" ? "warned" : type === "mute" ? "muted" : type === "kick" ? "kicked" : "banned"}.`);
      return message.reply({ embeds: [embed] });
    }

    return message.reply(usageErr(message, additionalInformationCommand, "Invalid subcommand — use view, warn|mute|kick|ban <message>, test, or clear"));
  },
};

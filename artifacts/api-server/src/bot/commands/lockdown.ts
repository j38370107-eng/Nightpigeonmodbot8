import { Message, PermissionFlagsBits, ChannelType, EmbedBuilder } from "discord.js";
import { logger } from "../../lib/logger";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { sendModLog } from "../lib/modlog";
import {
  getLockdownChannels,
  addLockdownChannel,
  removeLockdownChannel,
} from "../store/lockdown";

/** Returns true if the channel is a voice or stage channel */
function isVoiceChannel(type: number): boolean {
  // 2 = GuildVoice, 13 = GuildStageVoice
  return type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice;
}

export const lockdownCommand: Command = {
  name: "lockdown",
  aliases: ["ld"],
  description: "Lock or unlock all configured channels at once",
  usage: "[end] [reason] | add <#channel or voice channel ID> | remove <#channel> | list",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const channels = getLockdownChannels(guildId);
      if (!channels.length) {
        return message.reply("No channels configured for lockdown. Use `>lockdown add #channel` to add one.");
      }
      const list = channels.map((id) => `<#${id}>`).join("\n");
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🔒 Lockdown Channels")
        .setDescription(list)
        .setFooter({ text: `${channels.length} channel${channels.length === 1 ? "" : "s"}` });
      return message.reply({ embeds: [embed] });
    }

    // ── add ──────────────────────────────────────────────────────────────────
    if (sub === "add") {
      const channel =
        message.mentions.channels.first() ??
        (args[1] ? message.guild.channels.cache.get(args[1]) : null);

      if (!channel || !("permissionOverwrites" in channel)) {
        return message.reply(usageErr(message, lockdownCommand, "Mention or provide the ID of a text or voice channel"));
      }

      const added = addLockdownChannel(guildId, channel.id);
      const icon = isVoiceChannel(channel.type) ? "🔊" : "#";
      return message.reply(
        added
          ? `✅ ${icon}${channel.name} added to the lockdown list.`
          : `❌ ${icon}${channel.name} is already in the lockdown list.`
      );
    }

    // ── remove ───────────────────────────────────────────────────────────────
    if (sub === "remove") {
      const channel =
        message.mentions.channels.first() ??
        (args[1] ? message.guild.channels.cache.get(args[1]) : null);

      if (!channel) {
        return message.reply(usageErr(message, lockdownCommand, "Mention or provide the ID of a text or voice channel"));
      }

      const removed = removeLockdownChannel(guildId, channel.id);
      return message.reply(
        removed
          ? `✅ <#${channel.id}> removed from the lockdown list.`
          : `❌ <#${channel.id}> is not in the lockdown list.`
      );
    }

    // ── end (lift lockdown) ───────────────────────────────────────────────────
    if (sub === "end") {
      const reason = args.slice(1).join(" ") || "Lockdown lifted";
      const channelIds = getLockdownChannels(guildId);

      if (!channelIds.length) {
        return message.reply("❌ No channels are configured for lockdown. Use `>lockdown add #channel` first.");
      }

      const results: string[] = [];
      for (const id of channelIds) {
        try {
          const ch = await message.guild.channels.fetch(id).catch(() => null);
          if (!ch || !("permissionOverwrites" in ch)) continue;
          if (isVoiceChannel(ch.type)) {
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: null });
          } else {
            await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
          }
          results.push(`✅ <#${id}>`);
        } catch {
          results.push(`❌ <#${id}> (failed)`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🔓 Lockdown Lifted")
        .addFields(
          { name: "Moderator", value: `<@${message.author.id}>`, inline: true },
          { name: "Reason", value: reason },
          { name: "Channels", value: results.join("\n") || "None" }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      await sendModLog(message.client, guildId, {
        action: "Lockdown Lifted",
        executor: { tag: message.author.tag, id: message.author.id },
        reason,
        color: 0x2ecc71,
      });

      logger.info({ guildId, reason, count: channelIds.length }, "Lockdown lifted");
      return;
    }

    // ── start lockdown (default) ──────────────────────────────────────────────
    const reason = args.join(" ") || "No reason provided";
    const channelIds = getLockdownChannels(guildId);

    if (!channelIds.length) {
      return message.reply("❌ No channels are configured for lockdown. Use `>lockdown add #channel` first.");
    }

    const results: string[] = [];
    for (const id of channelIds) {
      try {
        const ch = await message.guild.channels.fetch(id).catch(() => null);
        if (!ch || !("permissionOverwrites" in ch)) continue;
        if (isVoiceChannel(ch.type)) {
          await ch.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
        } else {
          await ch.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        }
        results.push(`✅ <#${id}>`);
      } catch {
        results.push(`❌ <#${id}> (failed)`);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("🔒 Server Lockdown")
      .addFields(
        { name: "Moderator", value: `<@${message.author.id}>`, inline: true },
        { name: "Reason", value: reason },
        { name: "Channels", value: results.join("\n") || "None" }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    await sendModLog(message.client, guildId, {
      action: "Server Lockdown",
      executor: { tag: message.author.tag, id: message.author.id },
      reason,
      color: 0xe74c3c,
    });

    logger.info({ guildId, reason, count: channelIds.length }, "Lockdown activated");
  },
};

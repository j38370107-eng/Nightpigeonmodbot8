import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { resolveTarget } from "../lib/resolveUser";
import { getInfractions } from "../store/infractions";
import { getAlts, getMainAccount } from "../store/alts";

export const userinfoCommand: Command = {
  name: "userinfo",
  aliases: ["ui", "whois"],
  description: "View information about a user",
  usage: "[@user | userID]",
  requiredPermissions: [],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    let user = message.mentions.users.first() ?? null;
    let member = message.mentions.members?.first() ?? null;

    if (!user && args[0]) {
      const resolved = await resolveTarget(message, args);
      if (resolved) {
        user = resolved.user;
        member = resolved.member;
      }
    }

    if (!user) {
      user = message.author;
      member = message.member;
    }

    const isMod = message.member?.permissions.has(PermissionFlagsBits.ModerateMembers) ?? false;

    const createdAt = Math.floor(user.createdTimestamp / 1000);
    const joinedAt = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const infractions = getInfractions(message.guild.id, user.id);
    const counts: Record<string, number> = {};
    for (const inf of infractions) {
      counts[inf.type] = (counts[inf.type] ?? 0) + 1;
    }

    const infractionSummary = Object.entries(counts)
      .map(([type, n]) => `${type}: **${n}**`)
      .join(" · ");

    const roles = member?.roles.cache
      .filter((r) => r.id !== message.guild!.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .join(", ");

    const isMuted = member?.isCommunicationDisabled() ?? false;
    const mutedUntil = member?.communicationDisabledUntilTimestamp
      ? Math.floor(member.communicationDisabledUntilTimestamp / 1000)
      : null;

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865f2)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "User", value: `<@${user.id}>`, inline: true },
        { name: "ID", value: user.id, inline: true },
        { name: "Account Created", value: `<t:${createdAt}:R>`, inline: true },
      );

    if (joinedAt) {
      embed.addFields({ name: "Joined Server", value: `<t:${joinedAt}:R>`, inline: true });
    }

    if (isMuted && mutedUntil) {
      embed.addFields({ name: "Muted Until", value: `<t:${mutedUntil}:R>`, inline: true });
    }

    if (roles) {
      embed.addFields({ name: `Roles (${member?.roles.cache.size ? member.roles.cache.size - 1 : 0})`, value: roles || "None", inline: false });
    }

    if (isMod && infractions.length > 0) {
      embed.addFields({ name: "Infractions", value: infractionSummary || "None", inline: false });
    } else if (isMod) {
      embed.addFields({ name: "Infractions", value: "None", inline: false });
    }

    // ── Alt account info ──────────────────────────────────────────────────────
    const directAlts = getAlts(message.guild.id, user.id);
    const mainId = getMainAccount(message.guild.id, user.id);

    if (directAlts.length > 0) {
      embed.addFields({
        name: `🔗 Linked Alt${directAlts.length !== 1 ? "s" : ""} (${directAlts.length})`,
        value: directAlts.map(id => `<@${id}>`).join(", "),
        inline: false,
      });
    } else if (mainId) {
      const siblings = getAlts(message.guild.id, mainId).filter(id => id !== user.id);
      let altValue = `Main account: <@${mainId}>`;
      if (siblings.length > 0) altValue += `\nOther alts: ${siblings.map(id => `<@${id}>`).join(", ")}`;
      embed.addFields({ name: "🔗 Alt Account", value: altValue, inline: false });
    }

    embed.setFooter({ text: `Bot: ${user.bot ? "Yes" : "No"} · Status lookup time` }).setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};

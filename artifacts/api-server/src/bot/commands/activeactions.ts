import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "./types";
import { getAllTimedMutes } from "../store/timedMutes";
import { getAllTimedBans } from "../store/timedBans";

const PAGE_SIZE = 10;
const COLLECTOR_TIMEOUT = 120_000; // 2 minutes

function ts(expiresAt: number): string {
  const s = Math.floor(expiresAt / 1000);
  return `<t:${s}:R> (<t:${s}:f>)`;
}

interface Entry {
  label: string;
  type: "mute" | "ban";
}

function buildEmbed(
  entries: Entry[],
  page: number,
  totalPages: number,
  guildName: string,
  totalMutes: number,
  totalBans: number
): EmbedBuilder {
  const slice = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const muteLines: string[] = [];
  const banLines: string[] = [];
  for (const e of slice) {
    if (e.type === "mute") muteLines.push(e.label);
    else banLines.push(e.label);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Active Timed Actions — ${guildName}`)
    .setTimestamp();

  if (muteLines.length > 0) {
    embed.addFields({ name: `🔇 Timed Mutes`, value: muteLines.join("\n") });
  }
  if (banLines.length > 0) {
    embed.addFields({ name: `🔨 Timed Bans`, value: banLines.join("\n\n") });
  }

  embed.setFooter({
    text:
      `${totalMutes} mute${totalMutes === 1 ? "" : "s"} • ` +
      `${totalBans} ban${totalBans === 1 ? "" : "s"}` +
      (totalPages > 1 ? ` • Page ${page + 1}/${totalPages}` : ""),
  });

  return embed;
}

function buildRow(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("prev")
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

export const activeActionsCommand: Command = {
  name: "activeactions",
  aliases: ["activemutes", "activebans", "active", "timed"],
  description: "Show all users currently under a timed mute or timed ban",
  usage: "[mutes|bans]",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const filter = args[0]?.toLowerCase();
    const now = Date.now();

    const showMutes = !filter || filter === "mutes" || filter === "mute";
    const showBans  = !filter || filter === "bans"  || filter === "ban";

    const mutes = showMutes
      ? getAllTimedMutes()
          .filter((m) => m.guildId === guildId && m.expiresAt > now)
          .sort((a, b) => a.expiresAt - b.expiresAt)
      : [];

    const bans = showBans
      ? getAllTimedBans()
          .filter((b) => b.guildId === guildId && b.expiresAt > now)
          .sort((a, b) => a.expiresAt - b.expiresAt)
      : [];

    if (mutes.length === 0 && bans.length === 0) {
      const what =
        filter === "mutes" || filter === "mute" ? "timed mutes"
        : filter === "bans"  || filter === "ban"  ? "timed bans"
        : "timed mutes or bans";
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setDescription(`✅ No active ${what} in this server.`),
        ],
      });
    }

    // Build flat entry list: mutes first, then bans
    const entries: Entry[] = [
      ...mutes.map((m): Entry => ({
        type: "mute",
        label: `<@${m.userId}> — expires ${ts(m.expiresAt)}`,
      })),
      ...bans.map((b): Entry => ({
        type: "ban",
        label:
          `**${b.userTag}** (\`${b.userId}\`) — expires ${ts(b.expiresAt)}\n` +
          `↳ *${b.reason}* — by ${b.moderatorTag}`,
      })),
    ];

    const totalPages = Math.ceil(entries.length / PAGE_SIZE);
    let page = 0;

    const embed = buildEmbed(entries, page, totalPages, message.guild.name, mutes.length, bans.length);

    // No pagination needed if everything fits on one page
    if (totalPages === 1) {
      return message.reply({ embeds: [embed] });
    }

    const row = buildRow(page, totalPages);
    const reply = await message.reply({ embeds: [embed], components: [row] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_TIMEOUT,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "prev") page = Math.max(0, page - 1);
      if (interaction.customId === "next") page = Math.min(totalPages - 1, page + 1);

      const newEmbed = buildEmbed(entries, page, totalPages, message.guild!.name, mutes.length, bans.length);
      const newRow = buildRow(page, totalPages);
      await interaction.update({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on("end", () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("◀ Prev")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next ▶")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      reply.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};

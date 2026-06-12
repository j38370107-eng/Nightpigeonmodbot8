import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { getAllInfractionsForGuild, type InfractionType } from "../store/infractions";

const WINDOWS: Record<string, number | null> = {
  "7d":  7  * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "all": null,
};

const ACTION_TYPES: InfractionType[] = ["Warn", "Mute", "Kick", "Ban"];

interface ModRow {
  tag: string;
  warn: number;
  mute: number;
  kick: number;
  ban:  number;
  total: number;
}

function isUserId(s: string): string | null {
  // <@123456789> or <@!123456789> or raw snowflake
  const mention = s.match(/^<@!?(\d{17,19})>$/);
  if (mention) return mention[1]!;
  if (/^\d{17,19}$/.test(s)) return s;
  return null;
}

function parseWindow(arg: string | undefined): { label: string; ms: number | null } {
  if (!arg) return { label: "30d", ms: WINDOWS["30d"]! };
  const key = arg.toLowerCase();
  if (key in WINDOWS) return { label: key, ms: WINDOWS[key]! };
  return { label: "30d", ms: WINDOWS["30d"]! };
}

function buildRow(inf: typeof getAllInfractionsForGuild extends (...a: any) => infer R ? R : never): ModRow {
  return { tag: "", warn: 0, mute: 0, kick: 0, ban: 0, total: 0 };
}

export const modstatsCommand: Command = {
  name: "modstats",
  aliases: ["moderatorstats", "modleaderboard", "modlb"],
  description: "Show per-moderator action counts (warns, mutes, kicks, bans)",
  usage: "[@user | userID] [7d|30d|90d|all]",
  requiredPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;

    // Detect optional user target in first arg
    let targetId: string | null = null;
    let targetTag: string | null = null;
    let windowArg = args[0];

    const firstAsId = args[0] ? isUserId(args[0]) : null;
    if (firstAsId) {
      targetId = firstAsId;
      windowArg = args[1];
      // Resolve tag from guild cache for display
      const member = message.guild.members.cache.get(firstAsId)
        ?? await message.guild.members.fetch(firstAsId).catch(() => null);
      targetTag = member?.user.tag ?? `Unknown User (${firstAsId})`;
    }

    const { label, ms } = parseWindow(windowArg);
    const cutoff = ms !== null ? Date.now() - ms : 0;
    const windowDisplay = label === "all" ? "all time" : `last ${label}`;

    const allInfractions = getAllInfractionsForGuild(guildId).filter(
      (i) => ACTION_TYPES.includes(i.type) && !i.automod && i.timestamp >= cutoff
    );

    // ── Single moderator view ────────────────────────────────────────────────
    if (targetId) {
      const modInfractions = allInfractions.filter((i) => i.moderatorId === targetId);

      if (modInfractions.length === 0) {
        return message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x95a5a6)
              .setDescription(`✅ **${targetTag}** has no manual moderation actions in the ${windowDisplay}.`),
          ],
        });
      }

      let warn = 0, mute = 0, kick = 0, ban = 0;
      for (const i of modInfractions) {
        if (i.type === "Warn") warn++;
        if (i.type === "Mute") mute++;
        if (i.type === "Kick") kick++;
        if (i.type === "Ban")  ban++;
      }

      const breakdown = [
        warn ? `⚠️ **${warn}** warn${warn === 1 ? "" : "s"}` : null,
        mute ? `🔇 **${mute}** mute${mute === 1 ? "" : "s"}` : null,
        kick ? `👢 **${kick}** kick${kick === 1 ? "" : "s"}` : null,
        ban  ? `🔨 **${ban}** ban${ban === 1 ? "" : "s"}`   : null,
      ].filter(Boolean).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Mod Stats — ${targetTag}`)
        .addFields(
          { name: "Total Actions", value: `**${modInfractions.length}**`, inline: true },
          { name: "Period", value: windowDisplay, inline: true },
          { name: "Breakdown", value: breakdown }
        )
        .setFooter({ text: "Excludes AutoMod actions" })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ── Leaderboard view ─────────────────────────────────────────────────────
    if (allInfractions.length === 0) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x95a5a6)
            .setDescription(`✅ No manual moderation actions found in the ${windowDisplay}.`),
        ],
      });
    }

    const modMap = new Map<string, ModRow>();
    for (const inf of allInfractions) {
      const row = modMap.get(inf.moderatorId) ?? {
        tag: inf.moderatorTag, warn: 0, mute: 0, kick: 0, ban: 0, total: 0,
      };
      if (inf.type === "Warn") row.warn++;
      if (inf.type === "Mute") row.mute++;
      if (inf.type === "Kick") row.kick++;
      if (inf.type === "Ban")  row.ban++;
      row.total++;
      modMap.set(inf.moderatorId, row);
    }

    const rows = [...modMap.values()].sort((a, b) => b.total - a.total);

    const lines = rows.map((r, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`${i + 1}.\``;
      const counts = [
        r.warn ? `⚠️ ${r.warn}w` : null,
        r.mute ? `🔇 ${r.mute}m` : null,
        r.kick ? `👢 ${r.kick}k` : null,
        r.ban  ? `🔨 ${r.ban}b`  : null,
      ].filter(Boolean).join("  ");
      return `${medal} **${r.tag}** — ${r.total} total  •  ${counts}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 Moderator Stats — ${message.guild.name}`)
      .setDescription(lines.join("\n"))
      .setFooter({ text: `Period: ${windowDisplay} • ${allInfractions.length} total actions • excludes AutoMod` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};

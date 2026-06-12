import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "./types";
import { getInfractions, clearInfractions, getActiveAutomodWarnCount } from "../store/infractions";
import { resolveTarget } from "../lib/resolveUser";
import { getMuteConfig } from "../store/muteConfig";
import { getTimedMute, removeTimedMute } from "../store/timedMutes";
import { markManualUnmute } from "../store/manualUnmutes";
import { sendModLog } from "../lib/modlog";
import { logger } from "../../lib/logger";

/** Discord timestamp — long date + time, e.g. "November 27, 2021 9:01 PM" */
function formatDate(ts: number): string {
  return `<t:${Math.floor(ts / 1000)}:f>`;
}

/** Discord relative timestamp with expired fallback */
function formatExpiry(expiresAt: number | undefined): string {
  if (!expiresAt) return "";
  if (expiresAt <= Date.now()) return " **(expired)**";
  return ` (expires <t:${Math.floor(expiresAt / 1000)}:R>)`;
}

function isModerator(message: Message): boolean {
  if (!message.member) return false;
  return (
    message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export const warningsCommand: Command = {
  name: "warnings",
  aliases: ["warns", "modlogs", "infractions", "punishments", "cases", "hist", "history", "warnsa"],
  description: "Show your infractions, or any user's if you are a moderator",
  usage: "[@user | userID] [-a] [-clear | clear]",

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;

    const isMod = isModerator(message);
    const prefix = (message.client as any).prefix ?? ">";
    const invokedAs = message.content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
    const automodOnly = args.includes("-a") || invokedAs === "warnsa";

    // Strip flags before resolving target
    const nonFlagArgs = args.filter((a) => !a.startsWith("-"));

    // -clear flag OR bare "clear" positional arg both trigger a clear
    const shouldClear = args.includes("-clear") || nonFlagArgs.includes("clear");

    // Target resolution: strip "clear" from positional args so it isn't parsed as a user
    const targetArgs = nonFlagArgs.filter((a) => a !== "clear");

    let target = message.author;
    let member = message.guild.members.cache.get(message.author.id) ?? null;

    if (targetArgs.length > 0) {
      const resolved = await resolveTarget(message, targetArgs);
      if (resolved) {
        if (!isMod && resolved.user.id !== message.author.id) {
          return message.reply("❌ You can only view your own infractions.");
        }
        target = resolved.user;
        member = resolved.member;
      }
    }

    // ── Clear path ──────────────────────────────────────────────────────────
    if (shouldClear) {
      if (!isMod) return message.reply("❌ You don't have permission to clear infractions.");

      const guildId = message.guild.id;
      const removedActions: string[] = [];

      // Lift active punishments if the member is still in the server
      if (member) {
        const muteCfg = getMuteConfig(guildId);

        try {
          if (muteCfg.mode === "role" && muteCfg.muteRoleId && member.roles.cache.has(muteCfg.muteRoleId)) {
            // Restore any stripped roles from a timed mute, otherwise just remove the mute role
            const timedMute = getTimedMute(guildId, target.id);
            markManualUnmute(guildId, target.id);
            removeTimedMute(guildId, target.id);

            if (timedMute?.strippedRoles && timedMute.strippedRoles.length > 0) {
              const validRoles = timedMute.strippedRoles.filter((id) =>
                message.guild!.roles.cache.has(id)
              );
              await member.roles.set(validRoles, `Warnings cleared by ${message.author.tag}`);
            } else {
              await member.roles.remove(muteCfg.muteRoleId, `Warnings cleared by ${message.author.tag}`);
            }
            removedActions.push("mute role removed");
          } else if (muteCfg.mode === "timeout" && member.isCommunicationDisabled()) {
            markManualUnmute(guildId, target.id);
            removeTimedMute(guildId, target.id);
            await member.timeout(null, `Warnings cleared by ${message.author.tag}`);
            removedActions.push("timeout lifted");
          } else {
            // Still clean up any orphaned timed mute records even if no active punishment
            removeTimedMute(guildId, target.id);
          }
        } catch (err) {
          logger.warn({ err, targetId: target.id }, "Failed to remove punishment during warning clear");
          removedActions.push("⚠️ could not remove active punishment — check bot permissions");
        }
      }

      clearInfractions(guildId, target.id);

      await sendModLog(message.client, guildId, {
        action: "Warnings Cleared",
        executor: { tag: message.author.tag, id: message.author.id },
        target: { tag: target.tag, id: target.id },
        channel: { name: (message.channel as any).name ?? "unknown", id: message.channel.id },
        reason: removedActions.length > 0 ? removedActions.join(", ") : "infractions cleared",
        color: 0x2ecc71,
      });

      const punishmentNote = removedActions.length > 0 ? ` (${removedActions.join(", ")})` : "";
      return message.reply(`✅ All infractions for **${target.tag}** have been cleared${punishmentNote}.`);
    }

    // ── View path ───────────────────────────────────────────────────────────
    const allInfractions = getInfractions(message.guild.id, target.id);
    let infractions: typeof allInfractions;

    if (automodOnly) {
      if (!isMod && target.id !== message.author.id) {
        return message.reply("❌ You can only view your own AutoMod infractions.");
      }
      const base = allInfractions.filter((i) => i.type !== "Note");
      infractions = base.filter((i) => i.automod === true);
    } else {
      // Regular view: exclude automod entries and notes
      const base = allInfractions.filter((i) => i.type !== "Note");
      infractions = base.filter((i) => !i.automod);
    }

    const modeLabel = automodOnly ? "AutoMod infractions" : "infractions";

    if (infractions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x95a5a6)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription(
          isMod
            ? `Showing ${modeLabel} for ${target}.\n\n*No ${modeLabel} found.*`
            : `You have no infractions on record.`
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    const lines = infractions.map((inf) => {
      const expiry = formatExpiry(inf.expiresAt);
      const modLine = isMod ? ` — *by ${inf.moderatorTag}*` : "";
      return `**ID: ${inf.id}**\n${inf.type} — ${inf.reason} — ${formatDate(inf.timestamp)}${expiry}${modLine}`;
    });

    const chunkLines: string[][] = [[]];
    for (const line of lines) {
      const current = chunkLines[chunkLines.length - 1]!;
      if ((current.join("\n\n") + "\n\n" + line).length > 3900) {
        chunkLines.push([line]);
      } else {
        current.push(line);
      }
    }

    const activeCount = automodOnly
      ? getActiveAutomodWarnCount(message.guild.id, target.id)
      : null;

    const headerText = isMod
      ? `Showing ${modeLabel} for ${target}.${activeCount !== null ? ` **${activeCount} active.**` : ""}\n\n`
      : `Showing your infractions.\n\n`;

    for (let i = 0; i < chunkLines.length; i++) {
      const footerParts: string[] = [`${infractions.length} ${modeLabel}`];
      if (activeCount !== null) footerParts.push(`${activeCount} active`);
      if (!isMod) footerParts.push("Moderator hidden");

      const embed = new EmbedBuilder()
        .setColor(automodOnly ? 0xf39c12 : 0x5865f2)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setDescription((i === 0 ? headerText : "") + chunkLines[i]!.join("\n\n"))
        .setFooter({ text: footerParts.join(" • ") })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }
  },
};

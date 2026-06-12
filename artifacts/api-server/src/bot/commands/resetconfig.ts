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
import { clearGuildSettings } from "../store/settings";
import { clearModRoles } from "../store/modroles";
import { resetAutomodConfig } from "../store/automod";
import { resetAntiNukeConfig } from "../store/antinuke";
import { resetAntiRaidConfig } from "../store/antiraid";
import { clearShortcuts } from "../store/shortcuts";
import { clearAliases } from "../store/aliases";
import { setLockdownChannels } from "../store/lockdown";
import { resetTicketConfig } from "../store/tickets";
import { clearAllAdditionalInfo } from "../store/additionalInfo";

const WHAT_RESETS = [
  "• Command prefix → `>`",
  "• Mod log channel → cleared",
  "• Server log channel → cleared",
  "• Warn expiry → default (30 days)",
  "• AutoMod warn expiry → default (7 days)",
  "• Mod roles → cleared",
  "• AutoMod config → all modules off, no escalation",
  "• Punishment DM messages → cleared",
  "• Lockdown channels → cleared",
  "• AntiNuke → disabled",
  "• AntiRaid → disabled",
  "• Shortcuts → all deleted",
  "• Aliases → all deleted",
  "• Ticket config → cleared",
].join("\n");

const WONT_RESET = "Infractions, warnings, timed mutes/bans, invite stats, and alt records are **not** affected.";

export const resetConfigCommand: Command = {
  name: "resetconfig",
  aliases: ["configreset", "resetbot", "factoryreset"],
  description: "Reset all bot configuration for this server back to defaults",
  usage: "",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, _args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;

    const warningEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle("⚠️ Reset Server Configuration")
      .setDescription(
        `This will **permanently reset** all bot settings for **${message.guild.name}** back to their defaults.\n\n` +
        `**The following will be reset:**\n${WHAT_RESETS}\n\n` +
        `**${WONT_RESET}**\n\n` +
        `**This cannot be undone.** Are you sure you want to continue?`
      )
      .setFooter({ text: "Only you can confirm this action. Expires in 30 seconds." })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_reset")
        .setLabel("Yes, Reset Everything")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_reset")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await message.reply({ embeds: [warningEmbed], components: [row] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30_000,
      max: 1,
      filter: (i) => i.user.id === message.author.id,
    });

    collector.on("collect", async (interaction) => {
      if (interaction.customId === "cancel_reset") {
        const cancelEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setDescription("✅ Reset cancelled. No changes were made.");
        await interaction.update({ embeds: [cancelEmbed], components: [] });
        return;
      }

      // Perform the reset
      clearGuildSettings(guildId);
      clearModRoles(guildId);
      resetAutomodConfig(guildId);
      resetAntiNukeConfig(guildId);
      resetAntiRaidConfig(guildId);
      clearShortcuts(guildId);
      clearAliases(guildId);
      setLockdownChannels(guildId, []);
      resetTicketConfig(guildId);
      clearAllAdditionalInfo(guildId);

      const doneEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🔄 Configuration Reset")
        .setDescription(
          `All bot settings for **${message.guild!.name}** have been reset to defaults.\n\n` +
          `**What was reset:**\n${WHAT_RESETS}`
        )
        .setFooter({ text: `Reset by ${message.author.tag}` })
        .setTimestamp();

      await interaction.update({ embeds: [doneEmbed], components: [] });
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setDescription("⏱️ Reset confirmation expired. No changes were made.");
        reply.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
      }
    });
  },
};

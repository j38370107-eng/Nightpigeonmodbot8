import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  OverwriteType,
} from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getMuteConfig,
  setMuteMode,
  setMuteRoleId,
  setStripRoles,
} from "../store/muteConfig";

const USAGE = `\`\`\`
>muteconfig                    — show current settings
>muteconfig mode timeout       — use Discord timeout (default)
>muteconfig mode role          — use a mute role
>muteconfig role create        — create a "Muted" role with channel perms set
>muteconfig role set @role     — use an existing role as the mute role
>muteconfig striproles on/off  — strip all roles from muted members
\`\`\``;

export const muteconfigCommand: Command = {
  name: "muteconfig",
  aliases: ["mutesettings"],
  description: "Configure how mutes work (timeout vs mute role, role stripping)",
  usage: "[mode|role|striproles] [...]",
  requiredPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── Status ──────────────────────────────────────────────────────────────
    if (!sub) {
      const cfg = getMuteConfig(guildId);
      const roleDisplay =
        cfg.muteRoleId
          ? (message.guild.roles.cache.get(cfg.muteRoleId)
              ? `<@&${cfg.muteRoleId}>`
              : `~~${cfg.muteRoleId}~~ *(not found)*`)
          : "*(none set)*";
      const embed = new EmbedBuilder()
        .setTitle("🔇 Mute Configuration")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Mode",
            value: cfg.mode === "role"
              ? "🎭 Mute Role"
              : "⏱️ Discord Timeout (default)",
            inline: true,
          },
          { name: "Mute Role", value: roleDisplay, inline: true },
          {
            name: "Strip Roles on Mute",
            value: cfg.stripRoles ? "✅ On" : "❌ Off",
            inline: true,
          },
        )
        .setFooter({ text: "Use >muteconfig help to see all options" });
      return message.channel.send({ embeds: [embed] });
    }

    // ── Help ─────────────────────────────────────────────────────────────────
    if (sub === "help") {
      return message.reply(USAGE);
    }

    // ── Mode ─────────────────────────────────────────────────────────────────
    if (sub === "mode") {
      const val = args[1]?.toLowerCase();
      if (val !== "timeout" && val !== "role") {
        return message.reply(usageErr(message, muteconfigCommand, "Specify timeout or role for mode"));
      }
      if (val === "role" && !getMuteConfig(guildId).muteRoleId) {
        return message.reply(
          "⚠️ No mute role is set yet. Run `>muteconfig role create` or `>muteconfig role set @role` first, then switch mode.",
        );
      }
      setMuteMode(guildId, val);
      return message.reply(
        val === "role"
          ? "✅ Mute mode set to **Mute Role**. The configured role will be applied on mute."
          : "✅ Mute mode set to **Discord Timeout** (default).",
      );
    }

    // ── Role ─────────────────────────────────────────────────────────────────
    if (sub === "role") {
      const action = args[1]?.toLowerCase();

      // Create a new mute role
      if (action === "create") {
        if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return message.reply("❌ I need the **Manage Roles** permission to create a role.");
        }
        if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply("❌ I need the **Manage Channels** permission to set channel overrides.");
        }

        const statusMsg = await message.channel.send("⏳ Creating mute role and setting channel permissions…");

        try {
          const muteRole = await message.guild.roles.create({
            name: "Muted",
            color: 0x808080,
            reason: `Mute role created by ${message.author.tag} via >muteconfig role create`,
            permissions: [],
          });

          // Set deny overrides on every text/voice channel
          const channels = message.guild.channels.cache.filter(
            (ch) =>
              ch.type === ChannelType.GuildText ||
              ch.type === ChannelType.GuildVoice ||
              ch.type === ChannelType.GuildForum ||
              ch.type === ChannelType.GuildAnnouncement,
          );

          let failed = 0;
          for (const [, ch] of channels) {
            await ch.permissionOverwrites
              .create(
                muteRole,
                {
                  SendMessages: false,
                  AddReactions: false,
                  Speak: false,
                  Connect: false,
                  SendMessagesInThreads: false,
                  CreatePublicThreads: false,
                  CreatePrivateThreads: false,
                },
                {
                  type: OverwriteType.Role,
                  reason: "Muted role — deny send/speak",
                },
              )
              .catch(() => { failed++; });
          }

          setMuteRoleId(guildId, muteRole.id);

          await statusMsg.edit(
            `✅ Created role **${muteRole.name}** and set deny overrides on **${channels.size - failed}** channel(s).` +
            (failed > 0 ? ` (${failed} channel(s) skipped — missing permissions)` : "") +
            `\nRun \`>muteconfig mode role\` to activate it.`,
          );
        } catch (err) {
          await statusMsg.edit("❌ Failed to create mute role. Check my permissions.");
        }
        return;
      }

      // Set an existing role as the mute role
      if (action === "set") {
        const roleMention = message.mentions.roles.first();
        const roleId = roleMention?.id ?? args[2];
        if (!roleId) {
          return message.reply(usageErr(message, muteconfigCommand, "Mention a role or provide a role ID"));
        }
        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply("❌ Role not found in this server.");
        setMuteRoleId(guildId, role.id);
        return message.reply(
          `✅ Mute role set to **${role.name}**.\nRun \`>muteconfig mode role\` to activate it.`,
        );
      }

      return message.reply(usageErr(message, muteconfigCommand, "Specify create or set for role"));
    }

    // ── Strip roles ───────────────────────────────────────────────────────────
    if (sub === "striproles") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") {
        return message.reply(usageErr(message, muteconfigCommand, "Specify on or off for striproles"));
      }
      setStripRoles(guildId, val === "on");
      return message.reply(
        val === "on"
          ? "✅ **Strip Roles** enabled — all roles will be removed from members when muted and restored on unmute.\n⚠️ Only applies when mute mode is set to **Mute Role**."
          : "✅ **Strip Roles** disabled — roles will not be affected when muting.",
      );
    }

    return message.reply(usageErr(message, muteconfigCommand, "Invalid subcommand — use mode, role, or striproles"));
  },
};

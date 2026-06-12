import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  PermissionOverwriteResolvable,
} from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import {
  getAntiNuke,
  updateAntiNuke,
  AntiNukeAction,
  channelRecoveryCache,
  roleRecoveryCache,
} from "../store/antinuke";

const VALID_ACTIONS: AntiNukeAction[] = ["ban", "kick", "strip"];

const VALID_THRESHOLDS = [
  "channeldelete", "channelcreate",
  "roledelete",    "rolecreate",
  "ban",           "kick",
  "webhookcreate", "webhookdelete",
  "masstimeout",
  "channelrename", "rolerename",
] as const;
type ThresholdKey = typeof VALID_THRESHOLDS[number];

const THRESHOLD_MAP: Record<ThresholdKey, string> = {
  channeldelete:  "channelDelete",
  channelcreate:  "channelCreate",
  roledelete:     "roleDelete",
  rolecreate:     "roleCreate",
  ban:            "ban",
  kick:           "kick",
  webhookcreate:  "webhookCreate",
  webhookdelete:  "webhookDelete",
  masstimeout:    "massTimeout",
  channelrename:  "channelRename",
  rolerename:     "roleRename",
};

export const antinukeCommand: Command = {
  name: "antinuke",
  aliases: ["an", "nuke"],
  description: "Configure the anti-nuke protection system",
  usage:
    "enable | disable | status | action <ban|kick|strip> | " +
    "threshold <type> <count> | window <secs> | " +
    "whitelist <add|remove|list> [@user|roleID] | " +
    "logchannel <#ch|clear> | dmowner <on|off> | " +
    "watch <roles|server|everyone> <on|off> | " +
    "roleprotect <revert|punish> <on|off> | " +
    "prune <on|off> | vanity <on|off> | serverrename <on|off> | servericon <on|off> | " +
    "rolerename <on|off> | channelrename <on|off> | " +
    "restore <on|off> | recover [channels|roles]",
  requiredPermissions: [PermissionFlagsBits.Administrator],

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const guildId = message.guild.id;
    const sub = args[0]?.toLowerCase();

    // ── enable / disable ──────────────────────────────────────────────────
    if (sub === "enable" || sub === "on") {
      updateAntiNuke(guildId, { enabled: true });
      return message.reply("✅ Anti-Nuke protection **enabled**.");
    }
    if (sub === "disable" || sub === "off") {
      updateAntiNuke(guildId, { enabled: false });
      return message.reply("✅ Anti-Nuke protection **disabled**.");
    }

    // ── action ────────────────────────────────────────────────────────────
    if (sub === "action") {
      const act = args[1]?.toLowerCase() as AntiNukeAction;
      if (!VALID_ACTIONS.includes(act)) {
        return message.reply(
          usageErr(message, antinukeCommand, `Invalid action — choose: ${VALID_ACTIONS.join(", ")}`),
        );
      }
      updateAntiNuke(guildId, { action: act });
      return message.reply(`✅ Anti-Nuke action set to **${act}**.`);
    }

    // ── threshold ─────────────────────────────────────────────────────────
    if (sub === "threshold") {
      const type = args[1]?.toLowerCase() as ThresholdKey;
      const count = parseInt(args[2] ?? "", 10);
      if (!VALID_THRESHOLDS.includes(type)) {
        return message.reply(
          usageErr(message, antinukeCommand, `Invalid type — choose: ${VALID_THRESHOLDS.join(", ")}`),
        );
      }
      if (isNaN(count) || count < 1 || count > 50) {
        return message.reply("❌ Threshold must be between 1 and 50.");
      }
      const cfg = getAntiNuke(guildId);
      const key = THRESHOLD_MAP[type] as keyof typeof cfg.thresholds;
      cfg.thresholds[key] = count;
      updateAntiNuke(guildId, { thresholds: cfg.thresholds });
      return message.reply(`✅ **${key}** threshold set to **${count}**.`);
    }

    // ── window ────────────────────────────────────────────────────────────
    if (sub === "window") {
      const secs = parseInt(args[1] ?? "", 10);
      if (isNaN(secs) || secs < 1 || secs > 120) {
        return message.reply("❌ Window must be between 1 and 120 seconds.");
      }
      updateAntiNuke(guildId, { windowMs: secs * 1000 });
      return message.reply(`✅ Detection window set to **${secs}s**.`);
    }

    // ── logchannel ────────────────────────────────────────────────────────
    if (sub === "logchannel") {
      if (args[1]?.toLowerCase() === "clear") {
        updateAntiNuke(guildId, { logChannel: undefined });
        return message.reply("✅ Anti-Nuke log channel cleared.");
      }
      const ch =
        message.mentions.channels.first() ??
        (args[1] ? message.guild.channels.cache.get(args[1]) : null);
      if (!ch || !("send" in ch))
        return message.reply(usageErr(message, antinukeCommand, "Mention a valid text channel"));
      updateAntiNuke(guildId, { logChannel: ch.id });
      return message.reply(`✅ Logging to <#${ch.id}>.`);
    }

    // ── dmowner ───────────────────────────────────────────────────────────
    if (sub === "dmowner") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") {
        return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      }
      updateAntiNuke(guildId, { dmOwner: val === "on" });
      return message.reply(`✅ DM owner on trigger: **${val}**.`);
    }

    // ── watch ─────────────────────────────────────────────────────────────
    if (sub === "watch") {
      const target = args[1]?.toLowerCase();
      const val    = args[2]?.toLowerCase();
      if ((target !== "roles" && target !== "server" && target !== "everyone") || (val !== "on" && val !== "off")) {
        return message.reply(
          usageErr(message, antinukeCommand, "Usage: watch <roles|server|everyone> <on|off>"),
        );
      }
      if (target === "roles") {
        updateAntiNuke(guildId, { watchRolePerms: val === "on" });
        return message.reply(
          `✅ Watch **role permissions** set to **${val}**.\n${val === "on" ? "Dangerous permission grants to any role will be logged." : ""}`,
        );
      }
      if (target === "server") {
        updateAntiNuke(guildId, { watchServerUpdate: val === "on" });
        return message.reply(`✅ Watch **server settings** set to **${val}**.`);
      }
      if (target === "everyone") {
        updateAntiNuke(guildId, { watchEveryonePerms: val === "on" });
        return message.reply(
          `✅ Watch **@everyone permissions** set to **${val}**.\n${val === "on" ? "Any dangerous perm grant to @everyone by a non-whitelisted user will be detected and reverted." : ""}`,
        );
      }
    }

    // ── roleprotect ───────────────────────────────────────────────────────
    if (sub === "roleprotect" || sub === "rp") {
      const rpSub = args[1]?.toLowerCase();
      const val   = args[2]?.toLowerCase();

      if ((rpSub !== "revert" && rpSub !== "punish") || (val !== "on" && val !== "off")) {
        return message.reply(
          usageErr(message, antinukeCommand, "Usage: roleprotect <revert|punish> <on|off>"),
        );
      }

      if (rpSub === "revert") {
        updateAntiNuke(guildId, { revertRolePerms: val === "on" });
        return message.reply(
          val === "on"
            ? "✅ **Role permission revert** enabled. When a non-whitelisted user adds dangerous permissions to any role, the change will be automatically reverted."
            : "✅ Role permission revert **disabled**.",
        );
      }
      if (rpSub === "punish") {
        updateAntiNuke(guildId, { punishRolePerms: val === "on" });
        return message.reply(
          val === "on"
            ? `✅ **Role permission punishment** enabled. The executor will be \`${getAntiNuke(guildId).action}\`d when adding dangerous perms to any role.`
            : "✅ Role permission punishment **disabled**.",
        );
      }
    }

    // ── advanced event protections ────────────────────────────────────────
    if (sub === "prune") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiPruneEnabled: val === "on" });
      return message.reply(`✅ Anti-Prune **${val === "on" ? "enabled" : "disabled"}**. Non-whitelisted users who prune members will be ${val === "on" ? "punished" : "ignored"}.`);
    }

    if (sub === "vanity") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiVanityEnabled: val === "on" });
      return message.reply(`✅ Anti-Vanity Change **${val === "on" ? "enabled" : "disabled"}**.`);
    }

    if (sub === "serverrename") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiServerRenameEnabled: val === "on" });
      return message.reply(`✅ Anti-Server Rename **${val === "on" ? "enabled" : "disabled"}**.`);
    }

    if (sub === "servericon") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiServerIconEnabled: val === "on" });
      return message.reply(`✅ Anti-Server Icon Change **${val === "on" ? "enabled" : "disabled"}**.`);
    }

    if (sub === "rolerename") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiRoleRenameEnabled: val === "on" });
      return message.reply(`✅ Anti-Role Rename **${val === "on" ? "enabled" : "disabled"}**. Threshold: \`${getAntiNuke(guildId).thresholds.roleRename}\` renames per window.`);
    }

    if (sub === "channelrename") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      updateAntiNuke(guildId, { antiChannelRenameEnabled: val === "on" });
      return message.reply(`✅ Anti-Channel Rename **${val === "on" ? "enabled" : "disabled"}**. Threshold: \`${getAntiNuke(guildId).thresholds.channelRename}\` renames per window.`);
    }

    // ── restore toggle ────────────────────────────────────────────────────
    if (sub === "restore") {
      const val = args[1]?.toLowerCase();
      if (val !== "on" && val !== "off") {
        return message.reply(usageErr(message, antinukeCommand, "Specify on or off"));
      }
      updateAntiNuke(guildId, { restoreEnabled: val === "on" });
      return message.reply(
        val === "on"
          ? "✅ Auto-restore enabled. Deleted channels and roles will be cached for recovery."
          : "✅ Auto-restore disabled.",
      );
    }

    // ── recover ───────────────────────────────────────────────────────────
    if (sub === "recover") {
      const type = args[1]?.toLowerCase();

      if (!type || type === "channels") {
        const cached = channelRecoveryCache.get(guildId) ?? [];
        if (cached.length === 0) {
          if (!type) {
            // Fall through to check roles
          } else {
            return message.reply("No cached channels to restore (cache is empty or expired).");
          }
        } else {
          await message.reply(`🔄 Restoring **${cached.length}** cached channel(s)…`);
          let restored = 0;
          for (const ch of cached) {
            try {
              const overwrites: PermissionOverwriteResolvable[] = ch.permOverwrites.map((ov) => ({
                id: ov.id,
                type: ov.type as 0 | 1,
                allow: BigInt(ov.allow),
                deny: BigInt(ov.deny),
              }));
              await message.guild.channels.create({
                name: ch.name,
                type: ch.type as any,
                parent: ch.parentId ?? undefined,
                permissionOverwrites: overwrites,
                reason: "Anti-Nuke: Channel recovery",
              });
              restored++;
            } catch {
              /* skip */
            }
          }
          channelRecoveryCache.set(guildId, []);
          return message.reply(`✅ Restored **${restored}/${cached.length}** channels.`);
        }
      }

      if (!type || type === "roles") {
        const cached = roleRecoveryCache.get(guildId) ?? [];
        if (cached.length === 0) {
          return message.reply("No cached roles or channels to restore (cache is empty or expired).");
        }
        await message.reply(`🔄 Restoring **${cached.length}** cached role(s)…`);
        let restored = 0;
        for (const r of cached) {
          try {
            await message.guild.roles.create({
              name: r.name,
              color: r.color,
              permissions: BigInt(r.permissions),
              mentionable: r.mentionable,
              hoist: r.hoist,
              reason: "Anti-Nuke: Role recovery",
            });
            restored++;
          } catch {
            /* skip */
          }
        }
        roleRecoveryCache.set(guildId, []);
        return message.reply(`✅ Restored **${restored}/${cached.length}** roles.`);
      }

      return message.reply(usageErr(message, antinukeCommand, "Usage: recover [channels|roles]"));
    }

    // ── whitelist ─────────────────────────────────────────────────────────
    if (sub === "whitelist") {
      const wlSub = args[1]?.toLowerCase();
      const cfg   = getAntiNuke(guildId);

      if (wlSub === "list") {
        const userLines = cfg.whitelist.length
          ? cfg.whitelist.map((id) => `<@${id}>`).join(", ")
          : "None";
        const roleLines = cfg.whitelistRoles.length
          ? cfg.whitelistRoles.map((id) => `<@&${id}>`).join(", ")
          : "None";
        return message.reply(`**Whitelisted users:** ${userLines}\n**Whitelisted roles:** ${roleLines}`);
      }

      const target =
        message.mentions.users.first()?.id ??
        message.mentions.roles.first()?.id ??
        args[2];
      const isRole = !!message.mentions.roles.first() || args[3] === "--role";
      if (!target)
        return message.reply(usageErr(message, antinukeCommand, "Mention a user/role or provide their ID"));

      if (wlSub === "add") {
        if (isRole) {
          if (cfg.whitelistRoles.includes(target)) return message.reply("❌ Already in whitelist.");
          updateAntiNuke(guildId, { whitelistRoles: [...cfg.whitelistRoles, target] });
          return message.reply(`✅ <@&${target}> added to the Anti-Nuke role whitelist.`);
        } else {
          if (cfg.whitelist.includes(target)) return message.reply("❌ Already whitelisted.");
          updateAntiNuke(guildId, { whitelist: [...cfg.whitelist, target] });
          return message.reply(`✅ <@${target}> added to the Anti-Nuke whitelist.`);
        }
      }
      if (wlSub === "remove") {
        if (isRole) {
          const arr = cfg.whitelistRoles.filter((r) => r !== target);
          if (arr.length === cfg.whitelistRoles.length) return message.reply("❌ Not in whitelist.");
          updateAntiNuke(guildId, { whitelistRoles: arr });
          return message.reply(`✅ <@&${target}> removed from the role whitelist.`);
        } else {
          const arr = cfg.whitelist.filter((r) => r !== target);
          if (arr.length === cfg.whitelist.length) return message.reply("❌ Not whitelisted.");
          updateAntiNuke(guildId, { whitelist: arr });
          return message.reply(`✅ <@${target}> removed from the whitelist.`);
        }
      }
      return message.reply(
        usageErr(message, antinukeCommand, "Invalid whitelist sub — use add, remove, or list"),
      );
    }

    // ── default: dashboard link ───────────────────────────────────────────
    const baseUrl = process.env["DASHBOARD_URL"] ?? "https://utilitypulse-dashboard-pzu9.onrender.com";
    const dashUrl = `${baseUrl}/dashboard/${guildId}/antinuke`;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("💣 Anti-Nuke Settings — Use the Dashboard")
          .setDescription(
            `Anti-Nuke protection is managed through the **web dashboard**.\n\n[**Open Anti-Nuke Settings →**](${dashUrl})\n\`${dashUrl}\``,
          )
          .addFields({
            name: "What you can configure there",
            value: [
              "⚙️ Enable / disable Anti-Nuke",
              "🔨 Set punishment action (ban / kick / strip)",
              "📊 Configure thresholds & detection window",
              "👁️ Watch role perms, server settings & @everyone",
              "🔄 Role permission revert & punishment",
              "🛡️ Prune, vanity, rename & icon protections",
              "♻️ Auto-restore deleted channels & roles",
              "📋 Whitelist users & roles",
              "📝 Set log channel",
            ].join("\n"),
          })
          .setFooter({ text: "You must be a server admin to access the dashboard" })
          .setTimestamp(),
      ],
    });
  },
};

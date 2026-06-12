import {
  Client,
  AuditLogEvent,
  Guild,
  EmbedBuilder,
  GuildChannel,
  Role,
  PermissionFlagsBits,
  VerificationLevel,
} from "discord.js";
import {
  getAntiNuke,
  AntiNukeAction,
  cacheDeletedChannel,
  cacheDeletedRole,
  channelRecoveryCache,
  roleRecoveryCache,
} from "../store/antinuke";
import { sendSecurityLog } from "../lib/securityLog";
import { logger } from "../../lib/logger";

// ── Sliding-window action tracker ────────────────────────────────────────────
const actionLog = new Map<string, number[]>();

function record(
  guildId: string,
  userId: string,
  action: string,
  windowMs: number,
): number {
  const key = `${guildId}:${userId}:${action}`;
  const now = Date.now();
  const timestamps = (actionLog.get(key) ?? []).filter(
    (t) => now - t < windowMs,
  );
  timestamps.push(now);
  actionLog.set(key, timestamps);
  return timestamps.length;
}

function clearRecord(guildId: string, userId: string, action: string): void {
  actionLog.delete(`${guildId}:${userId}:${action}`);
}

// ── Dangerous permissions that should trigger watch alerts ───────────────────
const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.MentionEveryone,
];

function permName(p: bigint): string {
  if (p === PermissionFlagsBits.Administrator)    return "Administrator";
  if (p === PermissionFlagsBits.ManageGuild)      return "Manage Server";
  if (p === PermissionFlagsBits.ManageChannels)   return "Manage Channels";
  if (p === PermissionFlagsBits.ManageRoles)      return "Manage Roles";
  if (p === PermissionFlagsBits.BanMembers)       return "Ban Members";
  if (p === PermissionFlagsBits.KickMembers)      return "Kick Members";
  if (p === PermissionFlagsBits.ManageWebhooks)   return "Manage Webhooks";
  if (p === PermissionFlagsBits.ManageNicknames)  return "Manage Nicknames";
  if (p === PermissionFlagsBits.MentionEveryone)  return "Mention Everyone";
  return "Unknown";
}

const ACTION_LABEL: Record<string, string> = {
  channelDelete:  "Channel Delete",
  channelCreate:  "Channel Create",
  roleDelete:     "Role Delete",
  roleCreate:     "Role Create",
  ban:            "Ban",
  kick:           "Kick",
  webhookCreate:  "Webhook Create",
  webhookDelete:  "Webhook Delete",
  massTimeout:    "Mass Timeout",
  channelRename:  "Channel Rename",
  roleRename:     "Role Rename",
  prune:          "Member Prune",
  vanity:         "Vanity URL Change",
  serverRename:   "Server Rename",
  serverIcon:     "Server Icon Change",
};

// ── Check if user is whitelisted ──────────────────────────────────────────────
function isWhitelisted(
  cfg: ReturnType<typeof getAntiNuke>,
  guild: Guild,
  userId: string,
  roleIds: string[] = [],
): boolean {
  if (userId === guild.ownerId) return true;
  if (cfg.whitelist.includes(userId)) return true;
  if (cfg.whitelistRoles.some((r) => roleIds.includes(r))) return true;
  return false;
}

// ── DM the server owner ───────────────────────────────────────────────────────
async function dmOwner(
  client: Client,
  guild: Guild,
  title: string,
  description: string,
): Promise<void> {
  try {
    const owner = await client.users.fetch(guild.ownerId).catch(() => null);
    if (!owner) return;
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle(`🛡️ Anti-Nuke Alert — ${guild.name}`)
      .setDescription(`**${title}**\n\n${description}`)
      .setTimestamp();
    await owner.send({ embeds: [embed] }).catch(() => {});
  } catch {
    /* dm failed */
  }
}

// ── Punishment ────────────────────────────────────────────────────────────────
async function punish(
  client: Client,
  guild: Guild,
  userId: string,
  userTag: string,
  action: AntiNukeAction,
  actionType: string,
  count: number,
  windowMs: number,
): Promise<void> {
  const cfg = getAntiNuke(guild.id);
  const reason = `Anti-Nuke: ${count} ${ACTION_LABEL[actionType] ?? actionType} actions in ${windowMs / 1000}s`;

  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    const user =
      member?.user ?? (await client.users.fetch(userId).catch(() => null));

    if (user && (action === "ban" || action === "kick")) {
      const actionLabel = action === "ban" ? "banned from" : "kicked from";
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`🛡️ Anti-Nuke Action — ${guild.name}`)
        .setDescription(
          `You have been **${actionLabel}** **${guild.name}** because the anti-nuke system detected suspicious activity from your account.`,
        )
        .addFields(
          { name: "Trigger", value: ACTION_LABEL[actionType] ?? actionType, inline: true },
          { name: "Count", value: `${count} in ${windowMs / 1000}s`, inline: true },
          { name: "Action", value: `\`${action}\``, inline: true },
          { name: "Reason", value: reason },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    }

    if (action === "ban") {
      await guild.members.ban(userId, { reason, deleteMessageSeconds: 604800 });
    } else if (action === "kick" && member) {
      await member.kick(reason);
    } else if (action === "strip" && member) {
      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .map((r) => r.id);
      await member.roles.remove(roles, reason);
    }

    await sendSecurityLog(client, guild.id, cfg.logChannel, {
      title: "🛡️ Anti-Nuke — Triggered",
      color: 0xe74c3c,
      fields: [
        { name: "Action Taken", value: `\`${action}\``, inline: true },
        {
          name: "Trigger",
          value: ACTION_LABEL[actionType] ?? actionType,
          inline: true,
        },
        {
          name: "Count",
          value: `${count} in ${windowMs / 1000}s`,
          inline: true,
        },
        {
          name: "Offender",
          value: `<@${userId}> (${userId})`,
          inline: true,
        },
        { name: "Tag", value: userTag, inline: true },
        { name: "Reason", value: reason },
      ],
    });

    if (cfg.dmOwner) {
      await dmOwner(
        client,
        guild,
        `Punishment applied: \`${action}\``,
        `**${userTag}** (<@${userId}>) triggered the anti-nuke system.\n**Trigger:** ${ACTION_LABEL[actionType] ?? actionType} × ${count} in ${windowMs / 1000}s`,
      );
    }

    logger.warn(
      { guildId: guild.id, userId, action, reason },
      "Anti-nuke punishment applied",
    );
  } catch (err) {
    logger.error({ err, userId, action }, "Anti-nuke punishment failed");
  }
}

// ── Shared handler ────────────────────────────────────────────────────────────
async function handleAction(
  client: Client,
  guild: Guild,
  actionType: keyof import("../store/antinuke").AntiNukeThresholds,
  auditType: AuditLogEvent,
): Promise<void> {
  const cfg = getAntiNuke(guild.id);
  if (!cfg.enabled) return;

  let executorId: string | null = null;
  let executorTag = "Unknown#0000";
  let executorRoles: string[] = [];

  try {
    const logs = await guild.fetchAuditLogs({ type: auditType, limit: 1 });
    const entry = logs.entries.first();
    if (entry?.executor) {
      executorId = entry.executor.id;
      executorTag = entry.executor.tag;
    }
  } catch {
    return;
  }

  if (!executorId) return;
  if (executorId === client.user?.id) return;

  try {
    const m = guild.members.cache.get(executorId);
    if (m) executorRoles = [...m.roles.cache.keys()];
  } catch {
    /* cache miss is fine */
  }

  if (isWhitelisted(cfg, guild, executorId, executorRoles)) return;

  const count = record(guild.id, executorId, actionType, cfg.windowMs);
  const threshold = cfg.thresholds[actionType];

  if (count >= Math.ceil(threshold / 2) && count < threshold) {
    await sendSecurityLog(client, guild.id, cfg.logChannel, {
      title: "⚠️ Anti-Nuke — Approaching Threshold",
      color: 0xf39c12,
      fields: [
        {
          name: "Action",
          value: ACTION_LABEL[actionType] ?? actionType,
          inline: true,
        },
        {
          name: "Progress",
          value: `${count}/${threshold}`,
          inline: true,
        },
        {
          name: "Window",
          value: `${cfg.windowMs / 1000}s`,
          inline: true,
        },
        {
          name: "Suspect",
          value: `<@${executorId}> (${executorId})`,
          inline: true,
        },
        { name: "Tag", value: executorTag, inline: true },
      ],
    });
  }

  if (count >= threshold) {
    clearRecord(guild.id, executorId, actionType);
    await punish(
      client,
      guild,
      executorId,
      executorTag,
      cfg.action,
      actionType,
      count,
      cfg.windowMs,
    );
  }
}

// ── Role permission protection — revert + optional punish ────────────────────
async function handleRolePermChange(
  client: Client,
  oldRole: Role,
  newRole: Role,
): Promise<void> {
  const cfg = getAntiNuke(newRole.guild.id);
  if (!cfg.enabled) return;

  const isEveryoneRole = newRole.id === newRole.guild.id;

  const shouldWatch =
    (isEveryoneRole && cfg.watchEveryonePerms) ||
    (!isEveryoneRole && cfg.watchRolePerms);

  if (!shouldWatch) return;

  const oldPerms = oldRole.permissions.bitfield;
  const newPerms = newRole.permissions.bitfield;
  const added = newPerms & ~oldPerms;

  const newDangerous = DANGEROUS_PERMS.filter((p) => (added & p) === p);
  if (newDangerous.length === 0) return;

  let executorId = "";
  let executorTag = "Unknown";
  try {
    const logs = await newRole.guild.fetchAuditLogs({
      type: AuditLogEvent.RoleUpdate,
      limit: 1,
    });
    const entry = logs.entries.first();
    if (entry?.executor) {
      executorId = entry.executor.id;
      executorTag = entry.executor.tag;
    }
  } catch {
    return;
  }

  if (!executorId || executorId === client.user?.id) return;
  const m = newRole.guild.members.cache.get(executorId);
  const executorRoles = m ? [...m.roles.cache.keys()] : [];
  if (isWhitelisted(cfg, newRole.guild, executorId, executorRoles)) return;

  const permNames = newDangerous.map(permName);

  const roleLabel = isEveryoneRole
    ? `@everyone`
    : `<@&${newRole.id}> (${newRole.name})`;

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Role", value: roleLabel, inline: true },
    {
      name: "Modified by",
      value: `<@${executorId}> ${executorTag}`,
      inline: true,
    },
    { name: "Dangerous Perms Added", value: permNames.join(", ") },
  ];

  let reverted = false;
  if (cfg.revertRolePerms || (isEveryoneRole && cfg.watchEveryonePerms)) {
    try {
      await newRole.setPermissions(
        oldRole.permissions,
        `Anti-Nuke: Reverted unauthorized permission grant by ${executorTag}`,
      );
      reverted = true;
      fields.push({ name: "Reverted", value: "✅ Permissions restored to previous state", inline: false });
      logger.warn(
        { guildId: newRole.guild.id, roleId: newRole.id, executorId, permNames },
        "Anti-nuke: Role permissions reverted",
      );
    } catch (err) {
      fields.push({ name: "Revert", value: "❌ Failed to revert (missing permissions)", inline: false });
      logger.error({ err }, "Anti-nuke: Failed to revert role permissions");
    }
  }

  if (cfg.punishRolePerms || (isEveryoneRole && cfg.watchEveryonePerms && cfg.punishRolePerms)) {
    const reason = `Anti-Nuke: Added dangerous permissions (${permNames.join(", ")}) to ${isEveryoneRole ? "@everyone" : newRole.name}`;
    try {
      const member = await newRole.guild.members.fetch(executorId).catch(() => null);
      if (member) {
        const action = cfg.action;
        if (action === "ban") {
          await newRole.guild.members.ban(executorId, { reason, deleteMessageSeconds: 604800 });
        } else if (action === "kick") {
          await member.kick(reason);
        } else if (action === "strip") {
          const roles = member.roles.cache
            .filter((r) => r.id !== newRole.guild.id && !r.managed)
            .map((r) => r.id);
          await member.roles.remove(roles, reason);
        }
        fields.push({ name: "Punishment", value: `\`${action}\` applied to <@${executorId}>`, inline: false });
      }
    } catch (err) {
      logger.error({ err }, "Anti-nuke: Failed to punish role perm executor");
    }
  }

  const titlePrefix = isEveryoneRole
    ? "🚨 Anti-Nuke — @everyone Permissions Changed"
    : "⚠️ Anti-Nuke — Dangerous Role Permissions Added";
  const color = (cfg.revertRolePerms || reverted) ? 0xe74c3c : 0xf39c12;

  await sendSecurityLog(client, newRole.guild.id, cfg.logChannel, {
    title: titlePrefix,
    color,
    fields,
  });

  if (cfg.dmOwner) {
    await dmOwner(
      client,
      newRole.guild,
      isEveryoneRole
        ? "@everyone role permissions were changed"
        : "Dangerous permissions granted to a role",
      `**${executorTag}** (<@${executorId}>) added \`${permNames.join(", ")}\` to ${roleLabel}.${reverted ? "\n✅ Permissions have been **automatically reverted**." : ""}`,
    );
  }
}

// ── Prune entry dedup set (in-memory) ────────────────────────────────────────
const handledPruneEntries = new Set<string>();

// ── Registration ──────────────────────────────────────────────────────────────
export function registerAntiNukeEvents(client: Client) {

  // ── Channel events — cache before deletion ───────────────────────────────
  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    const cfg = getAntiNuke(channel.guild.id);

    if (cfg.restoreEnabled && "permissionOverwrites" in channel) {
      const ch = channel as GuildChannel;
      cacheDeletedChannel(channel.guild.id, {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        parentId: ch.parentId,
        position: ch.position,
        topic: "topic" in ch ? (ch as any).topic : null,
        nsfw: "nsfw" in ch ? (ch as any).nsfw : false,
        permOverwrites: ch.permissionOverwrites.cache.map((ov) => ({
          id: ov.id,
          type: ov.type,
          allow: ov.allow.bitfield.toString(),
          deny: ov.deny.bitfield.toString(),
        })),
        deletedAt: Date.now(),
      });
    }

    await handleAction(
      client,
      channel.guild,
      "channelDelete",
      AuditLogEvent.ChannelDelete,
    );
  });

  client.on("channelCreate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAction(
      client,
      channel.guild,
      "channelCreate",
      AuditLogEvent.ChannelCreate,
    );
  });

  // ── Channel update — detect channel renames ───────────────────────────────
  client.on("channelUpdate", async (oldChannel, newChannel) => {
    if (!("guild" in newChannel) || !newChannel.guild) return;
    const cfg = getAntiNuke(newChannel.guild.id);
    if (!cfg.enabled || !cfg.antiChannelRenameEnabled) return;
    const oldName = (oldChannel as any).name;
    const newName = (newChannel as any).name;
    if (!oldName || !newName || oldName === newName) return;

    if (cfg.revertChannelRename) {
      await (newChannel as any)
        .setName(oldName, "Anti-Nuke: Reverted unauthorized channel rename")
        .catch((err: any) => logger.error({ err }, "Anti-nuke: Failed to revert channel rename"));
    }

    await handleAction(
      client,
      newChannel.guild,
      "channelRename",
      AuditLogEvent.ChannelUpdate,
    ).catch((err) => logger.error({ err }, "Anti-nuke channelRename handler failed"));
  });

  // ── Role events — cache before deletion ──────────────────────────────────
  client.on("roleDelete", async (role: Role) => {
    const cfg = getAntiNuke(role.guild.id);

    if (cfg.restoreEnabled) {
      cacheDeletedRole(role.guild.id, {
        id: role.id,
        name: role.name,
        color: role.color,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable,
        hoist: role.hoist,
        position: role.position,
        deletedAt: Date.now(),
      });
    }

    await handleAction(client, role.guild, "roleDelete", AuditLogEvent.RoleDelete);
  });

  client.on("roleCreate", async (role: Role) => {
    await handleAction(client, role.guild, "roleCreate", AuditLogEvent.RoleCreate);
  });

  // ── Role update — dangerous perm grants + @everyone + rename detection ───
  client.on("roleUpdate", async (oldRole: Role, newRole: Role) => {
    await handleRolePermChange(client, oldRole, newRole).catch((err) =>
      logger.error({ err }, "Anti-nuke roleUpdate handler failed"),
    );

    // Anti-role-rename detection (threshold-based)
    const cfg = getAntiNuke(newRole.guild.id);
    if (cfg.enabled && cfg.antiRoleRenameEnabled && oldRole.name !== newRole.name) {
      if (cfg.revertRoleRename) {
        await newRole
          .setName(oldRole.name, "Anti-Nuke: Reverted unauthorized role rename")
          .catch((err) => logger.error({ err }, "Anti-nuke: Failed to revert role rename"));
      }
      await handleAction(client, newRole.guild, "roleRename", AuditLogEvent.RoleUpdate).catch((err) =>
        logger.error({ err }, "Anti-nuke roleRename handler failed"),
      );
    }
  });

  // ── Guild update — security downgrades + vanity / rename / icon ──────────
  client.on("guildUpdate", async (oldGuild, newGuild) => {
    const cfg = getAntiNuke(newGuild.id);
    if (!cfg.enabled) return;

    // ── Security downgrade alerts (existing) ──────────────────────────────
    if (cfg.watchServerUpdate) {
      const secAlerts: string[] = [];
      if (
        (newGuild.verificationLevel as number) <
        (oldGuild.verificationLevel as number)
      ) {
        const levels: Record<VerificationLevel, string> = {
          [VerificationLevel.None]:     "None",
          [VerificationLevel.Low]:      "Low",
          [VerificationLevel.Medium]:   "Medium",
          [VerificationLevel.High]:     "High",
          [VerificationLevel.VeryHigh]: "Very High",
        };
        secAlerts.push(
          `Verification level lowered: **${levels[oldGuild.verificationLevel]}** → **${levels[newGuild.verificationLevel]}**`,
        );
      }
      if (oldGuild.mfaLevel === 1 && newGuild.mfaLevel === 0) {
        secAlerts.push("2FA requirement for moderation actions was **removed**");
      }
      if (secAlerts.length > 0) {
        let executorTagSec = "Unknown";
        try {
          const logs = await newGuild.fetchAuditLogs({
            type: AuditLogEvent.GuildUpdate,
            limit: 1,
          });
          const entry = logs.entries.first();
          if (entry?.executor)
            executorTagSec = `<@${entry.executor.id}> (${entry.executor.tag})`;
        } catch { /* ignore */ }
        await sendSecurityLog(client, newGuild.id, cfg.logChannel, {
          title: "🚨 Anti-Nuke — Security Settings Changed",
          color: 0xe74c3c,
          fields: [
            { name: "Changed by", value: executorTagSec },
            { name: "Changes",    value: secAlerts.join("\n") },
          ],
        });
        if (cfg.dmOwner) {
          await dmOwner(
            client,
            newGuild,
            "Server security settings were changed",
            secAlerts.join("\n") + `\n\nExecuted by: ${executorTagSec}`,
          );
        }
      }
    }

    // ── New: Vanity URL / Server Rename / Server Icon checks ─────────────
    const needsNewChecks =
      (cfg.antiVanityEnabled      && oldGuild.vanityURLCode !== newGuild.vanityURLCode) ||
      (cfg.antiServerRenameEnabled && oldGuild.name         !== newGuild.name)          ||
      (cfg.antiServerIconEnabled   && oldGuild.icon         !== newGuild.icon);

    if (!needsNewChecks) return;

    let executorId: string | null = null;
    let executorTag = "Unknown";
    try {
      const logs = await newGuild.fetchAuditLogs({
        type: AuditLogEvent.GuildUpdate,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (entry?.executor) {
        executorId = entry.executor.id;
        executorTag = entry.executor.tag;
      }
    } catch { return; }

    if (!executorId || executorId === client.user?.id) return;
    const m = newGuild.members.cache.get(executorId);
    const executorRoles = m ? [...m.roles.cache.keys()] : [];
    if (isWhitelisted(cfg, newGuild, executorId, executorRoles)) return;

    if (cfg.antiVanityEnabled && oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
      const oldV = oldGuild.vanityURLCode ?? "none";
      const newV = newGuild.vanityURLCode ?? "removed";
      await sendSecurityLog(client, newGuild.id, cfg.logChannel, {
        title: "🚨 Anti-Nuke — Vanity URL Changed",
        color: 0xe74c3c,
        fields: [
          { name: "Changed by", value: `<@${executorId}> (${executorTag})`, inline: true },
          { name: "Old Vanity",  value: oldV,                                inline: true },
          { name: "New Vanity",  value: newV,                                inline: true },
        ],
      });
      if (cfg.dmOwner)
        await dmOwner(client, newGuild, "Vanity URL changed",
          `**${executorTag}** changed the vanity URL from \`${oldV}\` to \`${newV}\`.`);
      await punish(client, newGuild, executorId, executorTag, cfg.action, "vanity", 1, cfg.windowMs);
    }

    if (cfg.antiServerRenameEnabled && oldGuild.name !== newGuild.name) {
      if (cfg.revertServerRename) {
        await newGuild
          .setName(oldGuild.name, "Anti-Nuke: Reverted unauthorized server rename")
          .catch((err) => logger.error({ err }, "Anti-nuke: Failed to revert server rename"));
      }
      await sendSecurityLog(client, newGuild.id, cfg.logChannel, {
        title: "🚨 Anti-Nuke — Server Renamed",
        color: 0xe74c3c,
        fields: [
          { name: "Changed by", value: `<@${executorId}> (${executorTag})`, inline: true },
          { name: "Old Name",   value: oldGuild.name,                        inline: true },
          { name: "New Name",   value: newGuild.name,                        inline: true },
          ...(cfg.revertServerRename ? [{ name: "Reverted", value: "✅ Name restored automatically", inline: true }] : []),
        ],
      });
      if (cfg.dmOwner)
        await dmOwner(client, newGuild, "Server was renamed",
          `**${executorTag}** renamed the server from **${oldGuild.name}** to **${newGuild.name}**.${cfg.revertServerRename ? "\n✅ Name has been **automatically restored**." : ""}`);
      await punish(client, newGuild, executorId, executorTag, cfg.action, "serverRename", 1, cfg.windowMs);
    }

    if (cfg.antiServerIconEnabled && oldGuild.icon !== newGuild.icon) {
      await sendSecurityLog(client, newGuild.id, cfg.logChannel, {
        title: "🚨 Anti-Nuke — Server Icon Changed",
        color: 0xe74c3c,
        fields: [
          { name: "Changed by", value: `<@${executorId}> (${executorTag})`, inline: true },
          { name: "Change",     value: "Server icon was modified",           inline: true },
        ],
      });
      if (cfg.dmOwner)
        await dmOwner(client, newGuild, "Server icon changed",
          `**${executorTag}** changed the server icon.`);
      await punish(client, newGuild, executorId, executorTag, cfg.action, "serverIcon", 1, cfg.windowMs);
    }
  });

  // ── Ban events ───────────────────────────────────────────────────────────
  client.on("guildBanAdd", async (ban) => {
    await handleAction(client, ban.guild, "ban", AuditLogEvent.MemberBanAdd);
  });

  // ── Kick detection via guildMemberRemove ─────────────────────────────────
  client.on("guildMemberRemove", async (member) => {
    const cfg = getAntiNuke(member.guild.id);
    if (!cfg.enabled) return;
    try {
      const logs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (!entry || entry.target?.id !== member.id) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;
      if (!entry.executor) return;
      if (entry.executor.id === client.user?.id) return;

      const m = member.guild.members.cache.get(entry.executor.id);
      const executorRoles = m ? [...m.roles.cache.keys()] : [];
      if (isWhitelisted(cfg, member.guild, entry.executor.id, executorRoles))
        return;

      const count = record(
        member.guild.id,
        entry.executor.id,
        "kick",
        cfg.windowMs,
      );
      const threshold = cfg.thresholds.kick;

      if (
        count >= Math.ceil(threshold / 2) &&
        count < threshold
      ) {
        await sendSecurityLog(client, member.guild.id, cfg.logChannel, {
          title: "⚠️ Anti-Nuke — Approaching Threshold",
          color: 0xf39c12,
          fields: [
            { name: "Action",   value: "Kick",                                       inline: true },
            { name: "Progress", value: `${count}/${threshold}`,                      inline: true },
            { name: "Window",   value: `${cfg.windowMs / 1000}s`,                   inline: true },
            { name: "Suspect",  value: `<@${entry.executor.id}> (${entry.executor.id})`, inline: true },
            { name: "Tag",      value: entry.executor.tag,                           inline: true },
          ],
        });
      }

      if (count >= threshold) {
        clearRecord(member.guild.id, entry.executor.id, "kick");
        await punish(
          client,
          member.guild,
          entry.executor.id,
          entry.executor.tag,
          cfg.action,
          "kick",
          count,
          cfg.windowMs,
        );
      }
    } catch {
      /* no audit log access */
    }
  });

  // ── Prune detection via guildMemberRemove ────────────────────────────────
  client.on("guildMemberRemove", async (member) => {
    const cfg = getAntiNuke(member.guild.id);
    if (!cfg.enabled || !cfg.antiPruneEnabled) return;
    try {
      const logs = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberPrune,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (!entry) return;
      if (Date.now() - entry.createdTimestamp > 5000) return;
      if (handledPruneEntries.has(entry.id)) return;
      handledPruneEntries.add(entry.id);
      setTimeout(() => handledPruneEntries.delete(entry.id), 30_000);

      if (!entry.executor) return;
      if (entry.executor.id === client.user?.id) return;

      const m = member.guild.members.cache.get(entry.executor.id);
      const executorRoles = m ? [...m.roles.cache.keys()] : [];
      if (isWhitelisted(cfg, member.guild, entry.executor.id, executorRoles)) return;

      const pruneCount = (entry.extra as any)?.removed ?? 1;

      await sendSecurityLog(client, member.guild.id, cfg.logChannel, {
        title: "🚨 Anti-Nuke — Member Prune Detected",
        color: 0xe74c3c,
        fields: [
          { name: "Executor",        value: `<@${entry.executor.id}> (${entry.executor.tag})`, inline: true },
          { name: "Members Pruned",  value: String(pruneCount),                                 inline: true },
        ],
      });
      await punish(
        client,
        member.guild,
        entry.executor.id,
        entry.executor.tag,
        cfg.action,
        "prune",
        pruneCount,
        cfg.windowMs,
      );
      if (cfg.dmOwner) {
        await dmOwner(
          client,
          member.guild,
          "Member prune detected",
          `**${entry.executor.tag}** pruned **${pruneCount}** members.`,
        );
      }
    } catch {
      /* no audit log access */
    }
  });

  // ── Mass timeout detection ────────────────────────────────────────────────
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    const cfg = getAntiNuke(newMember.guild.id);
    if (!cfg.enabled) return;

    const wasTimedOut = !!oldMember.communicationDisabledUntil;
    const isTimedOut = !!newMember.communicationDisabledUntil;
    if (wasTimedOut || !isTimedOut) return;

    try {
      const logs = await newMember.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberUpdate,
        limit: 1,
      });
      const entry = logs.entries.first();
      if (!entry?.executor) return;
      if (entry.executor.id === client.user?.id) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;

      const m = newMember.guild.members.cache.get(entry.executor.id);
      const executorRoles = m ? [...m.roles.cache.keys()] : [];
      if (
        isWhitelisted(cfg, newMember.guild, entry.executor.id, executorRoles)
      )
        return;

      const count = record(
        newMember.guild.id,
        entry.executor.id,
        "massTimeout",
        cfg.windowMs,
      );
      const threshold = cfg.thresholds.massTimeout;

      if (count >= threshold) {
        clearRecord(newMember.guild.id, entry.executor.id, "massTimeout");
        await punish(
          client,
          newMember.guild,
          entry.executor.id,
          entry.executor.tag,
          cfg.action,
          "massTimeout",
          count,
          cfg.windowMs,
        );
      }
    } catch {
      /* no audit log access */
    }
  });

  // ── Webhook events ────────────────────────────────────────────────────────
  client.on("webhookUpdate", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ limit: 1 });
      const entry = logs.entries.first();
      if (!entry) return;

      if (entry.action === AuditLogEvent.WebhookCreate) {
        await handleAction(
          client,
          channel.guild,
          "webhookCreate",
          AuditLogEvent.WebhookCreate,
        );
      } else if (entry.action === AuditLogEvent.WebhookDelete) {
        await handleAction(
          client,
          channel.guild,
          "webhookDelete",
          AuditLogEvent.WebhookDelete,
        );
      }
    } catch {
      /* no audit log */
    }
  });

}

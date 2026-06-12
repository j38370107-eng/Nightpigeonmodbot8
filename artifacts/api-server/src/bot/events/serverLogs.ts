import {
  AttachmentBuilder,
  Client,
  Message,
  PartialMessage,
  GuildMember,
  PartialGuildMember,
  GuildBan,
  NonThreadGuildBasedChannel,
  Role,
  VoiceState,
  AuditLogEvent,
  ChannelType,
  Collection,
  GuildChannel,
  ThreadChannel,
  Sticker,
  GuildEmoji,
  Invite,
  StageInstance,
} from "discord.js";
import { sendServerLog } from "../lib/serverlog";
import {
  isChannelIgnored,
  isRoleIgnored,
  isUserIgnored,
  shouldLogBotActions,
} from "../store/serverlogging";

// ── helpers ──────────────────────────────────────────────────────────────────

function truncate(str: string, max = 1024): string {
  if (!str) return "*empty*";
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

// ── media attachment cache ────────────────────────────────────────────────────
// Proactively cache image/video attachment metadata on messageCreate so we can
// re-upload them to the log channel when the message is deleted.

interface CachedAttachment {
  url: string;
  name: string;
  contentType: string | null;
}

const MEDIA_CACHE_MAX = 2000;
const mediaCache = new Map<string, CachedAttachment[]>();

function cacheMessageMedia(msg: Message): void {
  if (!msg.attachments.size) return;
  const media = [...msg.attachments.values()]
    .filter((a) => a.contentType?.startsWith("image/") || a.contentType?.startsWith("video/"))
    .map((a) => ({ url: a.url, name: a.name, contentType: a.contentType ?? null }));
  if (!media.length) return;
  if (mediaCache.size >= MEDIA_CACHE_MAX) {
    const firstKey = mediaCache.keys().next().value;
    if (firstKey) mediaCache.delete(firstKey);
  }
  mediaCache.set(msg.id, media);
}

async function fetchAttachmentBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function channelTypeName(type: ChannelType): string {
  const map: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]: "Text",
    [ChannelType.GuildVoice]: "Voice",
    [ChannelType.GuildCategory]: "Category",
    [ChannelType.GuildAnnouncement]: "Announcement",
    [ChannelType.GuildStageVoice]: "Stage",
    [ChannelType.GuildForum]: "Forum",
    [ChannelType.GuildThread]: "Thread",
  };
  return map[type] ?? "Channel";
}

function ts(ms: number): string {
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

// ── registration ──────────────────────────────────────────────────────────────

export function registerServerLogEvents(client: Client) {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MESSAGE LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Populate media cache so deleted-message logs can re-upload the files
  client.on("messageCreate", (msg: Message) => {
    if (msg.attachments.size) cacheMessageMedia(msg);
  });

  client.on("messageDelete", async (msg: Message | PartialMessage) => {
    if (!msg.guild) return;
    if (!shouldLogBotActions(msg.guild.id) && msg.author?.bot) return;
    if (isChannelIgnored(msg.guild.id, msg.channelId)) return;
    if (msg.author && isUserIgnored(msg.guild.id, msg.author.id)) return;

    let deletedBy = "";
    try {
      const logs = await msg.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === msg.author?.id && Date.now() - entry.createdTimestamp < 5000) {
        deletedBy = `\n**Deleted by:** <@${entry.executor?.id}> (${entry.executor?.tag})`;
      }
    } catch { /* no audit log access */ }

    // ── gather media attachments ──────────────────────────────────────────────
    // Pull from our proactive cache first; fall back to discord.js message cache
    const cachedMedia = mediaCache.get(msg.id) ?? [];
    mediaCache.delete(msg.id);

    // Also check discord.js message cache for any attachments not in our cache
    const djsAttachments = (msg as Message).attachments
      ? [...(msg as Message).attachments.values()].filter(
          (a) => a.contentType?.startsWith("image/") || a.contentType?.startsWith("video/")
        )
      : [];

    // Merge: prefer our cache entries (same IDs), add any extras from djs
    const cachedUrls = new Set(cachedMedia.map((c) => c.url));
    const allMedia: CachedAttachment[] = [
      ...cachedMedia,
      ...djsAttachments
        .filter((a) => !cachedUrls.has(a.url))
        .map((a) => ({ url: a.url, name: a.name, contentType: a.contentType ?? null })),
    ];

    // Try to re-download and re-upload each image/video
    const files: AttachmentBuilder[] = [];
    let firstImageName: string | null = null;

    for (const media of allMedia) {
      const buf = await fetchAttachmentBuffer(media.url);
      if (buf) {
        files.push(new AttachmentBuilder(buf, { name: media.name }));
        if (!firstImageName && media.contentType?.startsWith("image/")) {
          firstImageName = media.name;
        }
      }
    }

    // Build extra fields for attachment info
    const extraFields: { name: string; value: string; inline?: boolean }[] = [];
    if (allMedia.length > 0) {
      const mediaList = allMedia
        .map((m) => `\`${m.name}\` (${m.contentType ?? "unknown"})`)
        .join("\n");
      extraFields.push({ name: `📎 Attachment${allMedia.length > 1 ? "s" : ""} (${allMedia.length})`, value: mediaList });
    }

    await sendServerLog(client, msg.guild.id, "messageDelete", {
      title: "🗑️ Message Deleted",
      color: 0xe74c3c,
      description: `Message by <@${msg.author?.id ?? "unknown"}> deleted in <#${msg.channelId}>${deletedBy}`,
      fields: [
        { name: "Content", value: truncate(msg.content ?? "*unavailable*") },
        { name: "Author", value: `<@${msg.author?.id ?? "unknown"}> (${msg.author?.id ?? "?"})`, inline: true },
        { name: "Channel", value: `<#${msg.channelId}>`, inline: true },
        ...extraFields,
      ],
      thumbnail: msg.author?.displayAvatarURL() ?? undefined,
      image: firstImageName ? `attachment://${firstImageName}` : undefined,
      files,
    });
  });

  client.on("messageUpdate", async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!newMsg.guild || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    if (isChannelIgnored(newMsg.guild.id, newMsg.channelId)) return;
    if (isUserIgnored(newMsg.guild.id, newMsg.author?.id ?? "")) return;

    await sendServerLog(client, newMsg.guild.id, "messageEdit", {
      title: "✏️ Message Edited",
      color: 0x3498db,
      description: `Message by <@${newMsg.author?.id}> edited in <#${newMsg.channelId}> — [Jump](${newMsg.url})`,
      fields: [
        { name: "Before", value: truncate(oldMsg.content ?? "*unavailable*") },
        { name: "After", value: truncate(newMsg.content ?? "*unavailable*") },
        { name: "Author", value: `<@${newMsg.author?.id}> (${newMsg.author?.id})`, inline: true },
        { name: "Channel", value: `<#${newMsg.channelId}>`, inline: true },
      ],
      thumbnail: newMsg.author?.displayAvatarURL() ?? undefined,
    });
  });

  client.on("messageDeleteBulk", async (messages: Collection<string, Message | PartialMessage>, channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    if (isChannelIgnored(channel.guild.id, channel.id)) return;

    let deletedBy = "";
    let executorTag = "";
    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.MessageBulkDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) {
        executorTag = entry.executor?.tag ?? "Unknown";
        deletedBy = `\n**Purged by:** <@${entry.executor?.id}> (${executorTag})`;
      }
    } catch { /* no audit log access */ }

    // Build monospace message list (oldest → newest)
    const sorted = [...messages.values()].sort(
      (a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0)
    );

    const msgLines: string[] = [];
    for (const msg of sorted) {
      const time = msg.createdAt
        ? msg.createdAt.toTimeString().slice(0, 8)
        : "??:??:??";
      const author = msg.author ? msg.author.tag : "Unknown";
      const content = (msg as Message).content || "[no text]";
      const hasAttachment = (msg as Message).attachments?.size
        ? ` [📎${(msg as Message).attachments.size}]`
        : "";
      msgLines.push(`[${time}] ${author}: ${content}${hasAttachment}`);
    }

    // Fit inside the 4096-char embed description limit
    const header = `**${messages.size}** messages deleted in <#${channel.id}>${deletedBy}\n\n`;
    const BLOCK_LIMIT = 4096 - header.length - 8; // 8 = ```\n ... \n```
    let block = msgLines.join("\n");
    if (block.length > BLOCK_LIMIT) {
      block = block.slice(0, BLOCK_LIMIT - 20) + "\n… (truncated)";
    }

    await sendServerLog(client, channel.guild.id, "messageBulkDelete", {
      title: "🗑️ Bulk Message Delete (Purge)",
      color: 0xe74c3c,
      description: `${header}\`\`\`\n${block}\n\`\`\``,
      fields: [
        { name: "Channel", value: `<#${channel.id}>`, inline: true },
        { name: "Count", value: `${messages.size} messages`, inline: true },
      ],
    });
  });

  client.on("channelPinsUpdate", async (channel, time) => {
    if (!("guild" in channel) || !channel.guild) return;
    if (isChannelIgnored(channel.guild.id, channel.id)) return;

    let actor = "";
    try {
      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.MessagePin, limit: 1 });
      const entry = logs.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 5000) {
        actor = `\n**By:** <@${entry.executor?.id}>`;
      }
    } catch { /* no audit log access */ }

    await sendServerLog(client, channel.guild.id, "messagePinned", {
      title: "📌 Message Pinned/Unpinned",
      color: 0xf39c12,
      description: `Pins updated in <#${channel.id}>${actor}`,
      fields: [{ name: "Channel", value: `<#${channel.id}>`, inline: true }],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MEMBER LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("guildMemberAdd", async (member: GuildMember) => {
    if (isUserIgnored(member.guild.id, member.id)) return;
    const created = ts(member.user.createdTimestamp);
    const age = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
    await sendServerLog(client, member.guild.id, "memberJoin", {
      title: "📥 Member Joined",
      color: 0x2ecc71,
      description: `<@${member.id}> joined the server`,
      fields: [
        { name: "User", value: `${member.user.tag} (${member.id})`, inline: true },
        { name: "Account Created", value: `${created} (${age}d ago)`, inline: true },
        { name: "Member #", value: `${member.guild.memberCount}`, inline: true },
      ],
      thumbnail: member.user.displayAvatarURL(),
    });
  });

  client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
    if (isUserIgnored(member.guild.id, member.id)) return;

    let action = "left";
    let color = 0xe67e22;
    let title = "📤 Member Left";
    let actor = "";

    try {
      const logs = await member.guild.fetchAuditLogs({ limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === member.id && Date.now() - entry.createdTimestamp < 5000) {
        if (entry.action === AuditLogEvent.MemberKick) {
          action = `kicked by <@${entry.executor?.id}>`;
          title = "👢 Member Kicked";
          color = 0xe74c3c;
          actor = `\n**Reason:** ${entry.reason ?? "No reason provided"}`;

          await sendServerLog(client, member.guild.id, "memberLeave", {
            title,
            color,
            description: `<@${member.id}> was kicked${actor}`,
            fields: [
              { name: "User", value: `${member.user?.tag ?? "Unknown"} (${member.id})`, inline: true },
              { name: "Kicked by", value: `<@${entry.executor?.id}>`, inline: true },
              { name: "Reason", value: entry.reason ?? "No reason provided" },
            ],
            thumbnail: member.user?.displayAvatarURL() ?? undefined,
          });
          return;
        }
      }
    } catch { /* no audit log access */ }

    await sendServerLog(client, member.guild.id, "memberLeave", {
      title,
      color,
      description: `<@${member.id}> ${action}`,
      fields: [
        { name: "User", value: `${member.user?.tag ?? "Unknown"} (${member.id})`, inline: true },
        {
          name: "Roles",
          value: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`).join(", ") || "None",
          inline: true,
        },
      ],
      thumbnail: member.user?.displayAvatarURL() ?? undefined,
    });
  });

  client.on("guildBanAdd", async (ban: GuildBan) => {
    if (isUserIgnored(ban.guild.id, ban.user.id)) return;
    let reason = ban.reason ?? "No reason provided";
    let bannedBy = "";
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === ban.user.id) {
        reason = entry.reason ?? reason;
        bannedBy = entry.executor?.id ?? "";
      }
    } catch { /* no audit log access */ }

    await sendServerLog(client, ban.guild.id, "memberBan", {
      title: "🔨 Member Banned",
      color: 0xe74c3c,
      description: `<@${ban.user.id}> was banned from the server`,
      fields: [
        { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        ...(bannedBy ? [{ name: "Banned by", value: `<@${bannedBy}>`, inline: true }] : []),
        { name: "Reason", value: reason },
      ],
      thumbnail: ban.user.displayAvatarURL(),
    });
  });

  client.on("guildBanRemove", async (ban: GuildBan) => {
    let unbannedBy = "";
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 });
      const entry = logs.entries.first();
      if (entry && entry.target?.id === ban.user.id) {
        unbannedBy = entry.executor?.id ?? "";
      }
    } catch { /* no audit log access */ }

    await sendServerLog(client, ban.guild.id, "memberUnban", {
      title: "✅ Member Unbanned",
      color: 0x2ecc71,
      description: `<@${ban.user.id}> was unbanned`,
      fields: [
        { name: "User", value: `${ban.user.tag} (${ban.user.id})`, inline: true },
        ...(unbannedBy ? [{ name: "Unbanned by", value: `<@${unbannedBy}>`, inline: true }] : []),
      ],
      thumbnail: ban.user.displayAvatarURL(),
    });
  });

  client.on("guildMemberUpdate", async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    const guildId = newMember.guild.id;
    if (isUserIgnored(guildId, newMember.id)) return;

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      await sendServerLog(client, guildId, "nicknameChange", {
        title: "🏷️ Nickname Changed",
        color: 0x9b59b6,
        description: `<@${newMember.id}>'s nickname was updated`,
        fields: [
          { name: "Before", value: oldMember.nickname ?? "*none*", inline: true },
          { name: "After", value: newMember.nickname ?? "*none*", inline: true },
        ],
        thumbnail: newMember.user.displayAvatarURL(),
      });
    }

    // Timeout
    const wasTimedOut = oldMember.communicationDisabledUntilTimestamp;
    const isTimedOut = newMember.communicationDisabledUntilTimestamp;

    if (!wasTimedOut && isTimedOut && isTimedOut > Date.now()) {
      let reason = "No reason provided";
      let actor = "";
      try {
        const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 });
        const entry = logs.entries.first();
        if (entry && entry.target?.id === newMember.id) {
          reason = entry.reason ?? reason;
          actor = entry.executor?.id ?? "";
        }
      } catch { /* no access */ }

      await sendServerLog(client, guildId, "memberTimeout", {
        title: "⏱️ Member Timed Out",
        color: 0xe67e22,
        description: `<@${newMember.id}> was timed out`,
        fields: [
          { name: "Expires", value: ts(isTimedOut), inline: true },
          ...(actor ? [{ name: "By", value: `<@${actor}>`, inline: true }] : []),
          { name: "Reason", value: reason },
        ],
        thumbnail: newMember.user.displayAvatarURL(),
      });
    } else if (wasTimedOut && (!isTimedOut || isTimedOut < Date.now())) {
      await sendServerLog(client, guildId, "timeoutRemoved", {
        title: "✅ Timeout Removed",
        color: 0x2ecc71,
        description: `<@${newMember.id}>'s timeout was removed`,
        fields: [{ name: "User", value: `${newMember.user.tag} (${newMember.id})`, inline: true }],
        thumbnail: newMember.user.displayAvatarURL(),
      });
    }

    // Role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const added = newRoles.filter((r) => !oldRoles.has(r.id) && r.id !== newMember.guild.id);
    const removed = oldRoles.filter((r) => !newRoles.has(r.id) && r.id !== newMember.guild.id);
    const ignoredRoles = isRoleIgnored(guildId, [...added.keys(), ...removed.keys()]);

    if (!ignoredRoles && (added.size > 0 || removed.size > 0)) {
      const fields = [];
      if (added.size > 0) fields.push({ name: "✅ Roles Added", value: added.map((r) => `<@&${r.id}>`).join(", "), inline: true });
      if (removed.size > 0) fields.push({ name: "❌ Roles Removed", value: removed.map((r) => `<@&${r.id}>`).join(", "), inline: true });

      await sendServerLog(client, guildId, "rolesChange", {
        title: "🎭 Member Roles Updated",
        color: 0x1abc9c,
        description: `<@${newMember.id}>'s roles were changed`,
        fields,
        thumbnail: newMember.user.displayAvatarURL(),
      });
    }

    // Avatar/username changes
    if (oldMember.user && newMember.user) {
      if (oldMember.user.username !== newMember.user.username) {
        await sendServerLog(client, guildId, "usernameChange", {
          title: "📝 Username Changed",
          color: 0x3498db,
          description: `<@${newMember.id}>'s username changed`,
          fields: [
            { name: "Before", value: oldMember.user.username, inline: true },
            { name: "After", value: newMember.user.username, inline: true },
          ],
          thumbnail: newMember.user.displayAvatarURL(),
        });
      }
      if (oldMember.user.avatar !== newMember.user.avatar) {
        await sendServerLog(client, guildId, "avatarChange", {
          title: "🖼️ Avatar Changed",
          color: 0x9b59b6,
          description: `<@${newMember.id}> updated their avatar`,
          fields: [{ name: "User", value: `${newMember.user.tag} (${newMember.id})`, inline: true }],
          thumbnail: newMember.user.displayAvatarURL(),
        });
      }
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ROLE LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("roleCreate", async (role: Role) => {
    await sendServerLog(client, role.guild.id, "roleCreate", {
      title: "🎭 Role Created",
      color: 0x2ecc71,
      description: `New role created: <@&${role.id}>`,
      fields: [
        { name: "Name", value: role.name, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
        { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
        { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true },
      ],
    });
  });

  client.on("roleDelete", async (role: Role) => {
    await sendServerLog(client, role.guild.id, "roleDelete", {
      title: "🗑️ Role Deleted",
      color: 0xe74c3c,
      description: `Role **${role.name}** was deleted`,
      fields: [
        { name: "Name", value: role.name, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
        { name: "Members had it", value: `${role.members.size}`, inline: true },
      ],
    });
  });

  client.on("roleUpdate", async (oldRole: Role, newRole: Role) => {
    const changes: string[] = [];
    if (oldRole.name !== newRole.name) changes.push(`**Name:** \`${oldRole.name}\` → \`${newRole.name}\``);
    if (oldRole.hexColor !== newRole.hexColor) changes.push(`**Color:** \`${oldRole.hexColor}\` → \`${newRole.hexColor}\``);
    if (oldRole.hoist !== newRole.hoist) changes.push(`**Hoisted:** ${oldRole.hoist ? "Yes" : "No"} → ${newRole.hoist ? "Yes" : "No"}`);
    if (oldRole.mentionable !== newRole.mentionable) changes.push(`**Mentionable:** ${oldRole.mentionable ? "Yes" : "No"} → ${newRole.mentionable ? "Yes" : "No"}`);
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) changes.push(`**Permissions changed**`);
    if (!changes.length) return;

    await sendServerLog(client, newRole.guild.id, "roleUpdate", {
      title: "✏️ Role Updated",
      color: 0x9b59b6,
      description: `Role <@&${newRole.id}> was updated\n\n${changes.join("\n")}`,
      fields: [{ name: "Role", value: `<@&${newRole.id}> (${newRole.id})`, inline: true }],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHANNEL LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("channelCreate", async (channel: NonThreadGuildBasedChannel) => {
    await sendServerLog(client, channel.guild.id, "channelCreate", {
      title: "📢 Channel Created",
      color: 0x2ecc71,
      description: `A new ${channelTypeName(channel.type)} channel was created`,
      fields: [
        { name: "Name", value: `<#${channel.id}> (${channel.name})`, inline: true },
        { name: "Type", value: channelTypeName(channel.type), inline: true },
        { name: "Category", value: channel.parent?.name ?? "*none*", inline: true },
      ],
    });
  });

  client.on("channelDelete", async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await sendServerLog(client, channel.guild.id, "channelDelete", {
      title: "🗑️ Channel Deleted",
      color: 0xe74c3c,
      description: `A ${channelTypeName(channel.type)} channel was deleted`,
      fields: [
        { name: "Name", value: channel.name, inline: true },
        { name: "Type", value: channelTypeName(channel.type), inline: true },
      ],
    });
  });

  client.on("channelUpdate", async (oldCh, newCh) => {
    if (!("guild" in newCh) || !newCh.guild) return;
    const changes: string[] = [];
    if ("name" in oldCh && "name" in newCh && oldCh.name !== newCh.name)
      changes.push(`**Name:** \`${oldCh.name}\` → \`${newCh.name}\``);
    if ("topic" in oldCh && "topic" in newCh && oldCh.topic !== newCh.topic)
      changes.push(`**Topic:** ${truncate(oldCh.topic ?? "*none*", 256)} → ${truncate(newCh.topic ?? "*none*", 256)}`);
    if ("rateLimitPerUser" in oldCh && "rateLimitPerUser" in newCh && oldCh.rateLimitPerUser !== newCh.rateLimitPerUser)
      changes.push(`**Slowmode:** ${oldCh.rateLimitPerUser}s → ${newCh.rateLimitPerUser}s`);
    if ("nsfw" in oldCh && "nsfw" in newCh && oldCh.nsfw !== newCh.nsfw)
      changes.push(`**NSFW:** ${oldCh.nsfw ? "Yes" : "No"} → ${newCh.nsfw ? "Yes" : "No"}`);
    if ("parentId" in oldCh && "parentId" in newCh && oldCh.parentId !== newCh.parentId)
      changes.push(`**Category moved:** ${oldCh.parentId ? `<#${oldCh.parentId}>` : "*none*"} → ${newCh.parentId ? `<#${newCh.parentId}>` : "*none*"}`);
    if (!changes.length) return;

    await sendServerLog(client, newCh.guild.id, "channelUpdate", {
      title: "✏️ Channel Updated",
      color: 0x3498db,
      description: `<#${newCh.id}> was updated\n\n${changes.join("\n")}`,
      fields: [{ name: "Channel", value: `<#${newCh.id}>`, inline: true }],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SERVER LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("guildUpdate", async (oldGuild, newGuild) => {
    const changes: string[] = [];
    if (oldGuild.name !== newGuild.name) changes.push(`**Name:** \`${oldGuild.name}\` → \`${newGuild.name}\``);
    if (oldGuild.icon !== newGuild.icon) changes.push(`**Icon:** Updated`);
    if (oldGuild.banner !== newGuild.banner) changes.push(`**Banner:** Updated`);
    if (oldGuild.verificationLevel !== newGuild.verificationLevel)
      changes.push(`**Verification Level:** ${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
    if (!changes.length) return;

    await sendServerLog(client, newGuild.id, "serverUpdate", {
      title: "🏠 Server Updated",
      color: 0x1abc9c,
      description: changes.join("\n"),
      thumbnail: newGuild.iconURL() ?? undefined,
    });
  });

  client.on("guildMemberAdd", async (member: GuildMember) => {
    if (!member.premiumSince) return;
    await sendServerLog(client, member.guild.id, "boostChange", {
      title: "💎 New Server Booster",
      color: 0xff73fa,
      description: `<@${member.id}> just boosted the server! 🎉`,
      fields: [{ name: "Boost Count", value: `${member.guild.premiumSubscriptionCount ?? 0}`, inline: true }],
      thumbnail: member.user.displayAvatarURL(),
    });
  });

  client.on("guildMemberUpdate", async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    if (!oldMember.premiumSince && newMember.premiumSince) {
      await sendServerLog(client, newMember.guild.id, "boostChange", {
        title: "💎 New Server Boost",
        color: 0xff73fa,
        description: `<@${newMember.id}> just boosted the server! 🎉`,
        fields: [{ name: "Boost Count", value: `${newMember.guild.premiumSubscriptionCount ?? 0}`, inline: true }],
        thumbnail: newMember.user.displayAvatarURL(),
      });
    } else if (oldMember.premiumSince && !newMember.premiumSince) {
      await sendServerLog(client, newMember.guild.id, "boostChange", {
        title: "💔 Boost Removed",
        color: 0x95a5a6,
        description: `<@${newMember.id}> removed their boost`,
        fields: [{ name: "Boost Count", value: `${newMember.guild.premiumSubscriptionCount ?? 0}`, inline: true }],
        thumbnail: newMember.user.displayAvatarURL(),
      });
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VOICE LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member) return;
    if (!shouldLogBotActions(guildId) && member.user.bot) return;
    if (isUserIgnored(guildId, member.id)) return;

    if (!oldState.channelId && newState.channelId) {
      await sendServerLog(client, guildId, "voiceJoin", {
        title: "🔊 Joined Voice Channel",
        color: 0x2ecc71,
        description: `<@${member.id}> joined <#${newState.channelId}>`,
        fields: [{ name: "Channel", value: `<#${newState.channelId}>`, inline: true }],
        thumbnail: member.user.displayAvatarURL(),
      });
    } else if (oldState.channelId && !newState.channelId) {
      await sendServerLog(client, guildId, "voiceLeave", {
        title: "🔇 Left Voice Channel",
        color: 0xe67e22,
        description: `<@${member.id}> left <#${oldState.channelId}>`,
        fields: [{ name: "Channel", value: `<#${oldState.channelId}>`, inline: true }],
        thumbnail: member.user.displayAvatarURL(),
      });
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await sendServerLog(client, guildId, "voiceMove", {
        title: "🔀 Moved Voice Channel",
        color: 0x3498db,
        description: `<@${member.id}> moved voice channels`,
        fields: [
          { name: "From", value: `<#${oldState.channelId}>`, inline: true },
          { name: "To", value: `<#${newState.channelId}>`, inline: true },
        ],
        thumbnail: member.user.displayAvatarURL(),
      });
    } else {
      const changes: string[] = [];
      if (oldState.serverMute !== newState.serverMute)
        changes.push(`**Server Muted:** ${newState.serverMute ? "Yes" : "No"}`);
      if (oldState.serverDeaf !== newState.serverDeaf)
        changes.push(`**Server Deafened:** ${newState.serverDeaf ? "Yes" : "No"}`);
      if (!changes.length) return;
      await sendServerLog(client, guildId, "voiceMuteDeafen", {
        title: "🔕 Voice State Changed",
        color: 0x95a5a6,
        description: `<@${member.id}>'s voice state was updated in <#${newState.channelId}>`,
        fields: [{ name: "Changes", value: changes.join("\n") }],
        thumbnail: member.user.displayAvatarURL(),
      });
    }
  });

  client.on("stageInstanceCreate", async (stage: StageInstance) => {
    const guild = stage.guild;
    if (!guild) return;
    await sendServerLog(client, guild.id, "stageEvent", {
      title: "🎙️ Stage Started",
      color: 0x2ecc71,
      description: `A stage channel event started in <#${stage.channelId}>`,
      fields: [{ name: "Topic", value: stage.topic, inline: true }],
    });
  });

  client.on("stageInstanceDelete", async (stage: StageInstance) => {
    const guild = stage.guild;
    if (!guild) return;
    await sendServerLog(client, guild.id, "stageEvent", {
      title: "🎙️ Stage Ended",
      color: 0xe67e22,
      description: `A stage channel event ended in <#${stage.channelId}>`,
      fields: [{ name: "Topic", value: stage.topic, inline: true }],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INVITE LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("inviteCreate", async (invite: Invite) => {
    if (!invite.guild) return;
    await sendServerLog(client, invite.guild.id, "inviteCreate", {
      title: "🔗 Invite Created",
      color: 0x3498db,
      description: `A new invite was created`,
      fields: [
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Created by", value: invite.inviter ? `<@${invite.inviter.id}>` : "Unknown", inline: true },
        { name: "Channel", value: invite.channel ? `<#${invite.channel.id}>` : "Unknown", inline: true },
        { name: "Expires", value: invite.expiresAt ? ts(invite.expiresAt.getTime()) : "Never", inline: true },
        { name: "Max Uses", value: invite.maxUses ? `${invite.maxUses}` : "Unlimited", inline: true },
      ],
    });
  });

  client.on("inviteDelete", async (invite: Invite) => {
    if (!invite.guild) return;
    await sendServerLog(client, invite.guild.id, "inviteDelete", {
      title: "🗑️ Invite Deleted",
      color: 0xe74c3c,
      description: `Invite \`${invite.code}\` was deleted`,
      fields: [
        { name: "Code", value: `\`${invite.code}\``, inline: true },
        { name: "Channel", value: invite.channel ? `<#${invite.channel.id}>` : "Unknown", inline: true },
      ],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // THREAD LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("threadCreate", async (thread: ThreadChannel) => {
    if (!thread.guild) return;
    await sendServerLog(client, thread.guild.id, "threadCreate", {
      title: "🧵 Thread Created",
      color: 0x2ecc71,
      description: `Thread <#${thread.id}> was created in <#${thread.parentId}>`,
      fields: [
        { name: "Name", value: thread.name, inline: true },
        { name: "Parent", value: thread.parentId ? `<#${thread.parentId}>` : "Unknown", inline: true },
      ],
    });
  });

  client.on("threadDelete", async (thread: ThreadChannel) => {
    if (!thread.guild) return;
    await sendServerLog(client, thread.guild.id, "threadDelete", {
      title: "🗑️ Thread Deleted",
      color: 0xe74c3c,
      description: `Thread **${thread.name}** was deleted`,
      fields: [
        { name: "Name", value: thread.name, inline: true },
        { name: "Parent", value: thread.parentId ? `<#${thread.parentId}>` : "Unknown", inline: true },
      ],
    });
  });

  client.on("threadUpdate", async (oldThread: ThreadChannel, newThread: ThreadChannel) => {
    if (!newThread.guild) return;
    const changes: string[] = [];
    if (oldThread.name !== newThread.name) changes.push(`**Name:** \`${oldThread.name}\` → \`${newThread.name}\``);
    if (oldThread.archived !== newThread.archived)
      changes.push(`**Archived:** ${newThread.archived ? "Yes (archived)" : "No (unarchived)"}`);
    if (!changes.length) return;

    await sendServerLog(client, newThread.guild.id, "threadUpdate", {
      title: newThread.archived ? "📦 Thread Archived" : "📂 Thread Updated",
      color: newThread.archived ? 0x95a5a6 : 0x3498db,
      description: `Thread <#${newThread.id}> was updated\n\n${changes.join("\n")}`,
    });
  });

  client.on("threadMembersUpdate", async (addedMembers, removedMembers, thread) => {
    if (!thread.guild) return;
    if (addedMembers.size > 0) {
      await sendServerLog(client, thread.guild.id, "threadMemberAdd", {
        title: "➕ Thread Members Added",
        color: 0x2ecc71,
        description: `Members added to <#${thread.id}>`,
        fields: [{ name: "Members", value: [...addedMembers.values()].map((m) => `<@${m.id}>`).join(", ") || "Unknown" }],
      });
    }
    if (removedMembers.size > 0) {
      await sendServerLog(client, thread.guild.id, "threadMemberRemove", {
        title: "➖ Thread Members Removed",
        color: 0xe67e22,
        description: `Members removed from <#${thread.id}>`,
        fields: [{ name: "Members", value: [...removedMembers.values()].map((m) => `<@${m.id}>`).join(", ") || "Unknown" }],
      });
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EMOJI & STICKER LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("emojiCreate", async (emoji: GuildEmoji) => {
    await sendServerLog(client, emoji.guild.id, "emojiCreate", {
      title: "😀 Emoji Added",
      color: 0x2ecc71,
      description: `New emoji added: ${emoji}`,
      fields: [
        { name: "Name", value: emoji.name ?? "Unknown", inline: true },
        { name: "Animated", value: emoji.animated ? "Yes" : "No", inline: true },
      ],
      thumbnail: emoji.url,
    });
  });

  client.on("emojiDelete", async (emoji: GuildEmoji) => {
    await sendServerLog(client, emoji.guild.id, "emojiDelete", {
      title: "🗑️ Emoji Deleted",
      color: 0xe74c3c,
      description: `Emoji **:${emoji.name}:** was deleted`,
      fields: [{ name: "Name", value: emoji.name ?? "Unknown", inline: true }],
    });
  });

  client.on("emojiUpdate", async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
    if (oldEmoji.name === newEmoji.name) return;
    await sendServerLog(client, newEmoji.guild.id, "emojiUpdate", {
      title: "✏️ Emoji Renamed",
      color: 0x9b59b6,
      description: `Emoji was renamed`,
      fields: [
        { name: "Before", value: `:${oldEmoji.name}:`, inline: true },
        { name: "After", value: `:${newEmoji.name}:`, inline: true },
      ],
      thumbnail: newEmoji.url,
    });
  });

  client.on("stickerCreate", async (sticker: Sticker) => {
    if (!sticker.guild) return;
    await sendServerLog(client, sticker.guild.id, "stickerCreate", {
      title: "🎨 Sticker Added",
      color: 0x2ecc71,
      description: `New sticker added: **${sticker.name}**`,
      fields: [{ name: "Name", value: sticker.name, inline: true }],
    });
  });

  client.on("stickerDelete", async (sticker: Sticker) => {
    if (!sticker.guild) return;
    await sendServerLog(client, sticker.guild.id, "stickerDelete", {
      title: "🗑️ Sticker Deleted",
      color: 0xe74c3c,
      description: `Sticker **${sticker.name}** was deleted`,
      fields: [{ name: "Name", value: sticker.name, inline: true }],
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BOT & INTEGRATION LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  client.on("guildMemberAdd", async (member: GuildMember) => {
    if (!member.user.bot) return;
    await sendServerLog(client, member.guild.id, "botAdded", {
      title: "⚙️ Bot Added",
      color: 0x3498db,
      description: `Bot <@${member.id}> was added to the server`,
      fields: [{ name: "Bot", value: `${member.user.tag} (${member.id})`, inline: true }],
      thumbnail: member.user.displayAvatarURL(),
    });
  });

  client.on("guildMemberRemove", async (member: GuildMember | PartialGuildMember) => {
    if (!member.user?.bot) return;
    await sendServerLog(client, member.guild.id, "botRemoved", {
      title: "⚙️ Bot Removed",
      color: 0xe74c3c,
      description: `Bot <@${member.id}> was removed from the server`,
      fields: [{ name: "Bot", value: `${member.user.tag} (${member.id})`, inline: true }],
    });
  });

  client.on("webhookUpdate" as any, async (channel: GuildChannel) => {
    if (!channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({ limit: 1 });
      const entry = logs.entries.first();
      if (!entry) return;
      const isCreate = entry.action === AuditLogEvent.WebhookCreate;
      const isDelete = entry.action === AuditLogEvent.WebhookDelete;
      if (!isCreate && !isDelete) return;
      if (Date.now() - entry.createdTimestamp > 5000) return;

      await sendServerLog(client, channel.guild.id, isCreate ? "webhookCreate" : "webhookDelete", {
        title: isCreate ? "🔗 Webhook Created" : "🗑️ Webhook Deleted",
        color: isCreate ? 0x2ecc71 : 0xe74c3c,
        description: `A webhook was ${isCreate ? "created" : "deleted"} in <#${channel.id}>`,
        fields: [
          { name: "Channel", value: `<#${channel.id}>`, inline: true },
          ...(entry.executor ? [{ name: "By", value: `<@${entry.executor.id}>`, inline: true }] : []),
        ],
      });
    } catch { /* no access */ }
  });

  client.on("guildIntegrationsUpdate", async (guild) => {
    await sendServerLog(client, guild.id, "integrationChange", {
      title: "🔌 Integration Changed",
      color: 0x9b59b6,
      description: `Server integrations were updated`,
    });
  });
}

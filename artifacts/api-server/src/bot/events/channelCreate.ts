import { Client, ChannelType, OverwriteType } from "discord.js";
import { logger } from "../../lib/logger";
import { getMuteConfig } from "../store/muteConfig";

export function registerChannelCreate(client: Client) {
  client.on("channelCreate", async (channel) => {
    if (!channel.guild) return;

    const muteCfg = getMuteConfig(channel.guild.id);
    if (muteCfg.mode !== "role" || !muteCfg.muteRoleId) return;

    const muteRole = channel.guild.roles.cache.get(muteCfg.muteRoleId);
    if (!muteRole) return;

    const supported =
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildVoice ||
      channel.type === ChannelType.GuildForum ||
      channel.type === ChannelType.GuildAnnouncement;

    if (!supported) return;

    await channel.permissionOverwrites
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
          reason: "Auto-applied mute role deny overrides to new channel",
        },
      )
      .catch((err) =>
        logger.warn({ err, channelId: channel.id }, "Failed to apply mute role overrides to new channel"),
      );

    logger.info({ channelId: channel.id, guildId: channel.guild.id }, "Applied mute role overrides to new channel");
  });
}

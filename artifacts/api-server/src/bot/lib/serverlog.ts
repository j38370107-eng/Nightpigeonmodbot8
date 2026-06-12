import { AttachmentBuilder, Client, EmbedBuilder, TextChannel } from "discord.js";
import { getLogChannel } from "../store/serverlogging";
import { logger } from "../../lib/logger";
import { sendViaWebhook } from "./webhookSender";

export interface ServerLogEntry {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: string;
  thumbnail?: string;
  /** attachment:// reference or remote URL — shown as the large embed image */
  image?: string;
  files?: AttachmentBuilder[];
}

export async function sendServerLog(
  client: Client,
  guildId: string,
  eventKey: string,
  entry: ServerLogEntry
): Promise<void> {
  const channelId = getLogChannel(guildId, eventKey);
  if (!channelId) return;

  let channel: TextChannel | null = null;
  try {
    channel = (await client.channels.fetch(channelId)) as TextChannel;
  } catch {
    return;
  }

  if (!channel || !("send" in channel)) return;

  const embed = new EmbedBuilder()
    .setColor(entry.color)
    .setTitle(entry.title)
    .setDescription(entry.description)
    .setTimestamp();

  if (entry.fields?.length) embed.addFields(entry.fields);
  if (entry.footer) embed.setFooter({ text: entry.footer });
  if (entry.thumbnail) embed.setThumbnail(entry.thumbnail);
  if (entry.image) embed.setImage(entry.image);

  await sendViaWebhook(client, channel, { embeds: [embed], files: entry.files ?? [] });
}

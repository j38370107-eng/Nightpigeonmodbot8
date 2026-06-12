import { Client, Events, Message, PartialMessage } from "discord.js";
import { setDeletedSnipe, setEditedSnipe } from "../store/snipe";
import { logger } from "../../lib/logger";

export function registerSnipeEvents(client: Client) {
  // ── Cache deleted messages ──────────────────────────────────────────────────
  client.on(Events.MessageDelete, (message) => {
    if (message.partial) return; // no content available
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content ?? "";
    if (!content && message.attachments.size === 0) return;

    setDeletedSnipe(message.channelId, {
      content,
      author: {
        id: message.author.id,
        tag: message.author.tag,
        displayAvatarURL: message.author.displayAvatarURL(),
      },
      attachments: [...message.attachments.values()].map((a) => ({
        url: a.url,
        name: a.name,
      })),
      deletedAt: Date.now(),
    });

    logger.debug({ channelId: message.channelId }, "Cached deleted message for snipe");
  });

  // ── Cache edited messages ───────────────────────────────────────────────────
  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (oldMessage.partial || newMessage.partial) return;
    if (newMessage.author.bot) return;
    if (!newMessage.guild) return;

    const oldContent = oldMessage.content ?? "";
    const newContent = newMessage.content ?? "";
    if (oldContent === newContent) return; // only embed resolutions — skip

    setEditedSnipe(newMessage.channelId, {
      oldContent,
      newContent,
      author: {
        id: newMessage.author.id,
        tag: newMessage.author.tag,
        displayAvatarURL: newMessage.author.displayAvatarURL(),
      },
      editedAt: Date.now(),
      messageUrl: newMessage.url,
    });

    logger.debug({ channelId: newMessage.channelId }, "Cached edited message for editsnipe");
  });
}

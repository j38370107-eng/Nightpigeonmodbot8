import { Client, Events } from "discord.js";
import { registerReadyHandler } from "./ready";
import { registerMessageHandler } from "./messageCreate";
import { registerMemberUpdateHandler } from "./guildMemberUpdate";
import { registerServerLogEvents } from "./serverLogs";
import { registerAntiNukeEvents } from "./antinuke";
import { registerAntiRaidEvents } from "./antiraid";
import { registerChannelCreate } from "./channelCreate";
import { registerMemberJoin } from "./guildMemberAdd";
import { registerMessageUpdate } from "./messageUpdate";
import { logger } from "../../lib/logger";

export function registerEvents(client: Client) {
  client.on(Events.Error, (err) => {
    logger.error({ err }, "Discord client error");
  });

  registerReadyHandler(client);
  registerMessageHandler(client);
  registerMessageUpdate(client);
  registerMemberUpdateHandler(client);
  registerServerLogEvents(client);
  registerAntiNukeEvents(client);
  registerAntiRaidEvents(client);
  registerChannelCreate(client);
  registerMemberJoin(client);
}

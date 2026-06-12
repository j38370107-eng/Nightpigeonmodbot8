import { Client, Events } from "discord.js";
import { registerReadyHandler } from "./ready";
import { registerMessageHandler } from "./messageCreate";
import { registerMemberUpdateHandler } from "./guildMemberUpdate";
import { registerServerLogEvents } from "./serverLogs";
import { registerAntiNukeEvents } from "./antinuke";
import { registerAntiRaidEvents } from "./antiraid";
import { registerTicketButtons } from "./ticketButtons";
import { startTicketScheduler, registerStaffResponseDetector } from "./ticketScheduler";
import { registerApplicationButtons } from "./applicationButtons";
import { registerChannelCreate } from "./channelCreate";
import { registerMemberJoin } from "./guildMemberAdd";
import { registerMessageUpdate } from "./messageUpdate";
import { registerSnipeEvents } from "./snipeEvents";
import { logger } from "../../lib/logger";

export function registerEvents(client: Client) {
  // Prevent unhandled 'error' events from crashing the process
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
  registerTicketButtons(client);
  registerStaffResponseDetector(client);
  startTicketScheduler(client);
  registerApplicationButtons(client);
  registerChannelCreate(client);
  registerMemberJoin(client);
  registerSnipeEvents(client);
}

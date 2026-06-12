import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { logger } from "../lib/logger";
import { loadCommands } from "./commands";
import { registerEvents } from "./events";
import { initAllStores } from "./store";
import { refreshShortcutsFromDb } from "./store/shortcuts";
import { refreshCustomCommandsFromDb } from "./store/customCommands";
import { refreshAutomodFromDb } from "./store/automod";

export async function startBot(): Promise<Client | null> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return null;
  }

  await initAllStores();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
    ],
    allowedMentions: { repliedUser: false },
  });

  (client as any).commands = new Collection();
  loadCommands(client);
  registerEvents(client);

  await client.login(token);
  logger.info("Discord bot logged in");

  // Refresh shortcuts and custom commands from DB every 30 s so that changes
  // made via the dashboard take effect without a bot restart.
  setInterval(() => {
    Promise.all([
      refreshShortcutsFromDb().catch((err) => logger.warn({ err }, "shortcuts refresh failed")),
      refreshCustomCommandsFromDb().catch((err) => logger.warn({ err }, "customCommands refresh failed")),
      refreshAutomodFromDb().catch((err) => logger.warn({ err }, "automod refresh failed")),
    ]);
  }, 10_000);

  return client;
}

import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { logger } from "../lib/logger";
import { initDb } from "./store/db";
import { initGuildConfigStore } from "./store/guildConfig";
import { initSettingsStore } from "./store/settings";
import { initAliasesStore } from "./store/aliases";
import { handleMessage } from "./handlers/messageCreate";

export async function startBot(): Promise<Client | null> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return null;
  }

  await initDb();
  await initGuildConfigStore();
  await initSettingsStore();
  await initAliasesStore();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
    allowedMentions: { repliedUser: false },
  });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, "NightPigeon is online");
  });

  client.on("messageCreate", (message) => {
    handleMessage(client, message).catch((err) =>
      logger.error({ err }, "Unhandled error in messageCreate")
    );
  });

  await client.login(token);
  return client;
}

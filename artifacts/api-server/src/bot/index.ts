import { Client, GatewayIntentBits, Partials } from "discord.js";
import { logger } from "../lib/logger";
import { initDb } from "./store/db";
import { initGuildConfigStore } from "./store/guildConfig";
import { registerMessageCreate } from "./events/messageCreate";

export async function startBot(): Promise<Client | null> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.warn("DISCORD_BOT_TOKEN not set — bot will not start");
    return null;
  }

  await initDb();
  await initGuildConfigStore();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
    allowedMentions: { repliedUser: false },
  });

  client.once("ready", (c) => {
    logger.info({ tag: c.user.tag, guilds: c.guilds.cache.size }, "NightPigeon is online");
  });

  registerMessageCreate(client);

  await client.login(token);
  return client;
}

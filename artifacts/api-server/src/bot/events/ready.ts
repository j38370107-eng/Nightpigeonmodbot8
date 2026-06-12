import { Client, ActivityType } from "discord.js";
import { logger } from "../../lib/logger";
import { dbSet, dbGet } from "../store/db";

export function registerReadyHandler(client: Client) {
  client.once("ready", async (c) => {
    logger.info(`Bot ready: logged in as ${c.user.tag}`);
    c.user.setActivity("the server", { type: ActivityType.Watching });

    const existing = await dbGet<{ startMs: number }>("_meta", "serverStart").catch(() => null);
    if (!existing) {
      await dbSet("_meta", "serverStart", { startMs: Date.now() }).catch(() => {});
    }

    const writeStats = async () => {
      try {
        const guildCount = c.guilds.cache.size;
        const userCount = c.guilds.cache.reduce((acc, g) => acc + (g.memberCount ?? 0), 0);
        await dbSet("_meta", "stats", { guildCount, userCount, cachedAt: Date.now() });
        logger.info({ guildCount, userCount }, "Cached bot stats to DB");
      } catch (err) {
        logger.warn({ err }, "Failed to cache bot stats");
      }
    };

    await writeStats();
    setInterval(writeStats, 5 * 60 * 1000);
  });
}

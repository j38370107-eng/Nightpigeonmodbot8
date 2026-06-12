import { Client, ActivityType } from "discord.js";
import { logger } from "../../lib/logger";
import { scheduleAllTimedBans } from "../store/timedBans";
import { scheduleAllTimedMutes } from "../store/timedMutes";
import { purgeExpiredWarnings } from "../store/infractions";
import { dbSet, dbGet } from "../store/db";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // every hour

export function registerReadyHandler(client: Client) {
  client.once("ready", async (c) => {
    logger.info(`Bot ready: logged in as ${c.user.tag}`);
    c.user.setActivity("the server", { type: ActivityType.Watching });
    scheduleAllTimedBans(client);
    scheduleAllTimedMutes(client);

    // Purge expired warnings on startup then hourly
    const runPurge = () => {
      const count = purgeExpiredWarnings();
      if (count > 0) logger.info({ count }, "Purged expired warnings from records");
    };
    runPurge();
    setInterval(runPurge, PURGE_INTERVAL_MS);

    // Persist a server-start anchor once so uptime survives restarts
    const existing = await dbGet<{ startMs: number }>( "_meta", "serverStart").catch(() => null);
    if (!existing) {
      await dbSet("_meta", "serverStart", { startMs: Date.now() }).catch(() => {});
    }

    // Cache live stats so the dashboard can show them even when bot restarts
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
    // Refresh every 5 minutes while online
    setInterval(writeStats, 5 * 60 * 1000);
  });
}

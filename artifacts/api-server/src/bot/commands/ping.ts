import { Message } from "discord.js";
import type { Command } from "./types";

export const pingCommand: Command = {
  name: "ping",
  aliases: ["latency"],
  description: "Check the bot's response time",
  usage: "",
  requiredPermissions: [],

  async execute(message: Message) {
    const sent = await message.reply("Pinging...");
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const ws = message.client.ws.ping;
    await sent.edit(
      `🏓 **Pong!**\nRoundtrip: **${roundtrip}ms** | WebSocket: **${ws}ms**`
    );
  },
};

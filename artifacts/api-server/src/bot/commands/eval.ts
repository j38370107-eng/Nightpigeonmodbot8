import { Message, EmbedBuilder, codeBlock } from "discord.js";
import type { Command } from "./types";
import { usageErr } from "../lib/usageError";
import { OWNER_ID } from "../store/ownerBlacklists";

export const evalCommand: Command = {
  name: "eval",
  aliases: ["ev"],
  description: "[Owner] Execute arbitrary JavaScript",
  usage: "<code>",
  ownerOnly: true,

  async execute(message: Message, args: string[]) {
    if (message.author.id !== OWNER_ID) return;

    const code = args.join(" ");
    if (!code) return message.reply(usageErr(message, evalCommand, "Provide code to evaluate"));

    const startTime = Date.now();
    let result: unknown;
    let isError = false;

    try {
      // eslint-disable-next-line no-eval
      result = await eval(code);
    } catch (err) {
      result = err;
      isError = true;
    }

    const elapsed = Date.now() - startTime;
    const output = typeof result === "string" ? result : JSON.stringify(result, null, 2) ?? String(result);
    const truncated = output.length > 1900 ? output.slice(0, 1900) + "\n…(truncated)" : output;

    const embed = new EmbedBuilder()
      .setColor(isError ? 0xe74c3c : 0x2ecc71)
      .setTitle(isError ? "❌ Eval Error" : "✅ Eval Result")
      .addFields(
        { name: "Input", value: codeBlock("js", code.length > 1000 ? code.slice(0, 1000) + "…" : code) },
        { name: "Output", value: codeBlock("js", truncated || "undefined") },
        { name: "Type", value: `\`${typeof result}\``, inline: true },
        { name: "Time", value: `\`${elapsed}ms\``, inline: true },
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};

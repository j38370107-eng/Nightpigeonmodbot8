import { Router } from "express";
import { dbGet, dbSet } from "../db.js";

const router = Router();

function discordHeaders(token: string) {
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

async function sendToDiscord(channelId: string, form: any, submission: any) {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token || !channelId) return;

  const fields = form.questions
    .filter((q: any) => submission.answers?.[q.id] !== undefined)
    .map((q: any) => ({
      name: q.label,
      value: submission.answers[q.id]?.trim() || "_No answer_",
      inline: false,
    }));

  const applicantValue = submission.userId
    ? `${submission.userTag}\nID: \`${submission.userId}\``
    : submission.userTag;

  const body = {
    embeds: [
      {
        title: `📋 New Application — ${form.title}`,
        description: form.description ? form.description : undefined,
        color: 0xf0a500,
        fields: [
          { name: "Applicant", value: applicantValue, inline: true },
          { name: "Status", value: "🟡 Pending", inline: true },
          ...fields,
        ],
        footer: { text: `Submission ID: ${submission.id}` },
        timestamp: new Date(submission.submittedAt).toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            label: "Approve",
            custom_id: `apply:approve:${submission.guildId}:${submission.id}`,
          },
          {
            type: 2,
            style: 4,
            label: "Deny",
            custom_id: `apply:deny:${submission.guildId}:${submission.id}`,
          },
        ],
      },
    ],
  };

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: discordHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[apply] Failed to send submission to channel (${res.status}):`, err);
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

router.get("/:guildId/:formId", async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const form = forms[formId];
  if (!form) return res.status(404).json({ error: "Form not found" });
  if (!form.active) return res.status(403).json({ error: "This form is not currently accepting submissions" });

  const userId = (req as any).session?.userId ?? (req as any).user?.id;
  if (userId) {
    const blacklist: string[] = (await dbGet<string[]>("appBlacklist", guildId)) ?? [];
    if (blacklist.includes(userId)) {
      return res.status(403).json({ error: "You have been blocked from submitting applications in this server." });
    }
  }

  const { id, title, description, questions } = form;
  res.json({ id, title, description, questions });
});

router.post("/:guildId/:formId", async (req: any, res: any) => {
  const { guildId, formId } = req.params;
  const { userId, userTag, answers } = req.body as { userId?: string; userTag: string; answers: Record<string, string> };

  if (!userTag?.trim()) return res.status(400).json({ error: "Discord username is required" });

  const forms = (await dbGet<any>("applicationForms", guildId)) ?? {};
  const form = forms[formId];
  if (!form) return res.status(404).json({ error: "Form not found" });
  if (!form.active) return res.status(403).json({ error: "This form is not currently accepting submissions" });

  if (userId) {
    const blacklist: string[] = (await dbGet<string[]>("appBlacklist", guildId)) ?? [];
    if (blacklist.includes(userId)) {
      return res.status(403).json({ error: "You have been blocked from submitting applications in this server." });
    }
  }

  const subs = (await dbGet<any>("applicationSubmissions", guildId)) ?? {};

  // ── Cooldown enforcement ───────────────────────────────────────────────────
  // Per-form cooldown takes priority; falls back to the global setting.
  if (userId) {
    const appCfg = (await dbGet<any>("appConfig", guildId)) ?? {};
    const globalCooldownHours: number = Math.min(720, appCfg.cooldownHours ?? 0);
    const perFormCooldownHours: number = Math.min(720, form.cooldownHours ?? 0);
    const cooldownHours = perFormCooldownHours > 0 ? perFormCooldownHours : globalCooldownHours;

    if (cooldownHours > 0) {
      const cutoff = Date.now() - cooldownHours * 3_600_000;
      const recent = Object.values(subs).find(
        (s: any) => s.userId === userId && s.formId === formId && s.submittedAt > cutoff,
      ) as any;
      if (recent) {
        const waitMs = recent.submittedAt + cooldownHours * 3_600_000 - Date.now();
        const waitH = Math.ceil(waitMs / 3_600_000);
        return res.status(429).json({
          error: `You must wait ${waitH} more hour${waitH !== 1 ? "s" : ""} before reapplying to this form.`,
        });
      }
    }
  }

  const id = generateId();
  const submission = {
    id,
    formId,
    formTitle: form.title,
    guildId,
    userId: userId ?? null,
    userTag: userTag.trim(),
    answers: answers ?? {},
    status: "pending",
    submittedAt: Date.now(),
  };
  subs[id] = submission;
  await dbSet("applicationSubmissions", guildId, subs);

  if (form.responseChannelId) {
    sendToDiscord(form.responseChannelId, form, submission).catch((e) =>
      console.error("[apply] sendToDiscord error:", e)
    );
  }

  res.json({ ok: true });
});

export default router;

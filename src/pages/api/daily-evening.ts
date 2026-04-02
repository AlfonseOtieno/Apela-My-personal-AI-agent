import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { format } from "date-fns";
import { callGeminiDirect } from "@/lib/agent";

// Called by cron-job.org at 9:30 PM EAT (18:30 UTC) daily
// Compares today's planned habits vs what was actually logged

const CRON_SECRET = process.env.CRON_SECRET || "apela-cron-2025";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = supabaseAdmin();
  const today = new Date();
  const todayDate  = format(today, "yyyy-MM-dd");
  const todayLabel = format(today, "EEEE, MMMM d");
  const dayShort   = format(today, "EEE").toLowerCase();

  try {
    // Get planned habits for today
    const { data: planned } = await db
      .from("planned_habits")
      .select("*")
      .eq("active", true);

    const todayPlanned = (planned || []).filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekdays") return ["mon","tue","wed","thu","fri"].includes(dayShort);
      if (h.frequency === "weekends") return ["sat","sun"].includes(dayShort);
      if (h.frequency === "specific") return Array.isArray(h.specific_days) && h.specific_days.includes(dayShort);
      return false;
    });

    // Get today's logs
    const { data: logs } = await db
      .from("habit_logs")
      .select("*")
      .eq("date", todayDate);

    const todayLogs = logs || [];

    // Match planned vs logged
    const done: string[]   = [];
    const missed: string[] = [];

    for (const habit of todayPlanned) {
      const logged = todayLogs.find(l =>
        l.habit_name.toLowerCase().includes(habit.name.toLowerCase()) ||
        habit.name.toLowerCase().includes(l.habit_name.toLowerCase())
      );
      if (logged) {
        let entry = `✓ ${habit.name}`;
        if (logged.duration) entry += ` — ${logged.duration} min`;
        if (logged.feeling)  entry += ` (feeling: ${logged.feeling})`;
        done.push(entry);
      } else {
        missed.push(`✗ ${habit.name}`);
      }
    }

    // Also include any bonus logs (things logged but not planned)
    const bonusLogs = todayLogs.filter(l =>
      !todayPlanned.some(p =>
        l.habit_name.toLowerCase().includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(l.habit_name.toLowerCase())
      )
    );

    // Build summary
    if (!todayPlanned.length && !todayLogs.length) {
      const msg = `Evening check-in for ${todayLabel}. Nothing was planned or logged today.`;
      await db.from("messages").insert([{ role: "assistant", content: msg }]);
      return res.status(200).json({ ok: true });
    }

    const completionRate = todayPlanned.length > 0
      ? Math.round((done.length / todayPlanned.length) * 100)
      : 100;

    let summary = `Evening summary — ${todayLabel}\n\n`;

    if (done.length) summary += `${done.join("\n")}\n`;
    if (missed.length) summary += `\n${missed.join("\n")}\n`;
    if (bonusLogs.length) {
      const bonusLines = bonusLogs.map(l => {
        let entry = `+ ${l.habit_name} (unplanned)`;
        if (l.duration) entry += ` — ${l.duration} min`;
        return entry;
      });
      summary += `\n${bonusLines.join("\n")}\n`;
    }

    summary += `\nCompletion: ${completionRate}%`;

    // If Gemini is available, add a one-sentence pattern insight
    if (todayLogs.length >= 2) {
      const logContext = todayLogs.map(l =>
        `${l.habit_name}: ${l.duration || "?"} min, feeling: ${l.feeling || "not logged"}`
      ).join("; ");

      const insightPrompt = `Today's habit logs: ${logContext}. Completion rate: ${completionRate}%. Write ONE sentence (max 20 words) noting the single most interesting thing about today's data. Be factual, not motivational. Do not say "you should" or give advice.`;

      const insight = await callGeminiDirect(insightPrompt);
      if (insight) summary += `\n\n${insight}`;
    }

    await db.from("messages").insert([{ role: "assistant", content: summary }]);
    return res.status(200).json({ ok: true, completion_rate: completionRate });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Evening cron error:", msg);
    return res.status(500).json({ error: msg });
  }
}

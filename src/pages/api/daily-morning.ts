import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { format, parseISO } from "date-fns";

// Called by cron-job.org at 5:30 AM EAT (02:30 UTC) daily
// Generates today's plan and saves it as an Apela message in the chat

const CRON_SECRET = process.env.CRON_SECRET || "apela-cron-2025";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Security: only allow calls with the correct secret header
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = supabaseAdmin();
  const today = new Date();
  const todayStr = format(today, "EEEE, MMMM d"); // e.g. "Monday, April 7"
  const dayShort = format(today, "EEE").toLowerCase(); // e.g. "mon"

  try {
    // Get all active planned habits
    const { data: planned } = await db
      .from("planned_habits")
      .select("*")
      .eq("active", true);

    if (!planned?.length) {
      const msg = `Good morning, Alphonse. No habits planned for today. You can add planned habits from the dashboard.`;
      await db.from("messages").insert([{ role: "assistant", content: msg }]);
      return res.status(200).json({ ok: true });
    }

    // Filter habits for today based on frequency
    const todayHabits = planned.filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekdays") return ["mon","tue","wed","thu","fri"].includes(dayShort);
      if (h.frequency === "weekends") return ["sat","sun"].includes(dayShort);
      if (h.frequency === "specific") {
        return Array.isArray(h.specific_days) && h.specific_days.includes(dayShort);
      }
      return false;
    });

    if (!todayHabits.length) {
      const msg = `Good morning, Alphonse. No habits scheduled for today (${todayStr}). Rest day or free day — enjoy it.`;
      await db.from("messages").insert([{ role: "assistant", content: msg }]);
      return res.status(200).json({ ok: true });
    }

    // Build the morning message
    const habitLines = todayHabits.map(h => {
      let line = `• ${h.name.charAt(0).toUpperCase() + h.name.slice(1)}`;
      if (h.start_time) {
        line += ` — ${h.start_time}`;
        if (h.end_time) line += ` to ${h.end_time}`;
      }
      if (h.target) line += ` (target: ${h.target})`;
      return line;
    }).join("\n");

    const message = `Good morning, Alphonse. Here is your plan for today, ${todayStr}:\n\n${habitLines}\n\nLog each one when you're done.`;

    await db.from("messages").insert([{ role: "assistant", content: message }]);
    return res.status(200).json({ ok: true, habits_count: todayHabits.length });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Morning cron error:", msg);
    return res.status(500).json({ error: msg });
  }
}

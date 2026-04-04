import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { listTodayEvents } from "@/lib/google";
import { format } from "date-fns";

const CRON_SECRET = process.env.CRON_SECRET || "apela-cron-2025";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const db = supabaseAdmin();
  const today    = new Date();
  const todayStr = format(today, "EEEE, MMMM d");
  const dayShort = format(today, "EEE").toLowerCase();

  try {
    // Get planned habits for today
    const { data: planned } = await db.from("planned_habits").select("*").eq("active", true);

    const todayHabits = (planned || []).filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekdays") return ["mon","tue","wed","thu","fri"].includes(dayShort);
      if (h.frequency === "weekends") return ["sat","sun"].includes(dayShort);
      if (h.frequency === "specific") return Array.isArray(h.specific_days) && h.specific_days.includes(dayShort);
      return false;
    });

    // Get Google Calendar events for today (graceful fail if not connected)
    let calendarEvents: { summary: string; start: string; end: string }[] = [];
    try {
      calendarEvents = await listTodayEvents();
    } catch {
      // Google not connected — skip silently
    }

    // Build message
    let message = `Good morning, Alphonse. ${todayStr}.\n`;

    if (todayHabits.length > 0) {
      message += `\nHabits today:\n`;
      message += todayHabits.map(h => {
        let line = `• ${h.name.charAt(0).toUpperCase() + h.name.slice(1)}`;
        if (h.start_time) { line += ` — ${h.start_time}`; if (h.end_time) line += ` to ${h.end_time}`; }
        if (h.target) line += ` (${h.target})`;
        return line;
      }).join("\n");
    } else {
      message += `\nNo habits scheduled today.`;
    }

    if (calendarEvents.length > 0) {
      message += `\n\nCalendar:\n`;
      message += calendarEvents.map(e => {
        const time = e.start ? format(new Date(e.start), "h:mm a") : "";
        return `• ${e.summary}${time ? ` at ${time}` : ""}`;
      }).join("\n");
    }

    message += `\n\nLog each activity when done.`;

    await db.from("messages").insert([{ role: "assistant", content: message }]);
    return res.status(200).json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
}

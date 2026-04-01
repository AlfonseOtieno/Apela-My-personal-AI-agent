import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { callApela, toGeminiHistory } from "@/lib/agent";
import { getLogsForPeriod, buildStatContext, generateReport, getStreak } from "@/lib/stats";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body as { message: string };
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });

  const db = supabaseAdmin();

  try {
    // 1. Load last 30 messages as history
    const { data: history } = await db
      .from("messages")
      .select("role, content")
      .order("created_at", { ascending: true })
      .limit(30);

    const geminiHistory = toGeminiHistory(history || []);

    // 2. Save user message
    await db.from("messages").insert([{ role: "user", content: message }]);

    // 3. Call Gemini
    const { text, action } = await callApela(message, geminiHistory);
    let finalReply = text;

    // 4. Execute action
    switch (action.type) {

      case "log_habit": {
        const d = action.data as {
          habit_name: string;
          duration?: number;
          feeling?: string;
          note?: string;
        };

        if (!d.habit_name) break;

        // Upsert habit definition
        const { data: existing } = await db
          .from("habits")
          .select("id")
          .ilike("name", d.habit_name)
          .single();

        let habitId = existing?.id;
        if (!habitId) {
          const { data: newHabit } = await db
            .from("habits")
            .insert([{ name: d.habit_name, unit: "minutes" }])
            .select("id")
            .single();
          habitId = newHabit?.id;
        }

        await db.from("habit_logs").insert([{
          habit_id:   habitId || null,
          habit_name: d.habit_name,
          duration:   d.duration || null,
          feeling:    d.feeling  || null,
          note:       d.note     || null,
        }]);

        // Append streak if more than 1
        const streak = await getStreak(d.habit_name);
        if (streak > 1) {
          finalReply = `${text} ${streak}-day streak on ${d.habit_name}.`;
        }
        break;
      }

      case "add_planned_habit": {
        const d = action.data as {
          name: string;
          frequency?: string;
          unit?: string;
        };
        if (!d.name) break;

        await db.from("planned_habits").upsert([{
          name:      d.name,
          frequency: d.frequency || "daily",
          unit:      d.unit      || "minutes",
          active:    true,
        }], { onConflict: "name" });
        break;
      }

      case "get_stats": {
        const d = action.data as { habit_name?: string; period?: string };
        const now  = new Date();
        const from = d.period === "month" ? startOfMonth(now) : startOfWeek(now, { weekStartsOn: 1 });
        const to   = d.period === "month" ? endOfMonth(now)   : endOfWeek(now, { weekStartsOn: 1 });

        const logs    = await getLogsForPeriod(d.habit_name || null, from, to);
        const context = buildStatContext(logs, d.period || "week");

        const statsResponse = await callApela(message, geminiHistory, context);
        finalReply = statsResponse.text;
        break;
      }

      case "get_report": {
        const d          = action.data as { period_type?: "week" | "month" | "year" };
        const periodType = d.period_type || "week";
        finalReply       = await generateReport(periodType);

        const now       = new Date();
        const periodKey =
          periodType === "week"  ? `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, "0")}` :
          periodType === "month" ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` :
          `${now.getFullYear()}`;

        await db.from("reports").upsert([{
          period:      periodKey,
          period_type: periodType,
          content:     finalReply,
        }], { onConflict: "period" });
        break;
      }

      case "clarify":
        // Gemini already put the clarifying question in `text` — just use it
        break;

      case "none":
      default:
        break;
    }

    // 5. Save assistant reply
    await db.from("messages").insert([{ role: "assistant", content: finalReply }]);

    return res.status(200).json({ reply: finalReply });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Apela chat error:", msg);

    const errorReply = `Something went wrong on my end: ${msg}`;
    try {
      await db.from("messages").insert([{ role: "assistant", content: errorReply }]);
    } catch { /* ignore secondary failure */ }

    return res.status(200).json({ reply: errorReply });
  }
}

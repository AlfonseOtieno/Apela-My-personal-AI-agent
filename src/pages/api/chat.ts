import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { callApela, toGeminiHistory } from "@/lib/agent";
import { getLogsForPeriod, buildStatContext, generateReport, getStreak } from "@/lib/stats";
import { createCalendarEvent, deleteCalendarEvent, createTask, completeTask, deleteTask } from "@/lib/google";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

function resolveLogDate(logDate: unknown): string {
  if (typeof logDate === "string" && logDate.match(/^\d{4}-\d{2}-\d{2}$/)) return logDate;
  return format(new Date(), "yyyy-MM-dd");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { message } = req.body as { message: string };
  if (!message?.trim()) return res.status(400).json({ error: "Message required" });

  const db = supabaseAdmin();

  try {
    const { data: history } = await db
      .from("messages").select("role, content")
      .order("created_at", { ascending: true }).limit(40);

    const geminiHistory = toGeminiHistory(history || []);
    await db.from("messages").insert([{ role: "user", content: message }]);

    const { text, action } = await callApela(message, geminiHistory);
    let finalReply = text;

    switch (action.type) {

      case "log_habit": {
        const d = action.data as { habit_name: string; duration?: number; feeling?: string; note?: string; log_date?: string };
        if (!d.habit_name) break;
        const logDate = resolveLogDate(d.log_date);

        const { data: existing } = await db.from("habits").select("id").ilike("name", d.habit_name).single();
        let habitId = existing?.id;
        if (!habitId) {
          const { data: newHabit } = await db.from("habits").insert([{ name: d.habit_name, unit: "minutes" }]).select("id").single();
          habitId = newHabit?.id;
        }
        await db.from("habit_logs").insert([{ habit_id: habitId || null, habit_name: d.habit_name, duration: d.duration || null, feeling: d.feeling || null, note: d.note || null, date: logDate, logged_at: new Date().toISOString() }]);

        const today = format(new Date(), "yyyy-MM-dd");
        const dateNote = logDate !== today ? ` (logged to ${logDate})` : "";
        const streak = await getStreak(d.habit_name);
        if (streak > 1) finalReply = `${text}${dateNote} ${streak}-day streak on ${d.habit_name}.`;
        else if (dateNote) finalReply = `${text}${dateNote}`;
        break;
      }

      case "add_planned_habit": {
        const d = action.data as { name: string; frequency?: string; unit?: string; start_time?: string; end_time?: string; target?: string };
        if (!d.name) break;
        await db.from("planned_habits").upsert([{ name: d.name.toLowerCase(), frequency: d.frequency || "daily", unit: d.unit || "minutes", start_time: d.start_time || null, end_time: d.end_time || null, target: d.target || null, active: true }], { onConflict: "name" });
        break;
      }

      case "add_calendar_event": {
        const d = action.data as { summary: string; start: string; end: string; description?: string; location?: string };
        if (!d.summary || !d.start || !d.end) {
          finalReply = "I need a title and time to create the event. What is it called and when?";
          break;
        }
        try {
          const event = await createCalendarEvent(d);
          finalReply = `Added to your Google Calendar: "${event.summary}".`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed";
          if (msg.includes("not connected")) {
            finalReply = "Google is not connected yet. Go to Dashboard → Google tab to connect your account first.";
          } else {
            finalReply = `Could not add to calendar: ${msg}`;
          }
        }
        break;
      }

      case "delete_calendar_event": {
        const d = action.data as { event_id: string };
        try {
          await deleteCalendarEvent(d.event_id);
          finalReply = "Event deleted from your Google Calendar.";
        } catch (err) {
          finalReply = `Could not delete event: ${err instanceof Error ? err.message : "Failed"}`;
        }
        break;
      }

      case "add_task": {
        const d = action.data as { title: string; due?: string; notes?: string };
        if (!d.title) {
          finalReply = "What should I call this task?";
          break;
        }
        try {
          const task = await createTask({ title: d.title, due: d.due, notes: d.notes });
          finalReply = `Task added to Google Tasks: "${task.title}".`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed";
          if (msg.includes("not connected")) {
            finalReply = "Google is not connected yet. Go to Dashboard → Google tab to connect your account first.";
          } else {
            finalReply = `Could not add task: ${msg}`;
          }
        }
        break;
      }

      case "complete_task": {
        const d = action.data as { task_id: string };
        try {
          await completeTask(d.task_id);
          finalReply = "Task marked as complete in Google Tasks.";
        } catch (err) {
          finalReply = `Could not complete task: ${err instanceof Error ? err.message : "Failed"}`;
        }
        break;
      }

      case "delete_task": {
        const d = action.data as { task_id: string };
        try {
          await deleteTask(d.task_id);
          finalReply = "Task deleted from Google Tasks.";
        } catch (err) {
          finalReply = `Could not delete task: ${err instanceof Error ? err.message : "Failed"}`;
        }
        break;
      }

      case "get_stats": {
        const d = action.data as { habit_name?: string; period?: string };
        const now = new Date();
        const from = d.period === "month" ? startOfMonth(now) : startOfWeek(now, { weekStartsOn: 1 });
        const to   = d.period === "month" ? endOfMonth(now)   : endOfWeek(now, { weekStartsOn: 1 });
        const logs = await getLogsForPeriod(d.habit_name || null, from, to);
        const context = buildStatContext(logs, d.period || "week");
        const statsResponse = await callApela(message, geminiHistory, context);
        finalReply = statsResponse.text;
        break;
      }

      case "get_report": {
        const d = action.data as { period_type?: "week" | "month" | "year" };
        const periodType = d.period_type || "week";
        finalReply = await generateReport(periodType);
        const now = new Date();
        const periodKey = periodType === "week" ? `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, "0")}` : periodType === "month" ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` : `${now.getFullYear()}`;
        await db.from("reports").upsert([{ period: periodKey, period_type: periodType, content: finalReply }], { onConflict: "period" });
        break;
      }

      case "clarify":
      case "none":
      default:
        break;
    }

    await db.from("messages").insert([{ role: "assistant", content: finalReply }]);
    return res.status(200).json({ reply: finalReply });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Apela chat error:", msg);
    const errorReply = `Something went wrong: ${msg}`;
    try { await db.from("messages").insert([{ role: "assistant", content: errorReply }]); } catch { /* ignore */ }
    return res.status(200).json({ reply: errorReply });
  }
}

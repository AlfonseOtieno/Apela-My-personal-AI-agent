import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { from, to, habit, date } = req.query as {
      from?: string; to?: string; habit?: string; date?: string;
    };

    let q = db
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)   // ← always scope to user
      .order("date", { ascending: false });

    if (date)  q = q.eq("date", date);
    if (from)  q = q.gte("date", from);
    if (to)    q = q.lte("date", to);
    if (habit) q = q.ilike("habit_name", `%${habit}%`);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { id, habit } = req.query as { id?: string; habit?: string };

    if (id) {
      const { error } = await db
        .from("habit_logs")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);  // ← verify ownership
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    if (habit) {
      const { error } = await db
        .from("habit_logs")
        .delete()
        .ilike("habit_name", `%${habit}%`)
        .eq("user_id", user.id);  // ← verify ownership
      if (error) return res.status(500).json({ error: error.message });
      return res.status(204).end();
    }

    return res.status(400).json({ error: "Provide id or habit param" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("planned_habits")
      .select("*")
      .eq("user_id", user.id)   // ← REQUIRED: always scope to user
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { name, frequency, unit, start_time, end_time, target, specific_days } = req.body as {
      name: string; frequency?: string; unit?: string;
      start_time?: string; end_time?: string; target?: string; specific_days?: string[];
    };
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });

    const { data, error } = await db
      .from("planned_habits")
      .upsert([{
        name:          name.trim().toLowerCase(),
        frequency:     frequency     || "daily",
        unit:          unit          || "minutes",
        start_time:    start_time    || null,
        end_time:      end_time      || null,
        target:        target        || null,
        specific_days: specific_days || [],
        active:        true,
        user_id:       user.id,      // ← always set owner
      }], { onConflict: "user_id,name" })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body as { id: string; [key: string]: unknown };
    if (!id) return res.status(400).json({ error: "ID required" });

    const { data, error } = await db
      .from("planned_habits")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)   // ← verify ownership before update
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "ID required" });

    const { error } = await db
      .from("planned_habits")
      .update({ active: false })
      .eq("id", id)
      .eq("user_id", user.id);  // ← verify ownership before delete
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}

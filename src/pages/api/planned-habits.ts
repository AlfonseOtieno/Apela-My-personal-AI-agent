import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("planned_habits")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { name, frequency, unit, preferred_time, target, specific_days } = req.body as {
      name: string;
      frequency?: string;
      unit?: string;
      preferred_time?: string;
      target?: string;
      specific_days?: string[];
    };
    if (!name?.trim()) return res.status(400).json({ error: "Name required" });

    const { data, error } = await db
      .from("planned_habits")
      .upsert([{
        name:           name.trim().toLowerCase(),
        frequency:      frequency      || "daily",
        unit:           unit           || "minutes",
        preferred_time: preferred_time || null,
        target:         target         || null,
        specific_days:  specific_days  || [],
        active:         true,
      }], { onConflict: "name" })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    const { error } = await db
      .from("planned_habits")
      .update({ active: false })
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}

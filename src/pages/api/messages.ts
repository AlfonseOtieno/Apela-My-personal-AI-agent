import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
}

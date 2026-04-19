import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { data } = await db
      .from("user_settings")
      .select("gemini_key, display_name")
      .eq("user_id", user.id)
      .single();
    return res.status(200).json(data || { gemini_key: null, display_name: null });
  }

  if (req.method === "POST") {
    const { gemini_key, display_name } = req.body as { gemini_key?: string; display_name?: string };
    const { error } = await db
      .from("user_settings")
      .upsert({ user_id: user.id, gemini_key: gemini_key || null, display_name: display_name || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

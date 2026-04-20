import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();
  const { error } = await db
    .from("messages")
    .delete()
    .eq("user_id", user.id);  // ← only delete THIS user's messages

  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).end();
}

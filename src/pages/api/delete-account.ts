import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();

  // Delete all user data (RLS cascade handles most, but explicit is safer)
  await db.from("messages").delete().eq("user_id", user.id);
  await db.from("habit_logs").delete().eq("user_id", user.id);
  await db.from("habits").delete().eq("user_id", user.id);
  await db.from("planned_habits").delete().eq("user_id", user.id);
  await db.from("reports").delete().eq("user_id", user.id);
  await db.from("oauth_tokens").delete().eq("user_id", user.id);
  await db.from("user_settings").delete().eq("user_id", user.id);

  // Delete the auth user (requires service role)
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true });
}

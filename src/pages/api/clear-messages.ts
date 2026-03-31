import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const db = supabaseAdmin();
  const { error } = await db.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true });
}

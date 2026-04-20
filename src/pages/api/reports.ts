import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAuth, getGeminiKey } from "@/lib/auth-middleware";
import { generateReport } from "@/lib/stats";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("reports")
      .select("*")
      .eq("user_id", user.id)   // ← always scope to user
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { period_type } = req.body as { period_type: "week"|"month"|"year" };
    if (!period_type) return res.status(400).json({ error: "period_type required" });

    const geminiKey = await getGeminiKey(user.id);
    const content   = await generateReport(period_type, user.id, geminiKey);

    const now = new Date();
    const periodKey =
      period_type === "week"  ? `${now.getFullYear()}-W${String(Math.ceil(now.getDate()/7)).padStart(2,"0")}` :
      period_type === "month" ? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}` :
      `${now.getFullYear()}`;

    await db.from("reports").upsert([{
      period:      periodKey,
      period_type,
      content,
      user_id:     user.id,
    }], { onConflict: "period" });

    return res.status(200).json({ content });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

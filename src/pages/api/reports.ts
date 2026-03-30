import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { generateReport } from "@/lib/stats";
import { format } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { period_type } = req.body as { period_type: "week" | "month" | "year" };
    const content = await generateReport(period_type || "week");

    const now = new Date();
    const period =
      period_type === "week"  ? `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, "0")}` :
      period_type === "month" ? format(now, "yyyy-MM") :
      `${now.getFullYear()}`;

    await db.from("reports").upsert([{ period, period_type, content }], { onConflict: "period" });
    return res.status(200).json({ content });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth-middleware";
import { getAllHabitStats } from "@/lib/stats";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const stats = await getAllHabitStats(user.id);  // ← pass user.id
  return res.status(200).json(stats);
}

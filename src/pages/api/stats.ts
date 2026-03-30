import type { NextApiRequest, NextApiResponse } from "next";
import { getAllHabitStats } from "@/lib/stats";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const stats = await getAllHabitStats();
    return res.status(200).json(stats);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed";
    return res.status(500).json({ error: msg });
  }
}

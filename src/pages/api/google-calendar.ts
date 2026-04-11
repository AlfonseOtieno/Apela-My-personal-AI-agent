import type { NextApiRequest, NextApiResponse } from "next";
import { listUpcomingEvents, createCalendarEvent, deleteCalendarEvent } from "@/lib/google";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const events = await listUpcomingEvents(14, user.id);
      return res.status(200).json(events);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  if (req.method === "POST") {
    try {
      const event = await createCalendarEvent(req.body, user.id);
      return res.status(201).json(event);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") return res.status(400).json({ error: "ID required" });
    try {
      await deleteCalendarEvent(id, user.id);
      return res.status(204).end();
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

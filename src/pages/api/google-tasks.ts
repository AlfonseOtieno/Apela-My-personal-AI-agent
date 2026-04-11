import type { NextApiRequest, NextApiResponse } from "next";
import { listTasks, createTask, completeTask, deleteTask } from "@/lib/google";
import { requireAuth } from "@/lib/auth-middleware";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const tasks = await listTasks(user.id);
      return res.status(200).json(tasks);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  if (req.method === "POST") {
    try {
      const task = await createTask(req.body, user.id);
      return res.status(201).json(task);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id || typeof id !== "string") return res.status(400).json({ error: "ID required" });
    try {
      await completeTask(id, user.id);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") return res.status(400).json({ error: "ID required" });
    try {
      await deleteTask(id, user.id);
      return res.status(204).end();
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

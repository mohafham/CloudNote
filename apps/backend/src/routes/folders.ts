import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const foldersRouter = Router();

const createFolderSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(24).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  icon: z.string().min(1).max(24).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

foldersRouter.use(requireAuth);

foldersRouter.get("/", async (req, res) => {
  const userId = req.user!.id;

  const folders = await pool.query(
    `SELECT id, owner_id AS "ownerId", name, icon, color, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM folders
     WHERE owner_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  res.status(200).json({ folders: folders.rows });
});

foldersRouter.post("/", async (req, res) => {
  const userId = req.user!.id;
  const parsed = createFolderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid folder payload.", issues: parsed.error.flatten() });
    return;
  }

  try {
    const insert = await pool.query(
      `INSERT INTO folders (owner_id, name, icon, color)
       VALUES ($1, $2, $3, $4)
       RETURNING id, owner_id AS "ownerId", name, icon, color, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [userId, parsed.data.name, parsed.data.icon ?? "folder", parsed.data.color ?? "#4E5D94"]
    );

    res.status(201).json({ folder: insert.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === "23505") {
      res.status(409).json({ message: "Folder name already exists for this user." });
      return;
    }

    res.status(500).json({ message: "Failed to create folder." });
  }
});

foldersRouter.patch("/:folderId", async (req, res) => {
  const userId = req.user!.id;
  const { folderId } = req.params;
  const parsed = updateFolderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid folder update payload.", issues: parsed.error.flatten() });
    return;
  }

  const update = await pool.query(
    `UPDATE folders
     SET name = COALESCE($3, name),
         icon = COALESCE($4, icon),
         color = COALESCE($5, color)
     WHERE id = $1 AND owner_id = $2
     RETURNING id, owner_id AS "ownerId", name, icon, color, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [folderId, userId, parsed.data.name ?? null, parsed.data.icon ?? null, parsed.data.color ?? null]
  );

  if (update.rowCount === 0) {
    res.status(404).json({ message: "Folder not found." });
    return;
  }

  res.status(200).json({ folder: update.rows[0] });
});

foldersRouter.delete("/:folderId", async (req, res) => {
  const userId = req.user!.id;
  const { folderId } = req.params;

  const deleted = await pool.query(
    `DELETE FROM folders
     WHERE id = $1 AND owner_id = $2
     RETURNING id`,
    [folderId, userId]
  );

  if (deleted.rowCount === 0) {
    res.status(404).json({ message: "Folder not found." });
    return;
  }

  res.status(204).send();
});

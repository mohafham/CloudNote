import { Router } from "express";
import { pool } from "../db/pool.js";

export const sharedRouter = Router();

sharedRouter.get("/:token", async (req, res) => {
  const { token } = req.params;

  const noteResult = await pool.query(
    `SELECT
       n.id,
       n.type,
       n.title,
       n.content,
       n.metadata,
       n.updated_at AS "updatedAt",
       sl.access_level AS "accessLevel"
     FROM note_share_links sl
     JOIN notes n ON n.id = sl.note_id
     WHERE sl.token = $1
       AND sl.is_active = TRUE
       AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
     LIMIT 1`,
    [token]
  );

  if (noteResult.rowCount === 0) {
    res.status(404).json({ message: "Share link is invalid, expired, or revoked." });
    return;
  }

  const attachments = await pool.query(
    `SELECT id, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", public_url AS "publicUrl", created_at AS "createdAt"
     FROM attachments
     WHERE note_id = $1
     ORDER BY created_at DESC`,
    [noteResult.rows[0].id]
  );

  res.status(200).json({
    note: noteResult.rows[0],
    attachments: attachments.rows
  });
});

import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

export const searchRouter = Router();

const querySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid search query.", issues: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.id;
  const keyword = parsed.data.q.trim();
  const pattern = `%${keyword}%`;

  const result = await pool.query(
    `SELECT
       n.id,
       n.type,
       n.title,
       n.folder_id AS "folderId",
       LEFT(n.content, 220) AS excerpt,
       n.updated_at AS "updatedAt",
       CASE WHEN n.title ILIKE $2 THEN 1 ELSE 0 END AS title_priority,
       ts_rank(n.search_vector, plainto_tsquery('simple', $1)) AS rank
     FROM notes n
     WHERE (
       n.owner_id = $3
       OR EXISTS (
         SELECT 1
         FROM note_collaborators nc
         WHERE nc.note_id = n.id
           AND nc.user_id = $3
       )
     )
       AND (
         n.title ILIKE $2
         OR n.content ILIKE $2
         OR n.search_vector @@ plainto_tsquery('simple', $1)
       )
     ORDER BY title_priority DESC, rank DESC, n.updated_at DESC
     LIMIT $4`,
    [keyword, pattern, userId, parsed.data.limit]
  );

  res.status(200).json({
    keyword,
    count: result.rowCount,
    results: result.rows
  });
});

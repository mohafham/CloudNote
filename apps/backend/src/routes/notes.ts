import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { hasRequiredAccess, resolveNoteAccess } from "../middleware/noteAccess.js";
import { signRealtimeToken } from "../services/authTokens.js";
import { createPresignedUploadUrl, deleteStoredObject, getObjectPublicUrl } from "../services/storage.js";

export const notesRouter = Router();

const noteCreateSchema = z.object({
  type: z.enum(["note", "checklist"]).default("note"),
  title: z.string().max(180).default(""),
  content: z.string().default(""),
  folderId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional()
});

const noteUpdateSchema = z.object({
  type: z.enum(["note", "checklist"]).optional(),
  title: z.string().max(180).optional(),
  content: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  isArchived: z.boolean().optional()
});

const shareCreateSchema = z.object({
  accessLevel: z.enum(["view", "edit"]),
  expiresAt: z.string().datetime().nullable().optional()
});

const shareUpdateSchema = z.object({
  accessLevel: z.enum(["view", "edit"]).optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

const collaboratorSchema = z.object({
  email: z.string().email(),
  accessLevel: z.enum(["view", "edit"])
});

const attachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]),
  sizeBytes: z.number().int().positive()
});

const checklistSchema = z.object({
  title: z.string().max(180).default(""),
  displayMode: z.enum(["standalone", "embedded"]).default("embedded")
});

const checklistItemSchema = z.object({
  content: z.string().min(1).max(500),
  position: z.number().int().nonnegative().default(0)
});

const checklistItemUpdateSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  isChecked: z.boolean().optional(),
  position: z.number().int().nonnegative().optional()
});

const noteBlockSchema = z.object({
  blockType: z.enum(["paragraph", "checklist", "voice_transcript", "diagram", "note_link"]),
  position: z.number().int().nonnegative().default(0),
  payload: z.record(z.unknown())
});

const noteBlockUpdateSchema = z.object({
  position: z.number().int().nonnegative().optional(),
  payload: z.record(z.unknown()).optional()
});

const noteLinkSchema = z.object({
  targetNoteId: z.string().uuid(),
  alias: z.string().min(1).max(120)
});

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

notesRouter.use(requireAuth);

notesRouter.get("/", async (req, res) => {
  const userId = req.user!.id;
  const folderId = typeof req.query.folderId === "string" ? req.query.folderId : null;
  const type = typeof req.query.type === "string" ? req.query.type : null;
  const includeArchived = req.query.includeArchived === "true";

  const notes = await pool.query(
    `SELECT
       n.id,
       n.owner_id AS "ownerId",
       n.folder_id AS "folderId",
       n.type,
       n.title,
       n.content,
       n.metadata,
       n.is_archived AS "isArchived",
       n.created_at AS "createdAt",
       n.updated_at AS "updatedAt"
     FROM notes n
     WHERE (
       n.owner_id = $1
       OR EXISTS (
         SELECT 1
         FROM note_collaborators nc
         WHERE nc.note_id = n.id
           AND nc.user_id = $1
       )
     )
       AND ($2::uuid IS NULL OR n.folder_id = $2::uuid)
       AND ($3::text IS NULL OR n.type = $3::text)
       AND ($4::boolean OR n.is_archived = FALSE)
     ORDER BY n.updated_at DESC`,
    [userId, folderId, type, includeArchived]
  );

  res.status(200).json({ notes: notes.rows });
});

notesRouter.post("/", async (req, res) => {
  const userId = req.user!.id;
  const parsed = noteCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid note payload.", issues: parsed.error.flatten() });
    return;
  }

  const insert = await pool.query(
    `INSERT INTO notes (owner_id, folder_id, type, title, content, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING
       id,
       owner_id AS "ownerId",
       folder_id AS "folderId",
       type,
       title,
       content,
       metadata,
       is_archived AS "isArchived",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      userId,
      parsed.data.folderId ?? null,
      parsed.data.type,
      parsed.data.title,
      parsed.data.content,
      JSON.stringify(parsed.data.metadata ?? {})
    ]
  );

  res.status(201).json({ note: insert.rows[0] });
});

notesRouter.get("/:noteId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "view")) {
    res.status(403).json({ message: "You do not have access to this note." });
    return;
  }

  const note = await pool.query(
    `SELECT
       id,
       owner_id AS "ownerId",
       folder_id AS "folderId",
       type,
       title,
       content,
       metadata,
       is_archived AS "isArchived",
       created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM notes
     WHERE id = $1`,
    [noteId]
  );

  if (note.rowCount === 0) {
    res.status(404).json({ message: "Note not found." });
    return;
  }

  const attachments = await pool.query(
    `SELECT id, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", public_url AS "publicUrl", created_at AS "createdAt"
     FROM attachments
     WHERE note_id = $1
     ORDER BY created_at DESC`,
    [noteId]
  );

  const checklists = await pool.query(
    `SELECT id, host_note_id AS "hostNoteId", display_mode AS "displayMode", title, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM checklists
     WHERE host_note_id = $1
     ORDER BY created_at ASC`,
    [noteId]
  );

  const blocks = await pool.query(
    `SELECT id, block_type AS "blockType", position, payload, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM note_blocks
     WHERE note_id = $1
     ORDER BY position ASC`,
    [noteId]
  );

  res.status(200).json({
    note: note.rows[0],
    access,
    attachments: attachments.rows,
    checklists: checklists.rows,
    blocks: blocks.rows
  });
});

notesRouter.patch("/:noteId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have edit permission for this note." });
    return;
  }

  const parsed = noteUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid note update payload.", issues: parsed.error.flatten() });
    return;
  }

  const hasFolderId = Object.prototype.hasOwnProperty.call(parsed.data, "folderId");
  const hasMetadata = Object.prototype.hasOwnProperty.call(parsed.data, "metadata");

  const update = await pool.query(
    `UPDATE notes
     SET
       type = COALESCE($2, type),
       title = COALESCE($3, title),
       content = COALESCE($4, content),
       folder_id = CASE WHEN $5::boolean THEN $6::uuid ELSE folder_id END,
       metadata = CASE WHEN $7::boolean THEN $8::jsonb ELSE metadata END,
       is_archived = COALESCE($9, is_archived)
     WHERE id = $1
     RETURNING
       id,
       owner_id AS "ownerId",
       folder_id AS "folderId",
       type,
       title,
       content,
       metadata,
       is_archived AS "isArchived",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      noteId,
      parsed.data.type ?? null,
      parsed.data.title ?? null,
      parsed.data.content ?? null,
      hasFolderId,
      parsed.data.folderId ?? null,
      hasMetadata,
      hasMetadata ? JSON.stringify(parsed.data.metadata) : null,
      parsed.data.isArchived ?? null
    ]
  );

  if (update.rowCount === 0) {
    res.status(404).json({ message: "Note not found." });
    return;
  }

  res.status(200).json({ note: update.rows[0] });
});

notesRouter.delete("/:noteId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can delete notes." });
    return;
  }

  const deleted = await pool.query("DELETE FROM notes WHERE id = $1 RETURNING id", [noteId]);

  if (deleted.rowCount === 0) {
    res.status(404).json({ message: "Note not found." });
    return;
  }

  res.status(204).send();
});

notesRouter.get("/:noteId/share", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can manage share links." });
    return;
  }

  const links = await pool.query(
    `SELECT id, note_id AS "noteId", token, access_level AS "accessLevel", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt"
     FROM note_share_links
     WHERE note_id = $1
     ORDER BY created_at DESC`,
    [noteId]
  );

  res.status(200).json({ shareLinks: links.rows });
});

notesRouter.post("/:noteId/share", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can create share links." });
    return;
  }

  const parsed = shareCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid share payload.", issues: parsed.error.flatten() });
    return;
  }

  const token = uuidv4().replaceAll("-", "");
  const expiresAt = parsed.data.expiresAt ?? null;

  const insert = await pool.query(
    `INSERT INTO note_share_links (note_id, created_by, token, access_level, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, note_id AS "noteId", token, access_level AS "accessLevel", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt"`,
    [noteId, userId, token, parsed.data.accessLevel, expiresAt]
  );

  res.status(201).json({
    shareLink: insert.rows[0]
  });
});

notesRouter.patch("/:noteId/share/:shareId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, shareId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can update share links." });
    return;
  }

  const parsed = shareUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid share update payload.", issues: parsed.error.flatten() });
    return;
  }

  const hasExpiry = Object.prototype.hasOwnProperty.call(parsed.data, "expiresAt");

  const update = await pool.query(
    `UPDATE note_share_links
     SET
       access_level = COALESCE($3, access_level),
       is_active = COALESCE($4, is_active),
       expires_at = CASE WHEN $5::boolean THEN $6::timestamptz ELSE expires_at END
     WHERE id = $1 AND note_id = $2
     RETURNING id, note_id AS "noteId", token, access_level AS "accessLevel", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt"`,
    [
      shareId,
      noteId,
      parsed.data.accessLevel ?? null,
      parsed.data.isActive ?? null,
      hasExpiry,
      parsed.data.expiresAt ?? null
    ]
  );

  if (update.rowCount === 0) {
    res.status(404).json({ message: "Share link not found." });
    return;
  }

  res.status(200).json({ shareLink: update.rows[0] });
});

notesRouter.delete("/:noteId/share/:shareId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, shareId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can revoke share links." });
    return;
  }

  const removed = await pool.query(
    `DELETE FROM note_share_links
     WHERE id = $1 AND note_id = $2
     RETURNING id`,
    [shareId, noteId]
  );

  if (removed.rowCount === 0) {
    res.status(404).json({ message: "Share link not found." });
    return;
  }

  res.status(204).send();
});

notesRouter.post("/:noteId/collaborators", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can invite collaborators." });
    return;
  }

  const parsed = collaboratorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid collaborator payload.", issues: parsed.error.flatten() });
    return;
  }

  const userLookup = await pool.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email = $1`,
    [parsed.data.email]
  );

  if (userLookup.rowCount === 0) {
    res.status(404).json({ message: "Target account not found." });
    return;
  }

  const targetUser = userLookup.rows[0];

  await pool.query(
    `INSERT INTO note_collaborators (note_id, user_id, access_level, added_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (note_id, user_id)
     DO UPDATE SET access_level = EXCLUDED.access_level, added_by = EXCLUDED.added_by`,
    [noteId, targetUser.id, parsed.data.accessLevel, userId]
  );

  res.status(200).json({
    collaborator: {
      noteId,
      userId: targetUser.id,
      email: targetUser.email,
      accessLevel: parsed.data.accessLevel
    }
  });
});

notesRouter.delete("/:noteId/collaborators/:collaboratorUserId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, collaboratorUserId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "owner")) {
    res.status(403).json({ message: "Only note owners can remove collaborators." });
    return;
  }

  const removed = await pool.query(
    `DELETE FROM note_collaborators
     WHERE note_id = $1 AND user_id = $2
     RETURNING note_id`,
    [noteId, collaboratorUserId]
  );

  if (removed.rowCount === 0) {
    res.status(404).json({ message: "Collaborator not found." });
    return;
  }

  res.status(204).send();
});

notesRouter.get("/:noteId/attachments", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "view")) {
    res.status(403).json({ message: "You do not have access to note attachments." });
    return;
  }

  const attachments = await pool.query(
    `SELECT id, file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", public_url AS "publicUrl", created_at AS "createdAt"
     FROM attachments
     WHERE note_id = $1
     ORDER BY created_at DESC`,
    [noteId]
  );

  res.status(200).json({ attachments: attachments.rows });
});

notesRouter.post("/:noteId/attachments", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to add attachments." });
    return;
  }

  const parsed = attachmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid attachment payload.", issues: parsed.error.flatten() });
    return;
  }

  if (parsed.data.sizeBytes > env.MAX_UPLOAD_BYTES) {
    res.status(413).json({ message: `Attachment exceeds configured max size of ${env.MAX_UPLOAD_BYTES} bytes.` });
    return;
  }

  const storageKey = `notes/${noteId}/${uuidv4()}-${sanitizeFileName(parsed.data.fileName)}`;
  const uploadUrl = await createPresignedUploadUrl({
    storageKey,
    mimeType: parsed.data.mimeType
  });

  const insert = await pool.query(
    `INSERT INTO attachments (note_id, uploader_id, storage_key, file_name, mime_type, size_bytes, public_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, note_id AS "noteId", file_name AS "fileName", mime_type AS "mimeType", size_bytes AS "sizeBytes", public_url AS "publicUrl", created_at AS "createdAt"`,
    [
      noteId,
      userId,
      storageKey,
      parsed.data.fileName,
      parsed.data.mimeType,
      parsed.data.sizeBytes,
      getObjectPublicUrl(storageKey)
    ]
  );

  res.status(201).json({
    attachment: insert.rows[0],
    uploadUrl,
    uploadMethod: "PUT"
  });
});

notesRouter.delete("/:noteId/attachments/:attachmentId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, attachmentId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to remove attachments." });
    return;
  }

  const lookup = await pool.query<{ storage_key: string }>(
    `SELECT storage_key FROM attachments WHERE id = $1 AND note_id = $2`,
    [attachmentId, noteId]
  );

  if (lookup.rowCount === 0) {
    res.status(404).json({ message: "Attachment not found." });
    return;
  }

  await deleteStoredObject(lookup.rows[0].storage_key);
  await pool.query("DELETE FROM attachments WHERE id = $1", [attachmentId]);

  res.status(204).send();
});

notesRouter.post("/:noteId/checklists", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to add checklists." });
    return;
  }

  const parsed = checklistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid checklist payload.", issues: parsed.error.flatten() });
    return;
  }

  const insert = await pool.query(
    `INSERT INTO checklists (host_note_id, display_mode, title)
     VALUES ($1, $2, $3)
     RETURNING id, host_note_id AS "hostNoteId", display_mode AS "displayMode", title, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [noteId, parsed.data.displayMode, parsed.data.title]
  );

  res.status(201).json({ checklist: insert.rows[0] });
});

notesRouter.get("/:noteId/checklists", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;

  const access = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(access, "view")) {
    res.status(403).json({ message: "You do not have permission to view checklists." });
    return;
  }

  const checklists = await pool.query(
    `SELECT id, host_note_id AS "hostNoteId", display_mode AS "displayMode", title, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM checklists
     WHERE host_note_id = $1
     ORDER BY created_at ASC`,
    [noteId]
  );

  res.status(200).json({ checklists: checklists.rows });
});

notesRouter.post("/checklists/:checklistId/items", async (req, res) => {
  const userId = req.user!.id;
  const { checklistId } = req.params;

  const checklistLookup = await pool.query<{ host_note_id: string }>(
    "SELECT host_note_id FROM checklists WHERE id = $1",
    [checklistId]
  );

  if (checklistLookup.rowCount === 0) {
    res.status(404).json({ message: "Checklist not found." });
    return;
  }

  const access = await resolveNoteAccess(checklistLookup.rows[0].host_note_id, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to edit this checklist." });
    return;
  }

  const parsed = checklistItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid checklist item payload.", issues: parsed.error.flatten() });
    return;
  }

  const insert = await pool.query(
    `INSERT INTO checklist_items (checklist_id, content, position)
     VALUES ($1, $2, $3)
     RETURNING id, checklist_id AS "checklistId", content, is_checked AS "isChecked", position, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [checklistId, parsed.data.content, parsed.data.position]
  );

  res.status(201).json({ item: insert.rows[0] });
});

notesRouter.patch("/checklists/:checklistId/items/:itemId", async (req, res) => {
  const userId = req.user!.id;
  const { checklistId, itemId } = req.params;

  const checklistLookup = await pool.query<{ host_note_id: string }>(
    "SELECT host_note_id FROM checklists WHERE id = $1",
    [checklistId]
  );

  if (checklistLookup.rowCount === 0) {
    res.status(404).json({ message: "Checklist not found." });
    return;
  }

  const access = await resolveNoteAccess(checklistLookup.rows[0].host_note_id, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to edit this checklist." });
    return;
  }

  const parsed = checklistItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid checklist item update payload.", issues: parsed.error.flatten() });
    return;
  }

  const update = await pool.query(
    `UPDATE checklist_items
     SET
       content = COALESCE($3, content),
       is_checked = COALESCE($4, is_checked),
       position = COALESCE($5, position)
     WHERE id = $1 AND checklist_id = $2
     RETURNING id, checklist_id AS "checklistId", content, is_checked AS "isChecked", position, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      itemId,
      checklistId,
      parsed.data.content ?? null,
      parsed.data.isChecked ?? null,
      parsed.data.position ?? null
    ]
  );

  if (update.rowCount === 0) {
    res.status(404).json({ message: "Checklist item not found." });
    return;
  }

  res.status(200).json({ item: update.rows[0] });
});

notesRouter.delete("/checklists/:checklistId/items/:itemId", async (req, res) => {
  const userId = req.user!.id;
  const { checklistId, itemId } = req.params;

  const checklistLookup = await pool.query<{ host_note_id: string }>(
    "SELECT host_note_id FROM checklists WHERE id = $1",
    [checklistId]
  );

  if (checklistLookup.rowCount === 0) {
    res.status(404).json({ message: "Checklist not found." });
    return;
  }

  const access = await resolveNoteAccess(checklistLookup.rows[0].host_note_id, userId);
  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to edit this checklist." });
    return;
  }

  const removed = await pool.query(
    "DELETE FROM checklist_items WHERE id = $1 AND checklist_id = $2 RETURNING id",
    [itemId, checklistId]
  );

  if (removed.rowCount === 0) {
    res.status(404).json({ message: "Checklist item not found." });
    return;
  }

  res.status(204).send();
});

notesRouter.post("/:noteId/blocks", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to edit note blocks." });
    return;
  }

  const parsed = noteBlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid note block payload.", issues: parsed.error.flatten() });
    return;
  }

  const insert = await pool.query(
    `INSERT INTO note_blocks (note_id, block_type, position, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, note_id AS "noteId", block_type AS "blockType", position, payload, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [noteId, parsed.data.blockType, parsed.data.position, JSON.stringify(parsed.data.payload)]
  );

  res.status(201).json({ block: insert.rows[0] });
});

notesRouter.patch("/:noteId/blocks/:blockId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, blockId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to edit note blocks." });
    return;
  }

  const parsed = noteBlockUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid note block update payload.", issues: parsed.error.flatten() });
    return;
  }

  const hasPayload = Object.prototype.hasOwnProperty.call(parsed.data, "payload");

  const update = await pool.query(
    `UPDATE note_blocks
     SET
       position = COALESCE($3, position),
       payload = CASE WHEN $4::boolean THEN $5::jsonb ELSE payload END
     WHERE id = $1 AND note_id = $2
     RETURNING id, note_id AS "noteId", block_type AS "blockType", position, payload, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [
      blockId,
      noteId,
      parsed.data.position ?? null,
      hasPayload,
      hasPayload ? JSON.stringify(parsed.data.payload) : null
    ]
  );

  if (update.rowCount === 0) {
    res.status(404).json({ message: "Note block not found." });
    return;
  }

  res.status(200).json({ block: update.rows[0] });
});

notesRouter.delete("/:noteId/blocks/:blockId", async (req, res) => {
  const userId = req.user!.id;
  const { noteId, blockId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "edit")) {
    res.status(403).json({ message: "You do not have permission to delete note blocks." });
    return;
  }

  const removed = await pool.query(
    "DELETE FROM note_blocks WHERE id = $1 AND note_id = $2 RETURNING id",
    [blockId, noteId]
  );

  if (removed.rowCount === 0) {
    res.status(404).json({ message: "Note block not found." });
    return;
  }

  res.status(204).send();
});

notesRouter.post("/:noteId/links", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const parsed = noteLinkSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Invalid note link payload.", issues: parsed.error.flatten() });
    return;
  }

  const sourceAccess = await resolveNoteAccess(noteId, userId);
  if (!hasRequiredAccess(sourceAccess, "edit")) {
    res.status(403).json({ message: "You do not have permission to link from this note." });
    return;
  }

  const targetAccess = await resolveNoteAccess(parsed.data.targetNoteId, userId);
  if (!hasRequiredAccess(targetAccess, "view")) {
    res.status(403).json({ message: "You do not have access to the target note." });
    return;
  }

  const insert = await pool.query(
    `INSERT INTO note_links (source_note_id, target_note_id, alias, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, source_note_id AS "sourceNoteId", target_note_id AS "targetNoteId", alias, created_at AS "createdAt"`,
    [noteId, parsed.data.targetNoteId, parsed.data.alias, userId]
  );

  res.status(201).json({ link: insert.rows[0] });
});

notesRouter.get("/:noteId/links", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "view")) {
    res.status(403).json({ message: "You do not have permission to view note links." });
    return;
  }

  const links = await pool.query(
    `SELECT
       nl.id,
       nl.source_note_id AS "sourceNoteId",
       nl.target_note_id AS "targetNoteId",
       nl.alias,
       tn.title AS "targetTitle",
       nl.created_at AS "createdAt"
     FROM note_links nl
     JOIN notes tn ON tn.id = nl.target_note_id
     WHERE nl.source_note_id = $1
     ORDER BY nl.created_at DESC`,
    [noteId]
  );

  res.status(200).json({ links: links.rows });
});

notesRouter.post("/:noteId/realtime-token", async (req, res) => {
  const userId = req.user!.id;
  const { noteId } = req.params;
  const access = await resolveNoteAccess(noteId, userId);

  if (!hasRequiredAccess(access, "view")) {
    res.status(403).json({ message: "You do not have access to this note." });
    return;
  }

  const token = signRealtimeToken({
    userId,
    email: req.user!.email,
    noteId,
    accessLevel: access
  });

  res.status(200).json({
    noteId,
    accessLevel: access,
    realtimeToken: token
  });
});

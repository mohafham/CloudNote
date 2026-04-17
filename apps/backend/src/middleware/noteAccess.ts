import { pool } from "../db/pool.js";

export type NoteAccessLevel = "owner" | "edit" | "view" | null;
export type GrantedNoteAccessLevel = Exclude<NoteAccessLevel, null>;

export async function resolveNoteAccess(noteId: string, userId: string): Promise<NoteAccessLevel> {
  const ownerResult = await pool.query<{ owner_id: string }>(
    "SELECT owner_id FROM notes WHERE id = $1",
    [noteId]
  );

  if (ownerResult.rowCount === 0) {
    return null;
  }

  if (ownerResult.rows[0].owner_id === userId) {
    return "owner";
  }

  const collabResult = await pool.query<{ access_level: "view" | "edit" }>(
    "SELECT access_level FROM note_collaborators WHERE note_id = $1 AND user_id = $2",
    [noteId, userId]
  );

  if (collabResult.rowCount === 0) {
    return null;
  }

  return collabResult.rows[0].access_level;
}

export function hasRequiredAccess(
  access: NoteAccessLevel,
  required: "view"
): access is GrantedNoteAccessLevel;
export function hasRequiredAccess(
  access: NoteAccessLevel,
  required: "edit"
): access is "edit" | "owner";
export function hasRequiredAccess(
  access: NoteAccessLevel,
  required: "owner"
): access is "owner";
export function hasRequiredAccess(
  access: NoteAccessLevel,
  required: "view" | "edit" | "owner"
): boolean {
  if (!access) {
    return false;
  }

  if (required === "view") {
    return access === "view" || access === "edit" || access === "owner";
  }

  if (required === "edit") {
    return access === "edit" || access === "owner";
  }

  return access === "owner";
}

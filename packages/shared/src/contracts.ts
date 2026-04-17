export type AccessLevel = "view" | "edit";

export type NoteType = "note" | "checklist";

export type BlockType =
  | "paragraph"
  | "checklist"
  | "voice_transcript"
  | "diagram"
  | "note_link";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

export interface NoteRecord {
  id: string;
  ownerId: string;
  folderId: string | null;
  type: NoteType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FolderRecord {
  id: string;
  ownerId: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLinkRecord {
  id: string;
  noteId: string;
  token: string;
  accessLevel: AccessLevel;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface AttachmentRecord {
  id: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string | null;
  createdAt: string;
}

export interface RealtimeEnvelope<T = unknown> {
  event:
    | "note.join"
    | "note.leave"
    | "note.patch"
    | "note.cursor"
    | "checklist.item.update"
    | "collaboration.presence";
  noteId: string;
  payload: T;
}

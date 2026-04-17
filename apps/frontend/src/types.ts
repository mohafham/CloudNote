export type AccessLevel = "view" | "edit";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  sizeLabel: string;
}

export interface FolderFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: string;
}

export interface DiagramConnection {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface Diagram {
  id: string;
  title: string;
  connections: DiagramConnection[];
  createdAt: string;
}

export interface NoteEntity {
  id: string;
  type: "note" | "checklist";
  title: string;
  content: string;
  folderId: string | null;
  checklistItems: ChecklistItem[];
  embeddedChecklist: ChecklistItem[];
  attachments: Attachment[];
  diagrams: Diagram[];
  updatedAt: string;
}

export interface FolderEntity {
  id: string;
  name: string;
  color: string;
  files: FolderFile[];
}

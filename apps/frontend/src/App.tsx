import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { API_BASE_URL } from "./api/client";
import type { AccessLevel, ChecklistItem, FolderEntity, NoteEntity } from "./types";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdAccounts {
  id: {
    initialize: (args: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
      auto_select?: boolean;
    }) => void;
    renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
    prompt: () => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: GoogleIdAccounts;
    };
  }
}

const initialFolders: FolderEntity[] = [
  {
    id: "f-general",
    name: "General Notes",
    color: "#5f739b",
    files: [
      {
        id: "ff-1",
        name: "project-kickoff.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        sizeBytes: 210230,
        addedAt: new Date().toISOString()
      }
    ]
  },
  { id: "f-study", name: "Study Sprint", color: "#3a6f74", files: [] },
  { id: "f-design", name: "Diagram Lab", color: "#6f5a3a", files: [] }
];

const initialNotes: NoteEntity[] = [
  {
    id: "n-1",
    type: "note",
    title: "Project Kickoff",
    content:
      "Need clean architecture handoff. Mention [[Cloud Sync Plan]] and map API first. Add voice transcript and quick block diagram.",
    folderId: "f-general",
    checklistItems: [],
    embeddedChecklist: [
      { id: "ec-1", text: "Finalize SRS", done: true },
      { id: "ec-2", text: "Draft API contract", done: false }
    ],
    attachments: [
      { id: "a-1", name: "srs-v1.pdf", mimeType: "application/pdf", sizeLabel: "1.2 MB" },
      { id: "a-2", name: "wireframe.png", mimeType: "image/png", sizeLabel: "560 KB" }
    ],
    diagrams: [],
    updatedAt: new Date().toISOString()
  },
  {
    id: "n-2",
    type: "checklist",
    title: "Launch Checklist",
    content: "",
    folderId: "f-study",
    checklistItems: [
      { id: "c-1", text: "Run schema migration", done: true },
      { id: "c-2", text: "Smoke test API", done: false },
      { id: "c-3", text: "Verify share links", done: false }
    ],
    embeddedChecklist: [],
    attachments: [],
    diagrams: [],
    updatedAt: new Date().toISOString()
  },
  {
    id: "n-3",
    type: "note",
    title: "Cloud Sync Plan",
    content: "Use websocket room updates and fallback polling for spotty networks.",
    folderId: null,
    checklistItems: [],
    embeddedChecklist: [],
    attachments: [],
    diagrams: [],
    updatedAt: new Date().toISOString()
  }
];

const allowedFolderExtensions = new Set(["ppt", "pptx", "doc", "docx", "pdf", "txt"]);

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = sizeBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function isAllowedFolderFile(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) {
    return false;
  }

  return allowedFolderExtensions.has(extension);
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractNoteLinks(content: string): string[] {
  const matches = content.match(/\[\[(.*?)\]\]/g) ?? [];
  return matches.map((chunk) => chunk.slice(2, -2));
}

function App(): JSX.Element {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const [signedIn, setSignedIn] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authPanelOpen, setAuthPanelOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [folders, setFolders] = useState<FolderEntity[]>(initialFolders);
  const [notes, setNotes] = useState<NoteEntity[]>(initialNotes);
  const [searchText, setSearchText] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<{ noteId: string; accessLevel: AccessLevel } | null>(null);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const editingNote = notes.find((note) => note.id === editingNoteId) ?? null;

  const notesBySearch = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) {
      return notes;
    }

    return notes
      .filter((note) => note.title.toLowerCase().includes(keyword) || note.content.toLowerCase().includes(keyword))
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase().includes(keyword) ? 1 : 0;
        const bTitle = b.title.toLowerCase().includes(keyword) ? 1 : 0;
        return bTitle - aTitle;
      });
  }, [notes, searchText]);

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const checklistNotes = notesBySearch.filter((note) => note.type === "checklist");
  const regularNotes = notesBySearch.filter((note) => note.type === "note");

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      setAuthPending(true);
      setAuthMessage("");

      try {
        const apiResponse = await fetch(`${API_BASE_URL}/auth/google`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ credential: response.credential })
        });

        if (!apiResponse.ok) {
          const errorBody = (await apiResponse.json().catch(() => ({}))) as { message?: string };
          throw new Error(errorBody.message ?? "Google sign-in failed.");
        }

        const body = (await apiResponse.json()) as {
          user: {
            displayName: string;
          };
        };

        setSignedIn(true);
        setGuestMode(false);
        setAuthMessage(`Signed in as ${body.user.displayName}`);
      } catch (error) {
        const err = error as Error;
        setAuthMessage(err.message || "Could not authenticate with Google.");
      } finally {
        setAuthPending(false);
      }
    },
    []
  );

  const handleEmailAuth = useCallback(async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setAuthMessage("Email and password are required.");
      return;
    }

    if (authMode === "register" && !displayNameInput.trim()) {
      setAuthMessage("Display name is required for registration.");
      return;
    }

    setAuthPending(true);
    setAuthMessage("");

    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const payload =
        authMode === "login"
          ? {
              email: emailInput.trim(),
              password: passwordInput
            }
          : {
              email: emailInput.trim(),
              password: passwordInput,
              displayName: displayNameInput.trim()
            };

      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        user?: {
          displayName?: string;
        };
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Authentication failed.");
      }

      setSignedIn(true);
      setGuestMode(false);
      setAuthPanelOpen(false);
      setPasswordInput("");
      setAuthMessage(`Signed in as ${body.user?.displayName ?? emailInput.trim()}`);
    } catch (error) {
      const err = error as Error;
      setAuthMessage(err.message || "Authentication failed.");
    } finally {
      setAuthPending(false);
    }
  }, [authMode, displayNameInput, emailInput, passwordInput]);

  useEffect(() => {
    if (!googleClientId || signedIn || guestMode || !googleButtonRef.current) {
      return;
    }

    let isCancelled = false;

    const initializeGoogle = (): void => {
      if (isCancelled || !window.google || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = "";

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
        auto_select: false
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "medium",
        width: "260",
        text: "signin_with"
      });
    };

    if (window.google) {
      initializeGoogle();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => {
        setAuthMessage("Google sign-in is currently unreachable. Use email sign-in below.");
      };
      document.body.appendChild(script);
    }

    return () => {
      isCancelled = true;
    };
  }, [googleClientId, guestMode, handleGoogleCredential, signedIn]);

  function updateNote(noteId: string, updater: (note: NoteEntity) => NoteEntity): void {
    setNotes((current) =>
      current.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        return {
          ...updater(note),
          updatedAt: new Date().toISOString()
        };
      })
    );
  }

  function createNewNote(type: "note" | "checklist"): void {
    const noteId = makeId("n");
    const next: NoteEntity = {
      id: noteId,
      type,
      title: type === "checklist" ? "Untitled Checklist" : "Untitled Note",
      content: "",
      folderId: null,
      checklistItems: type === "checklist" ? [] : [],
      embeddedChecklist: [],
      attachments: [],
      diagrams: [],
      updatedAt: new Date().toISOString()
    };

    setNotes((current) => [next, ...current]);
    if (type === "note") {
      setEditingNoteId(noteId);
    }

    setQuickCreateOpen(false);
  }

  function createFolder(): void {
    const folderName = window.prompt("Folder name");
    if (!folderName || !folderName.trim()) {
      return;
    }

    const nextFolder: FolderEntity = {
      id: makeId("f"),
      name: folderName.trim(),
      color: "#4f678f",
      files: []
    };

    setFolders((current) => [nextFolder, ...current]);
    setQuickCreateOpen(false);
  }

  function addFilesToFolder(folderId: string, incomingFiles: File[]): void {
    const allowed = incomingFiles.filter((file) => isAllowedFolderFile(file.name));

    if (allowed.length === 0) {
      setAuthMessage("Only ppt, pptx, doc, docx, pdf, and txt files are allowed in folders.");
      return;
    }

    setFolders((current) =>
      current.map((folder) => {
        if (folder.id !== folderId) {
          return folder;
        }

        const nextFiles = allowed.map((file) => ({
          id: makeId("ff"),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          addedAt: new Date().toISOString()
        }));

        return {
          ...folder,
          files: [...folder.files, ...nextFiles]
        };
      })
    );
  }

  function handleFolderFileInput(folderId: string, event: ChangeEvent<HTMLInputElement>): void {
    if (!event.target.files) {
      return;
    }

    addFilesToFolder(folderId, Array.from(event.target.files));
    event.target.value = "";
  }

  function handleFolderDrop(folderId: string, event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    addFilesToFolder(folderId, droppedFiles);
  }

  function removeFolderFile(folderId: string, fileId: string): void {
    setFolders((current) =>
      current.map((folder) => {
        if (folder.id !== folderId) {
          return folder;
        }

        return {
          ...folder,
          files: folder.files.filter((file) => file.id !== fileId)
        };
      })
    );
  }

  function addChecklistItem(noteId: string, embedded: boolean): void {
    const text = window.prompt("Checklist item");
    if (!text || !text.trim()) {
      return;
    }

    updateNote(noteId, (note) => {
      const item: ChecklistItem = {
        id: makeId("item"),
        text: text.trim(),
        done: false
      };

      if (embedded) {
        return {
          ...note,
          embeddedChecklist: [...note.embeddedChecklist, item]
        };
      }

      return {
        ...note,
        checklistItems: [...note.checklistItems, item]
      };
    });
  }

  function toggleChecklistItem(noteId: string, itemId: string, embedded: boolean): void {
    updateNote(noteId, (note) => {
      if (embedded) {
        return {
          ...note,
          embeddedChecklist: note.embeddedChecklist.map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item
          )
        };
      }

      return {
        ...note,
        checklistItems: note.checklistItems.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item))
      };
    });
  }

  async function copyShareLink(): Promise<void> {
    if (!shareState) {
      return;
    }

    const link = `${window.location.origin}/shared/${shareState.noteId}?access=${shareState.accessLevel}`;
    await navigator.clipboard.writeText(link);
  }

  return (
    <div className="page">
      <div className="ambient-glow ambient-glow-left" />
      <div className="ambient-glow ambient-glow-right" />

      <div className="dashboard-shell">
        <aside className="sidebar card">
          <div>
            <h2>Nimbus</h2>
            <p>Notes Dashboard</p>
          </div>

          <nav className="sidebar-nav">
            {[
              ["overview", "Overview"],
              ["folders", "Folders"],
              ["checklists", "Checklists"],
              ["notes", "Notes"],
              ["shared", "Shared"]
            ].map(([key, label]) => (
              <button
                key={key}
                className={`sidebar-link ${activeSection === key ? "sidebar-link-active" : ""}`}
                onClick={() => setActiveSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-summary card">
            <strong>{notes.length}</strong>
            <span>Total Notes</span>
            <strong>{folders.length}</strong>
            <span>Total Folders</span>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar card">
            <div>
              <h1>Nimbus Workspace</h1>
              <p>Dashboard view for your folders, notes, files, and collaboration.</p>
            </div>

            <div className="auth-actions">
              {!signedIn && !guestMode && (
                <>
                  {googleClientId ? (
                    <div ref={googleButtonRef} className="google-signin-slot" />
                  ) : (
                    <span className="warning-pill">Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</span>
                  )}

                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setAuthPanelOpen((value) => !value);
                      setAuthMessage("");
                    }}
                  >
                    {authPanelOpen ? "Hide Email Sign-In" : "Sign In with Email"}
                  </button>

                  <button
                    className="btn btn-muted"
                    onClick={() => {
                      setGuestMode(true);
                      setSignedIn(false);
                      setAuthMessage("You are in guest mode.");
                    }}
                  >
                    Continue as Guest
                  </button>
                </>
              )}

              {signedIn && (
                <>
                  <span className="status-pill">Cloud Sync Enabled</span>
                  <button
                    className="btn btn-muted"
                    onClick={() => {
                      setSignedIn(false);
                      setGuestMode(false);
                      setAuthMessage("Signed out.");
                    }}
                  >
                    Sign out
                  </button>
                </>
              )}

              {guestMode && <span className="warning-pill">You will not receive cloud benefits.</span>}
            </div>
          </header>

          {authPanelOpen && !signedIn && !guestMode && (
            <section className="card auth-panel">
              <div className="auth-panel-head">
                <h3>{authMode === "login" ? "Email Login" : "Create Account"}</h3>
                <button
                  className="btn btn-ghost"
                  onClick={() => setAuthMode((mode) => (mode === "login" ? "register" : "login"))}
                >
                  {authMode === "login" ? "Need an account? Register" : "Already registered? Login"}
                </button>
              </div>

              <div className="auth-form-grid">
                {authMode === "register" && (
                  <input
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                    placeholder="Display name"
                  />
                )}
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  placeholder="Email"
                />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  placeholder="Password"
                />
                <button className="btn btn-solid" onClick={() => void handleEmailAuth()} disabled={authPending}>
                  {authPending ? "Please wait..." : authMode === "login" ? "Login" : "Register"}
                </button>
              </div>
            </section>
          )}

          <div className="search-row card">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="search-input"
              placeholder="Search by title first, then content..."
              aria-label="Search notes"
            />
            <span className="endpoint-tag">API: {API_BASE_URL}</span>
          </div>

          {(authPending || authMessage) && (
            <div className="card auth-feedback">{authPending ? "Signing in with Google..." : authMessage}</div>
          )}

          <section className="section-block">
            <div className="section-title-row">
              <h2>Folders</h2>
              <span>{folders.length} total</span>
            </div>

            <div className="folder-grid">
              {folders.map((folder) => {
                const notesInFolder = notes.filter((note) => note.folderId === folder.id).length;
                const inputId = `folder-file-${folder.id}`;

                return (
                  <article key={folder.id} className="folder-card" style={{ borderColor: folder.color }}>
                    <div className="folder-tab" style={{ backgroundColor: folder.color }} />
                    <h3>{folder.name}</h3>
                    <p>{notesInFolder} notes, {folder.files.length} files</p>

                    <input
                      id={inputId}
                      type="file"
                      className="hidden-file-input"
                      accept=".ppt,.pptx,.doc,.docx,.pdf,.txt"
                      multiple
                      onChange={(event) => handleFolderFileInput(folder.id, event)}
                    />

                    <div
                      className="folder-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleFolderDrop(folder.id, event)}
                    >
                      Drop ppt/doc/pdf/txt files here
                    </div>

                    <label htmlFor={inputId} className="btn btn-muted folder-upload-btn">
                      Add file
                    </label>

                    <ul className="folder-file-list">
                      {folder.files.map((file) => (
                        <li key={file.id}>
                          <span>{file.name}</span>
                          <span>{formatFileSize(file.sizeBytes)}</span>
                          <button
                            className="btn btn-ghost folder-file-remove"
                            onClick={() => removeFolderFile(folder.id, file.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                      {folder.files.length === 0 && <li className="muted">No files added yet.</li>}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="section-block">
            <div className="section-title-row">
              <h2>Checklist Board</h2>
              <span>Editable directly from home</span>
            </div>

            <div className="checklist-grid">
              {checklistNotes.map((checklist) => (
                <article key={checklist.id} className="checklist-card card">
                  <div className="card-head">
                    <h3>{checklist.title || "Untitled Checklist"}</h3>
                    <button className="btn btn-ghost" onClick={() => setShareState({ noteId: checklist.id, accessLevel: "view" })}>
                      Share
                    </button>
                  </div>

                  <ul>
                    {checklist.checklistItems.map((item) => (
                      <li key={item.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => toggleChecklistItem(checklist.id, item.id, false)}
                          />
                          <span className={item.done ? "item-done" : ""}>{item.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <button className="btn btn-muted" onClick={() => addChecklistItem(checklist.id, false)}>
                    Add Item
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="section-block">
            <div className="section-title-row">
              <h2>Notes</h2>
              <span>{regularNotes.length} visible</span>
            </div>

            <div className="note-grid">
              {regularNotes.map((note) => {
                const linkedTitles = extractNoteLinks(note.content);

                return (
                  <article key={note.id} className="note-card card" onClick={() => setEditingNoteId(note.id)}>
                    <button
                      className="share-float"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShareState({ noteId: note.id, accessLevel: "view" });
                      }}
                    >
                      Share
                    </button>

                    <h3>{note.title || "Untitled Note"}</h3>
                    <p>{note.content || "No content yet."}</p>

                    {linkedTitles.length > 0 && (
                      <div className="link-chip-row">
                        {linkedTitles.map((title) => (
                          <span className="link-chip" key={`${note.id}-${title}`}>
                            @{title}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="note-footer">
                      <span>{note.folderId ? folderMap.get(note.folderId)?.name ?? "Folder" : "Unsorted"}</span>
                      <span>{new Date(note.updatedAt).toLocaleString()}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      <button className="fab" onClick={() => setQuickCreateOpen((value) => !value)} aria-label="Create new item">
        +
      </button>

      {quickCreateOpen && (
        <div className="quick-create card">
          <button className="btn btn-solid" onClick={() => createNewNote("note")}>New Note</button>
          <button className="btn btn-solid" onClick={() => createNewNote("checklist")}>New Checklist</button>
          <button className="btn btn-muted" onClick={createFolder}>New Folder</button>
        </div>
      )}

      {editingNote && (
        <div className="overlay" onClick={() => setEditingNoteId(null)}>
          <section className="modal card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top">
              <input
                value={editingNote.title}
                onChange={(event) => updateNote(editingNote.id, (note) => ({ ...note, title: event.target.value }))}
                placeholder="Title"
              />

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setShareState({ noteId: editingNote.id, accessLevel: "view" })}>
                  Share
                </button>
                <button className="btn btn-muted" onClick={() => setEditingNoteId(null)}>
                  Close
                </button>
              </div>
            </div>

            <textarea
              value={editingNote.content}
              onChange={(event) => updateNote(editingNote.id, (note) => ({ ...note, content: event.target.value }))}
              placeholder="Write your note. Link other notes with [[Note Title]]."
              rows={8}
            />

            <div className="modal-row">
              <label>
                Folder
                <select
                  value={editingNote.folderId ?? ""}
                  onChange={(event) =>
                    updateNote(editingNote.id, (note) => ({
                      ...note,
                      folderId: event.target.value || null
                    }))
                  }
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="diagram-voice-row">
                <button className="btn btn-muted" onClick={() => window.alert("Voice-to-text hook placeholder in scaffold")}>Voice to Text</button>
                <button className="btn btn-muted" onClick={() => window.alert("Simple diagram tool hook placeholder in scaffold")}>Add Diagram</button>
              </div>
            </div>

            <div className="attachment-panel">
              <h4>Attachments</h4>
              <div className="attachment-grid">
                {editingNote.attachments.map((attachment) => (
                  <div className="attachment-card" key={attachment.id}>
                    <strong>{attachment.name}</strong>
                    <span>{attachment.mimeType}</span>
                    <span>{attachment.sizeLabel}</span>
                  </div>
                ))}
                {editingNote.attachments.length === 0 && <span className="muted">No attachments yet.</span>}
              </div>
            </div>

            <div className="embedded-checklist-panel">
              <h4>Embedded Checklist</h4>
              <ul>
                {editingNote.embeddedChecklist.map((item) => (
                  <li key={item.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => toggleChecklistItem(editingNote.id, item.id, true)}
                      />
                      <span className={item.done ? "item-done" : ""}>{item.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button className="btn btn-muted" onClick={() => addChecklistItem(editingNote.id, true)}>
                Add Embedded Item
              </button>
            </div>
          </section>
        </div>
      )}

      {shareState && (
        <div className="overlay" onClick={() => setShareState(null)}>
          <section className="share-dialog card" onClick={(event) => event.stopPropagation()}>
            <h3>Share Note</h3>
            <p>Create a copy link and choose access level.</p>

            <label>
              Access
              <select
                value={shareState.accessLevel}
                onChange={(event) =>
                  setShareState((prev) =>
                    prev
                      ? {
                          ...prev,
                          accessLevel: event.target.value as AccessLevel
                        }
                      : null
                  )
                }
              >
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
            </label>

            <div className="share-actions">
              <button className="btn btn-solid" onClick={() => void copyShareLink()}>
                Copy Link
              </button>
              <button className="btn btn-muted" onClick={() => setShareState(null)}>
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

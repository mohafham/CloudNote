BEGIN;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_folders_owner_id ON folders(owner_id);

CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_title_trgm ON notes USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_notes_search_vector ON notes USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_checklists_host_note_id ON checklists(host_note_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_note_blocks_note_id ON note_blocks(note_id);

CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader_id ON attachments(uploader_id);

CREATE INDEX IF NOT EXISTS idx_note_collaborators_user_id ON note_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_note_collaborators_note_id ON note_collaborators(note_id);

CREATE INDEX IF NOT EXISTS idx_note_share_links_note_id ON note_share_links(note_id);
CREATE INDEX IF NOT EXISTS idx_note_share_links_token ON note_share_links(token);

CREATE INDEX IF NOT EXISTS idx_note_links_source_note ON note_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_links_target_note ON note_links(target_note_id);

CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_note_id ON collaboration_sessions(note_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_last_seen ON collaboration_sessions(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

COMMIT;

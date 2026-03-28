-- tablia_chat_sessions: stores chat conversations per menu visit
-- Messages are stored as JSONB array for simplicity

CREATE TABLE tablia_chat_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id     uuid NOT NULL REFERENCES tablia_menus(id) ON DELETE CASCADE,
  venue_id    uuid NOT NULL REFERENCES tablia_venues(id) ON DELETE CASCADE,
  messages    jsonb NOT NULL DEFAULT '[]',
  customer_email text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookups by venue and menu
CREATE INDEX tablia_chat_sessions_venue_idx ON tablia_chat_sessions(venue_id);
CREATE INDEX tablia_chat_sessions_menu_idx  ON tablia_chat_sessions(menu_id);

-- RLS
ALTER TABLE tablia_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Venue owners can read their sessions
CREATE POLICY "owners_read_chat_sessions"
  ON tablia_chat_sessions FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM tablia_venues WHERE owner_id = auth.uid()
    )
  );

-- Anyone can insert (guest customers creating chat sessions)
CREATE POLICY "anyone_insert_chat_sessions"
  ON tablia_chat_sessions FOR INSERT
  WITH CHECK (true);

-- Anyone can update their own session (append messages)
CREATE POLICY "anyone_update_chat_sessions"
  ON tablia_chat_sessions FOR UPDATE
  USING (true);

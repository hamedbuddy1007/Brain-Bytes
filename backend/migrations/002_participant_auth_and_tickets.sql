-- Safe incremental migration for participant authentication & persistent identifiers
ALTER TABLE participants ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS ticket_id TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS assigned_seat TEXT;

CREATE INDEX IF NOT EXISTS idx_participants_roll ON participants(roll_number);
CREATE INDEX IF NOT EXISTS idx_participants_ticket ON participants(ticket_id);

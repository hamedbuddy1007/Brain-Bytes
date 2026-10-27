-- Migration 006: Add department, year_of_study, access_code, approval_status to participants
-- and broadcast_message, broadcast_timestamp to competition_state

ALTER TABLE participants ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS year_of_study TEXT;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS idx_participants_access_code ON participants(access_code);
CREATE INDEX IF NOT EXISTS idx_participants_approval_status ON participants(approval_status);

ALTER TABLE competition_state ADD COLUMN IF NOT EXISTS broadcast_message TEXT;
ALTER TABLE competition_state ADD COLUMN IF NOT EXISTS broadcast_timestamp TIMESTAMPTZ;

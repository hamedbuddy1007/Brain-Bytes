-- Add paused_at column to competition_state for exact pause-duration time compensation
ALTER TABLE competition_state ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

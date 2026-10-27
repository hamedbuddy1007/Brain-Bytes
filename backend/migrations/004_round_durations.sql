-- Add round_durations JSONB column to competition_state
ALTER TABLE competition_state ADD COLUMN IF NOT EXISTS round_durations JSONB NOT NULL DEFAULT '{"1":600,"2":600,"3":180}'::jsonb;

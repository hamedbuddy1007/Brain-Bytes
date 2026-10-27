-- Add explanation and chart_data columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS chart_data JSONB;

-- Alter attempts.time_taken_seconds to NUMERIC(10,3) for millisecond timer precision
ALTER TABLE attempts ALTER COLUMN time_taken_seconds TYPE NUMERIC(10,3);

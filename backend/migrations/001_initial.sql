CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS participants (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  college_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS competition_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED','LIVE','PAUSED','COMPLETED')),
  active_round SMALLINT CHECK (active_round BETWEEN 1 AND 3),
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  round_states JSONB NOT NULL DEFAULT '{"1":"active","2":"locked","3":"locked"}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO competition_state(singleton) VALUES(TRUE) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  round_id SMALLINT NOT NULL CHECK (round_id BETWEEN 1 AND 3),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array'),
  correct_answer INTEGER NOT NULL CHECK (correct_answer >= 0),
  points_correct INTEGER NOT NULL,
  points_wrong INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(round_id, sort_order)
);
CREATE TABLE IF NOT EXISTS attempts (
  id BIGSERIAL PRIMARY KEY,
  participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  round_id SMALLINT NOT NULL CHECK (round_id BETWEEN 1 AND 3),
  started_at TIMESTAMPTZ NOT NULL,
  deadline_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  score INTEGER,
  correct_count INTEGER,
  incorrect_count INTEGER,
  unanswered_count INTEGER,
  time_taken_seconds INTEGER,
  UNIQUE(participant_id, round_id)
);
CREATE TABLE IF NOT EXISTS answers (
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id),
  selected_option INTEGER,
  PRIMARY KEY(attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin','participant','system')),
  actor_id BIGINT,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_round ON questions(round_id, enabled, sort_order);
CREATE INDEX IF NOT EXISTS idx_attempts_round_submitted ON attempts(round_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);

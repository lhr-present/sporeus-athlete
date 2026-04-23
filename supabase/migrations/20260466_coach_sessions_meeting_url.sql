-- Add optional video meeting URL to coach sessions
ALTER TABLE coach_sessions ADD COLUMN IF NOT EXISTS meeting_url TEXT;

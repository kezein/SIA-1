-- ==============================================================================
-- Meet Focus Tracker - Supabase Database Schema & Security Rules (Role 3)
-- Author: Aaron Celindro (Backend + Integration)
-- Compliant with: docs/EVENT_FORMAT.md
-- ==============================================================================

-- 1. Create table for storing focus events
CREATE TABLE IF NOT EXISTS public.focus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant TEXT NOT NULL,
    "meetingCode" TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('left', 'returned')),
    timestamp BIGINT NOT NULL,
    duration BIGINT, -- Total time away in milliseconds (only on 'returned' events)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Documentation comments inside PostgreSQL
COMMENT ON TABLE public.focus_events IS 'Stores tab switches and time away events from the Meet Focus Tracker extension';
COMMENT ON COLUMN public.focus_events.participant IS 'Name of the participant entered in the extension popup';
COMMENT ON COLUMN public.focus_events."meetingCode" IS 'Google Meet meeting code (e.g., abc-defg-hij)';
COMMENT ON COLUMN public.focus_events.type IS 'Event type: left or returned';
COMMENT ON COLUMN public.focus_events.timestamp IS 'Unix epoch timestamp in milliseconds when the event occurred';
COMMENT ON COLUMN public.focus_events.duration IS 'Duration away in milliseconds (populated only for returned events)';

-- 2. Performance Indexes
-- Essential for dashboard queries filtering by meeting code and aggregating by participant
CREATE INDEX IF NOT EXISTS idx_focus_events_meeting_code 
    ON public.focus_events ("meetingCode");

CREATE INDEX IF NOT EXISTS idx_focus_events_meeting_participant 
    ON public.focus_events ("meetingCode", participant);

CREATE INDEX IF NOT EXISTS idx_focus_events_timestamp 
    ON public.focus_events (timestamp DESC);

-- 3. Row Level Security (RLS)
ALTER TABLE public.focus_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running script
DROP POLICY IF EXISTS "Allow participants to insert focus events" ON public.focus_events;
DROP POLICY IF EXISTS "Allow authenticated teachers to read events" ON public.focus_events;
DROP POLICY IF EXISTS "Allow authenticated teachers to delete events" ON public.focus_events;
DROP POLICY IF EXISTS "Dev only: allow anon read" ON public.focus_events;

-- Security Rule 1 (INSERT): Allow participants to add events via anon key.
-- Validates that payload adheres to EVENT_FORMAT.md (non-empty fields, valid event type).
CREATE POLICY "Allow participants to insert focus events"
ON public.focus_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
    participant IS NOT NULL AND trim(participant) <> ''
    AND "meetingCode" IS NOT NULL AND trim("meetingCode") <> ''
    AND type IN ('left', 'returned')
    AND timestamp > 0
);

-- Security Rule 2 (SELECT): Only authenticated users (Teachers) can view events.
-- Students with the anon key cannot inspect or list other participants' tracking data.
CREATE POLICY "Allow authenticated teachers to read events"
ON public.focus_events
FOR SELECT
TO authenticated
USING (true);

-- Security Rule 3 (DELETE): Authenticated teachers can delete/clear past meetings.
CREATE POLICY "Allow authenticated teachers to delete events"
ON public.focus_events
FOR DELETE
TO authenticated
USING (true);

-- (Note: No UPDATE policy is created. Audit events are strictly append-only and immutable.)

-- 4. Convenient Aggregation View for Dashboard (Role 4 - Francis Conguis)
-- Calculates switch count and total time away per participant per meeting.
CREATE OR REPLACE VIEW public.meeting_summary
WITH (security_invoker = true)
AS
SELECT
    "meetingCode",
    participant,
    COUNT(*) FILTER (WHERE type = 'left') AS switch_count,
    COALESCE(SUM(duration) FILTER (WHERE type = 'returned'), 0) AS total_duration_ms,
    ROUND(COALESCE(SUM(duration) FILTER (WHERE type = 'returned'), 0) / 1000.0, 1) AS total_duration_seconds,
    MIN(timestamp) AS first_event_at,
    MAX(timestamp) AS last_event_at,
    COUNT(*) AS total_events
FROM public.focus_events
GROUP BY "meetingCode", participant;

-- 5. Enable Supabase Realtime
-- Enables live updates on the dashboard as events are reported
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'focus_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_events;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- [OPTIONAL DEV POLICY]
-- If the dashboard team is prototyping locally before setting up Supabase Auth,
-- you can temporarily uncomment the policy below to allow anon SELECT:
--
-- CREATE POLICY "Dev only: allow anon read"
-- ON public.focus_events
-- FOR SELECT
-- TO anon
-- USING (true);
-- -----------------------------------------------------------------------------

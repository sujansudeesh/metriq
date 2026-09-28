-- Migration 07: Create Append-Only Audit Logging Infrastructure for METRIQ
-- Description: Establishes public.audit_events table, indexes, and RLS policies for legal metrology compliance.

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE SET NULL,
    instrument_id UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexing for rapid audit query and filtering
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_session_id ON public.audit_events (session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Append-Only Security Policy:
-- Authorized authenticated users can read all audit events
CREATE POLICY "Authorized users can view audit events"
    ON public.audit_events
    FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can insert audit events
CREATE POLICY "Authenticated users can insert audit events"
    ON public.audit_events
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Strict Immutability Enforcement: UPDATE and DELETE are blocked by RLS policies
CREATE POLICY "Audit events are immutable - No UPDATE"
    ON public.audit_events
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Audit events are immutable - No DELETE"
    ON public.audit_events
    FOR DELETE
    TO authenticated
    USING (false);

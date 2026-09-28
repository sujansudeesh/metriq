-- Migration 08: Create Notifications Infrastructure for METRIQ
-- Description: Establishes public.notifications table, indexes, and recipient RLS policies for role-targeted notifications.

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_role TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    report_id TEXT,
    instrument_id UUID REFERENCES public.instruments(id) ON DELETE CASCADE,
    target_path TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Indexing for fast recipient retrieval
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user ON public.notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON public.notifications (recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: A user can only see notifications addressed directly to them or matching their profile role
CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    TO authenticated
    USING (
        recipient_user_id = auth.uid() OR
        recipient_role IN (
            SELECT role FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Authenticated users can insert notifications (event-driven workflow triggers)
CREATE POLICY "Authenticated users can create notifications"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Users can update read state on their own notifications
CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (
        recipient_user_id = auth.uid() OR
        recipient_role IN (
            SELECT role FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        recipient_user_id = auth.uid() OR
        recipient_role IN (
            SELECT role FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Strict Policy: Deletion of system notifications is prohibited
CREATE POLICY "Notifications cannot be deleted"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING (false);

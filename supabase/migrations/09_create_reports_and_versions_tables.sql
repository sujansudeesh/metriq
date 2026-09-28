-- Migration 09: Create Persistent Reports and Version History Tables for METRIQ
-- Description: Establishes public.reports and public.report_versions tables with snapshot_data JSONB and RLS rules.

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number TEXT UNIQUE NOT NULL,
    session_id UUID REFERENCES public.test_sessions(id) ON DELETE RESTRICT NOT NULL,
    version_number INTEGER DEFAULT 1 NOT NULL,
    status TEXT DEFAULT 'DRAFT' NOT NULL,
    evaluation_result TEXT DEFAULT 'UNDER_EVALUATION' NOT NULL,
    workflow_status_at_issue TEXT NOT NULL,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    technical_reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approving_officer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    rule_standard TEXT DEFAULT 'OIML R 76-1:2006' NOT NULL,
    rule_version TEXT DEFAULT '2006' NOT NULL,
    snapshot_data JSONB NOT NULL,
    pdf_storage_path TEXT,
    docx_storage_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.report_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    revision_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    pdf_storage_path TEXT,
    docx_storage_path TEXT,
    UNIQUE(report_id, version_number)
);

-- Indexes for rapid lookup
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON public.reports (session_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_number ON public.reports (report_number);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.reports
CREATE POLICY "Authorized users can view reports"
    ON public.reports
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create reports"
    ON public.reports
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Strict Immutability Policy: Finalized report records cannot be altered
CREATE POLICY "Finalized reports cannot be altered"
    ON public.reports
    FOR UPDATE
    TO authenticated
    USING (status != 'FINALIZED')
    WITH CHECK (status != 'FINALIZED');

-- Prevent deletion of finalized reports
CREATE POLICY "Finalized reports cannot be deleted"
    ON public.reports
    FOR DELETE
    TO authenticated
    USING (status != 'FINALIZED');

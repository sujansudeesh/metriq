-- ============================================================================
-- MIGRATION: 06_create_rbac_rls_policies.sql
-- PROJECT: NAWI Verify (SIH26035) — OIML R 76-1 Legal Metrology Platform
-- DESCRIPTION: Final RBAC & RLS Policies with Strict Sequential Workflow Guards & Column Protection
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SAFE ROLE HELPER FUNCTION
-- ----------------------------------------------------------------------------
-- Derives the current authenticated user's assigned role from public.profiles.
-- Uses SECURITY DEFINER to prevent recursive RLS policy evaluations.
-- Uses SET search_path = '' for search path safety.
-- Returns NULL for unauthenticated / anonymous users.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN user_role;
END;
$$;

-- Revoke public & anon execution on role helper function
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. WORKFLOW GUARD & COLUMN PROTECTION TRIGGER FOR TEST_SESSIONS
-- ----------------------------------------------------------------------------
-- Enforces strict sequential workflow transitions:
-- DRAFT -> IN_PROGRESS -> TESTING_COMPLETE -> UNDER_REVIEW -> TECHNICALLY_APPROVED -> APPROVED -> FINALIZED
-- Rejection loop: UNDER_REVIEW / TECHNICALLY_APPROVED -> CHANGES_REQUESTED -> IN_PROGRESS
-- Enforces column protection & self-assignment safety per role.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_test_session_workflow_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  caller_role := public.current_user_role();

  -- ADMIN retains administrative override
  IF caller_role = 'ADMIN' THEN
    RETURN NEW;
  END IF;

  -- AUDITOR is strictly read-only
  IF caller_role = 'AUDITOR' THEN
    RAISE EXCEPTION 'Auditors are strictly read-only and cannot modify test sessions.';
  END IF;

  -- 1. IMMUTABLE SYSTEM SPECIFICATION FIELDS (Prohibited for all non-admin users)
  IF NEW.id IS DISTINCT FROM OLD.id OR
     NEW.session_code IS DISTINCT FROM OLD.session_code OR
     NEW.instrument_id IS DISTINCT FROM OLD.instrument_id OR
     NEW.test_context IS DISTINCT FROM OLD.test_context OR
     NEW.verification_mode IS DISTINCT FROM OLD.verification_mode OR
     NEW.rule_standard IS DISTINCT FROM OLD.rule_standard OR
     NEW.rule_version IS DISTINCT FROM OLD.rule_version OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Non-admin users cannot alter immutable session identity or metrology specifications.';
  END IF;

  -- 2. ROLE-SPECIFIC COLUMN GUARDS & WORKFLOW TRANSITIONS

  -- --------------------------------------------------------------------------
  -- TESTING OFFICER
  -- --------------------------------------------------------------------------
  IF caller_role = 'TESTING_OFFICER' THEN
    -- Must be the assigned testing officer
    IF OLD.testing_officer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Testing officers can only update test sessions assigned to themselves.';
    END IF;

    -- Prohibit modifying officer assignments & review/approval timestamps
    IF NEW.testing_officer_id IS DISTINCT FROM OLD.testing_officer_id OR
       NEW.technical_reviewer_id IS DISTINCT FROM OLD.technical_reviewer_id OR
       NEW.approving_officer_id IS DISTINCT FROM OLD.approving_officer_id OR
       NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
       NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
       NEW.finalized_at IS DISTINCT FROM OLD.finalized_at THEN
      RAISE EXCEPTION 'Testing officers cannot modify officer assignments or reviewer/approver timestamps.';
    END IF;

    -- Strict Sequential Workflow Transitions for Testing Officer
    IF OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN
      IF NOT (
        (OLD.workflow_status = 'DRAFT' AND NEW.workflow_status = 'IN_PROGRESS') OR
        (OLD.workflow_status = 'IN_PROGRESS' AND NEW.workflow_status = 'TESTING_COMPLETE') OR
        (OLD.workflow_status = 'CHANGES_REQUESTED' AND NEW.workflow_status = 'IN_PROGRESS')
      ) THEN
        RAISE EXCEPTION 'Invalid workflow status transition % -> % for Testing Officer. Direct submission to UNDER_REVIEW or skipped states are prohibited.', OLD.workflow_status, NEW.workflow_status;
      END IF;
    ELSE
      -- Data Edit Check: Testing Officers can only edit session data during testing states
      IF OLD.workflow_status NOT IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED') THEN
        RAISE EXCEPTION 'Testing officers cannot modify session data while workflow status is %.', OLD.workflow_status;
      END IF;
    END IF;

  -- --------------------------------------------------------------------------
  -- TECHNICAL REVIEWER
  -- --------------------------------------------------------------------------
  ELSIF caller_role = 'TECHNICAL_REVIEWER' THEN
    -- Prohibit modifying testing_officer_id, approving_officer_id, or testing/approval timestamps
    IF NEW.testing_officer_id IS DISTINCT FROM OLD.testing_officer_id OR
       NEW.approving_officer_id IS DISTINCT FROM OLD.approving_officer_id OR
       NEW.started_at IS DISTINCT FROM OLD.started_at OR
       NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
       NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
       NEW.finalized_at IS DISTINCT FROM OLD.finalized_at THEN
      RAISE EXCEPTION 'Technical reviewers cannot alter testing officer, approving officer, or non-review timestamps.';
    END IF;

    -- Self-Assignment Check: May only claim review to own User ID
    IF OLD.technical_reviewer_id IS NULL THEN
      IF NEW.technical_reviewer_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Technical reviewers can only self-assign review claims to their own User ID.';
      END IF;
    ELSIF NEW.technical_reviewer_id IS DISTINCT FROM OLD.technical_reviewer_id THEN
      RAISE EXCEPTION 'Technical reviewers cannot reassign an already designated technical reviewer.';
    END IF;

    -- Strict Sequential Workflow Transitions for Technical Reviewer
    IF OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN
      IF NOT (
        (OLD.workflow_status = 'TESTING_COMPLETE' AND NEW.workflow_status = 'UNDER_REVIEW') OR
        (OLD.workflow_status = 'UNDER_REVIEW' AND NEW.workflow_status IN ('TECHNICALLY_APPROVED', 'CHANGES_REQUESTED'))
      ) THEN
        RAISE EXCEPTION 'Invalid workflow status transition % -> % for Technical Reviewer.', OLD.workflow_status, NEW.workflow_status;
      END IF;
    END IF;

  -- --------------------------------------------------------------------------
  -- LAB DIRECTOR
  -- --------------------------------------------------------------------------
  ELSIF caller_role = 'LAB_DIRECTOR' THEN
    -- Prohibit modifying testing_officer_id, technical_reviewer_id, or testing/review timestamps
    IF NEW.testing_officer_id IS DISTINCT FROM OLD.testing_officer_id OR
       NEW.technical_reviewer_id IS DISTINCT FROM OLD.technical_reviewer_id OR
       NEW.started_at IS DISTINCT FROM OLD.started_at OR
       NEW.submitted_at IS DISTINCT FROM OLD.submitted_at OR
       NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
      RAISE EXCEPTION 'Lab directors cannot alter testing officer, technical reviewer, or testing/review timestamps.';
    END IF;

    -- Self-Assignment Check: May only claim approval to own User ID
    IF OLD.approving_officer_id IS NULL THEN
      IF NEW.approving_officer_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Lab directors can only self-assign approval actions to their own User ID.';
      END IF;
    ELSIF NEW.approving_officer_id IS DISTINCT FROM OLD.approving_officer_id THEN
      RAISE EXCEPTION 'Lab directors cannot reassign an already designated approving officer.';
    END IF;

    -- Strict Sequential Workflow Transitions for Lab Director
    IF OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN
      IF NOT (
        (OLD.workflow_status = 'TECHNICALLY_APPROVED' AND NEW.workflow_status IN ('APPROVED', 'CHANGES_REQUESTED')) OR
        (OLD.workflow_status = 'APPROVED' AND NEW.workflow_status = 'FINALIZED')
      ) THEN
        RAISE EXCEPTION 'Invalid workflow status transition % -> % for Lab Director. Direct jump from TECHNICALLY_APPROVED to FINALIZED is prohibited.', OLD.workflow_status, NEW.workflow_status;
      END IF;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unauthorized role % for test session update.', caller_role;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_test_session_workflow_update() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_test_session_workflow_update() TO authenticated;

-- Attach BEFORE UPDATE trigger to public.test_sessions
DROP TRIGGER IF EXISTS trg_enforce_test_session_workflow ON public.test_sessions;
CREATE TRIGGER trg_enforce_test_session_workflow
  BEFORE UPDATE ON public.test_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_test_session_workflow_update();


-- ----------------------------------------------------------------------------
-- 3. ENSURE RLS IS ENABLED ON ALL TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 4. PUBLIC.INSTRUMENTS POLICIES
-- ----------------------------------------------------------------------------
-- ADMIN: SELECT, INSERT, UPDATE, DELETE
-- TESTING_OFFICER: SELECT, INSERT, UPDATE (no DELETE)
-- TECHNICAL_REVIEWER, LAB_DIRECTOR, AUDITOR: SELECT only
-- ANON: 0 access
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "instruments_select_authenticated" ON public.instruments;
CREATE POLICY "instruments_select_authenticated"
  ON public.instruments
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN (
      'ADMIN',
      'TESTING_OFFICER',
      'TECHNICAL_REVIEWER',
      'LAB_DIRECTOR',
      'AUDITOR'
    )
  );

DROP POLICY IF EXISTS "instruments_insert_officer_admin" ON public.instruments;
CREATE POLICY "instruments_insert_officer_admin"
  ON public.instruments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() IN ('ADMIN', 'TESTING_OFFICER')
  );

DROP POLICY IF EXISTS "instruments_update_officer_admin" ON public.instruments;
CREATE POLICY "instruments_update_officer_admin"
  ON public.instruments
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() IN ('ADMIN', 'TESTING_OFFICER')
  )
  WITH CHECK (
    public.current_user_role() IN ('ADMIN', 'TESTING_OFFICER')
  );

DROP POLICY IF EXISTS "instruments_delete_admin" ON public.instruments;
CREATE POLICY "instruments_delete_admin"
  ON public.instruments
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
  );


-- ----------------------------------------------------------------------------
-- 5. PUBLIC.TEST_SESSIONS POLICIES
-- ----------------------------------------------------------------------------
-- SELECT: All authenticated application roles
-- INSERT: ADMIN, or TESTING_OFFICER (must self-assign testing_officer_id = auth.uid())
-- UPDATE: Validated by enforce_test_session_workflow_update trigger
-- DELETE: ADMIN only for unfinished DRAFT/IN_PROGRESS sessions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "test_sessions_select_authenticated" ON public.test_sessions;
CREATE POLICY "test_sessions_select_authenticated"
  ON public.test_sessions
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() IN (
      'ADMIN',
      'TESTING_OFFICER',
      'TECHNICAL_REVIEWER',
      'LAB_DIRECTOR',
      'AUDITOR'
    )
  );

DROP POLICY IF EXISTS "test_sessions_insert_officer_admin" ON public.test_sessions;
CREATE POLICY "test_sessions_insert_officer_admin"
  ON public.test_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      testing_officer_id = auth.uid() AND
      workflow_status IN ('DRAFT', 'IN_PROGRESS')
    )
  );

DROP POLICY IF EXISTS "test_sessions_update_assigned_or_admin" ON public.test_sessions;
CREATE POLICY "test_sessions_update_assigned_or_admin"
  ON public.test_sessions
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      testing_officer_id = auth.uid() AND
      workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
    ) OR
    (
      public.current_user_role() = 'TECHNICAL_REVIEWER' AND
      (technical_reviewer_id IS NULL OR technical_reviewer_id = auth.uid()) AND
      workflow_status IN ('TESTING_COMPLETE', 'UNDER_REVIEW')
    ) OR
    (
      public.current_user_role() = 'LAB_DIRECTOR' AND
      (approving_officer_id IS NULL OR approving_officer_id = auth.uid()) AND
      workflow_status IN ('TECHNICALLY_APPROVED', 'APPROVED')
    )
  )
  WITH CHECK (
    public.current_user_role() IN ('ADMIN', 'TESTING_OFFICER', 'TECHNICAL_REVIEWER', 'LAB_DIRECTOR')
  );

DROP POLICY IF EXISTS "test_sessions_delete_admin" ON public.test_sessions;
CREATE POLICY "test_sessions_delete_admin"
  ON public.test_sessions
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' AND
    workflow_status IN ('DRAFT', 'IN_PROGRESS')
  );


-- ----------------------------------------------------------------------------
-- 6. PUBLIC.SESSION_TESTS POLICIES
-- ----------------------------------------------------------------------------
-- SELECT: All authenticated roles accessing valid parent session
-- INSERT/UPDATE: ADMIN or assigned TESTING_OFFICER during active testing states
-- DELETE: ADMIN only for unfinished sessions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "session_tests_select_authenticated" ON public.session_tests;
CREATE POLICY "session_tests_select_authenticated"
  ON public.session_tests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_sessions s
      WHERE s.id = session_tests.session_id
      AND public.current_user_role() IN (
        'ADMIN',
        'TESTING_OFFICER',
        'TECHNICAL_REVIEWER',
        'LAB_DIRECTOR',
        'AUDITOR'
      )
    )
  );

DROP POLICY IF EXISTS "session_tests_insert_assigned_officer_admin" ON public.session_tests;
CREATE POLICY "session_tests_insert_assigned_officer_admin"
  ON public.session_tests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.test_sessions s
        WHERE s.id = session_tests.session_id
        AND s.testing_officer_id = auth.uid()
        AND s.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  );

DROP POLICY IF EXISTS "session_tests_update_assigned_officer_admin" ON public.session_tests;
CREATE POLICY "session_tests_update_assigned_officer_admin"
  ON public.session_tests
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.test_sessions s
        WHERE s.id = session_tests.session_id
        AND s.testing_officer_id = auth.uid()
        AND s.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.test_sessions s
        WHERE s.id = session_tests.session_id
        AND s.testing_officer_id = auth.uid()
        AND s.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  );

DROP POLICY IF EXISTS "session_tests_delete_admin" ON public.session_tests;
CREATE POLICY "session_tests_delete_admin"
  ON public.session_tests
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' AND
    EXISTS (
      SELECT 1 FROM public.test_sessions s
      WHERE s.id = session_tests.session_id
      AND s.workflow_status IN ('DRAFT', 'IN_PROGRESS')
    )
  );


-- ----------------------------------------------------------------------------
-- 7. PUBLIC.TEST_OBSERVATIONS POLICIES
-- ----------------------------------------------------------------------------
-- SELECT: All authenticated roles
-- INSERT/UPDATE: ADMIN or assigned TESTING_OFFICER strictly during DRAFT, IN_PROGRESS, CHANGES_REQUESTED
-- DELETE: ADMIN only for unfinished sessions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "test_observations_select_authenticated" ON public.test_observations;
CREATE POLICY "test_observations_select_authenticated"
  ON public.test_observations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_tests st
      JOIN public.test_sessions ts ON ts.id = st.session_id
      WHERE st.id = test_observations.session_test_id
      AND public.current_user_role() IN (
        'ADMIN',
        'TESTING_OFFICER',
        'TECHNICAL_REVIEWER',
        'LAB_DIRECTOR',
        'AUDITOR'
      )
    )
  );

DROP POLICY IF EXISTS "test_observations_insert_assigned_officer_admin" ON public.test_observations;
CREATE POLICY "test_observations_insert_assigned_officer_admin"
  ON public.test_observations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.session_tests st
        JOIN public.test_sessions ts ON ts.id = st.session_id
        WHERE st.id = test_observations.session_test_id
        AND ts.testing_officer_id = auth.uid()
        AND ts.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  );

DROP POLICY IF EXISTS "test_observations_update_assigned_officer_admin" ON public.test_observations;
CREATE POLICY "test_observations_update_assigned_officer_admin"
  ON public.test_observations
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.session_tests st
        JOIN public.test_sessions ts ON ts.id = st.session_id
        WHERE st.id = test_observations.session_test_id
        AND ts.testing_officer_id = auth.uid()
        AND ts.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'ADMIN' OR
    (
      public.current_user_role() = 'TESTING_OFFICER' AND
      EXISTS (
        SELECT 1 FROM public.session_tests st
        JOIN public.test_sessions ts ON ts.id = st.session_id
        WHERE st.id = test_observations.session_test_id
        AND ts.testing_officer_id = auth.uid()
        AND ts.workflow_status IN ('DRAFT', 'IN_PROGRESS', 'CHANGES_REQUESTED')
      )
    )
  );

DROP POLICY IF EXISTS "test_observations_delete_admin" ON public.test_observations;
CREATE POLICY "test_observations_delete_admin"
  ON public.test_observations
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN' AND
    EXISTS (
      SELECT 1 FROM public.session_tests st
      JOIN public.test_sessions ts ON ts.id = st.session_id
      WHERE st.id = test_observations.session_test_id
      AND ts.workflow_status IN ('DRAFT', 'IN_PROGRESS')
    )
  );


-- ----------------------------------------------------------------------------
-- 8. PUBLIC.PROFILES POLICIES (SAFE READ ONLY - NO ROLE ESCALATION)
-- ----------------------------------------------------------------------------
-- Users can view own profile.
-- Supervisors and Admins may view user profiles for workflow assignment.
-- Authenticated UPDATE (role) is EXPLICITLY WITHHELD. Column privileges from
-- Migration 02 (GRANT UPDATE (full_name)) remain strictly enforced.
-- Role changes can only occur via database administrator or secure RPC.
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_view_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_view_self_or_staff"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    public.current_user_role() IN ('ADMIN', 'TECHNICAL_REVIEWER', 'LAB_DIRECTOR')
  );

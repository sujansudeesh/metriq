-- Migration 10: Admin Role Management RPC for METRIQ
-- Description: Establishes secure admin_update_user_role stored procedure enforcing authorization and valid roles.

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- 1. Derive caller role securely from public.profiles
  caller_role := public.current_user_role();
  IF caller_role IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user roles.';
  END IF;

  -- 2. Validate new role against allowed role list
  IF new_role NOT IN ('ADMIN', 'TESTING_OFFICER', 'TECHNICAL_REVIEWER', 'LAB_DIRECTOR', 'AUDITOR') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  -- 3. Update target user role in public.profiles
  UPDATE public.profiles
  SET role = new_role,
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for ID: %', target_user_id;
  END IF;
END;
$$;

-- Security Grants: Revoke public/anon execution, grant to authenticated users
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, TEXT) TO authenticated;

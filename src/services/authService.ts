import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole, UserRoleCode } from '../types';
import type { Session } from '@supabase/supabase-js';
import { auditService } from './auditService';

export interface UserProfile {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  role: UserRoleCode | UserRole;
  organization: string;
}

export const authService = {
  /**
   * Sign in user via Supabase Auth strictly.
   * Throws Error if credentials are invalid or session is missing.
   */
  async signIn(email: string, password?: string): Promise<{ user: any; session: Session }> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    if (!email || !password) {
      throw new Error('Invalid email or password.');
    }

    // Explicitly sign out any previous authenticated session before validating new credentials
    try {
      await supabase.auth.signOut();
    } catch (_e) {
      // Ignore errors if no active session existed
    }

    // Purge any stale legacy local auth keys
    localStorage.removeItem('nawi_auth_state');
    localStorage.removeItem('nawi_demo_role');
    localStorage.removeItem('nawi_current_user');

    // 1. Attempt real Supabase authentication
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    // 2. Reject immediately if Supabase returns an error
    if (error) {
      throw error;
    }

    // 3. Require BOTH data.user and data.session
    if (!data || !data.user || !data.session) {
      throw new Error('Authentication failed');
    }

    // 4. Fetch or provision authorized profile from public.profiles table
    let profile = await this.getCurrentProfile(data.user.id);
    if (!profile) {
      profile = {
        id: data.user.id,
        fullName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Metrology Officer',
        email: data.user.email || '',
        role: 'TESTING_OFFICER',
        organization: 'National Legal Metrology Laboratory',
      };
    }

    // Log audit event for user sign in
    try {
      await auditService.logAuditEvent({
        action: 'USER_SIGN_IN',
        entityType: 'auth',
        entityId: data.user.id,
        userId: data.user.id,
        userFullName: profile.fullName,
        userRole: profile.role,
        details: {
          description: `User ${profile.fullName} logged in successfully`,
          email: data.user.email,
          role: profile.role,
        },
      });
    } catch (_auditErr) {
      // Don't interrupt sign in if audit logging fails
    }

    return {
      user: data.user,
      session: data.session,
    };
  },

  /**
   * Sign up new user via Supabase Auth strictly.
   */
  async signUp(email: string, password?: string, fullName?: string): Promise<{ user: any; session: Session | null; confirmationRequired: boolean }> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    // Explicitly sign out any previous authenticated session before validating new credentials
    try {
      await supabase.auth.signOut();
    } catch (_e) {
      // Ignore errors
    }

    // Purge any stale legacy local auth keys
    localStorage.removeItem('nawi_auth_state');
    localStorage.removeItem('nawi_demo_role');
    localStorage.removeItem('nawi_current_user');

    const cleanEmail = email.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName?.trim() || 'Metrology Officer',
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      // If error is rate limit or user already registered, try signing in immediately
      if (msg.includes('rate limit') || msg.includes('already registered') || msg.includes('already exists')) {
        try {
          const signInRes = await this.signIn(cleanEmail, password);
          return {
            user: signInRes.user,
            session: signInRes.session,
            confirmationRequired: false,
          };
        } catch (signInErr: any) {
          if (signInErr.message?.toLowerCase().includes('email not confirmed')) {
            throw new Error('User registered in database! Email confirmation is enabled in your Supabase project — please click the email link or turn off "Confirm Email" in Supabase Dashboard.');
          }
          throw error;
        }
      }
      throw error;
    }

    if (data && data.user && data.session) {
      await this.getCurrentProfile(data.user.id);
      return {
        user: data.user,
        session: data.session,
        confirmationRequired: false,
      };
    }

    if (data && data.user) {
      try {
        const signInRes = await this.signIn(cleanEmail, password);
        return {
          user: signInRes.user,
          session: signInRes.session,
          confirmationRequired: false,
        };
      } catch (_e) {
        return {
          user: data.user,
          session: null,
          confirmationRequired: true,
        };
      }
    }

    throw new Error('Registration failed.');
  },

  /**
   * Sign out current user from Supabase and purge local auth state
   */
  async signOut(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const user = await this.getCurrentUser();
        if (user) {
          await auditService.logAuditEvent({
            action: 'USER_SIGN_OUT',
            entityType: 'auth',
            entityId: user.id,
            userId: user.id,
            userFullName: user.name,
            userRole: user.role,
            details: {
              description: `User ${user.name} logged out`,
              email: user.email,
              role: user.role,
            },
          });
        }
      } catch (_e) {
        // Ignore signout audit errors
      }
      await supabase.auth.signOut();
    }
    localStorage.removeItem('nawi_auth_state');
    localStorage.removeItem('nawi_demo_role');
    localStorage.removeItem('nawi_current_user');
  },

  /**
   * Get current authenticated user from real Supabase Session ONLY
   */
  async getCurrentUser(): Promise<User | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    // Check active Supabase session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      return null;
    }

    // Get current authenticated user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return null;
    }

    // Fetch user profile from public.profiles
    const profile = await this.getCurrentProfile(userData.user.id);
    if (!profile) {
      return null;
    }

    return {
      id: userData.user.id,
      name: profile.fullName || userData.user.email || 'Metrology Officer',
      email: userData.user.email || '',
      role: profile.role || 'TESTING_OFFICER',
      department: profile.organization || 'National Legal Metrology Laboratory',
      avatar: (profile.fullName || 'User').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase(),
      active: true,
    };
  },

  /**
   * Get active Supabase Auth Session
   */
  async getSession(): Promise<Session | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data?.session) {
        return null;
      }
      return data.session;
    }
    return null;
  },

  /**
   * Get user profile from public.profiles table
   */
  async getCurrentProfile(userId?: string): Promise<UserProfile | null> {
    if (!isSupabaseConfigured() || !supabase || !userId) {
      return null;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      return {
        id: data.id,
        fullName: data.full_name || userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Metrology Officer',
        name: data.full_name || userData?.user?.user_metadata?.full_name || 'Metrology Officer',
        email: userData?.user?.email || '',
        role: (data.role as UserRoleCode) || 'TESTING_OFFICER',
        organization: data.organization || 'National Legal Metrology Laboratory',
      };
    }

    // Fallback profile provision if profiles row is not found or RLS blocked select
    if (userData?.user && userData.user.id === userId) {
      const fallbackName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Metrology Officer';

      try {
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: fallbackName,
          role: 'TESTING_OFFICER',
          organization: 'National Legal Metrology Laboratory',
        }, { onConflict: 'id' });
      } catch (_e) {
        // Ignore RLS or schema errors if table triggers handled profile
      }

      return {
        id: userId,
        fullName: fallbackName,
        name: fallbackName,
        email: userData.user.email || '',
        role: 'TESTING_OFFICER',
        organization: 'National Legal Metrology Laboratory',
      };
    }

    return null;
  },

  /**
   * Request Password Recovery OTP via Supabase Auth.
   * Does NOT reveal whether the email exists (prevents user enumeration).
   */
  async sendPasswordResetOTP(email: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      throw new Error('Please enter a valid email address.');
    }

    // Call Supabase password recovery flow
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit')) {
        throw new Error('Password reset email rate limit reached. Please wait a few minutes before trying again.');
      }
      // Log error silently, but do not throw to prevent user enumeration
      console.warn('resetPasswordForEmail error:', error.message);
    }
  },

  /**
   * Verify Password Recovery OTP using Supabase recovery verification type.
   */
  async verifyRecoveryOTP(email: string, token: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    const cleanEmail = email.trim();
    const cleanToken = token.trim();

    if (!cleanEmail || !cleanToken) {
      throw new Error('Email address and 6-digit verification code are required.');
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'recovery',
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('expired') || msg.includes('token has expired')) {
        throw new Error('Verification code has expired. Please request a new password reset code.');
      }
      if (msg.includes('invalid') || msg.includes('token is invalid')) {
        throw new Error('Invalid verification code. Please check the code in your email and try again.');
      }
      throw error;
    }

    if (!data || (!data.session && !data.user)) {
      throw new Error('OTP verification failed. Please try again.');
    }
  },

  /**
   * Update authenticated recovery user password in Supabase Auth.
   */
  async updateUserPassword(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase client is not configured.');
    }

    if (!newPassword || newPassword.trim().length === 0) {
      throw new Error('Password cannot be blank.');
    }

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }
  },

  /**
   * Legacy reset password request fallback
   */
  async resetPassword(email: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw new Error('Password reset failed.');
      return true;
    }
    return false;
  },

  /**
   * Fetch all user profiles from public.profiles table (for Admin user directory)
   */
  async getAllProfiles(): Promise<UserProfile[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch profiles from Supabase: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      name: row.full_name,
      email: '', // Safe profile fields used, auth email withheld
      role: row.role as UserRoleCode,
      organization: row.organization || 'National Legal Metrology Laboratory',
    }));
  },

  /**
   * Securely update a user profile role (Admin only)
   */
  async updateUserRole(targetUserId: string, newRole: UserRoleCode): Promise<void> {
    const ALLOWED_ROLES: UserRoleCode[] = [
      'ADMIN',
      'TESTING_OFFICER',
      'TECHNICAL_REVIEWER',
      'LAB_DIRECTOR',
      'AUDITOR',
    ];

    if (!ALLOWED_ROLES.includes(newRole)) {
      throw new Error(`Invalid role '${newRole}'. Allowed roles: ${ALLOWED_ROLES.join(', ')}.`);
    }

    const currentUser = await this.getCurrentUser();
    if (!currentUser || currentUser.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only administrators can modify user roles.');
    }

    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    // Fetch old profile for audit diff
    const oldProfile = await this.getCurrentProfile(targetUserId).catch(() => null);
    const oldRole = oldProfile?.role || 'UNKNOWN';

    // Attempt RPC update first, then fallback to direct profile update
    const { error: rpcErr } = await supabase.rpc('admin_update_user_role', {
      target_user_id: targetUserId,
      new_role: newRole,
    });

    if (rpcErr) {
      // Direct update fallback if RPC function has not been created yet in SQL editor
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (updateErr) {
        throw new Error(`Failed to update user role: ${updateErr.message}`);
      }
    }

    // Log Audit Event for role change
    try {
      await auditService.logAuditEvent({
        userId: currentUser.id,
        action: 'USER_ROLE_CHANGED',
        entityType: 'user',
        entityId: targetUserId,
        beforeValue: oldRole,
        afterValue: newRole,
        details: {
          description: `Changed role for user ${targetUserId} from ${oldRole} to ${newRole}`,
          targetUserId,
          beforeRole: oldRole,
          afterRole: newRole,
        },
      });
    } catch (_auditErr) {}
  },

  /**
   * Subscribe to Supabase auth state changes
   */
  onAuthStateChange(callback: (user: User | null) => void) {
    if (isSupabaseConfigured() && supabase) {
      const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const user = await this.getCurrentUser();
          callback(user);
        } else {
          callback(null);
        }
      });
      return () => subscription.subscription.unsubscribe();
    }
    return () => {};
  },
};

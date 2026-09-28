import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { authService } from './authService';

export interface AppNotification {
  id: string;
  recipientUserId?: string;
  recipientRole?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  sessionId?: string;
  reportId?: string;
  instrumentId?: string;
  targetPath: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export const notificationService = {
  /**
   * Fetch real notifications for the current authenticated user from Supabase.
   */
  async getNotificationsForCurrentUser(): Promise<AppNotification[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return [];
    }

    try {
      const user = await authService.getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_user_id.eq.${user.id},recipient_role.eq.${user.role}`)
        .order('created_at', { ascending: false });

      if (error) {
        // Log warning cleanly without swallowing or silent fallback if table absent
        console.warn('Supabase notification fetch warning:', error.message);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        recipientUserId: row.recipient_user_id,
        recipientRole: row.recipient_role,
        type: row.type,
        title: row.title,
        message: row.message,
        entityType: row.entity_type,
        entityId: row.entity_id,
        sessionId: row.session_id,
        reportId: row.report_id,
        instrumentId: row.instrument_id,
        targetPath: row.target_path || '/',
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
        readAt: row.read_at,
      }));
    } catch (err: any) {
      console.warn('Failed to fetch notifications from Supabase:', err.message);
      return [];
    }
  },

  /**
   * Mark a notification as read in Supabase.
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    if (!isSupabaseConfigured() || !supabase) {
      return false;
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: now,
        })
        .eq('id', notificationId);

      if (error) {
        console.warn('Failed to mark notification read in Supabase:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('Mark read error:', err.message);
      return false;
    }
  },

  /**
   * Create a new event-driven notification in Supabase.
   * Fails gracefully without reverting workflow state if database insert fails.
   */
  async createNotification(params: {
    recipientUserId?: string;
    recipientRole?: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    sessionId?: string;
    reportId?: string;
    instrumentId?: string;
    targetPath: string;
  }): Promise<AppNotification | null> {
    if (!isSupabaseConfigured() || !supabase) {
      return null;
    }

    try {
      const payload = {
        recipient_user_id: params.recipientUserId || null,
        recipient_role: params.recipientRole || null,
        type: params.type,
        title: params.title,
        message: params.message,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        session_id: params.sessionId || null,
        report_id: params.reportId || null,
        instrument_id: params.instrumentId || null,
        target_path: params.targetPath,
        is_read: false,
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.warn('Failed to create notification in Supabase DB:', error.message);
        return null;
      }

      return {
        id: data.id,
        recipientUserId: data.recipient_user_id,
        recipientRole: data.recipient_role,
        type: data.type,
        title: data.title,
        message: data.message,
        entityType: data.entity_type,
        entityId: data.entity_id,
        sessionId: data.session_id,
        reportId: data.report_id,
        instrumentId: data.instrument_id,
        targetPath: data.target_path,
        isRead: Boolean(data.is_read),
        createdAt: data.created_at,
        readAt: data.read_at,
      };
    } catch (err: any) {
      console.warn('Notification creation error:', err.message);
      return null;
    }
  },
};

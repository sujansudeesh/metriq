import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLog } from '../types';
import { getAuditLogsStore, addAuditLog as addAuditLogToMockStore } from '../mock/store';
import { authService } from './authService';

export interface AuditEventInput {
  userId?: string;
  sessionId?: string;
  instrumentId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
  userFullName?: string;
  userRole?: string;
}

export const auditService = {
  /**
   * Fetch all audit events from append-only log table in Supabase or local store
   */
  async getAuditEvents(): Promise<AuditLog[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch audit events from Supabase: ${error.message}`);
      }

      return (data || []).map((row) => {
        const detailsObj = typeof row.details === 'object' && row.details !== null ? row.details : {};
        const description = typeof row.details === 'string'
          ? row.details
          : detailsObj.description || detailsObj.message || row.action;

        return {
          id: row.id,
          timestamp: row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19) : '',
          user: row.profiles?.full_name || 'Metrology Officer',
          role: row.profiles?.role || 'TESTING_OFFICER',
          action: row.action,
          details: description,
          instrumentOrSessionId: row.session_id || row.instrument_id || row.entity_id || 'GENERAL',
          entityType: row.entity_type,
          entityId: row.entity_id,
          beforeValue: detailsObj.before !== undefined ? detailsObj.before : undefined,
          afterValue: detailsObj.after !== undefined ? detailsObj.after : undefined,
          reason: detailsObj.reason !== undefined ? detailsObj.reason : undefined,
        };
      });
    }

    return getAuditLogsStore();
  },

  /**
   * Log a real audit event with actor identity resolution and before/after tracking
   */
  async logAuditEvent(event: AuditEventInput): Promise<AuditLog> {
    // 1. Derive real authenticated actor identity
    const currentUser = await authService.getCurrentUser().catch(() => null);
    const userId = event.userId || currentUser?.id;
    const userName = currentUser?.name || currentUser?.email || event.userFullName || 'Metrology Officer';
    const userRole = currentUser?.role || event.userRole || 'TESTING_OFFICER';

    const formattedDescription = typeof event.details === 'string'
      ? event.details
      : event.details?.description || event.action;

    const detailsPayload = {
      description: formattedDescription,
      ...(event.beforeValue !== undefined ? { before: event.beforeValue } : {}),
      ...(event.afterValue !== undefined ? { after: event.afterValue } : {}),
      ...(event.reason ? { reason: event.reason } : {}),
      ...(typeof event.details === 'object' ? event.details : {}),
    };

    // 2. Persist to Supabase audit_events table when configured
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('audit_events')
        .insert({
          user_id: userId,
          session_id: event.sessionId,
          instrument_id: event.instrumentId,
          action: event.action,
          entity_type: event.entityType,
          entity_id: event.entityId,
          details: detailsPayload,
        })
        .select('*, profiles(full_name, role)')
        .single();

      if (error) {
        throw new Error(`Failed to save audit event to Supabase DB: ${error.message}`);
      }

      return {
        id: data.id,
        timestamp: new Date(data.created_at).toISOString().replace('T', ' ').substring(0, 19),
        user: data.profiles?.full_name || userName,
        role: data.profiles?.role || userRole,
        action: data.action,
        details: formattedDescription,
        instrumentOrSessionId: data.session_id || data.instrument_id || data.entity_id || 'GENERAL',
        entityType: data.entity_type,
        entityId: data.entity_id,
        beforeValue: event.beforeValue,
        afterValue: event.afterValue,
        reason: event.reason,
      };
    }

    // 3. Fallback for unconfigured local mode
    const newLog: AuditLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: userName,
      role: userRole,
      action: event.action,
      details: formattedDescription,
      instrumentOrSessionId: event.sessionId || event.instrumentId || event.entityId || 'GENERAL',
      entityType: event.entityType,
      entityId: event.entityId,
      beforeValue: event.beforeValue,
      afterValue: event.afterValue,
      reason: event.reason,
    };

    addAuditLogToMockStore(newLog);
    return newLog;
  },
};

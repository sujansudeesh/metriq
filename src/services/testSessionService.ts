import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TestSession, WorkflowStatus, WorkflowHistoryEvent, UserRole, Report, WeighingTestObservation, TareSettingObservation, TareTestSession } from '../types';
import { INITIAL_TEST_SESSIONS, INITIAL_REPORTS } from '../mock/data';
import { addAuditLog, getInstrumentsStore } from '../mock/store';
import { calculateSessionProgress, calculateOverallEvaluationResult, isSessionReadyForReview } from './evaluationResultService';
import { instrumentService } from './instrumentService';
import { generateRecommendedTestPlan, getDefaultAdministrativeChecklist } from './testPlanService';
import { authService } from './authService';
import { reviewService } from './reviewService';
import { notificationService } from './notificationService';
import { reportService } from './reportService';

const STORAGE_KEYS = {
  TEST_SESSIONS: 'nawi_test_sessions',
  REPORTS: 'nawi_reports',
};

/**
 * Normalizes legacy test session status to formal WorkflowStatus.
 */
export function normalizeWorkflowStatus(session: Partial<TestSession>): WorkflowStatus {
  if (session.workflowStatus) return session.workflowStatus;
  
  const status = session.status;
  if (status === 'Finalized') return 'FINALIZED';
  if (status === 'Compliant') return 'APPROVED';
  if (status === 'Awaiting Review') return 'UNDER_REVIEW';
  if (status === 'Non-Compliant') return 'FINALIZED';
  return 'DRAFT';
}

/**
 * Maps WorkflowStatus to legacy user-facing TestSessionStatus badge string.
 */
export function mapWorkflowToDisplayStatus(workflowStatus: WorkflowStatus): TestSession['status'] {
  switch (workflowStatus) {
    case 'DRAFT':
    case 'IN_PROGRESS':
    case 'TESTING_COMPLETE':
      return 'In Progress';
    case 'UNDER_REVIEW':
    case 'TECHNICALLY_APPROVED':
      return 'Awaiting Review';
    case 'CHANGES_REQUESTED':
      return 'In Progress';
    case 'APPROVED':
      return 'Compliant';
    case 'FINALIZED':
      return 'Finalized';
    default:
      return 'In Progress';
  }
}

/**
 * Returns human-readable label for WorkflowStatus.
 */
export function getWorkflowStatusLabel(workflowStatus?: WorkflowStatus): string {
  switch (workflowStatus) {
    case 'DRAFT':
      return 'Draft';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'TESTING_COMPLETE':
      return 'Testing Complete';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'CHANGES_REQUESTED':
      return 'Changes Requested';
    case 'TECHNICALLY_APPROVED':
      return 'Technically Approved';
    case 'APPROVED':
      return 'Approved';
    case 'FINALIZED':
      return 'Finalized';
    default:
      return 'In Progress';
  }
}

function notifySubscribers() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nawi_session_updated'));
    window.dispatchEvent(new Event('storage'));
  }
}

export const testSessionService = {
  /**
   * Retrieves all test sessions from persistent storage or Supabase.
   */
  async getAllSessionsAsync(): Promise<TestSession[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('test_sessions')
        .select(`
          *,
          instruments (*),
          session_tests (*, test_observations (*))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch test sessions from Supabase: ${error.message}`);
      }

      return (data || []).map((row) => this.mapRowToSession(row));
    }

    return this.getAllSessions();
  },

  /**
   * Synchronous getAllSessions for local fallback / instant state access
   */
  getAllSessions(): TestSession[] {
    const saved = localStorage.getItem(STORAGE_KEYS.TEST_SESSIONS);
    let sessions: TestSession[] = [];

    if (saved) {
      try {
        sessions = JSON.parse(saved);
      } catch {
        sessions = INITIAL_TEST_SESSIONS;
      }
    } else {
      sessions = INITIAL_TEST_SESSIONS;
    }

    let updated = false;
    const normalizedSessions = sessions.map((s) => {
      const ws = normalizeWorkflowStatus(s);
      if (s.workflowStatus !== ws || !s.workflowHistory) {
        updated = true;
        return {
          ...s,
          workflowStatus: ws,
          workflowHistory: s.workflowHistory || [
            {
              id: `wh-init-${s.id}`,
              fromStatus: 'DRAFT',
              toStatus: ws,
              user: s.assignedOfficer || 'Testing Officer',
              role: 'Testing Officer' as UserRole,
              timestamp: s.startedOn || new Date().toISOString().substring(0, 10),
              comment: 'Initial test session initialized.',
            },
          ],
        };
      }
      return s;
    });

    if (updated || !saved) {
      localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(normalizedSessions));
    }

    return normalizedSessions;
  },

  /**
   * Gets latest state for a specific test session by ID asynchronously from Supabase.
   */
  async getSessionByIdAsync(id: string): Promise<TestSession | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('test_sessions')
        .select(`
          *,
          instruments (*),
          session_tests (*, test_observations (*))
        `)
        .or(`id.eq.${id},session_code.eq.${id}`)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch test session from Supabase: ${error.message}`);
      }

      if (data) {
        return this.mapRowToSession(data);
      }
      return null;
    }

    return this.getSession(id) || null;
  },

  /**
   * Synchronous getSession lookup (combines store & fallback)
   */
  getSession(id: string): TestSession | undefined {
    const sessions = this.getAllSessions();
    return sessions.find((s) => s.id === id || s.instrumentId === id);
  },

  getLatestSessionState(id: string): TestSession | undefined {
    return this.getSession(id);
  },

  /**
   * Creates a new evaluation session connected to real Supabase tables.
   */
  async createSession(params: {
    instrumentId: string;
    testContext?: string;
    verificationMode?: string;
    officerName?: string;
    ambientTemp?: number;
    relativeHumidity?: number;
    barometricPressure?: number;
  }): Promise<TestSession> {
    if (isSupabaseConfigured() && supabase) {
      // 1. Get current authenticated user ID
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      // 2. Fetch instrument details
      const instrument = await instrumentService.getInstrumentById(params.instrumentId);
      if (!instrument) {
        throw new Error(`Instrument with ID ${params.instrumentId} not found.`);
      }

      const sessionCode = `TS-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      // 3. Insert test_sessions row with DRAFT status
      const { data: dbSession, error: sessionError } = await supabase
        .from('test_sessions')
        .insert({
          session_code: sessionCode,
          instrument_id: instrument.id,
          test_context: params.testContext || 'TYPE_EXAMINATION',
          verification_mode: params.verificationMode || 'INITIAL',
          workflow_status: 'DRAFT',
          evaluation_result: 'UNDER_EVALUATION',
          testing_officer_id: currentUserId,
          rule_standard: 'OIML R 76-1',
          rule_version: '2006',
          started_at: new Date().toISOString(),
        })
        .select(`*, instruments(*)`)
        .single();

      if (sessionError || !dbSession) {
        throw new Error(`Failed to create test session in Supabase: ${sessionError?.message}`);
      }

      // 4. Generate applicable test plan using testPlanService
      const generatedPlan = generateRecommendedTestPlan(instrument, (params.testContext as any) || 'TYPE_EXAMINATION');

      // 5. Persist tests into public.session_tests (avoiding duplicates)
      const testTypesMap: Record<string, string> = {
        accuracy: 'ACCURACY',
        repeatability: 'REPEATABILITY',
        eccentricity: 'ECCENTRICITY',
        discrimination: 'DISCRIMINATION',
        zeroSetting: 'ZERO_SETTING',
        tare: 'TARE',
      };

      const sessionTestRows = generatedPlan.map((planItem) => {
        const dbType = testTypesMap[planItem.id] || planItem.id.toUpperCase();
        return {
          session_id: dbSession.id,
          test_type: dbType,
          required: planItem.requiredByDefault,
          applicability_status: planItem.status === 'APPLICABLE' ? 'APPLICABLE' : planItem.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'REQUIRES_CONFIRMATION',
          completion_status: planItem.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'NOT_STARTED',
          result: 'INCOMPLETE',
          rule_reference: planItem.ruleReference,
          applicability_reason: planItem.reason,
        };
      });

      const { error: testsError } = await supabase
        .from('session_tests')
        .upsert(sessionTestRows, { onConflict: 'session_id,test_type' });

      if (testsError) {
        console.warn('Warning: Error generating session tests:', testsError.message);
      }

      // Fetch full session back with relations
      const fullSession = await this.getSessionByIdAsync(dbSession.id);
      if (fullSession) {
        return fullSession;
      }
    }

    // Local Store Fallback if Supabase is not configured
    const inst = getInstrumentsStore().find((i) => i.id === params.instrumentId) || getInstrumentsStore()[0];
    const generatedPlan = generateRecommendedTestPlan(inst, 'TYPE_EXAMINATION');
    const adminChecklist = getDefaultAdministrativeChecklist();

    const localSession: TestSession = {
      id: `TS-2026-${Math.floor(100 + Math.random() * 900)}`,
      instrumentId: inst.id,
      instrumentModel: inst.model.modelName,
      serialNumber: inst.model.serialNumber,
      manufacturer: inst.manufacturer.name,
      accuracyClass: inst.metrology.accuracyClass,
      maxCapacity: `${inst.metrology.maxCapacity} ${inst.metrology.maxUnit}`,
      verificationInterval: `${inst.metrology.verificationIntervalE} ${inst.metrology.eUnit}`,
      startedOn: new Date().toISOString().replace('T', ' ').substring(0, 16),
      progress: 0,
      status: 'In Progress',
      workflowStatus: 'DRAFT',
      testContext: (params.testContext as any) || 'TYPE_EXAMINATION',
      assignedOfficer: params.officerName || 'Dr. Ananya Rao',
      ambientTemp: params.ambientTemp || 22.0,
      relativeHumidity: params.relativeHumidity || 50,
      barometricPressure: params.barometricPressure || 1013.2,
      eccentricityTestLoad: 10.0,
      weighingObservations: [],
      repeatabilityObservations: [],
      eccentricityObservations: [],
      tareObservations: [],
      discriminationObservations: [],
      testPlan: generatedPlan,
      administrativeChecklist: adminChecklist,
    };

    this.saveSession(localSession);
    return localSession;
  },

  /**
   * Saves or updates a test session persistently.
   */
  saveSession(session: TestSession): TestSession[] {
    const current = this.getAllSessions();
    const index = current.findIndex((s) => s.id === session.id);

    const { progressPercentage, moduleConfigs } = calculateSessionProgress(session);
    const overallEvalResult = calculateOverallEvaluationResult(session);

    const updatedSession: TestSession = {
      ...session,
      progress: progressPercentage,
      moduleConfigs,
      overallEvaluationResult: overallEvalResult,
      overallVerdict: overallEvalResult === 'NON_COMPLIANT' ? 'Non-Compliant' : overallEvalResult === 'COMPLIANT' ? 'Compliant' : 'Under Evaluation',
      workflowStatus: normalizeWorkflowStatus(session),
    };

    let updatedList: TestSession[];
    if (index >= 0) {
      updatedList = [...current];
      updatedList[index] = updatedSession;
    } else {
      updatedList = [updatedSession, ...current];
    }

    localStorage.setItem(STORAGE_KEYS.TEST_SESSIONS, JSON.stringify(updatedList));

    if (isSupabaseConfigured() && supabase) {
      this.syncSessionToSupabase(updatedSession).catch((err) => {
        console.error('Background Supabase session sync failed:', err);
      });
    }

    this.syncReportState(updatedSession);
    notifySubscribers();

    return updatedList;
  },

  /**
   * Saves test session record to Supabase
   */
  async syncSessionToSupabase(session: TestSession) {
    if (!isSupabaseConfigured() || !supabase) return;

    // 1. Upsert test_sessions row
    const { data: dbSession, error: sessionErr } = await supabase
      .from('test_sessions')
      .upsert({
        session_code: session.id,
        instrument_id: session.instrumentId && session.instrumentId.includes('-') ? session.instrumentId : undefined,
        test_context: session.testContext || 'TYPE_EXAMINATION',
        verification_mode: session.verificationMode || 'INITIAL',
        workflow_status: session.workflowStatus || 'DRAFT',
        evaluation_result: session.overallEvaluationResult || 'UNDER_EVALUATION',
        ambient_temp: session.ambientTemp,
        relative_humidity: session.relativeHumidity,
        barometric_pressure: session.barometricPressure,
        raw_metadata: {
          environmentalConditions: session.environmentalConditions || {},
          notes: session.notes,
          comments: session.comments,
        },
        rule_standard: 'OIML R 76-1',
        rule_version: '2006',
        submitted_at: session.submittedAt,
        reviewed_at: session.reviewedAt,
        approved_at: session.approvedAt,
        finalized_at: session.finalizedAt,
      }, { onConflict: 'session_code' })
      .select()
      .single();

    if (sessionErr || !dbSession) {
      console.warn('Failed to sync session row to Supabase:', sessionErr);
      return;
    }

    // 2. Upsert session_tests for each module
    const modules = session.selectedTests || ['accuracy', 'repeatability', 'eccentricity', 'discrimination', 'zeroSetting', 'tare'];
    for (const modKey of modules) {
      const dbType = modKey.toUpperCase();
      const config = session.moduleConfigs?.[modKey];
      await supabase.from('session_tests').upsert({
        session_id: dbSession.id,
        test_type: dbType,
        required: config?.required ?? true,
        applicability_status: config?.applicable ? 'APPLICABLE' : 'NOT_APPLICABLE',
        completion_status: config?.status || 'NOT_STARTED',
        result: config?.result || 'INCOMPLETE',
      }, { onConflict: 'session_id,test_type' });
    }
  },

  /**
   * Updates partial properties on a session by ID.
   */
  updateSession(id: string, updates: Partial<TestSession>): TestSession | undefined {
    const session = this.getSession(id);
    if (!session) return undefined;

    const merged = { ...session, ...updates };
    this.saveSession(merged);
    return this.getSession(id);
  },

  /**
   * Formal Workflow State Transition Handler.
   * Enforces strict sequential role transitions and persists directly to Supabase when configured.
   */
  async updateWorkflowStatus(
    id: string,
    toStatus: WorkflowStatus,
    metadata?: {
      user?: string;
      role?: UserRole;
      comments?: string;
      reason?: string;
    }
  ): Promise<TestSession | undefined> {
    const session = (await this.getSessionByIdAsync(id)) || this.getSession(id);
    if (!session) throw new Error(`Test session ${id} not found.`);

    const fromStatus = session.workflowStatus || normalizeWorkflowStatus(session);

    // Get current authenticated user details from Supabase if configured
    let currentAuthUser = await authService.getCurrentUser().catch(() => null);
    const currentUser = currentAuthUser?.name || metadata?.user || 'Metrology Officer';
    const currentRole = currentAuthUser?.role || metadata?.role || 'TESTING_OFFICER';
    const currentUserId = currentAuthUser?.id;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const commentText = metadata?.comments || metadata?.reason || `Workflow transition: ${fromStatus} -> ${toStatus}`;

    // Normalize caller role code
    const isTestingOfficer = currentRole === 'TESTING_OFFICER' || currentRole === 'Testing Officer';
    const isTechnicalReviewer = currentRole === 'TECHNICAL_REVIEWER' || currentRole === 'Technical Reviewer';
    const isLabDirector = currentRole === 'LAB_DIRECTOR' || currentRole === 'Approving Officer / Lab Director';
    const isAdmin = currentRole === 'ADMIN' || currentRole === 'Admin';

    // 1. ENFORCE STRICT SEQUENTIAL TRANSITIONS & ROLE RULES
    if (isTestingOfficer && !isAdmin) {
      if (fromStatus === 'DRAFT' && toStatus === 'IN_PROGRESS') {
        // Allowed: DRAFT -> IN_PROGRESS
      } else if (fromStatus === 'IN_PROGRESS' && toStatus === 'TESTING_COMPLETE') {
        // Allowed: IN_PROGRESS -> TESTING_COMPLETE (verify completion)
        const readyCheck = isSessionReadyForReview(session);
        if (!readyCheck.isReady) {
          throw new Error(readyCheck.blockingReason || 'Complete all required tests before submitting for technical review.');
        }
      } else if (fromStatus === 'CHANGES_REQUESTED' && toStatus === 'IN_PROGRESS') {
        // Allowed: CHANGES_REQUESTED -> IN_PROGRESS
      } else {
        throw new Error(`Invalid workflow transition ${fromStatus} -> ${toStatus} for Testing Officer.`);
      }
    } else if (isTechnicalReviewer && !isAdmin) {
      if (fromStatus === 'TESTING_COMPLETE' && toStatus === 'UNDER_REVIEW') {
        // Allowed: TESTING_COMPLETE -> UNDER_REVIEW
      } else if (fromStatus === 'UNDER_REVIEW' && (toStatus === 'TECHNICALLY_APPROVED' || toStatus === 'CHANGES_REQUESTED')) {
        // Allowed: UNDER_REVIEW -> TECHNICALLY_APPROVED or CHANGES_REQUESTED
        if (toStatus === 'CHANGES_REQUESTED' && !commentText.trim()) {
          throw new Error('A reason or review comment is required when requesting changes.');
        }
      } else {
        throw new Error(`Invalid workflow transition ${fromStatus} -> ${toStatus} for Technical Reviewer.`);
      }
    } else if (isLabDirector && !isAdmin) {
      if (fromStatus === 'TECHNICALLY_APPROVED' && (toStatus === 'APPROVED' || toStatus === 'CHANGES_REQUESTED')) {
        // Allowed: TECHNICALLY_APPROVED -> APPROVED or CHANGES_REQUESTED
        if (toStatus === 'CHANGES_REQUESTED' && !commentText.trim()) {
          throw new Error('A reason or review comment is required when requesting changes.');
        }
      } else if (fromStatus === 'APPROVED' && toStatus === 'FINALIZED') {
        // Allowed: APPROVED -> FINALIZED
      } else {
        throw new Error(`Invalid workflow transition ${fromStatus} -> ${toStatus} for Laboratory Director.`);
      }
    } else if (!isAdmin) {
      throw new Error(`Role ${currentRole} is not authorized to update workflow status.`);
    }

    // Prohibit forbidden jump transitions for all users
    if (
      (fromStatus === 'DRAFT' && toStatus === 'APPROVED') ||
      (fromStatus === 'IN_PROGRESS' && toStatus === 'APPROVED') ||
      (fromStatus === 'TESTING_COMPLETE' && toStatus === 'APPROVED') ||
      (fromStatus === 'TECHNICALLY_APPROVED' && toStatus === 'FINALIZED')
    ) {
      throw new Error(`Direct transition from ${fromStatus} to ${toStatus} is strictly prohibited by metrology workflow rules.`);
    }

    const updatedSession: TestSession = {
      ...session,
      workflowStatus: toStatus,
      status: mapWorkflowToDisplayStatus(toStatus),
    };

    if (toStatus === 'UNDER_REVIEW') {
      updatedSession.submittedBy = currentUser;
      updatedSession.submittedAt = timestamp;
    } else if (toStatus === 'CHANGES_REQUESTED') {
      updatedSession.correctionReason = commentText;
      updatedSession.correctionRequestedBy = currentUser;
      updatedSession.correctionRequestedAt = timestamp;
      updatedSession.reviewerComments = commentText;
    } else if (toStatus === 'TECHNICALLY_APPROVED') {
      updatedSession.reviewedBy = currentUser;
      updatedSession.reviewedAt = timestamp;
      updatedSession.reviewerComments = commentText;
      updatedSession.reviewer = currentUser;
    } else if (toStatus === 'APPROVED') {
      updatedSession.approvedBy = currentUser;
      updatedSession.approvedAt = timestamp;
      updatedSession.approver = currentUser;
    } else if (toStatus === 'FINALIZED') {
      updatedSession.finalizedBy = currentUser;
      updatedSession.finalizedAt = timestamp;
      updatedSession.completedOn = timestamp;
      updatedSession.approver = currentUser;
      updatedSession.progress = 100;
    }

    const newHistoryEvent: WorkflowHistoryEvent = {
      id: `wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fromStatus,
      toStatus,
      user: currentUser,
      role: currentRole,
      timestamp,
      comment: commentText,
    };

    const updatedHistory = [newHistoryEvent, ...(session.workflowHistory || [])];
    updatedSession.workflowHistory = updatedHistory;

    // 2. PERSIST TO SUPABASE WHEN CONFIGURED
    if (isSupabaseConfigured() && supabase) {
      const { data: dbSess, error: findErr } = await supabase
        .from('test_sessions')
        .select('id, raw_metadata, technical_reviewer_id, approving_officer_id')
        .or(`id.eq.${id},session_code.eq.${id}`)
        .maybeSingle();

      if (findErr || !dbSess) {
        throw new Error(`Failed to find test session ${id} in Supabase: ${findErr?.message || 'Session row missing'}`);
      }

      const nowIso = new Date().toISOString();
      const updatePayload: any = {
        workflow_status: toStatus,
        evaluation_result: updatedSession.overallEvaluationResult || 'UNDER_EVALUATION',
      };

      if (toStatus === 'IN_PROGRESS') {
        updatePayload.started_at = session.startedOn || nowIso;
      } else if (toStatus === 'TESTING_COMPLETE') {
        updatePayload.submitted_at = nowIso;
      } else if (toStatus === 'UNDER_REVIEW') {
        if (currentUserId) updatePayload.technical_reviewer_id = currentUserId;
      } else if (toStatus === 'CHANGES_REQUESTED') {
        // Keep comments in raw_metadata
      } else if (toStatus === 'TECHNICALLY_APPROVED') {
        updatePayload.reviewed_at = nowIso;
        if (currentUserId && !dbSess.technical_reviewer_id) {
          updatePayload.technical_reviewer_id = currentUserId;
        }
      } else if (toStatus === 'APPROVED') {
        updatePayload.approved_at = nowIso;
        if (currentUserId && !dbSess.approving_officer_id) {
          updatePayload.approving_officer_id = currentUserId;
        }
      } else if (toStatus === 'FINALIZED') {
        updatePayload.finalized_at = nowIso;
        if (currentUserId && !dbSess.approving_officer_id) {
          updatePayload.approving_officer_id = currentUserId;
        }
      }

      const existingMeta = dbSess.raw_metadata || {};
      updatePayload.raw_metadata = {
        ...existingMeta,
        workflowHistory: updatedHistory,
        comments: commentText,
        correctionReason: toStatus === 'CHANGES_REQUESTED' ? commentText : existingMeta.correctionReason,
      };

      const { error: dbUpdateErr } = await supabase
        .from('test_sessions')
        .update(updatePayload)
        .eq('id', dbSess.id);

      if (dbUpdateErr) {
        throw new Error(`Supabase DB workflow update rejected: ${dbUpdateErr.message}`);
      }

      // Add comment to review_comments table
      if (metadata?.comments || metadata?.reason || toStatus === 'CHANGES_REQUESTED' || toStatus === 'TECHNICALLY_APPROVED' || toStatus === 'APPROVED') {
        try {
          await reviewService.addComment({
            sessionId: dbSess.id,
            comment: commentText,
            commentType: toStatus === 'CHANGES_REQUESTED' ? 'CHANGE_REQUEST' : toStatus === 'TECHNICALLY_APPROVED' ? 'TECHNICAL_REVIEW' : 'APPROVAL_NOTE',
            createdBy: currentUserId || 'system',
          });
        } catch (cErr) {
          console.warn('Review comment save note:', cErr);
        }
      }

      // Create role-targeted notification for real workflow event
      try {
        const code = updatedSession.session_code || updatedSession.id;
        if (toStatus === 'TESTING_COMPLETE') {
          await notificationService.createNotification({
            recipientRole: 'TECHNICAL_REVIEWER',
            type: 'TECHNICAL_REVIEW_REQUIRED',
            title: 'Technical Review Required',
            message: `Session ${code} submitted for technical audit sign-off.`,
            sessionId: dbSess.id,
            targetPath: `/test-sessions/${code}?tab=review`,
          });
        } else if (toStatus === 'CHANGES_REQUESTED') {
          await notificationService.createNotification({
            recipientRole: 'TESTING_OFFICER',
            type: 'TEST_RETURNED_FOR_CORRECTION',
            title: 'Corrections Required',
            message: `Reviewer requested corrections on Session ${code}: ${commentText}`,
            sessionId: dbSess.id,
            targetPath: `/test-sessions/${code}?tab=weighing`,
          });
        } else if (toStatus === 'TECHNICALLY_APPROVED') {
          await notificationService.createNotification({
            recipientRole: 'LAB_DIRECTOR',
            type: 'DIRECTOR_APPROVAL_REQUIRED',
            title: 'Approval Required',
            message: `Director sign-off needed for Session ${code}.`,
            sessionId: dbSess.id,
            targetPath: `/test-sessions/${code}?tab=review`,
          });
        } else if (toStatus === 'FINALIZED' || toStatus === 'APPROVED') {
          if (toStatus === 'FINALIZED') {
            try {
              await reportService.generateFinalReportSnapshot(updatedSession);
            } catch (snapErr) {
              console.warn('Final report snapshot generation note:', snapErr);
            }
          }
          await notificationService.createNotification({
            recipientRole: 'TESTING_OFFICER',
            type: 'REPORT_READY',
            title: 'Report Ready',
            message: `Test evaluation certificate for Session ${code} has been generated.`,
            sessionId: dbSess.id,
            targetPath: `/test-sessions/${code}`,
          });
        }
      } catch (notifErr) {
        console.warn('Notification trigger note:', notifErr);
      }
    }

    this.saveSession(updatedSession);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp,
      user: currentUser,
      role: currentRole,
      action: `Workflow Status: ${getWorkflowStatusLabel(toStatus)}`,
      details: `${session.instrumentModel} (${id}) moved to ${getWorkflowStatusLabel(toStatus)}. ${commentText}`,
      instrumentOrSessionId: id,
    });

    return updatedSession;
  },

  /**
   * Synchronizes matching Report record with current session workflow status.
   */
  syncReportState(session: TestSession) {
    const rawReports = localStorage.getItem(STORAGE_KEYS.REPORTS);
    let reports: Report[] = rawReports ? JSON.parse(rawReports) : INITIAL_REPORTS;

    const existingReportIdx = reports.findIndex((r) => r.testSessionId === session.id);
    
    let reportStatus: Report['status'] = 'Draft';
    if (session.workflowStatus === 'UNDER_REVIEW' || session.workflowStatus === 'CHANGES_REQUESTED' || session.workflowStatus === 'TECHNICALLY_APPROVED') {
      reportStatus = 'Awaiting Review';
    } else if (session.workflowStatus === 'APPROVED') {
      reportStatus = 'Approved';
    } else if (session.workflowStatus === 'FINALIZED') {
      reportStatus = 'Finalized';
    }

    if (existingReportIdx >= 0) {
      reports[existingReportIdx] = {
        ...reports[existingReportIdx],
        status: reportStatus,
        technicalReviewer: session.reviewedBy || reports[existingReportIdx].technicalReviewer,
        labDirector: session.approvedBy || session.finalizedBy || reports[existingReportIdx].labDirector,
        verdict: session.overallVerdict || reports[existingReportIdx].verdict,
      };
    } else if (session.workflowStatus === 'APPROVED' || session.workflowStatus === 'FINALIZED' || session.workflowStatus === 'TECHNICALLY_APPROVED' || session.workflowStatus === 'UNDER_REVIEW') {
      const newReport: Report = {
        id: `REP-2026-${Math.floor(100 + Math.random() * 900)}`,
        reportNumber: `LM-OIML-R76-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        certificateId: `CERT-IN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        testSessionId: session.id,
        instrumentId: session.instrumentId,
        instrumentModel: session.instrumentModel,
        manufacturer: session.manufacturer,
        accuracyClass: session.accuracyClass,
        issueDate: new Date().toISOString().split('T')[0],
        status: reportStatus,
        testingOfficer: session.assignedOfficer || 'Dr. Ananya Rao',
        technicalReviewer: session.reviewedBy || 'Vikramaditya Verma',
        labDirector: session.approvedBy || session.finalizedBy || 'Dr. K. S. Murthy',
        verdict: session.overallVerdict || 'Compliant',
      };
      reports = [newReport, ...reports];
    }

    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  },

  /**
   * Helper to map Supabase session row to TestSession object
   */
  mapRowToSession(row: any): TestSession {
    const instrument = row.instruments;
    const sessionTests = row.session_tests || [];

    // 1. Accuracy / Weighing
    const accuracyTest = sessionTests.find((st: any) => st.test_type === 'ACCURACY' || st.test_type === 'WEIGHING');
    const weighingObsRows = accuracyTest?.test_observations || [];
    const weighingObservations: WeighingTestObservation[] = weighingObsRows
      .filter((obs: any) => obs.observation_type === 'WEIGHING')
      .map((obs: any) => ({
        id: obs.id,
        load: Number(obs.reference_value),
        indicatedValue: Number(obs.indicated_value),
        deltaL: Number(obs.additional_load_value || 0),
        calculatedError: Number(obs.raw_error_value ?? obs.corrected_error_value ?? 0),
        adjustedError: Number(obs.corrected_error_value ?? obs.raw_error_value ?? 0),
        mpeLimit: Number(obs.mpe_value ?? 0),
        passed: obs.result === 'WITHIN_LIMIT',
        direction: obs.calculation_trace?.direction || 'Increasing',
        mpeUnit: obs.result_unit || 'g',
        mpeStatus: obs.result === 'WITHIN_LIMIT' ? 'WITHIN_MPE' : 'EXCEEDS_MPE',
        indicatedDifferenceFormatted: obs.raw_metadata?.indicatedDifferenceFormatted || '',
        notes: obs.raw_metadata?.notes || '',
      }));

    // 2. Repeatability
    const repTest = sessionTests.find((st: any) => st.test_type === 'REPEATABILITY');
    const repObsRows = repTest?.test_observations || [];
    const repeatabilityObservations = repObsRows
      .filter((obs: any) => obs.observation_type === 'REPEATABILITY_READING' || obs.observation_type === 'REPEATABILITY')
      .map((obs: any) => ({
        id: obs.id,
        runNumber: obs.run_number || obs.observation_no,
        load: Number(obs.reference_value),
        indicatedValue: Number(obs.indicated_value),
        zeroIndication: Number(obs.calculation_trace?.zeroIndication || 0),
        deltaL: Number(obs.additional_load_value || 0),
        error: Number(obs.raw_error_value ?? 0),
        calculatedError: Number(obs.raw_error_value ?? 0),
        passed: obs.result === 'WITHIN_LIMIT',
      }));

    // 3. Eccentricity
    const eccTest = sessionTests.find((st: any) => st.test_type === 'ECCENTRICITY');
    const eccObsRows = eccTest?.test_observations || [];
    const eccentricityObservations = eccObsRows
      .filter((obs: any) => obs.observation_type === 'ECCENTRICITY_POSITION' || obs.observation_type === 'ECCENTRICITY')
      .map((obs: any) => ({
        id: obs.id,
        position: obs.run_number || 1,
        locationLabel: obs.position_label || `Position ${obs.run_number || 1}`,
        load: Number(obs.reference_value),
        indicatedValue: Number(obs.indicated_value),
        deltaL: Number(obs.additional_load_value || 0),
        error: Number(obs.raw_error_value ?? obs.corrected_error_value ?? 0),
        mpeValue: Number(obs.mpe_value ?? 0),
        mpeUnit: obs.result_unit || 'g',
        passed: obs.result === 'WITHIN_LIMIT',
        mpeStatus: obs.result === 'WITHIN_LIMIT' ? 'WITHIN_MPE' : 'EXCEEDS_MPE',
      }));

    // 4. Discrimination
    const discTest = sessionTests.find((st: any) => st.test_type === 'DISCRIMINATION');
    const discObsRows = discTest?.test_observations || [];
    const discriminationObservations = discObsRows
      .filter((obs: any) => obs.observation_type === 'DISCRIMINATION')
      .map((obs: any) => ({
        id: obs.id,
        testPointId: (obs.position_label as any) || 'MIN',
        testPointLabel: obs.raw_metadata?.testPointLabel || obs.position_label || 'Min Load',
        load: Number(obs.reference_value),
        loadUnit: obs.reference_unit || 'kg',
        scaleIntervalD: obs.raw_metadata?.scaleIntervalD || 0.1,
        dUnit: obs.indicated_unit || 'g',
        oneTenthD: obs.raw_metadata?.oneTenthD || 0.01,
        onePointFourD: obs.raw_metadata?.onePointFourD || 0.14,
        initialIndication: Number(obs.indicated_value),
        transitionIndication: obs.raw_metadata?.transitionIndication,
        finalIndication: obs.raw_metadata?.finalIndication ?? Number(obs.indicated_value),
        additionalLoad: Number(obs.additional_load_value || 0),
        passed: obs.result === 'WITHIN_LIMIT',
        resultStatus: obs.result === 'WITHIN_LIMIT' ? 'CONFIRMED' : 'NOT_OBSERVED',
        isCompleted: true,
      }));

    // 5. Zero Setting
    const zeroTest = sessionTests.find((st: any) => st.test_type === 'ZERO_SETTING');
    const zeroObsRows = zeroTest?.test_observations || [];
    const zeroSettingObservations = zeroObsRows
      .filter((obs: any) => obs.observation_type === 'ZERO_SETTING')
      .map((obs: any) => ({
        id: obs.id,
        zeroSettingType: obs.raw_metadata?.zeroSettingType || 'SEMI_AUTOMATIC',
        verificationIntervalE: obs.raw_metadata?.verificationIntervalE || 0.1,
        eUnit: obs.result_unit || 'g',
        suggestedIncrement: obs.raw_metadata?.suggestedIncrement || 0.5,
        changeoverAdditionalLoad: Number(obs.additional_load_value || 0),
        calculatedZeroError: Number(obs.corrected_error_value ?? obs.zero_error_value ?? 0),
        permissibleZeroDeviation: Number(obs.mpe_value ?? 0),
        passed: obs.result === 'WITHIN_LIMIT',
        resultStatus: obs.result === 'WITHIN_LIMIT' ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
        isCompleted: true,
      }));

    // 6. Tare
    const tareTest = sessionTests.find((st: any) => st.test_type === 'TARE');
    const tareObsRows = tareTest?.test_observations || [];
    const tareSettingRow = tareObsRows.find((obs: any) => obs.observation_type === 'TARE_SETTING');
    const netWeighingRows = tareObsRows.filter((obs: any) => obs.observation_type === 'NET_WEIGHING');

    let tareSettingObservation: TareSettingObservation | undefined = undefined;
    if (tareSettingRow) {
      tareSettingObservation = {
        id: tareSettingRow.id,
        appliedTareLoad: Number(tareSettingRow.reference_value),
        tareLoadUnit: tareSettingRow.reference_unit || 'kg',
        displayedIndicationAfterTare: Number(tareSettingRow.indicated_value),
        suggestedIncrement: tareSettingRow.raw_metadata?.suggestedIncrement || 0.5,
        changeoverAdditionalLoad: Number(tareSettingRow.additional_load_value || 0),
        calculatedTareZeroError: Number(tareSettingRow.corrected_error_value ?? 0),
        permissibleTareZeroError: Number(tareSettingRow.mpe_value ?? 0),
        passed: tareSettingRow.result === 'WITHIN_LIMIT',
        resultStatus: (tareSettingRow.result === 'WITHIN_LIMIT' ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT') as 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT',
      };
    }

    const netWeighingObservations = netWeighingRows.map((obs: any) => ({
      id: obs.id,
      stepIndex: obs.run_number || 1,
      stepLabel: obs.position_label || 'Step 1',
      appliedTareLoad: obs.raw_metadata?.appliedTareLoad || tareSettingObservation?.appliedTareLoad || 5.0,
      referenceNetLoad: Number(obs.reference_value),
      displayedNetReading: Number(obs.indicated_value),
      calculatedGrossLoad: obs.raw_metadata?.calculatedGrossLoad || (Number(obs.reference_value) + 5.0),
      netError: Number(obs.raw_error_value ?? 0),
      netErrorFormatted: obs.raw_metadata?.netErrorFormatted || `${obs.raw_error_value} g`,
      mpeLimit: Number(obs.mpe_value ?? 0),
      mpeUnit: obs.result_unit || 'g',
      mpeStatus: obs.result === 'WITHIN_LIMIT' ? 'WITHIN_MPE' : 'EXCEEDS_MPE',
      passed: obs.result === 'WITHIN_LIMIT',
    }));

    const tareTestSession: TareTestSession = {
      tareType: 'SUBTRACTIVE',
      maximumTareEffect: 10,
      maximumTareUnit: 'kg',
      appliedTare: tareSettingObservation?.appliedTareLoad || 5.0,
      availableNetCapacity: 25,
      tareSettingObservation,
      netWeighingObservations,
      isTareSettingCompleted: !!tareSettingObservation,
      isNetWeighingCompleted: netWeighingObservations.length > 0,
      overallResult: (tareSettingRow || netWeighingRows.length > 0 ? (netWeighingObservations.every((o: any) => o.passed) ? 'COMPLETED_WITHIN_LIMITS' : 'NEEDS_ATTENTION') : 'NOT_STARTED') as any,
      isCompleted: netWeighingObservations.length > 0,
    };

    // 7. Static Temperature
    const tempTest = sessionTests.find((st: any) => st.test_type === 'STATIC_TEMP' || st.test_type === 'TEMPERATURE');
    const tempObsRows = tempTest?.test_observations || [];
    const staticTemperatureObservations = tempObsRows.map((obs: any) => ({
      id: obs.id,
      stepIndex: obs.run_number || 1,
      temperature: Number(obs.reference_value),
      indicatedValue: Number(obs.indicated_value),
      error: Number(obs.raw_error_value ?? 0),
      passed: obs.result === 'WITHIN_LIMIT',
    }));

    // 8. Environmental Conditions
    const envConditions = row.raw_metadata?.environmentalConditions || row.environmental_conditions || {};

    const sessionObj: TestSession = {
      id: row.session_code || row.id,
      instrumentId: row.instrument_id || '',
      instrumentModel: instrument?.model || row.instrument_code || 'Precision Weighing Unit',
      serialNumber: instrument?.serial_number || 'SN-2026',
      manufacturer: instrument?.manufacturer || 'Mettler Toledo Ltd.',
      accuracyClass: (instrument?.accuracy_class ? (instrument.accuracy_class.startsWith('Class') ? instrument.accuracy_class : `Class ${instrument.accuracy_class}`) : 'Class III') as any,
      maxCapacity: `${instrument?.max_capacity || 30} ${instrument?.max_unit || 'kg'}`,
      verificationInterval: `${instrument?.verification_interval_e || 5} ${instrument?.verification_interval_e_unit || 'g'}`,
      startedOn: row.started_at ? new Date(row.started_at).toLocaleString() : new Date().toLocaleString(),
      completedOn: row.finalized_at ? new Date(row.finalized_at).toLocaleString() : undefined,
      progress: 0,
      status: mapWorkflowToDisplayStatus(row.workflow_status),
      workflowStatus: row.workflow_status as WorkflowStatus,
      testContext: row.test_context || 'TYPE_EXAMINATION',
      assignedOfficer: 'Dr. Ananya Rao',
      ambientTemp: row.ambient_temp ?? envConditions.start?.temp ?? 22.0,
      relativeHumidity: row.relative_humidity ?? envConditions.start?.humidity ?? 50,
      barometricPressure: row.barometric_pressure ?? envConditions.start?.pressure ?? 1013.2,
      environmentalConditions: envConditions,
      weighingObservations,
      repeatabilityObservations,
      eccentricityObservations,
      discriminationObservations,
      zeroSettingObservations,
      tareObservations: netWeighingObservations,
      tareTestSession,
      staticTemperatureObservations,
    };

    const { progressPercentage } = calculateSessionProgress(sessionObj);
    sessionObj.progress = progressPercentage;

    return sessionObj;
  },
};

export function canEditTestSession(session: TestSession, role: UserRole): boolean {
  const ws = session.workflowStatus || normalizeWorkflowStatus(session);
  if (ws === 'FINALIZED') return false;
  if (role === 'Testing Officer' || role === 'ADMIN') {
    return ws === 'DRAFT' || ws === 'IN_PROGRESS' || ws === 'CHANGES_REQUESTED';
  }
  return false;
}

export function canSubmitForReview(session: TestSession, role: UserRole): boolean {
  if (role !== 'Testing Officer' && role !== 'ADMIN') return false;
  const ws = session.workflowStatus || normalizeWorkflowStatus(session);
  return ws === 'DRAFT' || ws === 'IN_PROGRESS' || ws === 'CHANGES_REQUESTED' || ws === 'TESTING_COMPLETE';
}

export function canTechnicalReview(session: TestSession, role: UserRole): boolean {
  if (role !== 'Technical Reviewer' && role !== 'ADMIN') return false;
  const ws = session.workflowStatus || normalizeWorkflowStatus(session);
  return ws === 'UNDER_REVIEW';
}

export function canDirectorApprove(session: TestSession, role: UserRole): boolean {
  if (role !== 'Approving Officer / Lab Director' && role !== 'ADMIN') return false;
  const ws = session.workflowStatus || normalizeWorkflowStatus(session);
  return ws === 'TECHNICALLY_APPROVED' || ws === 'APPROVED';
}

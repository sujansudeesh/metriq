import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Report, TestSession } from '../types';
import { getReportsStore } from '../mock/store';
import { testSessionService } from './testSessionService';
import { pdfGeneratorService } from './pdfGeneratorService';
import { auditService } from './auditService';

export interface ReportVersionRecord {
  id: string;
  reportId: string;
  versionNumber: number;
  sessionSnapshot: TestSession;
  generatedBy?: string;
  generatedByName?: string;
  generatedAt: string;
  storagePath: string;
  status: 'DRAFT' | 'APPROVED' | 'FINAL';
  signedUrl?: string;
}

export const reportService = {
  /**
   * Build immutable snapshot data from a test session for report issuance
   */
  createSnapshotData(session: TestSession): any {
    const sessionCode = session.session_code || session.id;
    return {
      reportNumber: `REP-${sessionCode}`,
      versionNumber: 1,
      ruleStandard: 'OIML R 76-1:2006',
      ruleVersion: '2006',
      issuedAt: session.finalizedAt || new Date().toISOString(),
      workflowStatusAtIssue: session.workflowStatus || 'FINALIZED',
      evaluationResult: session.overallEvaluationResult || session.overallVerdict || 'COMPLIANT',
      instrument: {
        id: session.instrumentId,
        code: session.instrumentId,
        model: session.instrumentModel,
        manufacturer: session.manufacturer,
        serialNumber: session.serialNumber,
        accuracyClass: session.accuracyClass,
        maxCapacity: session.maxCapacity,
        verificationInterval: session.verificationInterval,
        scaleInterval: session.scaleInterval,
      },
      session: {
        id: session.id,
        sessionCode: sessionCode,
        testContext: session.testContext || 'INITIAL_VERIFICATION',
        verificationMode: session.verificationMode || 'INITIAL_VERIFICATION',
        startedOn: session.startedOn,
        completedOn: session.completedOn || new Date().toISOString(),
      },
      workflow: {
        testingOfficer: session.assignedOfficer || 'Metrology Officer',
        technicalReviewer: session.reviewer || session.reviewedBy || 'Technical Reviewer',
        approvingOfficer: session.approver || session.approvedBy || session.labDirector || 'Laboratory Director',
        finalizedBy: session.finalizedBy || session.approver,
        submittedAt: session.submittedAt,
        reviewedAt: session.reviewedAt,
        approvedAt: session.approvedAt,
        finalizedAt: session.finalizedAt || new Date().toISOString(),
        workflowHistory: session.workflowHistory || [],
      },
      observations: {
        weighing: session.weighingObservations || [],
        repeatability: session.repeatabilityObservations || [],
        eccentricity: session.eccentricityObservations || [],
        discrimination: session.discriminationObservations || [],
        zeroSetting: session.zeroSettingObservations || [],
        tare: session.tareObservations || [],
        environmentalConditions: session.environmentalConditions || {},
      },
      evaluation: {
        overallVerdict: session.overallVerdict || 'COMPLIANT',
        overallEvaluationResult: session.overallEvaluationResult || 'COMPLIANT',
        progress: session.progress || 100,
      },
    };
  },

  /**
   * Generate & persist an immutable final report snapshot upon session finalization
   */
  async generateFinalReportSnapshot(session: TestSession): Promise<Report> {
    const snapshot = this.createSnapshotData(session);
    const reportNumber = snapshot.reportNumber;
    const certificateId = `CERT-IN-2026-${session.id.substring(0, 4).toUpperCase()}`;

    let reportDbId = `REP-${session.id}`;

    if (isSupabaseConfigured() && supabase) {
      // Idempotency check: prevent duplicate Version 1 creation
      const { data: existing } = await supabase
        .from('reports')
        .select('*, test_sessions(*, instruments(*))')
        .or(`session_id.eq.${session.id},report_number.eq.${reportNumber}`)
        .maybeSingle();

      if (existing) {
        return this.mapRowToReport(existing);
      }

      const { data, error } = await supabase
        .from('reports')
        .insert({
          report_number: reportNumber,
          session_id: session.id,
          version_number: 1,
          status: 'FINALIZED',
          evaluation_result: snapshot.evaluationResult === 'NON_COMPLIANT' ? 'NON_COMPLIANT' : 'COMPLIANT',
          workflow_status_at_issue: 'FINALIZED',
          rule_standard: 'OIML R 76-1:2006',
          rule_version: '2006',
          snapshot_data: snapshot,
          finalized_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save finalized report to Supabase DB: ${error.message}`);
      }

      reportDbId = data.id;

      // Also record Version 1 record in report_versions
      try {
        await supabase.from('report_versions').insert({
          report_id: data.id,
          version_number: 1,
          snapshot_data: snapshot,
          status: 'FINAL',
        });
      } catch (_verErr) {}
    }

    const finalReport: Report = {
      id: reportDbId,
      reportNumber,
      certificateId,
      testSessionId: session.id,
      instrumentId: session.instrumentId,
      instrumentModel: session.instrumentModel,
      manufacturer: session.manufacturer,
      accuracyClass: session.accuracyClass,
      issueDate: new Date().toISOString().split('T')[0],
      status: 'Finalized',
      testingOfficer: snapshot.workflow.testingOfficer,
      technicalReviewer: snapshot.workflow.technicalReviewer,
      labDirector: snapshot.workflow.approvingOfficer,
      verdict: snapshot.evaluation.overallVerdict === 'NON_COMPLIANT' ? 'Non-Compliant' : 'Compliant',
      versionNumber: 1,
      snapshotData: snapshot,
    };

    // Log Audit Event
    try {
      await auditService.logAuditEvent({
        sessionId: session.id,
        action: 'REPORT_FINALIZED',
        entityType: 'report',
        entityId: finalReport.id,
        details: {
          description: `Finalized OIML R 76 Test Evaluation Report ${reportNumber} (Version 1)`,
          reportNumber,
          versionNumber: 1,
        },
      });
    } catch (_auditErr) {}

    return finalReport;
  },
  /**
   * Get all reports
   */
  async getReports(): Promise<Report[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*, test_sessions(*, instruments(*))')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((row) => this.mapRowToReport(row));
      }
    }

    return getReportsStore();
  },

  /**
   * Get report by Session ID or Report ID
   */
  async getReportBySessionId(sessionId: string): Promise<Report | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .select('*, test_sessions(*, instruments(*))')
        .or(`session_id.eq.${sessionId},id.eq.${sessionId},report_code.eq.${sessionId}`)
        .maybeSingle();

      if (!error && data) {
        return this.mapRowToReport(data);
      }
    }

    const reports = getReportsStore();
    return reports.find((r) => r.testSessionId === sessionId || r.id === sessionId || r.reportNumber === sessionId) || null;
  },

  /**
   * Generate & Store Real Report PDF + Version Snapshot
   */
  async generateRealReport(
    sessionId: string,
    userProfile?: { id: string; name?: string; fullName?: string; role: string },
    statusOverride?: 'DRAFT' | 'APPROVED' | 'FINAL'
  ): Promise<{ report: Report; pdfUrl: string; pdfBytes: Uint8Array }> {
    // 1. Fetch authoritative session data from backend service
    const session = (await testSessionService.getAllSessionsAsync()).find((s) => s.id === sessionId) || testSessionService.getSession(sessionId);

    if (!session) {
      throw new Error('Test session not found. Cannot generate report.');
    }

    const isFinalized = session.workflowStatus === 'FINALIZED';
    const isApproved = session.workflowStatus === 'APPROVED' || session.workflowStatus === 'TECHNICALLY_APPROVED';

    const status: 'DRAFT' | 'APPROVED' | 'FINAL' = statusOverride || (isFinalized ? 'FINAL' : isApproved ? 'APPROVED' : 'DRAFT');

    // 2. Safe report & certificate ID formatting
    const existingReport = await this.getReportBySessionId(sessionId);
    const reportCode = existingReport?.reportNumber || `NAWI-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const certificateId = existingReport?.certificateId || `CERT-IN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Determine next version number
    let nextVersion = 1;
    let reportDbId = existingReport?.id;

    if (isSupabaseConfigured() && supabase && reportDbId) {
      const { count } = await supabase
        .from('report_versions')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', reportDbId);

      if (count !== null) {
        nextVersion = count + 1;
      }
    }

    // 4. Generate REAL PDF binary using pdfGeneratorService
    const pdfBytes = await pdfGeneratorService.generateReportPDF({
      session,
      reportCode,
      certificateId,
      status,
      testingOfficerName: session.assignedOfficer || 'Dr. Ananya Rao',
      reviewerName: session.reviewer || session.reviewedBy || 'Vikramaditya Verma',
      approverName: session.approver || session.approvedBy || session.finalizedBy || 'Dr. K. S. Murthy',
    });

    const storagePath = `sessions/${sessionId}/reports/${reportCode}_v${nextVersion}.pdf`;
    let signedUrl = '';

    // 5. Upload PDF to Supabase Storage & insert records if configured
    if (isSupabaseConfigured() && supabase) {
      const { error: uploadErr } = await supabase.storage
        .from('generated-reports')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadErr) {
        console.warn('Failed to upload PDF to generated-reports bucket:', uploadErr);
      } else {
        const { data: urlData } = await supabase.storage
          .from('generated-reports')
          .createSignedUrl(storagePath, 86400); // 24 hour URL
        signedUrl = urlData?.signedUrl || '';
      }

      // Upsert report row
      const { data: dbReport, error: repErr } = await supabase
        .from('reports')
        .upsert({
          report_code: reportCode,
          session_id: sessionId,
          report_status: status === 'FINAL' ? 'FINALIZED' : status === 'APPROVED' ? 'APPROVED' : 'DRAFT',
          evaluation_result: session.overallEvaluationResult || 'UNDER_EVALUATION',
          generated_by: userProfile?.id,
          report_data: {
            certificateId,
            reportNumber: reportCode,
            storagePath,
            pdfUrl: signedUrl,
          },
        }, { onConflict: 'report_code' })
        .select()
        .single();

      if (!repErr && dbReport) {
        reportDbId = dbReport.id;
        // Insert report_versions snapshot
        await supabase.from('report_versions').insert({
          report_id: dbReport.id,
          version_number: nextVersion,
          session_snapshot: session,
          generated_by: userProfile?.id,
          storage_path: storagePath,
          status,
        });
      }
    }

    // Local Blob URL fallback
    if (!signedUrl) {
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      signedUrl = URL.createObjectURL(blob);
    }

    const reportResult: Report = {
      id: reportDbId || `REP-2026-${Math.floor(100 + Math.random() * 900)}`,
      reportNumber: reportCode,
      certificateId,
      testSessionId: sessionId,
      instrumentId: session.instrumentId,
      instrumentModel: session.instrumentModel,
      manufacturer: session.manufacturer,
      accuracyClass: session.accuracyClass,
      issueDate: new Date().toISOString().split('T')[0],
      status: status === 'FINAL' ? 'Finalized' : status === 'APPROVED' ? 'Approved' : 'Draft',
      testingOfficer: session.assignedOfficer || 'Dr. Ananya Rao',
      technicalReviewer: session.reviewer || 'Vikramaditya Verma',
      labDirector: session.approver || 'Dr. K. S. Murthy',
      verdict: session.overallEvaluationResult === 'NON_COMPLIANT' ? 'Non-Compliant' : 'Compliant',
      downloadUrl: signedUrl,
    };

    // Log Audit Event
    await auditService.logAuditEvent({
      userId: userProfile?.id,
      sessionId,
      action: status === 'FINAL' ? 'Report Finalized' : 'Report Generated',
      entityType: 'REPORT',
      entityId: reportResult.id,
      details: `Generated ${status} report PDF v${nextVersion} (${reportCode})`,
      userFullName: userProfile?.name,
      userRole: userProfile?.role,
    });

    return { report: reportResult, pdfUrl: signedUrl, pdfBytes };
  },

  /**
   * Fetch version history for a report
   */
  async getReportVersions(reportId: string): Promise<ReportVersionRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('report_versions')
        .select('*, profiles(full_name)')
        .eq('report_id', reportId)
        .order('version_number', { ascending: false });

      if (!error && data) {
        return Promise.all(
          data.map(async (row) => {
            let signedUrl = '';
            if (row.storage_path) {
              const { data: urlData } = await supabase!.storage
                .from('generated-reports')
                .createSignedUrl(row.storage_path, 3600);
              signedUrl = urlData?.signedUrl || '';
            }
            return {
              id: row.id,
              reportId: row.report_id,
              versionNumber: row.version_number,
              sessionSnapshot: row.session_snapshot,
              generatedBy: row.generated_by,
              generatedByName: row.profiles?.full_name || 'System Officer',
              generatedAt: row.generated_at,
              storagePath: row.storage_path,
              status: row.status as any,
              signedUrl,
            };
          })
        );
      }
    }

    return [];
  },

  /**
   * Save Report object
   */
  async saveReport(report: Report): Promise<Report> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('reports')
        .upsert({
          report_code: report.reportNumber,
          session_id: report.testSessionId,
          report_status: report.status.toUpperCase(),
          evaluation_result: report.verdict === 'Compliant' ? 'COMPLIANT' : 'NON_COMPLIANT',
          report_data: report,
        }, { onConflict: 'report_code' })
        .select()
        .single();

      if (!error && data) {
        return this.mapRowToReport(data);
      }
    }

    return report;
  },

  /**
   * Map DB Row to Report object
   */
  mapRowToReport(row: any): Report {
    const session = row.test_sessions;
    const instrument = session?.instruments;

    return {
      id: row.id,
      reportNumber: row.report_code || `REP-${row.id.substring(0, 8)}`,
      certificateId: row.report_data?.certificateId || `CERT-IN-2026-${row.id.substring(0, 4)}`,
      testSessionId: row.session_id,
      instrumentId: session?.instrument_id || row.report_data?.instrumentId || '',
      instrumentModel: instrument?.model || row.report_data?.instrumentModel || 'Instrument Standard',
      manufacturer: instrument?.manufacturer || row.report_data?.manufacturer || 'Metrology Manufacturer',
      accuracyClass: instrument?.accuracy_class || row.report_data?.accuracyClass || 'Class III',
      issueDate: (row.created_at || new Date().toISOString()).substring(0, 10),
      status: (row.report_status === 'FINALIZED' ? 'Finalized' : row.report_status === 'APPROVED' ? 'Approved' : 'Draft') as any,
      testingOfficer: row.report_data?.testingOfficer || 'Dr. Ananya Rao',
      technicalReviewer: row.report_data?.technicalReviewer || 'Vikramaditya Verma',
      labDirector: row.report_data?.labDirector || 'Dr. K. S. Murthy',
      verdict: row.evaluation_result === 'COMPLIANT' ? 'Compliant' : 'Non-Compliant',
      downloadUrl: row.report_data?.pdfUrl,
    };
  },
};

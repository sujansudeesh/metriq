import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  RotateCcw,
  ChevronRight,
  Clock,
  AlertTriangle,
  FileCheck2,
  Plus,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { StartTestWizardModal } from '../components/test/StartTestWizardModal';
import { authService } from '../services/authService';
import { User, TestSession, Report } from '../types';
import { testSessionService } from '../services/testSessionService';
import { reportService } from '../services/reportService';
import { calculateSessionProgress, getFriendlyWorkflowStatus } from '../services/evaluationResultService';
import { MetriqLogo } from '../components/common/MetriqLogo';
import { useTranslation } from 'react-i18next';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [testSessions, setTestSessions] = useState<TestSession[]>(() => testSessionService.getAllSessions());
  const [reports, setReports] = useState<Report[]>([]);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const handleSync = async () => {
      const user = await authService.getCurrentUser();
      if (isMounted && user) {
        setAuthUser(user);
      }
      const fetchedSessions = await testSessionService.getAllSessionsAsync();
      const fetchedReports = await reportService.getReports();
      if (isMounted) {
        setTestSessions(fetchedSessions);
        setReports(fetchedReports);
      }
    };

    handleSync();

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (isMounted) {
        setAuthUser(user);
      }
    });

    window.addEventListener('nawi_session_updated', handleSync);
    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('nawi_session_updated', handleSync);
    };
  }, []);

  const activeRole = authUser?.role || 'TESTING_OFFICER';

  // Find active session in progress for current officer
  const activeSession = testSessions.find(
    (s) => s.workflowStatus === 'IN_PROGRESS' || s.workflowStatus === 'DRAFT' || s.status === 'In Progress'
  );

  // Role-based queues
  const returnedForCorrectionSessions = testSessions.filter((s) => s.workflowStatus === 'CHANGES_REQUESTED');
  const awaitingReviewSessions = testSessions.filter(
    (s) => s.workflowStatus === 'TESTING_COMPLETE' || s.workflowStatus === 'UNDER_REVIEW'
  );
  const awaitingApprovalSessions = testSessions.filter(
    (s) => s.workflowStatus === 'TECHNICALLY_APPROVED' || s.workflowStatus === 'APPROVED'
  );
  const myActiveSessions = testSessions.filter(
    (s) => s.workflowStatus === 'IN_PROGRESS' || s.workflowStatus === 'DRAFT' || s.status === 'In Progress'
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8 font-sans text-[#1A1F2B]">
      {/* 1. TOP WELCOME AREA & TWO MAJOR ACTIONS */}
      <div className="bg-white p-6 md:p-8 rounded-xl border border-[#D9D3C7] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-extrabold text-[#C8A46B] uppercase tracking-wider block mb-1">
              METRIQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A] tracking-tight">
              Good Morning, {authUser?.name || 'Metrology Officer'}
            </h2>
            <p className="text-xs text-[#5F6B7A] mt-1">
              Role: <span className="font-semibold text-[#0B1F3A]">{activeRole.replace('_', ' ')}</span>
            </p>
          </div>
        </div>

        {/* TWO MAJOR ACTION BUTTONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="py-4 px-6 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-extrabold text-sm rounded-xl border border-[#C8A46B]/40 shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <PlayCircle className="w-5 h-5 text-[#C8A46B]" />
            <span>{t('dashboard.startNewTest')}</span>
          </button>

          {activeSession ? (
            <button
              onClick={() => navigate(`/test-sessions/${activeSession.id}`)}
              className="py-4 px-6 bg-[#C8A46B] hover:bg-[#B79055] text-[#08162A] font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5 text-[#08162A]" />
              <span>{t('dashboard.continueTest')}</span>
            </button>
          ) : (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="py-4 px-6 bg-[#F4ECDD] hover:bg-[#E8DCC4] text-[#0B1F3A] font-extrabold text-sm rounded-xl border border-[#D9D3C7] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-[#0B1F3A]" />
              <span>{t('dashboard.registerInstrument')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CURRENT TEST CARD */}
      <div className="bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F6B7A] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0B1F3A]" />
          CURRENT TEST
        </h3>

        {activeSession ? (
          <div className="bg-[#F9F9F7] p-5 rounded-lg border border-[#D9D3C7] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 text-xs">
              <div className="space-y-0.5">
                <span className="font-extrabold text-base text-[#0B1F3A] block">{activeSession.instrumentModel}</span>
                <span className="text-[11px] text-[#5F6B7A] font-mono block">
                  Serial No: <strong className="text-[#0B1F3A]">{activeSession.serialNumber}</strong> • Test ID:{' '}
                  <strong className="text-[#0B1F3A]">{activeSession.id}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div>
                  <span className="text-[10px] text-[#5F6B7A] uppercase block font-semibold">Current Step</span>
                  <span className="font-bold text-[#0B1F3A]">Eccentricity Test</span>
                </div>
                <div className="h-6 w-px bg-[#D9D3C7] hidden sm:block" />
                <div>
                  <span className="text-[10px] text-[#5F6B7A] uppercase block font-semibold">Progress</span>
                  <span className="font-bold text-[#0B1F3A]">
                    {calculateSessionProgress(activeSession).completedCount} of{' '}
                    {calculateSessionProgress(activeSession).totalCount} tests completed (
                    {calculateSessionProgress(activeSession).progressPercentage}%)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/test-sessions/${activeSession.id}`)}
              className="px-6 py-2.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 shrink-0 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>CONTINUE</span>
              <ChevronRight className="w-4 h-4 text-[#C8A46B]" />
            </button>
          </div>
        ) : (
          <div className="p-6 text-center bg-[#F9F9F7] rounded-lg border border-[#D9D3C7] space-y-3">
            <p className="text-xs text-[#5F6B7A] font-medium">No test currently in progress.</p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-5 py-2 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 cursor-pointer inline-flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4 text-[#C8A46B]" />
              <span>START NEW TEST</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. ROLE-BASED DASHBOARD WORKFLOW QUEUES */}

      {/* TESTING OFFICER QUEUES */}
      {(activeRole === 'TESTING_OFFICER' || activeRole === 'Testing Officer') && (
        <div className="space-y-6">
          {/* Returned for Correction (if any) */}
          {returnedForCorrectionSessions.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Tests Returned for Correction ({returnedForCorrectionSessions.length})
                </h3>
              </div>
              <div className="space-y-2">
                {returnedForCorrectionSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/test-sessions/${s.id}`)}
                    className="p-3 bg-white border border-rose-200 rounded-lg flex items-center justify-between hover:border-rose-400 cursor-pointer text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#0B1F3A] block">{s.instrumentModel}</span>
                      <span className="text-[11px] text-[#5F6B7A] font-mono">Test ID: {s.id}</span>
                    </div>
                    <button className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded">
                      Fix Issues
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Tests List */}
          <div className="bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#D9D3C7] pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A]">My Active Tests</h3>
              <Link to="/test-sessions" className="text-xs font-bold text-[#C8A46B] hover:underline">
                View All
              </Link>
            </div>

            {myActiveSessions.length > 0 ? (
              <div className="space-y-2">
                {myActiveSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/test-sessions/${s.id}`)}
                    className="p-3.5 bg-[#F9F9F7] hover:bg-[#F4ECDD]/40 border border-[#D9D3C7] rounded-lg flex items-center justify-between cursor-pointer text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-[#0B1F3A] block">{s.instrumentModel}</span>
                      <span className="text-[11px] text-[#5F6B7A] font-mono">
                        S/N: {s.serialNumber} • ID: {s.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#0B1F3A]">
                        {getFriendlyWorkflowStatus(s.workflowStatus)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#5F6B7A]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5F6B7A] italic py-3">No tests currently require your attention.</p>
            )}
          </div>
        </div>
      )}

      {/* TECHNICAL REVIEWER QUEUES */}
      {(activeRole === 'TECHNICAL_REVIEWER' || activeRole === 'Technical Reviewer') && (
        <div className="bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D9D3C7] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A]">Tests Awaiting Technical Review</h3>
            <span className="text-xs font-bold text-[#C8A46B]">{awaitingReviewSessions.length} Pending</span>
          </div>

          {awaitingReviewSessions.length > 0 ? (
            <div className="space-y-2">
              {awaitingReviewSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/test-sessions/${s.id}`)}
                  className="p-3.5 bg-[#F9F9F7] hover:bg-[#F4ECDD]/40 border border-[#D9D3C7] rounded-lg flex items-center justify-between cursor-pointer text-xs transition-colors"
                >
                  <div>
                    <span className="font-bold text-[#0B1F3A] block">{s.instrumentModel}</span>
                    <span className="text-[11px] text-[#5F6B7A] font-mono">
                      Testing Officer: {s.assignedOfficer} • Test ID: {s.id}
                    </span>
                  </div>
                  <button className="px-3.5 py-1.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded border border-[#C8A46B]/40">
                    Review Test
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5F6B7A] italic py-3">No tests currently require your technical review.</p>
          )}
        </div>
      )}

      {/* LAB DIRECTOR QUEUES */}
      {(activeRole === 'LAB_DIRECTOR' || activeRole === 'Approving Officer / Lab Director') && (
        <div className="bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#D9D3C7] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B1F3A]">Evaluations Awaiting Director Approval</h3>
            <span className="text-xs font-bold text-[#C8A46B]">{awaitingApprovalSessions.length} Pending</span>
          </div>

          {awaitingApprovalSessions.length > 0 ? (
            <div className="space-y-2">
              {awaitingApprovalSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/test-sessions/${s.id}`)}
                  className="p-3.5 bg-[#F9F9F7] hover:bg-[#F4ECDD]/40 border border-[#D9D3C7] rounded-lg flex items-center justify-between cursor-pointer text-xs transition-colors"
                >
                  <div>
                    <span className="font-bold text-[#0B1F3A] block">{s.instrumentModel}</span>
                    <span className="text-[11px] text-[#5F6B7A] font-mono">
                      Manufacturer: {s.manufacturer} • Certificate Ready
                    </span>
                  </div>
                  <button className="px-3.5 py-1.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded border border-[#C8A46B]/40">
                    Approve Certificate
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5F6B7A] italic py-3">No tests currently require your approval.</p>
          )}
        </div>
      )}

      {/* Start New Test Setup Wizard Modal */}
      <StartTestWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
};

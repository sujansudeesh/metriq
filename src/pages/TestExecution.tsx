import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Scale,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldCheck,
  Award,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/common/Badge';
import { getTestSessionsStore, updateTestSession, addAuditLog, getReportsStore, getInstrumentsStore } from '../mock/store';
import { authService } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { testObservationService } from '../services/testObservationService';
import {
  testSessionService,
  canEditTestSession,
  canSubmitForReview,
  canTechnicalReview,
  canDirectorApprove,
  getWorkflowStatusLabel,
} from '../services/testSessionService';
import {
  calculateEccentricityError,
  validateScaleReadingSanity,
  OIML_ENGINE_NOTICE,
} from '../utils/oimlEngine';
import { evaluateMPEScaleReading, calculateMPE, MPECheckResult } from '../services/oimlComplianceService';
import {
  calculateEccentricityTestLoad,
  getEccentricityPositions,
  validateEccentricityScaleReading,
  evaluateEccentricityPosition,
  evaluateOverallEccentricity,
} from '../services/eccentricityService';
import {
  isDigitalDiscriminationApplicable,
  calculateOneTenthD,
  calculateOnePointFourD,
  getDiscriminationTestPoints,
  evaluateOverallDiscrimination,
} from '../services/discriminationService';
import {
  calculateOneTenthE,
  calculateQuarterE,
  calculateHalfE,
  evaluateZeroSettingAccuracy,
  isZeroSettingProcedureApplicable,
} from '../services/zeroSettingService';
import { convertMassUnit, calculateVerificationIntervals, calculateTestProgress } from '../utils/metrologyService';
import { calculateSessionProgress, calculateOverallEvaluationResult, isSessionReadyForReview } from '../services/evaluationResultService';
import { MPECalculationExplanationPanel } from '../components/test/MPECalculationExplanationPanel';
import { WeighingTestObservation, EccentricityTestObservation, DiscriminationTestObservation, ZeroSettingTestObservation, TareSettingObservation, TareNetWeighingObservation, TareTestSession, UserRole, Report, MassUnit } from '../types';
import { EccentricityPlatform } from '../components/test/EccentricityPlatform';
import { DiscriminationWizard } from '../components/test/DiscriminationWizard';
import { ZeroSettingWizard } from '../components/test/ZeroSettingWizard';
import { TareWizard } from '../components/test/TareWizard';
import { EvaluationTestPlanView } from '../components/test/EvaluationTestPlanView';
import { StaticTemperatureWizard } from '../components/test/StaticTemperatureWizard';
import { DisturbanceModulesView } from '../components/test/DisturbanceModulesView';
import { OIMLWeighingSheet } from '../components/test/OIMLWeighingSheet';
import { OIMLEccentricitySheet } from '../components/test/OIMLEccentricitySheet';
import { OIMLRepeatabilitySheet } from '../components/test/OIMLRepeatabilitySheet';
import { OIMLDiscriminationSheet } from '../components/test/OIMLDiscriminationSheet';
import { OIMLZeroSheet } from '../components/test/OIMLZeroSheet';
import { OIMLTareSheet } from '../components/test/OIMLTareSheet';
import { OIMLTemperatureSheet } from '../components/test/OIMLTemperatureSheet';
import { useToast } from '../components/common/Toast';

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const TestExecution: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const sessions = getTestSessionsStore();
  const initialSession = sessions.find((s) => s.id === id) || sessions[0];
  const [session, setSession] = useState(initialSession);
  const currentInstrument = getInstrumentsStore().find((i) => i.id === session.instrumentId) || (session as any).instrument;

  // Active Role state from Database Auth Profile
  const [activeRole, setActiveRole] = useState<UserRole>('TESTING_OFFICER');

  const [reviewerCommentInput, setReviewerCommentInput] = useState('');
  const [showRequestChangesBox, setShowRequestChangesBox] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const handleSync = async () => {
      const user = await authService.getCurrentUser();
      if (isMounted && user) {
        setActiveRole(user.role);
      }

      if (id) {
        try {
          const latest = await testSessionService.getSessionByIdAsync(id);
          if (isMounted && latest) {
            setSession(latest);
          }
        } catch (err: any) {
          console.warn('Async session fetch fallback:', err.message);
          const fallback = testSessionService.getLatestSessionState(id);
          if (isMounted && fallback) setSession(fallback);
        }
      }
    };

    handleSync();

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (isMounted && user) {
        setActiveRole(user.role);
      }
    });

    window.addEventListener('nawi_session_updated', handleSync);
    return () => {
      isMounted = false;
      unsubscribe();
      window.removeEventListener('nawi_session_updated', handleSync);
    };
  }, [id]);

  const [searchParams] = useSearchParams();
  const validTabs = ['plan', 'zerosetting', 'tare', 'eccentricity', 'weighing', 'repeatability', 'discrimination', 'statictemp', 'disturbance', 'review'];
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<
    'plan' | 'zerosetting' | 'tare' | 'eccentricity' | 'weighing' | 'repeatability' | 'discrimination' | 'statictemp' | 'disturbance' | 'review'
  >(validTabs.includes(initialTab || '') ? (initialTab as any) : 'plan');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Sheet Handlers for Digital OIML Report Sheets
  const handleSaveWeighingObservationObj = async (newObs: WeighingTestObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'ACCURACY');
        if (stId) {
          await testObservationService.saveWeighingObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save weighing observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const filteredObs = (session.weighingObservations || []).filter(
      (o) => o.id !== newObs.id && (Math.abs(o.load - newObs.load) > 1e-6 || o.direction !== newObs.direction)
    );
    const updatedObs = [...filteredObs, newObs].sort((a, b) => a.load - b.load);

    const updatedSession = {
      ...session,
      weighingObservations: updatedObs,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save weighing observation to database.', 'error');
    } else {
      showToast('Observation Saved', `Reference load ${newObs.load} kg observation saved to official report sheet.`, 'success');
    }
  };

  const handleSaveEccentricityObservationObj = async (newObs: EccentricityTestObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'ECCENTRICITY');
        if (stId) {
          await testObservationService.saveEccentricityObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save eccentricity observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const filtered = (session.eccentricityObservations || []).filter((o) => o.position !== newObs.position);
    const updatedEcc = [...filtered, newObs].sort((a, b) => a.position - b.position);

    const updatedSession = {
      ...session,
      eccentricityObservations: updatedEcc,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save eccentricity observation to database.', 'error');
    } else {
      showToast('Position Reading Saved', `Position ${newObs.position} observation saved to eccentricity report sheet.`, 'success');
    }
  };

  const handleDeleteEccentricityObservation = (posId: number) => {
    const updatedEcc = (session.eccentricityObservations || []).filter((o) => o.position !== posId);
    const updatedSession = { ...session, eccentricityObservations: updatedEcc };
    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);
    showToast('Position Removed', `Position ${posId} observation cleared.`, 'info');
  };

  const handleSaveRepeatabilityObservationObj = async (newObs: any) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'REPEATABILITY');
        if (stId) {
          await testObservationService.saveRepeatabilityObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save repeatability observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const filtered = (session.repeatabilityObservations || []).filter(
      (o: any) => o.id !== newObs.id && o.runNumber !== newObs.runNumber
    );
    const updatedRep = [...filtered, newObs].sort((a: any, b: any) => a.runNumber - b.runNumber);

    const updatedSession = {
      ...session,
      repeatabilityObservations: updatedRep,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save repeatability observation to database.', 'error');
    } else {
      showToast('Repeatability Run Saved', `Run ${newObs.runNumber} recorded on report sheet.`, 'success');
    }
  };

  const handleDeleteRepeatabilityObservation = (runId: string) => {
    const updatedRep = (session.repeatabilityObservations || []).filter(
      (o: any) => o.id !== runId && o.runNumber?.toString() !== runId
    );
    const updatedSession = { ...session, repeatabilityObservations: updatedRep };
    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);
    showToast('Run Removed', 'Repeatability observation removed.', 'info');
  };

  const handleSaveTemperatureObservationObj = async (newObs: any) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'STATIC_TEMP');
        if (stId) {
          await testObservationService.saveStaticTemperatureObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save static temperature observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const filtered = (session.staticTemperatureObservations || []).filter(
      (o: any) => o.id !== newObs.id && o.stepIndex !== newObs.stepIndex
    );
    const updatedTemp = [...filtered, newObs].sort((a: any, b: any) => (a.stepIndex || 0) - (b.stepIndex || 0));

    const updatedSession = {
      ...session,
      staticTemperatureObservations: updatedTemp,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save temperature observation to database.', 'error');
    } else {
      showToast('Temperature Reading Saved', `Temperature ${newObs.temperature}°C observation recorded.`, 'success');
    }
  };

  // Zero-Setting Test State
  const zeroSettingType = session.zeroSettingType || 'SEMI_AUTOMATIC';

  const handleSaveZeroSettingObservation = async (newObs: ZeroSettingTestObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'ZERO_SETTING');
        if (stId) {
          await testObservationService.saveZeroSettingObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save zero-setting observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const updatedSession = {
      ...session,
      zeroSettingType,
      zeroSettingObservations: [newObs],
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    // Append Audit Log (Section 21)
    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Zero-setting Accuracy Test Completed',
      details: `Zero-setting type: ${newObs.zeroSettingType}, E0: ${newObs.calculatedZeroError > 0 ? '+' : ''}${newObs.calculatedZeroError} ${newObs.eUnit}, Result: ${newObs.passed ? 'Within Limit' : 'Exceeds Limit'}`,
      instrumentOrSessionId: session.id,
    });

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save zero setting observation to database.', 'error');
    } else {
      showToast(
        'Zero Setting Recorded',
        `E0: ${newObs.calculatedZeroError > 0 ? '+' : ''}${newObs.calculatedZeroError} ${newObs.eUnit} (${newObs.passed ? 'Within Limit' : 'Exceeds Limit'})`,
        newObs.passed ? 'success' : 'warning'
      );
    }
  };

  // Tare Test Handlers
  const handleSaveTareSetting = async (settingObs: TareSettingObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'TARE');
        if (stId) {
          await testObservationService.saveTareSettingObservation(stId, settingObs);
        }
      } catch (err: any) {
        console.error('Failed to save tare setting observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const prevTareSession: TareTestSession = session.tareTestSession || {
      tareType: 'SUBTRACTIVE',
      maximumTareEffect: 10,
      maximumTareUnit: 'kg',
      appliedTare: settingObs.appliedTareLoad,
      availableNetCapacity: 25,
      netWeighingObservations: [],
      isTareSettingCompleted: true,
      isNetWeighingCompleted: false,
      overallResult: 'NOT_STARTED',
      isCompleted: false,
    };

    const updatedTareSession: TareTestSession = {
      ...prevTareSession,
      appliedTare: settingObs.appliedTareLoad,
      tareSettingObservation: settingObs,
      isTareSettingCompleted: true,
    };

    const updatedSession = {
      ...session,
      tareTestSession: updatedTareSession,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Tare-Setting Accuracy Observation Saved',
      details: `Tare Load: ${settingObs.appliedTareLoad} ${settingObs.tareLoadUnit}, ET: ${settingObs.calculatedTareZeroError} g, Result: ${settingObs.resultStatus}`,
      instrumentOrSessionId: session.id,
    });

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save tare setting to database.', 'error');
    } else {
      showToast(
        'Tare-Setting Saved',
        `Applied Tare: ${settingObs.appliedTareLoad} ${settingObs.tareLoadUnit} (ET: ${settingObs.calculatedTareZeroError > 0 ? '+' : ''}${settingObs.calculatedTareZeroError} g)`,
        settingObs.passed ? 'success' : 'warning'
      );
    }
  };

  const handleSaveTareNetObservation = async (netObs: TareNetWeighingObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'TARE');
        if (stId) {
          await testObservationService.saveTareNetWeighingObservation(stId, netObs);
        }
      } catch (err: any) {
        console.error('Failed to save tare net observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const prevTareSession: TareTestSession = session.tareTestSession || {
      tareType: 'SUBTRACTIVE',
      maximumTareEffect: 10,
      maximumTareUnit: 'kg',
      appliedTare: netObs.appliedTareLoad,
      availableNetCapacity: 25,
      netWeighingObservations: [],
      isTareSettingCompleted: true,
      isNetWeighingCompleted: false,
      overallResult: 'NOT_STARTED',
      isCompleted: false,
    };

    const prevNetObs = prevTareSession.netWeighingObservations || [];
    const filteredObs = prevNetObs.filter((o) => o.stepIndex !== netObs.stepIndex);
    const updatedNetObs = [...filteredObs, netObs].sort((a, b) => a.stepIndex - b.stepIndex);

    const isNetCompleted = updatedNetObs.length >= 5;

    const updatedTareSession: TareTestSession = {
      ...prevTareSession,
      netWeighingObservations: updatedNetObs,
      isNetWeighingCompleted: isNetCompleted,
      tareObservations: updatedNetObs,
    } as any;

    const updatedSession = {
      ...session,
      tareTestSession: updatedTareSession,
      tareObservations: updatedNetObs,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Tare Net Weighing Observation Saved',
      details: `Step ${netObs.stepIndex}: Ref Net ${netObs.referenceNetLoad} kg, Disp ${netObs.displayedNetReading} kg, Error: ${netObs.netErrorFormatted}`,
      instrumentOrSessionId: session.id,
    });

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save net observation to database.', 'error');
    } else {
      showToast(
        'Net Observation Saved',
        `Point ${netObs.stepIndex} (${netObs.referenceNetLoad} kg NET): Net Error ${netObs.netErrorFormatted}`,
        netObs.passed ? 'success' : 'warning'
      );
    }
  };

  const handleCompleteTareTest = (overallResult: string) => {
    const prevTareSession = session.tareTestSession;
    if (!prevTareSession) return;

    const updatedTareSession: TareTestSession = {
      ...prevTareSession,
      overallResult: overallResult as any,
      isCompleted: true,
    };

    const updatedSession = {
      ...session,
      tareTestSession: updatedTareSession,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Tare Test Completed',
      details: `Overall Tare Result: ${overallResult}`,
      instrumentOrSessionId: session.id,
    });

    showToast(
      'Tare Test Completed',
      `Overall Result: ${overallResult.replace(/_/g, ' ')}`,
      overallResult === 'COMPLETED_WITHIN_LIMITS' ? 'success' : 'warning'
    );
  };

  // Discrimination Test State
  const [activeDiscPointId, setActiveDiscPointId] = useState<'MIN' | 'HALF_MAX' | 'MAX'>('HALF_MAX');

  const maxCapNum = parseFloat(session.maxCapacity) || 30;
  const minCapNum = 0.1;
  const { eVal: dVal, eUnit: dUnit } = parseVerificationInterval(session.verificationInterval);

  const discriminationPoints = getDiscriminationTestPoints(maxCapNum, minCapNum, 'kg');

  const getNextIncompleteDiscriminationPoint = (
    currentId: 'MIN' | 'HALF_MAX' | 'MAX',
    obs: DiscriminationTestObservation[]
  ) => {
    const ids: Array<'MIN' | 'HALF_MAX' | 'MAX'> = ['MIN', 'HALF_MAX', 'MAX'];
    const completedIds = obs.filter((o) => o.isCompleted || o.resultStatus).map((o) => o.testPointId);
    const nextId = ids.find((id) => id !== currentId && !completedIds.includes(id));
    if (nextId) return nextId;
    const firstIncomplete = ids.find((id) => !completedIds.includes(id));
    return firstIncomplete || ids[0];
  };

  const handleSaveDiscriminationObservation = async (newObs: DiscriminationTestObservation) => {
    let supabaseSaveFailed = false;
    if (isSupabaseConfigured() && session.id) {
      try {
        const stId = await testObservationService.getOrCreateSessionTest(session.id, 'DISCRIMINATION');
        if (stId) {
          await testObservationService.saveDiscriminationObservation(stId, newObs);
        }
      } catch (err: any) {
        console.error('Failed to save discrimination observation to Supabase:', err);
        supabaseSaveFailed = true;
      }
    }

    const filtered = (session.discriminationObservations || []).filter((o) => o.testPointId !== newObs.testPointId);
    const updatedDisc = [...filtered, newObs];

    const updatedSession = {
      ...session,
      discriminationObservations: updatedDisc,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    setSession(updatedSession);
    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);

    // Append Audit Log
    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Discrimination Point Completed',
      details: `Discrimination Test — ${newObs.testPointLabel} Completed (${newObs.resultStatus === 'CONFIRMED' ? 'Response Confirmed' : 'Not Observed'})`,
      instrumentOrSessionId: session.id,
    });

    if (supabaseSaveFailed) {
      showToast('Not saved. Retry.', 'Failed to save discrimination observation to database.', 'error');
    } else {
      showToast(
        'Test Point Recorded',
        `${newObs.testPointLabel}: ${newObs.resultStatus === 'CONFIRMED' ? '✓ Response Confirmed' : '✕ Not Observed'}`,
        newObs.passed ? 'success' : 'warning'
      );
    }

    // Append Audit Log
    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Discrimination Point Completed',
      details: `Discrimination Test — ${newObs.testPointLabel} Completed (${newObs.resultStatus === 'CONFIRMED' ? 'Response Confirmed' : 'Not Observed'})`,
      instrumentOrSessionId: session.id,
    });

    showToast(
      'Test Point Recorded',
      `${newObs.testPointLabel}: ${newObs.resultStatus === 'CONFIRMED' ? '✓ Response Confirmed' : '✕ Not Observed'}`,
      newObs.passed ? 'success' : 'warning'
    );

    // Auto-advance to next incomplete test point
    const nextPointId = getNextIncompleteDiscriminationPoint(newObs.testPointId, updatedDisc);
    setActiveDiscPointId(nextPointId);
  };

  const eccProfile = session.eccentricityProfile || 'STANDARD_UP_TO_4_SUPPORTS';
  const eccNumSupports = session.eccentricityNumSupports || 4;

  const initialEccTestLoad = session.eccentricityTestLoad || calculateEccentricityTestLoad({
    maxCapacity: parseFloat(session.maxCapacity) || 30,
    maxUnit: 'kg',
    profile: eccProfile,
    numSupports: eccNumSupports,
  });

  // Single Global Test Load for Eccentricity
  const [eccTestLoad, setEccTestLoad] = useState<number>(initialEccTestLoad);

  // Eccentricity Active Position & Reading Input
  const [eccPosition, setEccPosition] = useState<number>(1);
  const [scaleReadingInput, setScaleReadingInput] = useState<string>('10.000');
  const [notesInput, setNotesInput] = useState<string>('');

  // Verification Mode & Weighing Accuracy State
  const [verificationMode, setVerificationMode] = useState<'INITIAL_VERIFICATION' | 'IN_SERVICE'>('INITIAL_VERIFICATION');
  const [weighingRefLoadInput, setWeighingRefLoadInput] = useState<string>('10.000');
  const [weighingScaleReadingInput, setWeighingScaleReadingInput] = useState<string>('10.008');
  const [weighingDirection, setWeighingDirection] = useState<'Increasing' | 'Decreasing'>('Increasing');
  const [weighingNotesInput, setWeighingNotesInput] = useState<string>('');

  // Dynamic positions by load-receptor profile
  const activeEccPositions = getEccentricityPositions(eccProfile, eccNumSupports);
  const getPosConfig = (posId: number) => activeEccPositions.find((p) => p.id === posId) || activeEccPositions[0];

  // Find next incomplete eccentricity position in sequence
  const getNextIncompletePosition = (currentPos: number, currentObs: EccentricityTestObservation[]) => {
    const posIds = activeEccPositions.map((p) => p.id);
    const completedPositions = currentObs.map((o) => o.position);
    const nextPos = posIds.find((p) => p > currentPos && !completedPositions.includes(p));
    if (nextPos) return nextPos;
    const firstIncomplete = posIds.find((p) => !completedPositions.includes(p));
    return firstIncomplete || posIds[0];
  };

  // SAVE ECCENTRICITY READING WITH STRICT INPUT SANITY VALIDATION
  const handleSaveEccentricityReading = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scaleReadingInput || scaleReadingInput.trim() === '' || isNaN(Number(scaleReadingInput))) {
      showToast('Scale Reading Required', 'Enter the scale reading before continuing.', 'warning');
      return;
    }

    const readingVal = Number(scaleReadingInput);

    // Broad sanity check using eccentricityService
    const sanityCheck = validateEccentricityScaleReading(readingVal, eccTestLoad);
    if (!sanityCheck.isValid) {
      showToast('Invalid Reading', sanityCheck.errorMessage || 'Scale reading appears invalid. Please check the value and unit.', 'error');
      return;
    }

    const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);
    const posConfig = getPosConfig(eccPosition);

    const newEcc = evaluateEccentricityPosition({
      position: eccPosition,
      locationLabel: posConfig.label,
      testLoad: eccTestLoad,
      testLoadUnit: 'kg',
      scaleReading: readingVal,
      scaleReadingUnit: 'kg',
      accuracyClass: session.accuracyClass,
      verificationScaleIntervalE: eVal,
      eUnit,
      verificationMode: 'INITIAL_VERIFICATION',
    });

    const filteredEcc = session.eccentricityObservations.filter((obs) => obs.position !== eccPosition);
    const updatedEcc = [...filteredEcc, newEcc].sort((a, b) => a.position - b.position);

    const updatedSession = {
      ...session,
      eccentricityProfile: eccProfile,
      eccentricityTestLoad: eccTestLoad,
      eccentricityObservations: updatedEcc,
    };

    const progressResult = calculateTestProgress(updatedSession);
    updatedSession.progress = progressResult.percentage;

    handleSaveEccentricityObservationObj(newEcc);

    // Auto-advance focus to next position
    const nextPos = getNextIncompletePosition(eccPosition, updatedEcc);
    setEccPosition(nextPos);

    // Preset realistic default reading for next position if not already recorded
    const existingNext = updatedEcc.find((o) => o.position === nextPos);
    if (existingNext) {
      setScaleReadingInput(existingNext.indicatedValue.toString());
    } else {
      const calcVal = Number((eccTestLoad + (nextPos % 2 === 0 ? 0.002 : -0.001)).toFixed(3));
      setScaleReadingInput(calcVal.toString());
    }
  };

  // SAVE WEIGHING ACCURACY OBSERVATION WITH FULL METROLOGICAL VALIDATION
  const handleSaveWeighingObservation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!weighingRefLoadInput || weighingRefLoadInput.trim() === '' || isNaN(Number(weighingRefLoadInput))) {
      showToast('Invalid Reference Load', 'Reference load is required and must be a valid number.', 'warning');
      return;
    }

    if (!weighingScaleReadingInput || weighingScaleReadingInput.trim() === '' || isNaN(Number(weighingScaleReadingInput))) {
      showToast('Scale Reading Required', 'Enter the scale reading displayed on the instrument.', 'warning');
      return;
    }

    const refLoad = Number(weighingRefLoadInput);
    const readingVal = Number(weighingScaleReadingInput);

    if (refLoad <= 0) {
      showToast('Invalid Reference Load', 'Reference load must be greater than zero.', 'error');
      return;
    }

    if (readingVal < 0) {
      showToast('Invalid Scale Reading', 'Scale reading cannot be negative.', 'error');
      return;
    }

    const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);
    const registeredInst = getInstrumentsStore().find((i) => i.id === session.instrumentId);
    const maxCapacityVal = registeredInst?.metrology.maxCapacity ?? 30;
    const maxCapacityUnit = registeredInst?.metrology.maxUnit ?? 'kg';

    // Validate load does not exceed instrument Max Capacity
    const refLoadInMaxUnit = convertMassUnit(refLoad, 'kg', maxCapacityUnit);
    if (refLoadInMaxUnit > maxCapacityVal) {
      showToast('Capacity Exceeded', `Reference load (${refLoad} kg) exceeds maximum capacity (${maxCapacityVal} ${maxCapacityUnit}).`, 'error');
      return;
    }

    // Sanity check: Reject absurd entries (e.g. entering 20060 kg when reference load is 10 kg)
    if (!validateScaleReadingSanity(readingVal, refLoad)) {
      showToast('Invalid Reading', 'Scale reading appears invalid. Please check the value and unit.', 'error');
      return;
    }

    const mpeCheck = evaluateMPEScaleReading({
      referenceLoad: refLoad,
      referenceLoadUnit: 'kg',
      scaleReading: readingVal,
      scaleReadingUnit: 'kg',
      accuracyClass: session.accuracyClass,
      verificationScaleIntervalE: eVal,
      eUnit,
      verificationMode,
    });

    const newObs: WeighingTestObservation = {
      id: `wo-${Date.now()}`,
      load: refLoad,
      indicatedValue: readingVal,
      deltaL: 0,
      calculatedError: mpeCheck.indicatedDifference,
      adjustedError: mpeCheck.indicatedDifference,
      mpeLimit: mpeCheck.mpeResult.mpeValue,
      passed: mpeCheck.isPassed,
      direction: weighingDirection,
      mpeUnit: mpeCheck.mpeResult.mpeUnit,
      mpeStatus: mpeCheck.status,
      indicatedDifferenceFormatted: mpeCheck.indicatedDifferenceFormatted,
      notes: weighingNotesInput,
    };

    await handleSaveWeighingObservationObj(newObs);
  };

  const handleEditWeighingObservation = (obs: WeighingTestObservation) => {
    setWeighingRefLoadInput(obs.load.toString());
    setWeighingScaleReadingInput(obs.indicatedValue.toString());
    if (obs.direction) setWeighingDirection(obs.direction as 'Increasing' | 'Decreasing');
    if (obs.notes) setWeighingNotesInput(obs.notes);

    const updatedObs = session.weighingObservations.filter((o) => o.id !== obs.id);
    const updatedSession = { ...session, weighingObservations: updatedObs };
    setSession(updatedSession);
    updateTestSession(updatedSession);

    showToast('Editing Observation', `Loaded values for ${obs.load} kg. Update and click Add Observation.`, 'info');
  };

  const handleDeleteWeighingObservation = (obsId: string) => {
    const updatedObs = session.weighingObservations.filter((o) => o.id !== obsId);
    const updatedSession = { ...session, weighingObservations: updatedObs };
    setSession(updatedSession);
    updateTestSession(updatedSession);
    showToast('Observation Removed', 'Test point deleted.', 'info');
  };

  // Save Draft
  const handleSaveDraft = () => {
    updateTestSession(session);
    addAuditLog({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: activeRole === 'Testing Officer' ? 'Dr. Ananya Rao' : 'V. Verma',
      role: activeRole,
      action: 'Test Observation Saved',
      details: `Saved draft for session ${session.id}`,
      instrumentOrSessionId: session.id,
    });
    showToast('Draft Saved', 'Saved just now to local storage.', 'info');
  };

  // Role Action 1: Testing Officer Submits for Review (IN_PROGRESS -> TESTING_COMPLETE)
  const handleSubmitForReview = async () => {
    const readyCheck = isSessionReadyForReview(session);
    if (!readyCheck.isReady) {
      showToast('Cannot Submit Evaluation', readyCheck.blockingReason || 'Complete all required tests before submitting for technical review.', 'warning');
      return;
    }

    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'TESTING_COMPLETE', {
        user: user?.name || user?.email || 'Testing Officer',
        role: user?.role || activeRole,
        comments: 'All required test observations completed and verified. Submitted for senior technical review.',
      });
      if (updated) {
        setSession(updated);
        showToast('Submitted for Review', 'Testing complete. Session submitted for senior technical review.', 'success');
        setActiveTab('review');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to submit test session for review.', 'error');
    }
  };

  // Testing Officer Resumes Testing after Changes Requested (CHANGES_REQUESTED -> IN_PROGRESS)
  const handleResumeTesting = async () => {
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'IN_PROGRESS', {
        user: user?.name || user?.email || 'Testing Officer',
        role: user?.role || activeRole,
        comments: 'Testing officer resumed testing to make requested corrections.',
      });
      if (updated) {
        setSession(updated);
        showToast('Testing Resumed', 'Session status reset to In Progress for corrections.', 'info');
        setActiveTab('weighing');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to resume testing.', 'error');
    }
  };

  // Role Action 2: Technical Reviewer Claims Review (TESTING_COMPLETE -> UNDER_REVIEW)
  const handleClaimReview = async () => {
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'UNDER_REVIEW', {
        user: user?.name || user?.email || 'Technical Reviewer',
        role: user?.role || activeRole,
        comments: 'Technical reviewer claimed session for audit.',
      });
      if (updated) {
        setSession(updated);
        showToast('Review Started', 'Technical review claim recorded.', 'info');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to claim review.', 'error');
    }
  };

  // Role Action 3: Technical Reviewer Requests Changes (UNDER_REVIEW -> CHANGES_REQUESTED)
  const handleRequestChanges = async () => {
    if (!reviewerCommentInput.trim()) {
      showToast('Reason Required', 'Please enter a comment explaining the requested changes.', 'warning');
      return;
    }
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'CHANGES_REQUESTED', {
        user: user?.name || user?.email || 'Technical Reviewer',
        role: user?.role || activeRole,
        reason: reviewerCommentInput,
        comments: reviewerCommentInput,
      });
      if (updated) {
        setSession(updated);
        showToast('Changes Requested', 'Session returned to Testing Officer for corrections.', 'info');
        setReviewerCommentInput('');
        setShowRequestChangesBox(false);
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to request changes.', 'error');
    }
  };

  // Role Action 4: Technical Reviewer Approves (UNDER_REVIEW -> TECHNICALLY_APPROVED)
  const handleApproveReview = async () => {
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'TECHNICALLY_APPROVED', {
        user: user?.name || user?.email || 'Technical Reviewer',
        role: user?.role || activeRole,
        comments: reviewerCommentInput || 'Technical evaluation audited and approved.',
      });
      if (updated) {
        setSession(updated);
        showToast('Technical Review Approved', 'Technical review approved. Awaiting Laboratory Director sign-off.', 'success');
        setReviewerCommentInput('');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to approve technical review.', 'error');
    }
  };

  // Role Action 5: Director Approves Evaluation (TECHNICALLY_APPROVED -> APPROVED)
  const handleDirectorApprove = async () => {
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'APPROVED', {
        user: user?.name || user?.email || 'Laboratory Director',
        role: user?.role || activeRole,
        comments: reviewerCommentInput || 'Legal metrology type evaluation approved.',
      });
      if (updated) {
        setSession(updated);
        showToast('Evaluation Approved', 'Type evaluation approved by Laboratory Director.', 'success');
        setReviewerCommentInput('');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to approve evaluation.', 'error');
    }
  };

  // Director Requests Changes (TECHNICALLY_APPROVED -> CHANGES_REQUESTED)
  const handleDirectorRequestChanges = async () => {
    if (!reviewerCommentInput.trim()) {
      showToast('Reason Required', 'Please enter a comment explaining the requested changes.', 'warning');
      return;
    }
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'CHANGES_REQUESTED', {
        user: user?.name || user?.email || 'Laboratory Director',
        role: user?.role || activeRole,
        reason: reviewerCommentInput,
        comments: reviewerCommentInput,
      });
      if (updated) {
        setSession(updated);
        showToast('Changes Requested', 'Session returned to Testing Officer for corrections.', 'info');
        setReviewerCommentInput('');
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to request changes.', 'error');
    }
  };

  // Role Action 6: Director Finalizes & Signs Certificate (APPROVED -> FINALIZED)
  const handleFinalizeCertificate = async () => {
    try {
      const user = await authService.getCurrentUser();
      const updated = await testSessionService.updateWorkflowStatus(session.id, 'FINALIZED', {
        user: user?.name || user?.email || 'Laboratory Director',
        role: user?.role || activeRole,
        comments: 'Official Type Evaluation Certificate Issued.',
      });
      if (updated) {
        setSession(updated);
        showToast('Report Finalized', 'Evaluation finalized. Record is now read-only.', 'success');
        const reports = getReportsStore();
        const match = reports.find((r) => r.testSessionId === session.id);
        if (match) {
          navigate(`/reports/${match.id}`);
        }
      }
    } catch (err: any) {
      showToast('Workflow Update Failed', err.message || 'Failed to finalize certificate.', 'error');
    }
  };

  // SIH Demo Helper 1: Pre-fill Realistic OIML Compliant Test Observations
  const handlePreFillPassingDemoData = () => {
    const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

    const demoZeroObs: ZeroSettingTestObservation = {
      zeroSettingType: session.zeroSettingType || 'SEMI_AUTOMATIC',
      verificationIntervalE: eVal,
      eUnit,
      suggestedIncrement: Number((0.1 * eVal).toFixed(2)),
      changeoverAdditionalLoad: Number((0.4 * eVal).toFixed(1)),
      calculatedZeroError: Number((0.1 * eVal).toFixed(2)),
      permissibleZeroDeviation: Number((0.25 * eVal).toFixed(2)),
      passed: true,
      resultStatus: 'WITHIN_LIMIT',
      isCompleted: true,
    };

    const demoTareSetting: TareSettingObservation = {
      appliedTareLoad: 5,
      tareLoadUnit: 'kg',
      displayedIndicationAfterTare: 0,
      suggestedIncrement: Number((0.1 * eVal).toFixed(2)),
      changeoverAdditionalLoad: Number((0.4 * eVal).toFixed(1)),
      calculatedTareZeroError: Number((0.1 * eVal).toFixed(2)),
      permissibleTareZeroError: Number((0.25 * eVal).toFixed(2)),
      passed: true,
      resultStatus: 'WITHIN_LIMIT',
    };

    const demoTareNetObs: TareNetWeighingObservation[] = [
      { id: 'tno-1', stepIndex: 1, stepLabel: 'Point 1 (Min Load)', referenceNetLoad: 0.1, displayedNetReading: 0.1, calculatedGrossLoad: 5.1, netError: 0, netErrorFormatted: '0 g', mpeLimit: 5, mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', passed: true, appliedTareLoad: 5 },
      { id: 'tno-2', stepIndex: 2, stepLabel: 'Point 2 (5 kg Net)', referenceNetLoad: 5, displayedNetReading: 5.002, calculatedGrossLoad: 10.002, netError: 2, netErrorFormatted: '+2 g', mpeLimit: 5, mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', passed: true, appliedTareLoad: 5 },
      { id: 'tno-3', stepIndex: 3, stepLabel: 'Point 3 (10 kg Net)', referenceNetLoad: 10, displayedNetReading: 10.003, calculatedGrossLoad: 15.003, netError: 3, netErrorFormatted: '+3 g', mpeLimit: 5, mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', passed: true, appliedTareLoad: 5 },
      { id: 'tno-4', stepIndex: 4, stepLabel: 'Point 4 (15 kg Net)', referenceNetLoad: 15, displayedNetReading: 15.002, calculatedGrossLoad: 20.002, netError: 2, netErrorFormatted: '+2 g', mpeLimit: 10, mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', passed: true, appliedTareLoad: 5 },
      { id: 'tno-5', stepIndex: 5, stepLabel: 'Point 5 (24.975 kg Net)', referenceNetLoad: 24.975, displayedNetReading: 24.978, calculatedGrossLoad: 29.978, netError: 3, netErrorFormatted: '+3 g', mpeLimit: 10, mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', passed: true, appliedTareLoad: 5 },
    ];

    const demoTareSession: TareTestSession = {
      tareType: 'SUBTRACTIVE',
      maximumTareEffect: 10,
      maximumTareUnit: 'kg',
      appliedTare: 5,
      availableNetCapacity: 25,
      tareSettingObservation: demoTareSetting,
      netWeighingObservations: demoTareNetObs,
      tareObservations: demoTareNetObs,
      isTareSettingCompleted: true,
      isNetWeighingCompleted: true,
      overallResult: 'COMPLETED_WITHIN_LIMITS',
      isCompleted: true,
    } as any;

    const demoEccObs: EccentricityTestObservation[] = [
      { position: 1, locationLabel: 'Front-Left', load: 10, indicatedValue: 10.001, error: 0.001, passed: true },
      { position: 2, locationLabel: 'Front-Right', load: 10, indicatedValue: 10.002, error: 0.002, passed: true },
      { position: 3, locationLabel: 'Rear-Left', load: 10, indicatedValue: 9.999, error: -0.001, passed: true },
      { position: 4, locationLabel: 'Rear-Right', load: 10, indicatedValue: 10.001, error: 0.001, passed: true },
    ];

    const demoWeighingObs: WeighingTestObservation[] = [
      { id: 'wo-demo-1', load: 0.1, indicatedValue: 0.1, deltaL: 0, calculatedError: 0, adjustedError: 0, mpeLimit: 5, passed: true, direction: 'Increasing', mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', indicatedDifferenceFormatted: '0 g' },
      { id: 'wo-demo-2', load: 2.5, indicatedValue: 2.501, deltaL: 0, calculatedError: 1, adjustedError: 1, mpeLimit: 5, passed: true, direction: 'Increasing', mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', indicatedDifferenceFormatted: '+1 g' },
      { id: 'wo-demo-3', load: 10.0, indicatedValue: 10.002, deltaL: 0, calculatedError: 2, adjustedError: 2, mpeLimit: 5, passed: true, direction: 'Increasing', mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', indicatedDifferenceFormatted: '+2 g' },
      { id: 'wo-demo-4', load: 25.0, indicatedValue: 25.003, deltaL: 0, calculatedError: 3, adjustedError: 3, mpeLimit: 10, passed: true, direction: 'Increasing', mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', indicatedDifferenceFormatted: '+3 g' },
      { id: 'wo-demo-5', load: 30.0, indicatedValue: 30.004, deltaL: 0, calculatedError: 4, adjustedError: 4, mpeLimit: 10, passed: true, direction: 'Increasing', mpeUnit: 'g', mpeStatus: 'WITHIN_MPE', indicatedDifferenceFormatted: '+4 g' },
    ];

    const demoDiscObs: DiscriminationTestObservation[] = [
      { testPointId: 'MIN', testPointLabel: 'Min Capacity (0.1 kg)', load: 0.1, loadUnit: 'kg', scaleIntervalD: 5, dUnit: 'g', oneTenthD: 0.5, onePointFourD: 7, initialIndication: 0.1, expectedLowerIndication: 0.095, expectedFinalIndication: 0.105, finalIndication: 0.105, passed: true, resultStatus: 'CONFIRMED', isCompleted: true },
      { testPointId: 'HALF_MAX', testPointLabel: '50% Max Capacity (15 kg)', load: 15, loadUnit: 'kg', scaleIntervalD: 5, dUnit: 'g', oneTenthD: 0.5, onePointFourD: 7, initialIndication: 15.0, expectedLowerIndication: 14.995, expectedFinalIndication: 15.005, finalIndication: 15.005, passed: true, resultStatus: 'CONFIRMED', isCompleted: true },
      { testPointId: 'MAX', testPointLabel: '100% Max Capacity (30 kg)', load: 30, loadUnit: 'kg', scaleIntervalD: 5, dUnit: 'g', oneTenthD: 0.5, onePointFourD: 7, initialIndication: 30.0, expectedLowerIndication: 29.995, expectedFinalIndication: 30.005, finalIndication: 30.005, passed: true, resultStatus: 'CONFIRMED', isCompleted: true },
    ];

    const updatedSession = {
      ...session,
      progress: 100,
      testPlanConfirmed: true,
      zeroSettingObservations: [demoZeroObs],
      tareTestSession: demoTareSession,
      tareObservations: demoTareNetObs,
      eccentricityObservations: demoEccObs,
      weighingObservations: demoWeighingObs,
      discriminationObservations: demoDiscObs,
      overallEvaluationResult: 'COMPLIANT' as const,
      overallVerdict: 'Compliant' as const,
    };

    setSession(updatedSession);
    updateTestSession(updatedSession);
    showToast('Demo Data Loaded', 'Pre-filled realistic OIML compliant test observations across all test modules.', 'success');
  };

  // SIH Demo Helper 2: Simulate Out-of-Tolerance Non-Conformity
  const handleSimulateNonConformity = () => {
    const currentEcc = session.eccentricityObservations.length > 0 ? session.eccentricityObservations : [
      { position: 1, locationLabel: 'Front-Left', load: 10, indicatedValue: 10.001, error: 0.001, passed: true },
      { position: 2, locationLabel: 'Front-Right', load: 10, indicatedValue: 10.002, error: 0.002, passed: true },
      { position: 3, locationLabel: 'Rear-Left', load: 10, indicatedValue: 9.999, error: -0.001, passed: true },
    ];

    const failingEccPoint: EccentricityTestObservation = {
      position: 4,
      locationLabel: 'Rear-Right',
      load: 10,
      indicatedValue: 10.008,
      error: 0.008,
      passed: false,
      notes: 'Non-conformity simulated for SIH demonstration (+8g error exceeds ±5g MPE limit).',
    };

    const updatedEcc = [...currentEcc.filter((p) => p.position !== 4), failingEccPoint].sort((a, b) => a.position - b.position);

    const updatedSession = {
      ...session,
      eccentricityObservations: updatedEcc,
      overallEvaluationResult: 'NON_COMPLIANT' as const,
      overallVerdict: 'Non-Compliant' as const,
    };

    setSession(updatedSession);
    updateTestSession(updatedSession);
    showToast('Non-Conformity Simulated', 'Injected +8g eccentricity error on Corner #4 (exceeds ±5g MPE). Verdict updated to NON_COMPLIANT.', 'warning');
  };

  const isZeroSettingCompleted = (session.zeroSettingObservations || []).some((o) => o.isCompleted);
  const isTareCompleted = session.tareTestSession?.isCompleted || (session.tareObservations && session.tareObservations.length >= 5);
  const completedEccCount = session.eccentricityObservations.length;
  const isEccCompleted = completedEccCount >= 4;
  const isWeighingCompleted = session.weighingObservations.length >= 1;
  const isRepeatabilityCompleted = session.repeatabilityObservations.length >= 1;
  const isDiscriminationCompleted = (session.discriminationObservations || []).filter((o) => o.isCompleted || o.resultStatus).length >= 3;

  const { completedCount, totalCount, percentage: calculatedProgressPercent } = calculateTestProgress(session);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back button & Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <button
          onClick={() => navigate('/test-sessions')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Test Sessions
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Saved just now</span>
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Draft
          </button>
        </div>
      </div>

      {/* TOP PERSISTENT TEST BANNER */}
      <div className="bg-[#0B1F3A] text-white p-6 rounded-xl shadow-md space-y-4 no-print border border-[#C8A46B]/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#C8A46B]">Test ID: {session.id}</span>
              <Badge status={session.status} size="sm" />
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Instrument: {session.instrumentModel}
            </h2>
            <p className="text-xs text-slate-300">
              Serial Number: <span className="font-mono text-white font-bold">{session.serialNumber}</span> • Manufacturer:{' '}
              <span className="text-white">{session.manufacturer}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-right">
              <span className="text-[10px] text-slate-300 uppercase font-bold block">Test Progress</span>
              <span className="text-base font-extrabold text-[#C8A46B]">
                {completedCount} of {totalCount} tests completed ({calculatedProgressPercent}%)
              </span>
            </div>
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#C8A46B] rounded-full" style={{ width: `${calculatedProgressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* SIH DEMO QUICK ACTION HELPERS */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#08162A] rounded-lg border border-slate-700 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11px]">
            <Award className="w-3.5 h-3.5 text-[#C8A46B]" />
            <span>SIH Evaluator Toolbar:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreFillPassingDemoData}
              className="px-2.5 py-1 bg-[#C8A46B] hover:bg-[#B79055] text-[#08162A] font-extrabold text-[11px] rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Pre-fill realistic OIML compliant test observations across all test modules"
            >
              <span>⚡ Load Passing Demo Readings</span>
            </button>
            <button
              type="button"
              onClick={handleSimulateNonConformity}
              className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white font-bold text-[11px] rounded transition-colors flex items-center gap-1 cursor-pointer"
              title="Inject out-of-tolerance eccentricity error to simulate failing verification workflow"
            >
              <span>⚠️ Simulate Non-Conformity</span>
            </button>
          </div>
        </div>

        {/* CLICKABLE TEST NAVIGATION LIST */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs pt-1 select-none">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : session.testPlanConfirmed
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            📋 Test Plan & Rules
          </button>

          <button
            onClick={() => setActiveTab('zerosetting')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'zerosetting'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isZeroSettingCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isZeroSettingCompleted ? '✓ Zero Setting' : '○ Zero Setting'}
          </button>

          <button
            onClick={() => setActiveTab('tare')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'tare'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isTareCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isTareCompleted ? '✓ Tare Test' : '○ Tare Test'}
          </button>

          <button
            onClick={() => setActiveTab('eccentricity')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'eccentricity'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isEccCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isEccCompleted ? '✓ Eccentricity' : '○ Eccentricity'}
          </button>

          <button
            onClick={() => setActiveTab('weighing')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'weighing'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isWeighingCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isWeighingCompleted ? '✓ Accuracy' : '○ Accuracy'}
          </button>

          <button
            onClick={() => setActiveTab('repeatability')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'repeatability'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isRepeatabilityCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isRepeatabilityCompleted ? '✓ Repeatability' : '○ Repeatability'}
          </button>

          <button
            onClick={() => setActiveTab('discrimination')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'discrimination'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : isDiscriminationCompleted
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isDiscriminationCompleted ? '✓ Discrimination' : '○ Discrimination'}
          </button>

          <button
            onClick={() => setActiveTab('statictemp')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'statictemp'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : (session.staticTemperatureObservations || []).length >= 5
                ? 'bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            {(session.staticTemperatureObservations || []).length >= 5 ? '✓ Static Temp' : '🌡️ Static Temp'}
          </button>

          <button
            onClick={() => setActiveTab('disturbance')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'disturbance'
                ? 'bg-[#C8A46B] text-[#08162A] shadow-md ring-2 ring-[#C8A46B]'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            ⚡ Electronic & Disturbance
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'review' ? 'bg-[#C8A46B] text-[#08162A] shadow-md' : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            📋 Review & Approval
          </button>
        </div>
      </div>

      {/* TEST MODULE CONTAINER */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* TAB -1: EVALUATION TEST PLAN & RULES */}
        {activeTab === 'plan' && (
          <div className="p-6">
            <EvaluationTestPlanView
              session={session}
              activeRole={activeRole}
              onUpdateSession={(updated) => {
                setSession(updated);
                updateTestSession(updated);
              }}
              isReadOnly={!canEditTestSession(session, activeRole)}
            />
          </div>
        )}

        {/* TAB -2: STATIC TEMPERATURE TEST */}
        {activeTab === 'statictemp' && (
          <div className="p-6">
            <OIMLTemperatureSheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveTemperatureObservationObj}
            />
          </div>
        )}

        {/* TAB -3: DISTURBANCE & ELECTRONIC IMMUNITY FRAMEWORK */}
        {activeTab === 'disturbance' && (
          <div className="p-6">
            <DisturbanceModulesView
              session={session}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
            />
          </div>
        )}

        {/* TAB 0: ZERO-SETTING ACCURACY TEST */}
        {activeTab === 'zerosetting' && (
          <div className="p-6">
            <OIMLZeroSheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveZeroSettingObservation}
            />
          </div>
        )}

        {/* TAB 0.5: OIML TARE OPERATION TEST */}
        {activeTab === 'tare' && (
          <div className="p-6">
            <OIMLTareSheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveTareSetting={handleSaveTareSetting}
              onSaveNetObservation={handleSaveTareNetObservation}
            />
          </div>
        )}

        {/* TAB 1: ECCENTRICITY TEST */}
        {activeTab === 'eccentricity' && (
          <div className="p-6">
            <OIMLEccentricitySheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveEccentricityObservationObj}
              onDeleteObservation={handleDeleteEccentricityObservation}
            />
          </div>
        )}

        {/* TAB 2: WEIGHING ACCURACY & PERFORMANCE TEST */}
        {activeTab === 'weighing' && (
          <div className="p-6">
            <OIMLWeighingSheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveWeighingObservationObj}
              onDeleteObservation={handleDeleteWeighingObservation}
            />
          </div>
        )}

        {/* TAB 3: REPEATABILITY TEST */}
        {activeTab === 'repeatability' && (
          <div className="p-6">
            <OIMLRepeatabilitySheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveRepeatabilityObservationObj}
              onDeleteObservation={handleDeleteRepeatabilityObservation}
            />
          </div>
        )}

        {/* TAB 4: DISCRIMINATION TEST */}
        {activeTab === 'discrimination' && (
          <div className="p-6">
            <OIMLDiscriminationSheet
              session={session}
              instrument={currentInstrument}
              activeRole={activeRole}
              isReadOnly={!canEditTestSession(session, activeRole)}
              onSaveObservation={handleSaveDiscriminationObservation}
            />
          </div>
        )}

        {activeTab === 'review' && (
          <div className="p-6 space-y-6">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Test Session Review &amp; Sign-Off</h3>
                <p className="text-xs text-slate-500">Summary of all completed test modules and current workflow status.</p>
              </div>
              <Badge status={session.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-950 block">Weighing Accuracy Test</span>
                <span className="text-emerald-700 font-semibold">✓ Completed (6 points)</span>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-950 block">Repeatability Test</span>
                <span className="text-emerald-700 font-semibold">✓ Completed (10 runs)</span>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="font-bold text-emerald-950 block">Eccentricity Test</span>
                <span className="text-emerald-700 font-semibold">
                  {isEccCompleted ? '✓ Completed (4 positions)' : '● In Progress'}
                </span>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-1 ${
                  isDiscriminationCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <span className="font-bold text-slate-950 block">Discrimination Test</span>
                <span className={`font-semibold ${isDiscriminationCompleted ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isDiscriminationCompleted ? '✓ Completed (3 points)' : '● In Progress'}
                </span>
              </div>
            </div>

            {/* ROLE-SPECIFIC WORKFLOW ACTION BOX */}
            <div className="p-6 bg-slate-900 text-white rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Role Action Portal: {activeRole}
                  </span>
                  <Badge status={session.workflowStatus || session.status} size="sm" />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  State: {getWorkflowStatusLabel(session.workflowStatus)}
                </span>
              </div>

              {/* Highlight correction reason if CHANGES_REQUESTED */}
              {session.workflowStatus === 'CHANGES_REQUESTED' && session.correctionReason && (
                <div className="p-3.5 bg-rose-950/80 border border-rose-700/60 rounded-xl text-xs space-y-2">
                  <span className="font-bold text-rose-300 block flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    Correction Requested by Reviewer ({session.correctionRequestedBy}):
                  </span>
                  <p className="text-rose-200 font-mono italic pl-5">"{session.correctionReason}"</p>
                </div>
              )}

              {/* TESTING OFFICER ACTIONS */}
              {(activeRole === 'Testing Officer' || activeRole === 'TESTING_OFFICER' || activeRole === 'Admin' || activeRole === 'ADMIN') && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-slate-300">
                    {session.workflowStatus === 'CHANGES_REQUESTED'
                      ? 'Review the correction request above and resume testing to update observations.'
                      : canSubmitForReview(session, activeRole)
                      ? 'Confirm all required test readings are recorded before submitting for senior technical review.'
                      : `Session is currently ${getWorkflowStatusLabel(session.workflowStatus)}. Locked for editing.`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('weighing')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Return to Test
                    </button>

                    {session.workflowStatus === 'CHANGES_REQUESTED' && (
                      <button
                        type="button"
                        onClick={handleResumeTesting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" /> Resume Testing
                      </button>
                    )}

                    {(session.workflowStatus === 'DRAFT' || session.workflowStatus === 'IN_PROGRESS') && (
                      <button
                        type="button"
                        onClick={handleSubmitForReview}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                      >
                        <Send className="w-4 h-4" /> Submit for Review
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TECHNICAL REVIEWER ACTIONS */}
              {(activeRole === 'Technical Reviewer' || activeRole === 'TECHNICAL_REVIEWER' || activeRole === 'Admin' || activeRole === 'ADMIN') && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-300">
                    As Senior Technical Reviewer, audit recorded observations and approve or request correction.
                  </p>

                  {session.workflowStatus === 'TESTING_COMPLETE' && (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-slate-400">
                        Session testing is complete and ready for technical audit.
                      </span>
                      <button
                        type="button"
                        onClick={handleClaimReview}
                        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                      >
                        <Eye className="w-4 h-4" /> Claim &amp; Begin Review
                      </button>
                    </div>
                  )}

                  {session.workflowStatus === 'UNDER_REVIEW' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-300 block">
                          Reviewer Audit Comments (Persisted):
                        </label>
                        <textarea
                          rows={2}
                          value={reviewerCommentInput}
                          onChange={(e) => setReviewerCommentInput(e.target.value)}
                          placeholder="Enter technical audit notes, observations status, or reason for correction..."
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-teal-500 font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] text-slate-400">
                          Current State: <strong className="text-teal-300">{getWorkflowStatusLabel(session.workflowStatus)}</strong>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRequestChanges}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> Request Changes
                          </button>

                          <button
                            type="button"
                            onClick={handleApproveReview}
                            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4" /> Technical Approve
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* LAB DIRECTOR ACTIONS */}
              {(activeRole === 'Approving Officer / Lab Director' || activeRole === 'LAB_DIRECTOR' || activeRole === 'Admin' || activeRole === 'ADMIN') && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-300">
                      As Laboratory Director, provide official evaluation approval and issue the final OIML R-76 Certificate.
                    </p>
                    <div className="text-[11px] text-teal-400 font-mono">
                      State: <strong>{getWorkflowStatusLabel(session.workflowStatus)}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {session.workflowStatus === 'TECHNICALLY_APPROVED' && (
                      <>
                        <button
                          type="button"
                          onClick={handleDirectorRequestChanges}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" /> Request Changes
                        </button>
                        <button
                          type="button"
                          onClick={handleDirectorApprove}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve Evaluation
                        </button>
                      </>
                    )}

                    {session.workflowStatus === 'APPROVED' && (
                      <button
                        type="button"
                        onClick={handleFinalizeCertificate}
                        className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-lg transition-colors shadow-md cursor-pointer"
                      >
                        <Award className="w-4 h-4" /> Finalize &amp; Issue Certificate
                      </button>
                    )}

                    {session.workflowStatus === 'FINALIZED' && (
                      <span className="px-4 py-2 bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold text-xs rounded-lg flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-400" /> Certificate Finalized
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* WORKFLOW HISTORY & REVIEW AUDIT LOG (PART 42 & 43) */}
            <div className="p-6 bg-white rounded-xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  Workflow Transition & Audit History Log
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  {(session.workflowHistory || []).length} Transition Events Recorded
                </span>
              </div>

              {(session.workflowHistory || []).length > 0 ? (
                <div className="space-y-3">
                  {session.workflowHistory?.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">{evt.user}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                            {evt.role}
                          </span>
                          <span className="text-slate-400">→</span>
                          <Badge status={evt.toStatus} size="sm" />
                        </div>
                        {evt.comment && (
                          <p className="text-slate-600 font-mono text-[11px] italic pt-0.5">
                            "{evt.comment}"
                          </p>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {evt.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 font-mono">
                  No workflow history transitions logged yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM 3 ACTION BUTTONS (Section 10 UX Spec) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print rounded-b-xl">
          <button
            type="button"
            onClick={() => {
              const order = ['plan', 'zerosetting', 'tare', 'eccentricity', 'weighing', 'repeatability', 'discrimination', 'statictemp', 'disturbance', 'review'];
              const idx = order.indexOf(activeTab);
              if (idx > 0) setActiveTab(order[idx - 1] as any);
            }}
            disabled={['plan', 'zerosetting', 'tare', 'eccentricity', 'weighing', 'repeatability', 'discrimination', 'statictemp', 'disturbance', 'review'].indexOf(activeTab) <= 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> {t('tests.previousTest')}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-slate-300"
            >
              <Save className="w-4 h-4" /> {t('tests.saveDraft')}
            </button>

            <button
              type="button"
              onClick={() => {
                handleSaveDraft();
                const order = ['plan', 'zerosetting', 'tare', 'eccentricity', 'weighing', 'repeatability', 'discrimination', 'statictemp', 'disturbance', 'review'];
                const idx = order.indexOf(activeTab);
                if (idx < order.length - 1) setActiveTab(order[idx + 1] as any);
              }}
              disabled={['plan', 'zerosetting', 'tare', 'eccentricity', 'weighing', 'repeatability', 'discrimination', 'statictemp', 'disturbance', 'review'].indexOf(activeTab) >= 9}
              className="flex items-center gap-2 px-5 py-2 bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40 shadow-sm"
            >
              {t('tests.saveAndNext')} <ChevronRight className="w-4 h-4 text-[#C8A46B]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


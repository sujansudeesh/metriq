import {
  TestSession,
  TestModuleKey,
  ModuleStatus,
  ModuleResult,
  TestModuleConfig,
  OverallEvaluationStatus,
  Instrument,
} from '../types';

/**
 * ============================================================================
 * SINGLE SOURCE OF TRUTH EVALUATION RESULT SERVICE
 * ============================================================================
 * Centralized evaluation service enforcing OIML R 76 test completion rules,
 * progress calculations, module status/results, and overall evaluation verdict.
 * ============================================================================
 */

export const ALL_TEST_MODULE_KEYS: TestModuleKey[] = [
  'accuracy',
  'repeatability',
  'eccentricity',
  'discrimination',
  'zeroSetting',
  'tare',
];

export const MODULE_METADATA: Record<TestModuleKey, { label: string; clause: string; defaultRequiredCount: number }> = {
  accuracy: { label: 'Weighing Accuracy / Performance Test', clause: 'Clause 3.5 / A.4.4', defaultRequiredCount: 1 },
  repeatability: { label: 'Repeatability Test', clause: 'Clause 3.6.1 / A.4.10', defaultRequiredCount: 1 },
  eccentricity: { label: 'Eccentricity Loading Test', clause: 'Clause 3.6.2 / A.4.7', defaultRequiredCount: 4 },
  discrimination: { label: 'Digital Discrimination Test', clause: 'Clause 3.8 / A.4.8', defaultRequiredCount: 3 },
  zeroSetting: { label: 'Zero-Setting Accuracy Test', clause: 'Clause 4.5.2 / A.4.2.3', defaultRequiredCount: 1 },
  tare: { label: 'Tare Operation & Net Weighing Test', clause: 'Clause 4.6 / A.4.6', defaultRequiredCount: 5 },
};

/**
 * Determines module applicability based on instrument and test context specs.
 */
export function isModuleApplicable(session: TestSession, moduleKey: TestModuleKey, instrument?: Instrument): boolean {
  // If session has explicit test plan item, check its applicability status
  if (session.testPlan) {
    const item = session.testPlan.find((p) => p.id === moduleKey);
    if (item) {
      return item.status === 'APPLICABLE';
    }
  }

  if (moduleKey === 'discrimination') {
    const dVal = parseFloat(session.verificationInterval) || 5;
    const isTypeExam = session.testContext === 'TYPE_EXAMINATION';
    if (!isTypeExam || dVal < 0.005) {
      return false; // Not applicable for non-type examination or d < 5 mg
    }
  }

  if (moduleKey === 'tare') {
    const tareAvail = instrument?.metrology?.tareDeviceAvailable ?? (session as any).tareDeviceAvailable ?? true;
    const tareType = instrument?.metrology?.tareType ?? (session as any).tareType ?? 'SUBTRACTIVE';
    if (!tareAvail || tareType === 'NONE') {
      return false; // Not applicable if instrument has no tare device
    }
  }

  return true;
}

/**
 * Evaluates individual test module status, result, and observation counts.
 */
export function evaluateModuleConfig(session: TestSession, moduleKey: TestModuleKey): TestModuleConfig {
  const meta = MODULE_METADATA[moduleKey];
  const applicable = isModuleApplicable(session, moduleKey);

  if (!applicable) {
    return {
      key: moduleKey,
      label: meta.label,
      clause: meta.clause,
      required: false,
      applicable: false,
      status: 'NOT_APPLICABLE',
      result: 'NOT_APPLICABLE',
      observationCount: 0,
      requiredCount: 0,
      notes: 'Not applicable for this instrument context.',
    };
  }

  let status: ModuleStatus = 'NOT_STARTED';
  let result: ModuleResult = 'INCOMPLETE';
  let obsCount = 0;
  let reqCount = meta.defaultRequiredCount;

  switch (moduleKey) {
    case 'accuracy': {
      const obs = session.weighingObservations || [];
      obsCount = obs.length;
      if (obsCount >= 1) {
        const hasFailing = obs.some((o) => !o.passed);
        status = hasFailing ? 'NEEDS_ATTENTION' : 'COMPLETED';
        result = hasFailing ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';
      }
      break;
    }

    case 'repeatability': {
      const obs = session.repeatabilityObservations || [];
      obsCount = obs.length;
      if (obsCount >= 1) {
        status = 'COMPLETED';
        result = 'WITHIN_LIMIT';
      }
      break;
    }

    case 'eccentricity': {
      const obs = session.eccentricityObservations || [];
      obsCount = obs.length;
      reqCount = session.eccentricityNumSupports || 4;
      if (obsCount >= reqCount) {
        const hasFailing = obs.some((o) => !o.passed);
        status = hasFailing ? 'NEEDS_ATTENTION' : 'COMPLETED';
        result = hasFailing ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';
      } else if (obsCount > 0) {
        status = 'IN_PROGRESS';
      }
      break;
    }

    case 'discrimination': {
      const obs = session.discriminationObservations || [];
      obsCount = obs.filter((o) => o.isCompleted || o.resultStatus).length;
      reqCount = 3;
      if (obsCount >= reqCount) {
        const hasFailing = obs.some((o) => !o.passed);
        status = hasFailing ? 'NEEDS_ATTENTION' : 'COMPLETED';
        result = hasFailing ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';
      } else if (obsCount > 0) {
        status = 'IN_PROGRESS';
      }
      break;
    }

    case 'zeroSetting': {
      const obs = session.zeroSettingObservations || [];
      obsCount = obs.length;
      reqCount = 1;
      if (obsCount >= 1) {
        const firstObs = obs[0];
        status = firstObs.passed ? 'COMPLETED' : 'NEEDS_ATTENTION';
        result = firstObs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT';
      }
      break;
    }

    case 'tare': {
      const tareSess = session.tareTestSession;
      const netObs = session.tareObservations || tareSess?.netWeighingObservations || [];
      obsCount = netObs.length;
      reqCount = 5;

      if (tareSess?.isCompleted || (tareSess?.isTareSettingCompleted && obsCount >= 5)) {
        const hasFailing = !tareSess.tareSettingObservation?.passed || netObs.some((o) => !o.passed);
        status = hasFailing ? 'NEEDS_ATTENTION' : 'COMPLETED';
        result = hasFailing ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';
      } else if (tareSess?.isTareSettingCompleted || obsCount > 0) {
        status = 'IN_PROGRESS';
      }
      break;
    }
  }

  return {
    key: moduleKey,
    label: meta.label,
    clause: meta.clause,
    required: true,
    applicable: true,
    status,
    result,
    observationCount: obsCount,
    requiredCount: reqCount,
  };
}

/**
 * Calculates test progress percentage dynamically based ONLY on selected required applicable tests.
 * Formula: completed required applicable tests / total required applicable tests * 100
 */
export function calculateSessionProgress(session: TestSession): {
  progressPercentage: number;
  completedCount: number;
  totalCount: number;
  moduleConfigs: Record<TestModuleKey, TestModuleConfig>;
} {
  const selectedModules = session.selectedTests || ALL_TEST_MODULE_KEYS;
  const configs: Partial<Record<TestModuleKey, TestModuleConfig>> = {};

  let completedCount = 0;
  let totalCount = 0;

  selectedModules.forEach((key) => {
    const config = evaluateModuleConfig(session, key);
    configs[key] = config;

    if (config.required && config.applicable) {
      totalCount += 1;
      if (config.status === 'COMPLETED' || config.status === 'NEEDS_ATTENTION') {
        completedCount += 1;
      }
    }
  });

  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    progressPercentage,
    completedCount,
    totalCount,
    moduleConfigs: configs as Record<TestModuleKey, TestModuleConfig>,
  };
}

/**
 * Calculates central overall evaluation result: UNDER_EVALUATION | COMPLIANT | NON_COMPLIANT
 */
export function calculateOverallEvaluationResult(session: TestSession): OverallEvaluationStatus {
  const { moduleConfigs } = calculateSessionProgress(session);

  const selectedModules = session.selectedTests || ALL_TEST_MODULE_KEYS;
  let hasIncompleteRequired = false;
  let hasFailingModule = false;

  selectedModules.forEach((key) => {
    const cfg = moduleConfigs[key];
    if (cfg && cfg.required && cfg.applicable) {
      if (cfg.status !== 'COMPLETED' && cfg.status !== 'NEEDS_ATTENTION') {
        hasIncompleteRequired = true;
      }
      if (cfg.result === 'EXCEEDS_LIMIT') {
        hasFailingModule = true;
      }
    }
  });

  if (hasIncompleteRequired) {
    return 'UNDER_EVALUATION';
  }

  if (hasFailingModule) {
    return 'NON_COMPLIANT';
  }

  return 'COMPLIANT';
}

/**
 * Checks if session is ready for submission to review.
 */
export function isSessionReadyForReview(session: TestSession): {
  isReady: boolean;
  blockingReason?: string;
  incompleteModules: string[];
} {
  const { moduleConfigs } = calculateSessionProgress(session);

  const selectedModules = session.selectedTests || ALL_TEST_MODULE_KEYS;
  const incompleteModules: string[] = [];

  selectedModules.forEach((key) => {
    const cfg = moduleConfigs[key];
    if (cfg && cfg.required && cfg.applicable) {
      if (cfg.status !== 'COMPLETED' && cfg.status !== 'NEEDS_ATTENTION') {
        incompleteModules.push(cfg.label);
      }
    }
  });

  if (incompleteModules.length > 0) {
    return {
      isReady: false,
      blockingReason: `Complete all required tests before submitting this evaluation. (${incompleteModules.join(', ')})`,
      incompleteModules,
    };
  }

  return {
    isReady: true,
    incompleteModules: [],
  };
}

/**
 * Maps raw internal workflow status strings into clean, user-friendly labels.
 */
export function getFriendlyWorkflowStatus(status?: string): string {
  if (!status) return 'Draft';
  switch (status.toUpperCase()) {
    case 'IN_PROGRESS':
    case 'TESTING':
      return 'Testing in Progress';
    case 'TESTING_COMPLETE':
      return 'Testing Complete';
    case 'UNDER_REVIEW':
    case 'SUBMITTED_FOR_REVIEW':
      return 'Under Technical Review';
    case 'TECHNICALLY_APPROVED':
      return 'Technical Review Approved';
    case 'CHANGES_REQUESTED':
    case 'NEEDS_CORRECTION':
      return 'Corrections Required';
    case 'APPROVED':
      return 'Evaluation Approved';
    case 'FINALIZED':
    case 'COMPLETED':
      return 'Final Certificate Issued';
    case 'DRAFT':
      return 'Draft Test';
    default:
      return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}


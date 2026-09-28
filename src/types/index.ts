export type AccuracyClass = 'Class I' | 'Class II' | 'Class III' | 'Class IIII';

export type MassUnit = 'mg' | 'g' | 'kg' | 't' | 'ct';

export type InstrumentType =
  | 'Analytical Balance'
  | 'Precision Balance'
  | 'Laboratory Balance'
  | 'Jewellery / Gem Balance'
  | 'Retail Weighing Scale'
  | 'Price Computing Scale'
  | 'Label Printing Scale'
  | 'Bench Scale'
  | 'Platform Scale'
  | 'Floor Scale'
  | 'Pallet Scale'
  | 'Counting Scale'
  | 'Postal / Parcel Scale'
  | 'Medical Weighing Scale'
  | 'Baby Weighing Scale'
  | 'Veterinary Scale'
  | 'Livestock Scale'
  | 'Hanging Scale'
  | 'Crane Scale'
  | 'Static Vehicle Weighbridge'
  | 'Truck Scale'
  | 'Static Axle Weighing Scale'
  | 'Industrial Receiving Scale'
  | 'Heavy Duty Industrial Scale'
  | 'Agricultural Produce Scale'
  | 'Waste Weighing Scale'
  | 'Portable Weighing Scale'
  | 'Mechanical Platform Scale'
  | 'Electronic Platform Scale'
  | 'Non-Self-Indicating Instrument'
  | 'Electronic Weighing Scale'
  | 'Weighbridge'
  | 'Other NAWI';

export type ComplianceStatus = 'Compliant' | 'Non-Compliant' | 'Under Evaluation' | 'Pending Review';

export type TestSessionStatus = 'In Progress' | 'Awaiting Review' | 'Compliant' | 'Non-Compliant' | 'Finalized';

export type ReportStatus = 'Draft' | 'Awaiting Review' | 'Approved' | 'Finalized';

export type WorkflowStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'TESTING_COMPLETE'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'TECHNICALLY_APPROVED'
  | 'APPROVED'
  | 'FINALIZED';

export type UserRoleCode =
  | 'ADMIN'
  | 'TESTING_OFFICER'
  | 'TECHNICAL_REVIEWER'
  | 'LAB_DIRECTOR'
  | 'AUDITOR';

export type UserRole =
  | 'Testing Officer'
  | 'Technical Reviewer'
  | 'Approving Officer / Lab Director'
  | 'Admin'
  | 'Read Only Auditor'
  | UserRoleCode;

export interface WorkflowHistoryEvent {
  id: string;
  fromStatus: WorkflowStatus | string;
  toStatus: WorkflowStatus | string;
  user: string;
  role: UserRole;
  timestamp: string;
  comment?: string;
}

export interface ManufacturerInfo {
  name: string;
  address: string;
  country: string;
  contactPerson: string;
  email: string;
  phone: string;
}

export interface ModelIdentification {
  instrumentType: InstrumentType;
  modelName: string;
  serialNumber: string;
  firmwareVersion: string;
  yearOfManufacture: number;
  intendedApplication: string;
}

export type TareType = 'NONE' | 'SUBTRACTIVE' | 'ADDITIVE';

export interface MetrologicalCharacteristics {
  accuracyClass: AccuracyClass;
  maxCapacity: number;
  maxUnit: MassUnit;
  minCapacity: number;
  minUnit: MassUnit;
  scaleIntervalD: number;
  dUnit: MassUnit;
  verificationIntervalE: number;
  eUnit: MassUnit;
  verificationScaleIntervalsN: number; // Auto-calculated n = Max / e
  tareRange: number;
  tempRangeMin: number;
  tempRangeMax: number;
  isMultiInterval: boolean;
  zeroSettingType?: ZeroSettingType;
  tareDeviceAvailable?: boolean;
  tareType?: TareType;
  maximumTareEffect?: number;
  maximumTareUnit?: MassUnit;
  tareIndicationSupported?: boolean;
}

export type InstrumentStatus = 'ACTIVE' | 'INACTIVE' | 'OUT_OF_SERVICE' | ComplianceStatus;

export interface Instrument {
  id: string;
  manufacturer: ManufacturerInfo;
  model: ModelIdentification;
  metrology: MetrologicalCharacteristics;
  registeredDate: string;
  lastEvaluated: string;
  status: InstrumentStatus;
  notes?: string;
}

export interface WeighingTestObservation {
  id: string;
  load: number;
  indicatedValue: number;
  deltaL: number;
  calculatedError: number;
  adjustedError: number;
  mpeLimit: number;
  passed: boolean;
  direction: 'Increasing' | 'Decreasing';
  mpeUnit?: MassUnit;
  mpeStatus?: 'WITHIN_MPE' | 'EXCEEDS_MPE';
  indicatedDifferenceFormatted?: string;
  notes?: string;
}

export interface RepeatabilityTestObservation {
  id?: string;
  runNumber: number;
  load: number;
  indicatedValue: number;
  zeroIndication?: number;
  deltaL?: number;
  error?: number;
  calculatedError?: number;
  passed?: boolean;
}

export type EccentricityProfile =
  | 'STANDARD_UP_TO_4_SUPPORTS'
  | 'MORE_THAN_4_SUPPORTS'
  | 'MINIMAL_OFF_CENTRE'
  | 'ROLLING_LOAD';

export interface EccentricityPositionConfig {
  id: number;
  label: string;
  shortLabel: string;
  quadrant?: 'FL' | 'FR' | 'RL' | 'RR';
  description?: string;
}

export interface EccentricityTestObservation {
  position: number;
  locationLabel: string;
  load: number;
  indicatedValue: number;
  deltaL?: number;
  error: number;
  passed: boolean;
  mpeValue?: number;
  mpeUnit?: MassUnit;
  mpeStatus?: 'WITHIN_MPE' | 'EXCEEDS_MPE';
  indicatedDifferenceFormatted?: string;
  notes?: string;
}

export interface TareSettingObservation {
  id?: string;
  appliedTareLoad: number; // e.g. 5.0 kg
  tareLoadUnit: MassUnit;
  displayedIndicationAfterTare: number; // e.g. 0.0 kg NET
  suggestedIncrement: number; // 0.1e (e.g. 0.5 g)
  changeoverAdditionalLoad: number; // ΔL (e.g. 2.0 g)
  calculatedTareZeroError: number; // ET = 0.5e - ΔL (e.g. +0.5 g)
  permissibleTareZeroError: number; // ±0.25e (e.g. ±1.25 g)
  passed: boolean;
  resultStatus: 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT';
  recordedAt?: string;
  notes?: string;
}

export interface TareNetWeighingObservation {
  id: string;
  stepIndex: number;
  stepLabel: string;
  appliedTareLoad: number; // e.g. 5.0 kg
  referenceNetLoad: number; // e.g. 10.0 kg
  displayedNetReading: number; // e.g. 10.003 kg
  calculatedGrossLoad: number; // e.g. 15.0 kg = Tare + Net
  netError: number; // e.g. +0.003 kg = +3 g
  netErrorFormatted: string;
  mpeLimit: number; // e.g. 0.005 kg = 5 g
  mpeUnit: MassUnit;
  mpeStatus: 'WITHIN_MPE' | 'EXCEEDS_MPE';
  passed: boolean;
  notes?: string;
}

export interface TareTestSession {
  tareType: TareType;
  maximumTareEffect: number;
  maximumTareUnit: MassUnit;
  appliedTare: number;
  availableNetCapacity: number;
  tareSettingObservation?: TareSettingObservation;
  netWeighingObservations: TareNetWeighingObservation[];
  isTareSettingCompleted: boolean;
  isNetWeighingCompleted: boolean;
  overallResult: 'COMPLETED_WITHIN_LIMITS' | 'NEEDS_ATTENTION' | 'NOT_APPLICABLE' | 'NOT_STARTED';
  isCompleted: boolean;
}

// Legacy compatibility alias
export type TareTestObservation = TareNetWeighingObservation;

export type TestContext = 'TYPE_EXAMINATION' | 'INITIAL_VERIFICATION' | 'IN_SERVICE_INSPECTION';

export type ZeroSettingType =
  | 'NON_AUTOMATIC'
  | 'SEMI_AUTOMATIC'
  | 'AUTOMATIC'
  | 'ZERO_TRACKING';

export interface ZeroSettingTestObservation {
  id?: string;
  zeroSettingType: ZeroSettingType;
  verificationIntervalE: number;
  eUnit: MassUnit;
  suggestedIncrement: number; // 0.1e (e.g. 0.5 g)
  changeoverAdditionalLoad: number; // ΔL (e.g. 2.0 g)
  calculatedZeroError: number; // E0 = 0.5e - ΔL (e.g. +0.5 g)
  permissibleZeroDeviation: number; // ±0.25e (e.g. 1.25 g)
  passed: boolean;
  resultStatus: 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT';
  isCompleted: boolean;
  recordedAt?: string;
  notes?: string;
}

export interface DiscriminationTestObservation {
  id?: string;
  testPointId: 'MIN' | 'HALF_MAX' | 'MAX';
  testPointLabel: string;
  load: number; // Base test load in kg (e.g. 0.1, 15, 30)
  loadUnit: MassUnit;
  scaleIntervalD: number;
  dUnit: MassUnit;
  oneTenthD: number; // e.g. 0.5 g
  onePointFourD: number; // e.g. 7 g
  initialIndication: number; // I (e.g. 15.000)
  transitionIndication?: number; // I - d (e.g. 14.995)
  expectedLowerIndication?: number; // 14.995
  finalIndication?: number; // Observed final I (e.g. 15.005)
  expectedFinalIndication?: number; // I + d (e.g. 15.005)
  additionalLoad?: number; // 1.4d (7 g)
  newIndication?: number; // legacy compatibility alias for finalIndication
  passed: boolean;
  resultStatus?: 'CONFIRMED' | 'NOT_OBSERVED';
  currentStep?: number; // 1..4 wizard step
  isCompleted?: boolean;
  notes?: string;
}

export type TestCategory =
  | 'ADMINISTRATIVE'
  | 'METROLOGICAL'
  | 'INFLUENCE'
  | 'DISTURBANCE'
  | 'STABILITY';

export type ApplicabilityStatus =
  | 'APPLICABLE'
  | 'NOT_APPLICABLE'
  | 'REQUIRES_LAB_CONFIRMATION';

export type DecisionSource =
  | 'RECOMMENDED_ENGINE'
  | 'MANUAL_OVERRIDE';

export interface TestPlanItem {
  id: string;
  name: string;
  category: TestCategory;
  ruleReference: string;
  applicableContexts: TestContext[];
  status: ApplicabilityStatus;
  reason: string;
  requiredByDefault: boolean;
  isOptional?: boolean;
  isSelected?: boolean;
  decisionSource: DecisionSource;
  overriddenBy?: string;
  overriddenAt?: string;
  overrideReason?: string;
  notes?: string;
}

export interface AdministrativeChecklistItem {
  id: string;
  label: string;
  clause: string;
  completed: boolean;
  notes?: string;
}

export type TestModuleKey = 'accuracy' | 'repeatability' | 'eccentricity' | 'discrimination' | 'zeroSetting' | 'tare';
export type ModuleStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_ATTENTION' | 'NOT_APPLICABLE';
export type ModuleResult = 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT' | 'NOT_APPLICABLE' | 'INCOMPLETE';
export type OverallEvaluationStatus = 'UNDER_EVALUATION' | 'COMPLIANT' | 'NON_COMPLIANT';
export type VerificationMode = 'INITIAL_VERIFICATION' | 'IN_SERVICE';

export interface TestModuleConfig {
  key: TestModuleKey;
  label: string;
  clause: string;
  required: boolean;
  applicable: boolean;
  status: ModuleStatus;
  result: ModuleResult;
  observationCount: number;
  requiredCount: number;
  notes?: string;
}

export interface EnvironmentalConditionRow {
  temp?: number | string;
  humidity?: number | string;
  time?: string;
  pressure?: number | string;
  pressureNotApplicable?: boolean;
}

export interface EnvironmentalConditionsData {
  start?: EnvironmentalConditionRow;
  maxLoad?: EnvironmentalConditionRow;
  end?: EnvironmentalConditionRow;
}

export interface TestSession {
  id: string;
  instrumentId: string;
  instrumentModel: string;
  serialNumber: string;
  manufacturer: string;
  accuracyClass: AccuracyClass;
  maxCapacity: string;
  verificationInterval: string;
  startedOn: string;
  completedOn?: string;
  progress: number;
  status: TestSessionStatus;
  workflowStatus?: WorkflowStatus;
  testContext?: TestContext;
  verificationMode?: VerificationMode;
  selectedTests?: TestModuleKey[];
  requiredTests?: TestModuleKey[];
  moduleConfigs?: Partial<Record<TestModuleKey, TestModuleConfig>>;
  overallEvaluationResult?: OverallEvaluationStatus;
  testPlan?: TestPlanItem[];
  administrativeChecklist?: AdministrativeChecklistItem[];
  testPlanConfirmed?: boolean;
  testPlanConfirmedBy?: string;
  testPlanConfirmedAt?: string;
  zeroSettingType?: ZeroSettingType;
  assignedOfficer: string;
  reviewer?: string;
  approver?: string;
  labDirector?: string;

  // Persistent Workflow Details
  createdAt?: string;
  updatedAt?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerComments?: string;
  approvedBy?: string;
  approvedAt?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  correctionReason?: string;
  correctionRequestedBy?: string;
  correctionRequestedAt?: string;
  workflowHistory?: WorkflowHistoryEvent[];

  ambientTemp: number;
  relativeHumidity: number;
  barometricPressure: number;
  environmentalConditions?: EnvironmentalConditionsData;
  eccentricityProfile?: EccentricityProfile;
  eccentricityNumSupports?: number;
  eccentricityTestLoad?: number;
  weighingObservations: WeighingTestObservation[];
  repeatabilityObservations: RepeatabilityTestObservation[];
  eccentricityObservations: EccentricityTestObservation[];
  tareObservations: TareTestObservation[];
  tareTestSession?: TareTestSession;
  discriminationObservations: DiscriminationTestObservation[];
  zeroSettingObservations?: ZeroSettingTestObservation[];
  staticTemperatureObservations?: any[];
  staticTemperatureSession?: any;
  overallVerdict?: ComplianceStatus;
  comments?: string;
  notes?: string;
  scaleInterval?: string;
  session_code?: string;
}

export interface Report {
  id: string;
  reportNumber: string;
  certificateId: string;
  testSessionId: string;
  instrumentId: string;
  instrumentModel: string;
  manufacturer: string;
  accuracyClass: AccuracyClass;
  issueDate: string;
  status: ReportStatus;
  testingOfficer: string;
  technicalReviewer: string;
  labDirector: string;
  verdict: ComplianceStatus;
  downloadUrl?: string;
  versionNumber?: number;
  snapshotData?: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  instrumentOrSessionId: string;
  entityType?: string;
  entityId?: string;
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar: string;
  active: boolean;
}

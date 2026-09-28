import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  WeighingTestObservation,
  RepeatabilityTestObservation,
  EccentricityTestObservation,
  DiscriminationTestObservation,
  ZeroSettingTestObservation,
  TareNetWeighingObservation,
  TareSettingObservation,
  EnvironmentalConditionsData,
} from '../types';
import { auditService } from './auditService';

export const testObservationService = {
  /**
   * Helper to get or create a session_tests row for a given session and test_type
   */
  async getOrCreateSessionTest(sessionId: string, testType: string): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null;

    // Resolve db UUID if sessionId is a session_code like TS-2026-101
    let dbSessionId = sessionId;
    const { data: dbSess } = await supabase
      .from('test_sessions')
      .select('id')
      .or(`id.eq.${sessionId},session_code.eq.${sessionId}`)
      .maybeSingle();

    if (dbSess?.id) {
      dbSessionId = dbSess.id;
    }

    const { data: existing } = await supabase
      .from('session_tests')
      .select('id')
      .eq('session_id', dbSessionId)
      .eq('test_type', testType)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from('session_tests')
      .insert({
        session_id: dbSessionId,
        test_type: testType,
        required: true,
        applicability_status: 'APPLICABLE',
        completion_status: 'IN_PROGRESS',
        result: 'INCOMPLETE',
      })
      .select('id')
      .single();

    if (error || !created) {
      console.warn(`Failed to create session_tests row for ${testType}:`, error);
      return null;
    }
    return created.id;
  },

  /**
   * Save or update a single test observation row in Supabase test_observations table
   */
  async saveObservation(sessionTestId: string, observation: {
    id?: string;
    observationType: string;
    referenceValue?: number;
    referenceUnit?: string;
    indicatedValue?: number;
    indicatedUnit?: string;
    additionalLoadValue?: number;
    additionalLoadUnit?: string;
    preRoundingIndicationValue?: number;
    rawErrorValue?: number;
    zeroErrorValue?: number;
    correctedErrorValue?: number;
    mpeValue?: number;
    resultUnit?: string;
    result?: string;
    positionLabel?: string;
    runNumber?: number;
    ruleReference?: string;
    calculationTrace?: any;
    rawMetadata?: any;
    recordedBy?: string;
  }) {
    if (isSupabaseConfigured() && supabase) {
      // 1. Get authenticated user ID if not provided
      let userId = observation.recordedBy;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        userId = authData?.user?.id;
      }

      // 2. Map observationType to valid DB check constraint
      let dbObsType = 'WEIGHING';
      if (observation.observationType.includes('REPEATABILITY')) dbObsType = 'REPEATABILITY_READING';
      else if (observation.observationType.includes('ECCENTRICITY')) dbObsType = 'ECCENTRICITY_POSITION';
      else if (observation.observationType.includes('DISCRIMINATION')) dbObsType = 'DISCRIMINATION';
      else if (observation.observationType.includes('ZERO')) dbObsType = 'ZERO_SETTING';
      else if (observation.observationType.includes('TARE_SETTING')) dbObsType = 'TARE_SETTING';
      else if (observation.observationType.includes('NET') || observation.observationType.includes('TARE')) dbObsType = 'NET_WEIGHING';
      else if (observation.observationType.includes('STATIC_TEMP')) dbObsType = 'STATIC_TEMP';

      // 3. Map result to valid DB check constraint
      let dbResult = 'WITHIN_LIMIT';
      if (observation.result === 'EXCEEDS_LIMIT' || observation.result === 'EXCEEDS_MPE' || observation.result === 'FAIL') {
        dbResult = 'EXCEEDS_LIMIT';
      } else if (observation.result === 'OBSERVED') {
        dbResult = 'OBSERVED';
      } else if (observation.result === 'NOT_APPLICABLE') {
        dbResult = 'NOT_APPLICABLE';
      }

      // 4. Duplicate Prevention: check if row exists for update
      let query = supabase.from('test_observations').select('id, observation_no, indicated_value').eq('session_test_id', sessionTestId);

      if (observation.id && observation.id.includes('-') && !observation.id.startsWith('wo-') && !observation.id.startsWith('eo-') && !observation.id.startsWith('ro-')) {
        query = query.eq('id', observation.id);
      } else if (observation.runNumber !== undefined && observation.runNumber !== null) {
        query = query.eq('run_number', observation.runNumber);
      } else if (observation.positionLabel) {
        query = query.eq('position_label', observation.positionLabel);
      } else if (dbObsType === 'ZERO_SETTING' || dbObsType === 'TARE_SETTING') {
        query = query.eq('observation_type', dbObsType);
      } else if (observation.referenceValue !== undefined && dbObsType === 'WEIGHING') {
        query = query.eq('reference_value', observation.referenceValue);
      }

      const { data: existingRows } = await query.limit(1);
      const existingRow = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      let obsNo = existingRow?.observation_no;
      if (!obsNo) {
        const { count } = await supabase
          .from('test_observations')
          .select('*', { count: 'exact', head: true })
          .eq('session_test_id', sessionTestId);
        obsNo = (count || 0) + 1;
      }

      const payload = {
        session_test_id: sessionTestId,
        observation_no: obsNo,
        observation_type: dbObsType,
        reference_value: observation.referenceValue,
        reference_unit: observation.referenceUnit || 'kg',
        indicated_value: observation.indicatedValue,
        indicated_unit: observation.indicatedUnit || 'kg',
        additional_load_value: observation.additionalLoadValue,
        additional_load_unit: observation.additionalLoadUnit,
        pre_rounding_indication_value: observation.preRoundingIndicationValue,
        raw_error_value: observation.rawErrorValue,
        zero_error_value: observation.zeroErrorValue,
        corrected_error_value: observation.correctedErrorValue,
        mpe_value: observation.mpeValue,
        result_unit: observation.resultUnit || 'g',
        result: dbResult,
        position_label: observation.positionLabel,
        run_number: observation.runNumber,
        rule_reference: observation.ruleReference || 'OIML R 76-1',
        calculation_trace: observation.calculationTrace || {},
        raw_metadata: observation.rawMetadata || {},
        recorded_by: userId,
      };

      let resultData;
      if (existingRow?.id) {
        const { data, error } = await supabase
          .from('test_observations')
          .update(payload)
          .eq('id', existingRow.id)
          .select()
          .single();
        if (error) throw new Error(`Failed to update observation in Supabase: ${error.message}`);
        resultData = data;
      } else {
        const { data, error } = await supabase
          .from('test_observations')
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(`Failed to insert observation in Supabase: ${error.message}`);
        resultData = data;
      }

      // Update parent session_tests status
      await supabase
        .from('session_tests')
        .update({
          completion_status: 'COMPLETED',
          result: dbResult,
        })
        .eq('id', sessionTestId);

      try {
        await auditService.logAuditEvent({
          action: existingRow?.id ? 'OBSERVATION_UPDATED' : 'OBSERVATION_CREATED',
          entityType: 'test_observation',
          entityId: resultData.id,
          beforeValue: existingRow ? { indicated_value: existingRow.indicated_value } : null,
          afterValue: { indicated_value: resultData.indicated_value, result: resultData.result },
          details: {
            description: existingRow?.id
              ? `Updated ${dbObsType} observation #${obsNo}`
              : `Recorded new ${dbObsType} observation #${obsNo}`,
          },
        });
      } catch (_auditErr) {
        // Ignore audit log error if table missing
      }

      return resultData;
    }
    return observation;
  },

  /**
   * Save Accuracy / Weighing Observation
   */
  async saveWeighingObservation(sessionTestId: string, obs: WeighingTestObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'WEIGHING',
      referenceValue: obs.load,
      referenceUnit: 'kg',
      indicatedValue: obs.indicatedValue,
      indicatedUnit: 'kg',
      additionalLoadValue: obs.deltaL,
      additionalLoadUnit: 'g',
      preRoundingIndicationValue: obs.indicatedValue,
      rawErrorValue: obs.calculatedError,
      correctedErrorValue: obs.adjustedError,
      mpeValue: obs.mpeLimit,
      resultUnit: obs.mpeUnit || 'g',
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      ruleReference: 'OIML R 76-1 Clause 3.5 / A.4.4',
      calculationTrace: {
        direction: obs.direction,
        mpeLimit: obs.mpeLimit,
        mpeStatus: obs.mpeStatus,
      },
      rawMetadata: {
        indicatedDifferenceFormatted: obs.indicatedDifferenceFormatted,
        notes: obs.notes,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Repeatability Observation
   */
  async saveRepeatabilityObservation(sessionTestId: string, obs: RepeatabilityTestObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'REPEATABILITY',
      referenceValue: obs.load,
      indicatedValue: obs.indicatedValue,
      rawErrorValue: obs.error,
      runNumber: obs.runNumber,
      ruleReference: 'OIML R 76-1 Clause 3.6.1 / A.4.10',
      calculationTrace: {
        zeroIndication: obs.zeroIndication,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Eccentricity Observation
   */
  async saveEccentricityObservation(sessionTestId: string, obs: EccentricityTestObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.notes || undefined,
      observationType: 'ECCENTRICITY',
      referenceValue: obs.load,
      indicatedValue: obs.indicatedValue,
      rawErrorValue: obs.error,
      mpeValue: obs.mpeValue,
      resultUnit: obs.mpeUnit || 'g',
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      positionLabel: obs.locationLabel,
      runNumber: obs.position,
      ruleReference: 'OIML R 76-1 Clause 3.6.2 / A.4.7',
      recordedBy: userId,
    });
  },

  /**
   * Save Discrimination Observation
   */
  async saveDiscriminationObservation(sessionTestId: string, obs: DiscriminationTestObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'DISCRIMINATION',
      referenceValue: obs.load,
      referenceUnit: obs.loadUnit,
      indicatedValue: obs.finalIndication || obs.initialIndication,
      indicatedUnit: obs.dUnit,
      additionalLoadValue: obs.additionalLoad || 0,
      additionalLoadUnit: 'g',
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      positionLabel: obs.testPointId,
      ruleReference: 'OIML R 76-1 Clause 3.8 / A.4.8',
      rawMetadata: {
        testPointLabel: obs.testPointLabel,
        scaleIntervalD: obs.scaleIntervalD,
        oneTenthD: obs.oneTenthD,
        onePointFourD: obs.onePointFourD,
        transitionIndication: obs.transitionIndication,
        finalIndication: obs.finalIndication,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Zero-Setting Accuracy Observation
   */
  async saveZeroSettingObservation(sessionTestId: string, obs: ZeroSettingTestObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'ZERO_SETTING',
      referenceValue: 0,
      indicatedValue: 0,
      additionalLoadValue: obs.changeoverAdditionalLoad,
      additionalLoadUnit: 'g',
      correctedErrorValue: obs.calculatedZeroError,
      zeroErrorValue: obs.calculatedZeroError,
      mpeValue: obs.permissibleZeroDeviation,
      resultUnit: obs.eUnit,
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      ruleReference: 'OIML R 76-1 Clause 4.5.2 / A.4.2.3',
      rawMetadata: {
        zeroSettingType: obs.zeroSettingType,
        verificationIntervalE: obs.verificationIntervalE,
        suggestedIncrement: obs.suggestedIncrement,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Tare Setting Observation
   */
  async saveTareSettingObservation(sessionTestId: string, obs: TareSettingObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'TARE_SETTING',
      referenceValue: obs.appliedTareLoad,
      referenceUnit: obs.tareLoadUnit,
      indicatedValue: obs.displayedIndicationAfterTare,
      additionalLoadValue: obs.changeoverAdditionalLoad,
      additionalLoadUnit: 'g',
      correctedErrorValue: obs.calculatedTareZeroError,
      zeroErrorValue: obs.calculatedTareZeroError,
      mpeValue: obs.permissibleTareZeroError,
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      ruleReference: 'OIML R 76-1 Clause 4.6.3 / A.4.6.2',
      rawMetadata: {
        suggestedIncrement: obs.suggestedIncrement,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Tare Net Weighing Observation
   */
  async saveTareNetWeighingObservation(sessionTestId: string, obs: TareNetWeighingObservation, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'NET_WEIGHING',
      referenceValue: obs.referenceNetLoad,
      indicatedValue: obs.displayedNetReading,
      rawErrorValue: obs.netError,
      mpeValue: obs.mpeLimit,
      resultUnit: obs.mpeUnit,
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      runNumber: obs.stepIndex,
      positionLabel: obs.stepLabel,
      ruleReference: 'OIML R 76-1 Clause 3.5.3.3 / A.4.6.1',
      rawMetadata: {
        appliedTareLoad: obs.appliedTareLoad,
        calculatedGrossLoad: obs.calculatedGrossLoad,
        netErrorFormatted: obs.netErrorFormatted,
      },
      recordedBy: userId,
    });
  },

  /**
   * Save Static Temperature Observation
   */
  async saveStaticTemperatureObservation(sessionTestId: string, obs: any, userId?: string) {
    return this.saveObservation(sessionTestId, {
      id: obs.id,
      observationType: 'STATIC_TEMP',
      referenceValue: obs.temperature,
      referenceUnit: '°C',
      indicatedValue: obs.indicatedValue,
      rawErrorValue: obs.error,
      runNumber: obs.stepIndex || obs.temperature,
      positionLabel: obs.stepLabel || `${obs.temperature}°C`,
      result: obs.passed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT',
      ruleReference: 'OIML R 76-1 Clause 5.3.1 / A.5.3.1',
      recordedBy: userId,
    });
  },

  /**
   * Save Environmental Conditions Data
   */
  async saveEnvironmentalConditions(sessionId: string, envData: EnvironmentalConditionsData) {
    if (!isSupabaseConfigured() || !supabase) return;

    const { data: dbSess } = await supabase
      .from('test_sessions')
      .select('id, raw_metadata')
      .or(`id.eq.${sessionId},session_code.eq.${sessionId}`)
      .maybeSingle();

    if (!dbSess) return;

    const updatedMetadata = {
      ...(dbSess.raw_metadata || {}),
      environmentalConditions: envData,
    };

    const startTemp = envData?.start?.temp !== undefined && !isNaN(Number(envData.start.temp)) ? Number(envData.start.temp) : undefined;
    const startHum = envData?.start?.humidity !== undefined && !isNaN(Number(envData.start.humidity)) ? Number(envData.start.humidity) : undefined;
    const startPress = envData?.start?.pressure !== undefined && !isNaN(Number(envData.start.pressure)) ? Number(envData.start.pressure) : undefined;

    const { error } = await supabase
      .from('test_sessions')
      .update({
        raw_metadata: updatedMetadata,
        ...(startTemp !== undefined ? { ambient_temp: startTemp } : {}),
        ...(startHum !== undefined ? { relative_humidity: startHum } : {}),
        ...(startPress !== undefined ? { barometric_pressure: startPress } : {}),
      })
      .eq('id', dbSess.id);

    if (error) {
      throw new Error(`Failed to save environmental conditions in Supabase: ${error.message}`);
    }
  },
};

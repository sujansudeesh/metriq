import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Instrument, MassUnit } from '../types';
import { calculateVerificationIntervals, convertMassUnit } from '../utils/metrologyService';
import { getInstrumentsStore, addInstrument as addInstrumentToMockStore } from '../mock/store';
import { auditService } from './auditService';

// DB Allowed Units for check constraints
const ALLOWED_DB_UNITS = ['mg', 'g', 'kg', 't'];

function sanitizeUnitForDb(unit: string | undefined): { valueFactor: number; dbUnit: string } {
  if (!unit || unit === 'ct') {
    return { valueFactor: 0.2, dbUnit: 'g' }; // 1 ct = 0.2 g
  }
  if (ALLOWED_DB_UNITS.includes(unit)) {
    return { valueFactor: 1, dbUnit: unit };
  }
  return { valueFactor: 1, dbUnit: 'kg' };
}

export const instrumentService = {
  /**
   * Fetch all instruments from Supabase or Local Mock Store
   */
  async getInstruments(): Promise<Instrument[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch instruments from Supabase: ${error.message}`);
      }

      return (data || []).map((row) => this.mapRowToInstrument(row));
    }

    return getInstrumentsStore();
  },

  /**
   * Fetch single instrument by ID or Code
   */
  async getInstrumentById(id: string): Promise<Instrument | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('instruments')
        .select('*')
        .or(`id.eq.${id},instrument_code.eq.${id}`)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch instrument from Supabase: ${error.message}`);
      }

      if (data) {
        return this.mapRowToInstrument(data);
      }
      return null;
    }

    const instruments = getInstrumentsStore();
    return instruments.find((i) => i.id === id || i.metrology.accuracyClass === id) || null;
  },

  /**
   * Save a new instrument
   * Calculates n = Max / e using metrology service before storing!
   */
  async saveInstrument(instrument: Instrument): Promise<Instrument> {
    const existing = await this.getInstrumentById(instrument.id).catch(() => null);

    // 1. Calculate verified n value using existing metrology service
    const verifiedN = calculateVerificationIntervals(
      instrument.metrology.maxCapacity,
      instrument.metrology.maxUnit,
      instrument.metrology.verificationIntervalE,
      instrument.metrology.eUnit
    );

    const verifiedInstrument: Instrument = {
      ...instrument,
      metrology: {
        ...instrument.metrology,
        verificationScaleIntervalsN: verifiedN,
      },
    };

    let savedInstrument: Instrument;

    if (isSupabaseConfigured() && supabase) {
      const row = this.mapInstrumentToRow(verifiedInstrument);
      const { data, error } = await supabase
        .from('instruments')
        .insert(row)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save instrument to database: ${error.message}`);
      }

      savedInstrument = this.mapRowToInstrument(data);
    } else {
      // Local Store Fallback (Demo / Offline Mode)
      addInstrumentToMockStore(verifiedInstrument);
      savedInstrument = verifiedInstrument;
    }

    try {
      await auditService.logAuditEvent({
        action: existing ? 'INSTRUMENT_UPDATED' : 'INSTRUMENT_CREATED',
        entityType: 'instrument',
        entityId: savedInstrument.id,
        instrumentId: savedInstrument.id,
        beforeValue: existing ? existing : null,
        afterValue: savedInstrument,
        details: {
          description: existing
            ? `Updated instrument ${savedInstrument.id} (${savedInstrument.model?.modelName || 'Scale'})`
            : `Created new instrument ${savedInstrument.id} (${savedInstrument.model?.modelName || 'Scale'})`,
        },
      });
    } catch (_auditErr) {
      // Don't interrupt instrument save if audit table log fails
    }

    return savedInstrument;
  },

  /**
   * Map Supabase DB Row to Instrument Frontend Type
   */
  mapRowToInstrument(row: any): Instrument {
    const verifiedN = calculateVerificationIntervals(
      Number(row.max_capacity),
      row.max_unit || 'g',
      Number(row.verification_interval_e),
      row.verification_interval_e_unit || 'g'
    );

    // Canonical Class formatting ('III' -> 'Class III' for frontend)
    const rawClass = row.accuracy_class || 'III';
    const accuracyClass = rawClass.startsWith('Class') ? rawClass : `Class ${rawClass}`;

    return {
      id: row.id,
      manufacturer: {
        name: row.manufacturer || 'Unknown Manufacturer',
        address: 'Registered Metrology Facility',
        country: 'India',
        contactPerson: 'Technical Director',
        email: 'info@manufacturer.demo',
        phone: '+91 00000 00000',
      },
      model: {
        instrumentType: row.instrument_type || 'Electronic Weighing Scale',
        modelName: row.model || row.instrument_code || 'Model Standard',
        serialNumber: row.serial_number || row.instrument_code,
        firmwareVersion: 'v1.0.0-OIML',
        yearOfManufacture: 2026,
        intendedApplication: 'Commercial Trade & Legal Verification',
      },
      metrology: {
        accuracyClass: accuracyClass as any,
        maxCapacity: Number(row.max_capacity),
        maxUnit: row.max_unit || 'kg',
        minCapacity: Number(row.min_capacity),
        minUnit: row.min_unit || 'kg',
        scaleIntervalD: Number(row.scale_interval_d),
        dUnit: row.scale_interval_d_unit || 'g',
        verificationIntervalE: Number(row.verification_interval_e),
        eUnit: row.verification_interval_e_unit || 'g',
        verificationScaleIntervalsN: Number(row.verification_intervals_n) || verifiedN,
        tareRange: Number(row.maximum_tare_effect) || 0,
        tempRangeMin: -10,
        tempRangeMax: 40,
        isMultiInterval: false,
        zeroSettingType: row.zero_setting_type || 'SEMI_AUTOMATIC',
        tareDeviceAvailable: Boolean(row.tare_device_available),
        tareType: row.tare_type || 'NONE',
        maximumTareEffect: Number(row.maximum_tare_effect) || 0,
        maximumTareUnit: row.maximum_tare_unit || 'kg',
      },
      registeredDate: (row.created_at || new Date().toISOString()).substring(0, 10),
      lastEvaluated: (row.updated_at || new Date().toISOString()).substring(0, 10),
      status: (row.status === 'ACTIVE' || row.status === 'INACTIVE' || row.status === 'OUT_OF_SERVICE')
        ? row.status
        : 'ACTIVE',
    };
  },

  /**
   * Map Instrument Frontend Type to Supabase DB Row
   */
  mapInstrumentToRow(instrument: Instrument): any {
    const verifiedN = calculateVerificationIntervals(
      instrument.metrology.maxCapacity,
      instrument.metrology.maxUnit,
      instrument.metrology.verificationIntervalE,
      instrument.metrology.eUnit
    );

    // Convert frontend 'Class III' -> Canonical DB format 'III'
    const canonicalClass = (instrument.metrology.accuracyClass || 'Class III').replace(/^Class\s*/i, '');

    const masterStatus = (instrument.status === 'ACTIVE' || instrument.status === 'INACTIVE' || instrument.status === 'OUT_OF_SERVICE')
      ? instrument.status
      : 'ACTIVE';

    const maxSan = sanitizeUnitForDb(instrument.metrology.maxUnit);
    const minSan = sanitizeUnitForDb(instrument.metrology.minUnit);
    const dSan = sanitizeUnitForDb(instrument.metrology.dUnit);
    const eSan = sanitizeUnitForDb(instrument.metrology.eUnit);
    const tareSan = sanitizeUnitForDb(instrument.metrology.maximumTareUnit);

    return {
      instrument_code: instrument.id.startsWith('INS-') || instrument.id.startsWith('NAWI-') ? instrument.id : `INS-${Date.now()}`,
      manufacturer: instrument.manufacturer?.name || 'Unknown Manufacturer',
      model: instrument.model?.modelName || 'Model Standard',
      serial_number: instrument.model?.serialNumber || instrument.id,
      instrument_type: instrument.model?.instrumentType || 'Electronic Weighing Scale',
      accuracy_class: canonicalClass,
      max_capacity: instrument.metrology.maxCapacity * maxSan.valueFactor,
      max_unit: maxSan.dbUnit,
      min_capacity: instrument.metrology.minCapacity * minSan.valueFactor,
      min_unit: minSan.dbUnit,
      scale_interval_d: instrument.metrology.scaleIntervalD * dSan.valueFactor,
      scale_interval_d_unit: dSan.dbUnit,
      verification_interval_e: instrument.metrology.verificationIntervalE * eSan.valueFactor,
      verification_interval_e_unit: eSan.dbUnit,
      verification_intervals_n: verifiedN,
      digital_indication: true,
      zero_setting_type: instrument.metrology.zeroSettingType || 'SEMI_AUTOMATIC',
      tare_device_available: Boolean(instrument.metrology.tareDeviceAvailable),
      tare_type: instrument.metrology.tareType || 'NONE',
      maximum_tare_effect: (instrument.metrology.maximumTareEffect || 0) * tareSan.valueFactor,
      maximum_tare_unit: tareSan.dbUnit,
      load_receptor_type: 'PLATFORM',
      number_of_supports: 4,
      status: masterStatus,
    };
  },
};

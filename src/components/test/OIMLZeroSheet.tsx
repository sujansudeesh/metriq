import React, { useState } from 'react';
import { TestSession, ZeroSettingTestObservation, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { evaluateZeroSettingAccuracy } from '../../services/zeroSettingService';
import { Plus } from 'lucide-react';

interface OIMLZeroSheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveObservation: (obs: ZeroSettingTestObservation) => void;
  onDeleteObservation?: () => void;
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLZeroSheet: React.FC<OIMLZeroSheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
}) => {
  const zeroSettingType = session.zeroSettingType || 'SEMI_AUTOMATIC';
  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const [deltaLInput, setDeltaLInput] = useState<string>('2.0');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const deltaLNum = parseFloat(deltaLInput) || 0;
  const suggestedIncrement = Number((eVal * 0.1).toFixed(2));

  const evaluatedObs = evaluateZeroSettingAccuracy({
    zeroSettingType,
    eVal,
    eUnit,
    changeoverAdditionalLoad: deltaLNum,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newObs: ZeroSettingTestObservation = {
      id: `zero-${Date.now()}`,
      zeroSettingType,
      verificationIntervalE: eVal,
      eUnit,
      suggestedIncrement,
      changeoverAdditionalLoad: deltaLNum,
      calculatedZeroError: evaluatedObs.zeroError,
      permissibleZeroDeviation: evaluatedObs.permissibleZeroDeviation,
      passed: evaluatedObs.passed,
      resultStatus: evaluatedObs.resultStatus,
      isCompleted: true,
      notes: remarks,
    };
    onSaveObservation(newObs);
  };

  const obsList = session.zeroSettingObservations || [];
  const currentObs = obsList[0];
  const isPassed = currentObs?.passed ?? evaluatedObs.passed;
  const overallStatus = obsList.length === 0 ? 'NOT_STARTED' : isPassed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Zero Setting Evaluation (OIML R 76-1 Clause 4.5.2)',
    appliedLoad: `Zero Load`,
    observedIndication: `Changeover Load ΔL = ${deltaLNum} g`,
    additionalLoad: `${deltaLNum} g`,
    calculatedError: `E0 = 0.5e − ΔL = ${evaluatedObs.zeroError} g`,
    correctedError: `E0 = ${evaluatedObs.zeroError} g`,
    mpeLimit: `±0.25e (±${evaluatedObs.permissibleZeroDeviation} g)`,
    ruleReference: 'OIML R 76-1:2006 Clause 4.5.2 / A.4.2.3',
    comparison: `|E0| ≤ 0.25e ⟹ |${evaluatedObs.zeroError}| ≤ ${evaluatedObs.permissibleZeroDeviation} g (${isPassed ? 'SATISFIED' : 'EXCEEDED'})`,
    resultStatus: isPassed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 6"
      sheetTitle="ACCURACY OF ZERO-SETTING & ZERO RETURN"
      clauseReference="OIML R 76-2:2007 Clause 4.5.2 / A.4.2.3 & A.4.2.4"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 6"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Zero Setting Formula (OIML R 76-1 Clause 4.5.2):</div>
        <div className="text-slate-700">
          <span className="font-bold text-teal-800">E0 = ½e − ΔL</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-teal-800">|E0| ≤ ±0.25e</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="text-slate-600">Limit = ±{evaluatedObs.permissibleZeroDeviation} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-teal-600 rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-teal-900 uppercase font-sans">
            Officer Observation Entry — Changeover Load:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 font-sans">Zero Device Type</label>
              <input
                type="text"
                disabled
                value={zeroSettingType}
                className="w-full bg-slate-100 text-slate-700 border border-slate-300 font-mono px-2 py-1 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Add. Load ΔL ({eUnit}) *</label>
              <input
                type="number"
                step="any"
                required
                value={deltaLInput}
                onChange={(e) => setDeltaLInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div className="bg-sky-50 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">Zero Error E0</span>
              <span className="font-mono font-bold text-xs text-slate-900">
                {evaluatedObs.zeroError > 0 ? `+${evaluatedObs.zeroError}` : evaluatedObs.zeroError} {eUnit}
              </span>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">Permissible (±0.25e)</span>
              <span className="font-mono font-bold text-xs text-slate-900">±{evaluatedObs.permissibleZeroDeviation} {eUnit}</span>
            </div>

            <div className="flex items-end col-span-2">
              <button
                type="submit"
                className="w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Zero Observation
              </button>
            </div>
          </div>
        </form>
      )}

      {/* OFFICIAL OIML R 76-2 ZERO TABLE */}
      <div className="overflow-x-auto border border-slate-400">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] font-sans border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-300">Device Type</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Verification e</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Add Load ΔL ({eUnit})</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-bold">Calculated Error E0</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Permissible Limit (±0.25e)</th>
              <th className="py-2 px-2 text-center font-sans">Result (|E0| ≤ 0.25e)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            <tr className={isPassed ? 'bg-white' : 'bg-rose-50'}>
              <td className="py-2 px-2 border-r border-slate-300 font-sans font-bold text-slate-800">
                {zeroSettingType}
              </td>
              <td className="py-2 px-2 border-r border-slate-300 text-right font-bold bg-slate-100">
                {eVal} {eUnit}
              </td>
              <td className="py-2 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                {deltaLNum} {eUnit}
              </td>
              <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold text-slate-900">
                {evaluatedObs.zeroError > 0 ? `+${evaluatedObs.zeroError}` : evaluatedObs.zeroError} {eUnit}
              </td>
              <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 font-bold text-slate-800">
                ±{evaluatedObs.permissibleZeroDeviation} {eUnit}
              </td>
              <td className="py-2 px-2 text-center font-sans">
                {isPassed ? (
                  <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300">
                    PASSED (|E0| ≤ {evaluatedObs.permissibleZeroDeviation} {eUnit})
                  </span>
                ) : (
                  <span className="text-rose-800 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded-xs border border-rose-300">
                    FAILED (|E0| &gt; {evaluatedObs.permissibleZeroDeviation} {eUnit})
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DigitalOIMLTestSheet>
  );
};

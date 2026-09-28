import React, { useState } from 'react';
import { TestSession, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { Plus } from 'lucide-react';

interface OIMLDiscriminationSheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveObservation?: (obs: any) => void;
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLDiscriminationSheet: React.FC<OIMLDiscriminationSheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
}) => {
  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);
  const dVal = parseFloat(session.scaleInterval || '') || eVal; // d scale interval

  const [loadLInput, setLoadLInput] = useState<string>('10.000');
  const [i1Input, setI1Input] = useState<string>('10.000');
  const [deltaLInput, setDeltaLInput] = useState<string>('0.000');
  const [i2Input, setI2Input] = useState<string>('10.005');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const loadNum = parseFloat(loadLInput) || 0;
  const i1Num = parseFloat(i1Input) || 0;
  const deltaLNum = parseFloat(deltaLInput) || 0;
  const i2Num = parseFloat(i2Input) || 0;

  const oneTenthD = 0.1 * (dVal / 1000); // in kg
  const extraLoad14D = 1.4 * (dVal / 1000); // in kg
  const i2MinusI1 = (i2Num - i1Num) * 1000; // in g
  const isPassed = i2MinusI1 >= (dVal - 1e-6);

  const observations = session.discriminationObservations || [
    {
      id: 'disc-1',
      load: loadNum,
      i1: i1Num,
      removedDeltaL: deltaLNum,
      addOneTenthD: oneTenthD * 1000,
      extraLoad: extraLoad14D * 1000,
      i2: i2Num,
      diff: i2MinusI1,
      passed: isPassed,
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newObs = {
      id: `disc-${Date.now()}`,
      load: loadNum,
      i1: i1Num,
      removedDeltaL: deltaLNum,
      addOneTenthD: oneTenthD * 1000,
      extraLoad: extraLoad14D * 1000,
      i2: i2Num,
      diff: i2MinusI1,
      passed: isPassed,
    };

    if (onSaveObservation) onSaveObservation(newObs);
  };

  const overallStatus = observations.length === 0 ? 'NOT_STARTED' : isPassed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Digital Discrimination Evaluation',
    appliedLoad: `${loadNum} kg`,
    observedIndication: `I1 = ${i1Num} kg, I2 = ${i2Num} kg`,
    additionalLoad: `Extra Load 1.4d = ${(extraLoad14D * 1000).toFixed(2)} g`,
    calculatedError: `I2 − I1 = ${i2MinusI1.toFixed(1)} g`,
    correctedError: `I2 − I1 = ${i2MinusI1.toFixed(1)} g`,
    mpeLimit: `Required ≥ d (${dVal} g)`,
    ruleReference: 'OIML R 76-1:2006 Clause 3.8 / OIML R 76-2 Section 4.1.1',
    comparison: `(I2 − I1) ≥ d ⟹ ${i2MinusI1.toFixed(1)} g ≥ ${dVal} g (${isPassed ? 'SATISFIED' : 'FAILED'})`,
    resultStatus: isPassed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 4"
      sheetTitle="DISCRIMINATION AND SENSITIVITY — 4.1.1 Digital indication"
      clauseReference="OIML R 76-2:2007 Clause 3.8 / A.4.8 / Section 4.1.1"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 3"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Discrimination Rule (OIML R 76-1 Clause 3.8):</div>
        <div className="text-slate-700">
          An extra load of <span className="font-bold text-teal-800">1.4d</span> applied gently to the load receptor shall produce a clear change in indication <span className="font-bold text-teal-800">I2 − I1 ≥ d</span>.
          &nbsp;&nbsp;|&nbsp;&nbsp;<span className="text-slate-600">Scale interval d = {dVal} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-teal-600 rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-teal-900 uppercase font-sans">
            Officer Observation Entry (Digital Discrimination Test Point):
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Load, L (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={loadLInput}
                onChange={(e) => setLoadLInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Indication, I1 (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={i1Input}
                onChange={(e) => setI1Input(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 font-sans">Removed ΔL (g)</label>
              <input
                type="number"
                step="any"
                value={deltaLInput}
                onChange={(e) => setDeltaLInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Indication, I2 (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={i2Input}
                onChange={(e) => setI2Input(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div className="bg-sky-50 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">I2 − I1 (g)</span>
              <span className="font-mono font-bold text-xs text-slate-900">{i2MinusI1.toFixed(1)} g</span>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Discrimination
              </button>
            </div>
          </div>
        </form>
      )}

      {/* OFFICIAL OIML R 76-2 DISCRIMINATION TABLE */}
      <div className="overflow-x-auto border border-slate-400">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] font-sans border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Load, L (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Indication, I1 (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right">Removed Load ΔL (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Add 1/10 d (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Extra Load = 1.4 d (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Indication, I2 (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold">I2 − I1 (g)</th>
              <th className="py-2 px-2 text-center font-sans">Check (I2 − I1 ≥ d)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {observations.map((obs: any, idx: number) => (
              <tr key={obs.id || idx} className={obs.passed ? 'bg-white' : 'bg-rose-50'}>
                <td className="py-2 px-2 border-r border-slate-300 text-right font-bold bg-slate-100">
                  {obs.load.toFixed(3)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                  {obs.i1.toFixed(3)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right text-slate-700">
                  {obs.removedDeltaL !== undefined ? obs.removedDeltaL : '0.0'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 text-slate-800">
                  {(0.1 * dVal).toFixed(2)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 font-bold text-slate-800">
                  {(1.4 * dVal).toFixed(2)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                  {obs.i2.toFixed(3)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold text-slate-900">
                  {obs.diff !== undefined ? obs.diff.toFixed(1) : (obs.i2 - obs.i1).toFixed(1)} g
                </td>
                <td className="py-2 px-2 text-center font-sans">
                  {obs.passed ? (
                    <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300">
                      PASSED (I2 − I1 ≥ {dVal} g)
                    </span>
                  ) : (
                    <span className="text-rose-800 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded-xs border border-rose-300">
                      FAILED (I2 − I1 &lt; {dVal} g)
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DigitalOIMLTestSheet>
  );
};

import React, { useState } from 'react';
import { TestSession, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { Plus, Trash2 } from 'lucide-react';

interface OIMLRepeatabilitySheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveObservation?: (obs: any) => void;
  onDeleteObservation?: (runId: string) => void;
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLRepeatabilitySheet: React.FC<OIMLRepeatabilitySheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
  onDeleteObservation,
}) => {
  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const [testLoadInput, setTestLoadInput] = useState<string>('10.000');
  const [readingInput, setReadingInput] = useState<string>('10.002');
  const [deltaLInput, setDeltaLInput] = useState<string>('0.000');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const observations = session.repeatabilityObservations || [];
  const runNumber = observations.length + 1;

  const testLoadNum = parseFloat(testLoadInput) || 10;
  const indNum = parseFloat(readingInput) || 10;
  const deltaLNum = parseFloat(deltaLInput) || 0;

  const calcError = Math.round(((indNum - testLoadNum) * 1000) * 10) / 10; // in g

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (runNumber > 20) return;

    const newObs = {
      id: `rep-${Date.now()}`,
      runNumber,
      testLoad: testLoadNum,
      indicatedValue: indNum,
      deltaL: deltaLNum,
      calculatedError: calcError,
      passed: Math.abs(calcError) <= eVal,
    };

    if (onSaveObservation) onSaveObservation(newObs);
  };

  const errors = observations.map((o: any) => o.calculatedError ?? o.error ?? 0);
  const maxErr = errors.length > 0 ? Math.max(...errors) : 0;
  const minErr = errors.length > 0 ? Math.min(...errors) : 0;
  const spread = Math.round((maxErr - minErr) * 10) / 10;

  const mpeLimit = eVal; // mpe limit for repeatability load
  const isSpreadPassed = spread <= mpeLimit;
  const isAllPointPassed = observations.every((o: any) => (o.passed !== undefined ? o.passed : Math.abs(o.calculatedError) <= mpeLimit));
  const isOverallPassed = observations.length >= 3 && isSpreadPassed && isAllPointPassed;

  const overallStatus = observations.length === 0 ? 'NOT_STARTED' : isOverallPassed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Repeatability Evaluation (OIML R 76-1 Clause 3.6.1)',
    appliedLoad: `${testLoadNum} kg`,
    observedIndication: `Emax = ${maxErr > 0 ? '+' : ''}${maxErr} g, Emin = ${minErr > 0 ? '+' : ''}${minErr} g`,
    calculatedError: `Emax − Emin = ${spread} g`,
    correctedError: `Spread = ${spread} g`,
    mpeLimit: `MPE = ±${mpeLimit} ${eUnit}`,
    ruleReference: 'OIML R 76-1:2006 Clause 3.6.1 / A.4.10',
    comparison: `(Emax − Emin) ≤ |mpe| ⟹ ${spread} g ≤ ${mpeLimit} g (${isSpreadPassed ? 'SATISFIED' : 'EXCEEDED'})`,
    resultStatus: isOverallPassed ? 'PASSED' : 'FAILED',
  };

  // Split observations into Left Block (1-10) and Right Block (11-20)
  const leftBlockObs = observations.filter((o: any) => (o.runNumber || 0) <= 10);
  const rightBlockObs = observations.filter((o: any) => (o.runNumber || 0) > 10);

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 5"
      sheetTitle="REPEATABILITY (A.4.10)"
      clauseReference="OIML R 76-2:2007 Clause 3.6.1 / A.4.10"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 4"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Repeatability Formula (OIML R 76-1 Clause 3.6.1):</div>
        <div className="text-slate-700">
          <span className="font-bold text-teal-800">E = I + ½e − ΔL − L</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-teal-800">Spread = Emax − Emin ≤ |mpe|</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="text-slate-600">mpe = ±{mpeLimit} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && runNumber <= 20 && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-teal-600 rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-teal-900 uppercase font-sans flex justify-between">
            <span>Officer Entry — Weighing Run #{runNumber} of 10 (or 20)</span>
            <span className="font-mono text-slate-700">Test Load: {testLoadInput} kg</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Test Load, L (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={testLoadInput}
                onChange={(e) => setTestLoadInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Indication, I (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={readingInput}
                onChange={(e) => setReadingInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 font-sans">Add Load, ΔL (g)</label>
              <input
                type="number"
                step="any"
                value={deltaLInput}
                onChange={(e) => setDeltaLInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div className="bg-sky-50 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">Calculated Error E (g)</span>
              <span className="font-mono font-bold text-xs text-slate-900">{calcError > 0 ? `+${calcError}` : calcError} g</span>
            </div>

            <div className="flex items-end col-span-2">
              <button
                type="submit"
                className="w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Weighing Run #{runNumber}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* DUAL BLOCK DENSE REPEATABILITY TABLE (1-10 LEFT, 11-20 RIGHT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT BLOCK: WEIGHINGS 1-10 */}
        <div className="border border-slate-400">
          <div className="bg-slate-200 text-slate-900 font-bold font-sans text-[11px] p-2 border-b border-slate-400 uppercase text-center">
            Weighings 1 – 10
          </div>
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] font-sans border-b border-slate-300">
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right">Indication I (kg)</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right">Add ΔL (g)</th>
                <th className="py-1.5 px-2 text-right bg-sky-50">Error E (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {Array.from({ length: 10 }).map((_, i) => {
                const runNo = i + 1;
                const obs = leftBlockObs.find((o: any) => o.runNumber === runNo);
                return (
                  <tr key={runNo} className={obs ? 'bg-white' : 'bg-slate-50 text-slate-400'}>
                    <td className="py-1 px-2 border-r border-slate-300 text-center font-bold text-slate-700 font-sans">
                      {runNo}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                      {obs ? obs.indicatedValue.toFixed(3) : '—'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-300 text-right text-slate-700">
                      {obs && obs.deltaL !== undefined ? obs.deltaL : '—'}
                    </td>
                    <td className="py-1 px-2 text-right bg-sky-50 font-bold text-slate-900">
                      {obs ? (
                        (obs.calculatedError ?? obs.error ?? 0) > 0
                          ? `+${obs.calculatedError ?? obs.error ?? 0}`
                          : `${obs.calculatedError ?? obs.error ?? 0}`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT BLOCK: WEIGHINGS 11-20 */}
        <div className="border border-slate-400">
          <div className="bg-slate-200 text-slate-900 font-bold font-sans text-[11px] p-2 border-b border-slate-400 uppercase text-center">
            Weighings 11 – 20
          </div>
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] font-sans border-b border-slate-300">
                <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right">Indication I (kg)</th>
                <th className="py-1.5 px-2 border-r border-slate-300 text-right">Add ΔL (g)</th>
                <th className="py-1.5 px-2 text-right bg-sky-50">Error E (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {Array.from({ length: 10 }).map((_, i) => {
                const runNo = i + 11;
                const obs = rightBlockObs.find((o: any) => o.runNumber === runNo);
                return (
                  <tr key={runNo} className={obs ? 'bg-white' : 'bg-slate-50 text-slate-400'}>
                    <td className="py-1 px-2 border-r border-slate-300 text-center font-bold text-slate-700 font-sans">
                      {runNo}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                      {obs ? obs.indicatedValue.toFixed(3) : '—'}
                    </td>
                    <td className="py-1 px-2 border-r border-slate-300 text-right text-slate-700">
                      {obs && obs.deltaL !== undefined ? obs.deltaL : '—'}
                    </td>
                    <td className="py-1 px-2 text-right bg-sky-50 font-bold text-slate-900">
                      {obs ? (
                        (obs.calculatedError ?? obs.error ?? 0) > 0
                          ? `+${obs.calculatedError ?? obs.error ?? 0}`
                          : `${obs.calculatedError ?? obs.error ?? 0}`
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY RESULTS BLOCK */}
      <div className="p-3 bg-slate-100 border border-slate-400 font-mono text-xs space-y-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-sans font-bold">
          <div>Emax: <span className="font-mono text-slate-900">{maxErr > 0 ? `+${maxErr}` : maxErr} g</span></div>
          <div>Emin: <span className="font-mono text-slate-900">{minErr > 0 ? `+${minErr}` : minErr} g</span></div>
          <div>Emax − Emin: <span className="font-mono text-teal-800">{spread} g</span></div>
          <div>mpe Limit: <span className="font-mono text-slate-900">±{mpeLimit} {eUnit}</span></div>
        </div>
        <div className="text-[11px] text-slate-700 font-sans pt-1 border-t border-slate-300">
          Check a) E ≤ mpe: <span className="font-bold">{isAllPointPassed ? 'PASSED' : 'FAILED'}</span> &nbsp;|&nbsp;
          Check b) Emax − Emin ≤ |mpe|: <span className="font-bold">{isSpreadPassed ? 'PASSED' : 'FAILED'}</span>
        </div>
      </div>
    </DigitalOIMLTestSheet>
  );
};

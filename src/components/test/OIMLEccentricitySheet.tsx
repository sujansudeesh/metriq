import React, { useState } from 'react';
import { TestSession, EccentricityTestObservation, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import {
  calculateEccentricityTestLoad,
  getEccentricityPositions,
  evaluateEccentricityPosition,
} from '../../services/eccentricityService';
import { Plus, Trash2 } from 'lucide-react';

interface OIMLEccentricitySheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveObservation: (obs: EccentricityTestObservation) => void;
  onDeleteObservation?: (posNo: number) => void;
  verificationMode?: 'INITIAL_VERIFICATION' | 'IN_SERVICE';
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLEccentricitySheet: React.FC<OIMLEccentricitySheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
  onDeleteObservation,
  verificationMode = 'INITIAL_VERIFICATION',
}) => {
  const eccProfile = session.eccentricityProfile || 'STANDARD_UP_TO_4_SUPPORTS';
  const eccNumSupports = session.eccentricityNumSupports || 4;
  const maxCapNum = parseFloat(session.maxCapacity) || 30;

  const testLoad = session.eccentricityTestLoad || calculateEccentricityTestLoad({
    maxCapacity: maxCapNum,
    maxUnit: 'kg',
    profile: eccProfile,
    numSupports: eccNumSupports,
  });

  const activePositions = getEccentricityPositions(eccProfile, eccNumSupports).filter((p) => p.id <= 4);
  const [selectedPosId, setSelectedPosId] = useState<number>(1);
  const [readingInput, setReadingInput] = useState<string>('10.000');
  const [deltaLInput, setDeltaLInput] = useState<string>('0.000');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const posConfig = activePositions.find((p) => p.id === selectedPosId) || activePositions[0];
  const observations = session.eccentricityObservations || [];

  const indValNum = parseFloat(readingInput) || 0;
  const deltaLNum = parseFloat(deltaLInput) || 0;

  const evaluatedObsPreview = evaluateEccentricityPosition({
    position: selectedPosId,
    locationLabel: posConfig.label,
    testLoad,
    testLoadUnit: 'kg',
    scaleReading: indValNum,
    scaleReadingUnit: 'kg',
    accuracyClass: session.accuracyClass,
    verificationScaleIntervalE: eVal,
    eUnit,
    verificationMode,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(indValNum)) return;

    onSaveObservation({
      ...evaluatedObsPreview,
      notes: remarks,
    });

    const nextPos = (selectedPosId % activePositions.length) + 1;
    setSelectedPosId(nextPos);
  };

  const completedCount = observations.length;
  const hasFailures = observations.some((o) => !o.passed);
  const overallStatus = completedCount < 4 ? 'IN_PROGRESS' : hasFailures ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';

  const currentObs = observations.find((o) => o.position === selectedPosId) || evaluatedObsPreview;

  const explanationDetail: ExplanationDetail = {
    title: 'Eccentricity Test Evaluation',
    appliedLoad: `${testLoad} kg (1/3 Max)`,
    observedIndication: `${indValNum} kg`,
    additionalLoad: `${deltaLNum} g`,
    calculatedError: `${currentObs.error > 0 ? '+' : ''}${currentObs.error} g`,
    correctedError: `${currentObs.error > 0 ? '+' : ''}${currentObs.error} g`,
    mpeLimit: `±${currentObs.mpeValue} ${currentObs.mpeUnit || 'g'}`,
    ruleReference: 'OIML R 76-1:2006 Clause 3.6.2 / A.4.7',
    comparison: `|Ec| ≤ |mpe| ⟹ |${currentObs.error}| ≤ |${currentObs.mpeValue}| (${currentObs.passed ? 'SATISFIED' : 'EXCEEDED'})`,
    resultStatus: currentObs.passed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 3"
      sheetTitle="ECCENTRICITY (3.1 Eccentricity using weights)"
      clauseReference="OIML R 76-2:2007 Clause 3.6.2 / A.4.7"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 2"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Metrological Formulas &amp; Test Load:</div>
        <div className="text-slate-700">
          <span className="font-bold text-teal-800">E = I + ½e − ΔL − L</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-teal-800">Ec = E − E0</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-slate-900">Applied Load L = {testLoad} kg</span> (1/3 Max)
        </div>
      </div>

      {/* REACT 4-POSITION LOAD RECEPTOR DIAGRAM & INPUT ROW */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-4 no-print">
        {/* Real React Diagram (2x2 Grid per OIML Standard) */}
        <div className="md:col-span-5 p-3 bg-slate-100 border border-slate-400 text-center font-sans">
          <span className="text-xs font-bold text-slate-800 uppercase block mb-2">
            Load Receptor Position Sketch (4 Supports)
          </span>
          <div className="w-48 h-48 mx-auto grid grid-cols-2 grid-rows-2 gap-1.5 p-2 bg-slate-300 border-2 border-slate-600 font-mono">
            {[1, 2, 4, 3].map((posId) => {
              const obs = observations.find((o) => o.position === posId);
              const isSelected = selectedPosId === posId;

              return (
                <button
                  key={posId}
                  type="button"
                  onClick={() => setSelectedPosId(posId)}
                  className={`flex flex-col items-center justify-center p-2 border font-bold text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-900 ring-2 ring-teal-400 shadow-md scale-105'
                      : obs
                      ? obs.passed
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-500'
                        : 'bg-rose-100 text-rose-950 border-rose-500'
                      : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs">Location {posId}</span>
                  {obs && (
                    <span className="text-[10px] font-normal">
                      {obs.indicatedValue.toFixed(3)} kg
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-600 font-mono block mt-2">
            Click position box above to select location for entry.
          </span>
        </div>

        {/* Officer Entry Box */}
        {!isReadOnly && (
          <form onSubmit={handleSubmit} className="md:col-span-7 p-3 bg-white border-2 border-teal-600 rounded-xs space-y-3">
            <div className="text-xs font-bold text-teal-900 uppercase font-sans border-b border-slate-200 pb-1 flex justify-between">
              <span>Officer Entry — Location {selectedPosId} ({posConfig.label})</span>
              <span className="font-mono text-slate-700">Test Load: {testLoad} kg</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 font-sans">Location</label>
                <select
                  value={selectedPosId}
                  onChange={(e) => setSelectedPosId(Number(e.target.value))}
                  className="w-full bg-white text-slate-900 border border-slate-400 font-mono px-2 py-1 text-xs"
                >
                  {activePositions.map((p) => (
                    <option key={p.id} value={p.id}>
                      Location {p.id} ({p.label})
                    </option>
                  ))}
                </select>
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
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="py-1.5 px-4 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Location {selectedPosId}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* OFFICIAL OIML R 76-2 ECCENTRICITY TABLE */}
      <div className="overflow-x-auto border border-slate-400">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] font-sans border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-300 w-16 text-center">Location</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Load, L (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Indication, I (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right">Add Load, ΔL (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50">Error, E (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold">Corrected Ec (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">mpe (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center font-sans">|Ec| ≤ |mpe|</th>
              <th className="py-2 px-2 text-center w-8 no-print">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {[1, 2, 3, 4].map((posId) => {
              const posConf = activePositions.find((p) => p.id === posId) || { label: `Location ${posId}` };
              const obs = observations.find((o) => o.position === posId);

              return (
                <tr key={posId} className={obs ? (obs.passed ? 'bg-white' : 'bg-rose-50') : 'bg-slate-50'}>
                  <td className="py-2 px-2 border-r border-slate-300 text-center font-bold text-slate-800 font-sans">
                    Loc {posId}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 font-bold">
                    {testLoad.toFixed(3)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                    {obs ? obs.indicatedValue.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right text-slate-700">
                    {obs && obs.deltaL !== undefined ? obs.deltaL : '0.0'}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 text-slate-900">
                    {obs ? (obs.error > 0 ? `+${obs.error}` : `${obs.error}`) : '—'}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold text-slate-900">
                    {obs ? (obs.error > 0 ? `+${obs.error}` : `${obs.error}`) : '—'}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 font-bold text-slate-800">
                    {obs ? `±${obs.mpeValue} ${obs.mpeUnit || 'g'}` : `±${eVal} ${eUnit}`}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-center font-sans">
                    {obs ? (
                      obs.passed ? (
                        <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded-xs border border-emerald-300">
                          PASSED
                        </span>
                      ) : (
                        <span className="text-rose-800 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded-xs border border-rose-300">
                          FAILED
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Pending</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center no-print">
                    {!isReadOnly && obs && onDeleteObservation && (
                      <button
                        type="button"
                        onClick={() => onDeleteObservation(posId)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Delete position observation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DigitalOIMLTestSheet>
  );
};

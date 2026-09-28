import React, { useState } from 'react';
import { TestSession, TareNetWeighingObservation, TareSettingObservation, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { evaluateMPEScaleReading } from '../../services/oimlComplianceService';
import { Plus, Trash2 } from 'lucide-react';

interface OIMLTareSheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveTareSetting?: (obs: TareSettingObservation) => void;
  onSaveNetObservation: (obs: TareNetWeighingObservation) => void;
  onDeleteNetObservation?: (stepIndex: number) => void;
  verificationMode?: 'INITIAL_VERIFICATION' | 'IN_SERVICE';
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLTareSheet: React.FC<OIMLTareSheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveNetObservation,
  onDeleteNetObservation,
  verificationMode = 'INITIAL_VERIFICATION',
}) => {
  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const [appliedTare, setAppliedTare] = useState<string>('5.000');
  const [netLoadInput, setNetLoadInput] = useState<string>('10.000');
  const [displayedNetInput, setDisplayedNetInput] = useState<string>('10.003');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const tareNum = parseFloat(appliedTare) || 5;
  const netLoadNum = parseFloat(netLoadInput) || 10;
  const displayedNetNum = parseFloat(displayedNetInput) || 10.003;

  const netObsList = session.tareObservations || session.tareTestSession?.netWeighingObservations || [];
  const nextStepIndex = netObsList.length + 1;

  const mpeCheck = evaluateMPEScaleReading({
    referenceLoad: netLoadNum,
    referenceLoadUnit: 'kg',
    scaleReading: displayedNetNum,
    scaleReadingUnit: 'kg',
    accuracyClass: session.accuracyClass,
    verificationScaleIntervalE: eVal,
    eUnit,
    verificationMode,
  });

  const netError = mpeCheck.indicatedDifference;
  const mpeLimit = mpeCheck.mpeResult.mpeValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(netLoadNum) || isNaN(displayedNetNum)) return;

    const netObs: TareNetWeighingObservation = {
      id: `to-${Date.now()}`,
      stepIndex: nextStepIndex,
      stepLabel: `Tare Point #${nextStepIndex} (${tareNum} kg Tare)`,
      appliedTareLoad: tareNum,
      referenceNetLoad: netLoadNum,
      displayedNetReading: displayedNetNum,
      calculatedGrossLoad: tareNum + netLoadNum,
      netError,
      netErrorFormatted: mpeCheck.indicatedDifferenceFormatted,
      mpeLimit,
      mpeUnit: mpeCheck.mpeResult.mpeUnit,
      mpeStatus: mpeCheck.status,
      passed: mpeCheck.isPassed,
      notes: remarks,
    };

    onSaveNetObservation(netObs);
  };

  const hasFailures = netObsList.some((o) => !o.passed);
  const overallStatus = netObsList.length === 0 ? 'NOT_STARTED' : hasFailures ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Tare Operation & Net Weighing Evaluation',
    appliedLoad: `Tare = ${tareNum} kg, Ref Net LNET = ${netLoadNum} kg`,
    observedIndication: `Displayed Net INET = ${displayedNetNum} kg`,
    additionalLoad: `Gross Load = ${(tareNum + netLoadNum).toFixed(3)} kg`,
    calculatedError: `ENET = ${netError > 0 ? '+' : ''}${netError} g`,
    correctedError: `ENET = ${netError > 0 ? '+' : ''}${netError} g`,
    mpeLimit: `±${mpeLimit} ${eUnit}`,
    ruleReference: 'OIML R 76-1:2006 Clause 4.6 / A.4.6',
    comparison: `|ENET| ≤ |mpe| ⟹ |${netError}| ≤ ${mpeLimit} g (${mpeCheck.isPassed ? 'SATISFIED' : 'EXCEEDED'})`,
    resultStatus: mpeCheck.isPassed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 7"
      sheetTitle="TARE OPERATION & NET WEIGHING"
      clauseReference="OIML R 76-2:2007 Clause 4.6 / A.4.6"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 7"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Tare &amp; Net Formula (OIML R 76-1 Clause 4.6):</div>
        <div className="text-slate-700">
          <span className="font-bold text-teal-800">ENET = INET − LNET</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-teal-800">|ENET| ≤ |mpe|</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="text-slate-600">e = {eVal} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-teal-600 rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-teal-900 uppercase font-sans">
            Officer Observation Entry — Tare Net Weighing Point #{nextStepIndex}:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 font-sans">Applied Tare (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={appliedTare}
                onChange={(e) => setAppliedTare(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Ref Net Load, LNET (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={netLoadInput}
                onChange={(e) => setNetLoadInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Displayed Net INET (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={displayedNetInput}
                onChange={(e) => setDisplayedNetInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div className="bg-sky-50 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">Net Error ENET (g)</span>
              <span className="font-mono font-bold text-xs text-slate-900">{netError > 0 ? `+${netError}` : netError} g</span>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-1 flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 font-sans uppercase">mpe Limit</span>
              <span className="font-mono font-bold text-xs text-slate-900">±{mpeLimit} {eUnit}</span>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Net Point
              </button>
            </div>
          </div>
        </form>
      )}

      {/* OFFICIAL OIML R 76-2 TARE TABLE */}
      <div className="overflow-x-auto border border-slate-400">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] font-sans border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right">Applied Tare (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Ref Net Load LNET (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Displayed Net INET (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-bold">Net Error ENET (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">mpe (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-center font-sans">|ENET| ≤ |mpe|</th>
              <th className="py-2 px-2 text-center w-8 no-print">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {netObsList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 font-sans italic bg-white">
                  No tare net weighing observations recorded yet. Enter tare load and net reading above.
                </td>
              </tr>
            ) : (
              netObsList.map((obs, idx) => (
                <tr key={obs.id || idx} className={obs.passed ? 'bg-white' : 'bg-rose-50'}>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-slate-700 font-sans">
                    {obs.stepIndex || idx + 1}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right text-slate-800">
                    {obs.appliedTareLoad.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold bg-slate-50">
                    {obs.referenceNetLoad.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold text-slate-900 bg-white">
                    {obs.displayedNetReading.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right bg-sky-50 font-extrabold text-slate-900">
                    {obs.netError > 0 ? `+${obs.netError}` : obs.netError} g
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-right bg-slate-100 font-bold text-slate-800">
                    ±{obs.mpeLimit} {obs.mpeUnit || 'g'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-slate-300 text-center font-sans">
                    {obs.passed ? (
                      <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded-xs border border-emerald-300">
                        PASSED
                      </span>
                    ) : (
                      <span className="text-rose-800 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded-xs border border-rose-300">
                        FAILED
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center no-print">
                    {!isReadOnly && onDeleteNetObservation && (
                      <button
                        type="button"
                        onClick={() => onDeleteNetObservation(obs.stepIndex)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DigitalOIMLTestSheet>
  );
};

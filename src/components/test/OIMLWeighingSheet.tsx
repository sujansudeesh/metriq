import React, { useState } from 'react';
import { TestSession, WeighingTestObservation, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { evaluateMPEScaleReading } from '../../services/oimlComplianceService';
import { Plus, Trash2 } from 'lucide-react';

interface OIMLWeighingSheetProps {
  session: TestSession;
  instrument?: any;
  activeRole?: any;
  isReadOnly?: boolean;
  onSaveObservation: (obs: WeighingTestObservation) => void;
  onDeleteObservation?: (obsId: string) => void;
  verificationMode?: 'INITIAL_VERIFICATION' | 'IN_SERVICE';
}

const parseVerificationInterval = (intervalStr?: string): { eVal: number; eUnit: MassUnit } => {
  if (!intervalStr) return { eVal: 10, eUnit: 'g' };
  const parts = intervalStr.trim().split(/\s+/);
  const val = parseFloat(parts[0]);
  const unit = (parts[1] as MassUnit) || 'g';
  return { eVal: isNaN(val) ? 10 : val, eUnit: unit };
};

export const OIMLWeighingSheet: React.FC<OIMLWeighingSheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
  onDeleteObservation,
  verificationMode = 'INITIAL_VERIFICATION',
}) => {
  const [refLoadInput, setRefLoadInput] = useState<string>('10.000');
  const [indicationInput, setIndicationInput] = useState<string>('10.003');
  const [deltaLInput, setDeltaLInput] = useState<string>('0.000');
  const [direction, setDirection] = useState<'Increasing' | 'Decreasing'>('Increasing');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const loadNum = parseFloat(refLoadInput) || 0;
  const indNum = parseFloat(indicationInput) || 0;
  const deltaLNum = parseFloat(deltaLInput) || 0;

  const mpeCheckPreview = evaluateMPEScaleReading({
    referenceLoad: loadNum,
    referenceLoadUnit: 'kg',
    scaleReading: indNum,
    scaleReadingUnit: 'kg',
    accuracyClass: session.accuracyClass,
    verificationScaleIntervalE: eVal,
    eUnit,
    verificationMode,
  });

  const pPreview = indNum + (0.5 * (eVal / 1000)) - deltaLNum;
  const ePreview = mpeCheckPreview.indicatedDifference;
  const ecPreview = ePreview;
  const mpeValPreview = mpeCheckPreview.mpeResult.mpeValue;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(loadNum) || loadNum <= 0) return;
    if (isNaN(indNum) || indNum < 0) return;

    const newObs: WeighingTestObservation = {
      id: `wo-${Date.now()}`,
      load: loadNum,
      indicatedValue: indNum,
      deltaL: deltaLNum,
      calculatedError: ePreview,
      adjustedError: ecPreview,
      mpeLimit: mpeValPreview,
      passed: mpeCheckPreview.isPassed,
      direction,
      mpeUnit: mpeCheckPreview.mpeResult.mpeUnit,
      mpeStatus: mpeCheckPreview.status,
      indicatedDifferenceFormatted: mpeCheckPreview.indicatedDifferenceFormatted,
      notes: remarks,
    };

    onSaveObservation(newObs);
  };

  const observations = session.weighingObservations || [];
  const hasFailures = observations.some((o) => !o.passed);
  const overallStatus = observations.length === 0 ? 'NOT_STARTED' : hasFailures ? 'EXCEEDS_LIMIT' : 'WITHIN_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Weighing Performance Evaluation',
    appliedLoad: `${loadNum} kg`,
    observedIndication: `${indNum} kg`,
    additionalLoad: `${deltaLNum} g`,
    calculatedError: `${ePreview > 0 ? '+' : ''}${ePreview} g`,
    correctedError: `${ecPreview > 0 ? '+' : ''}${ecPreview} g`,
    mpeLimit: `±${mpeValPreview} g`,
    ruleReference: 'OIML R 76-1:2006 Clause 3.5.1 / Table 6',
    comparison: `|Ec| ≤ |mpe| ⟹ |${ecPreview}| ≤ |${mpeValPreview}| (${mpeCheckPreview.isPassed ? 'SATISFIED' : 'EXCEEDED'})`,
    resultStatus: mpeCheckPreview.isPassed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 1"
      sheetTitle="WEIGHING PERFORMANCE (A.4.4) (A.5.3.1)"
      clauseReference="OIML R 76-2:2007 Clause 3.5 / A.4.4 / A.5.3.1"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 1"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-[#F4ECDD]/40 border border-[#D9D3C7] font-mono text-xs space-y-1">
        <div className="font-bold text-[#0B1F3A] font-sans uppercase">Verified Metrological Formulas:</div>
        <div className="text-[#1A1F2B]">
          <span className="font-bold text-[#0B1F3A]">E = I + ½e − ΔL − L</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-[#0B1F3A]">Ec = E − E0</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="text-[#5F6B7A]">e = {eVal} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-[#0B1F3A] rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-[#0B1F3A] uppercase font-sans">
            Officer Observation Entry Row (Increments or Decrements):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-[#5F6B7A] font-sans">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full bg-white text-[#1A1F2B] border border-[#D9D3C7] font-mono px-2 py-1 text-xs"
              >
                <option value="Increasing">▲ Ascending</option>
                <option value="Decreasing">▼ Descending</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#0B1F3A] font-sans">Load, L (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={refLoadInput}
                onChange={(e) => setRefLoadInput(e.target.value)}
                className="w-full bg-white text-[#1A1F2B] border border-[#D9D3C7] font-mono font-bold px-2 py-1 text-xs focus:bg-[#F4ECDD]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#0B1F3A] font-sans">Indication, I (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={indicationInput}
                onChange={(e) => setIndicationInput(e.target.value)}
                className="w-full bg-white text-[#1A1F2B] border border-[#D9D3C7] font-mono font-bold px-2 py-1 text-xs focus:bg-[#F4ECDD]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#5F6B7A] font-sans">Add Load, ΔL (g)</label>
              <input
                type="number"
                step="any"
                value={deltaLInput}
                onChange={(e) => setDeltaLInput(e.target.value)}
                className="w-full bg-white text-[#1A1F2B] border border-[#D9D3C7] font-mono px-2 py-1 text-xs focus:bg-[#F4ECDD]"
              />
            </div>

            <div className="bg-[#F4ECDD] border border-[#D9D3C7] p-1 flex flex-col justify-center">
              <span className="text-[9px] text-[#5F6B7A] font-sans uppercase">Ec (g)</span>
              <span className="font-mono font-bold text-xs text-[#0B1F3A]">
                {ecPreview > 0 ? `+${ecPreview}` : ecPreview} g
              </span>
            </div>

            <div className="bg-slate-100 border border-[#D9D3C7] p-1 flex flex-col justify-center">
              <span className="text-[9px] text-[#5F6B7A] font-sans uppercase">mpe</span>
              <span className="font-mono font-bold text-xs text-[#1A1F2B]">±{mpeValPreview} g</span>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-1.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] border border-[#C8A46B]/40 font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#C8A46B]" /> Save Row
              </button>
            </div>
          </div>
        </form>
      )}

      {/* OFFICIAL OIML R 76-2 WEIGHING PERFORMANCE TABLE */}
      <div className="overflow-x-auto border border-[#D9D3C7]">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-[#0B1F3A] text-white font-bold uppercase text-[11px] font-sans border-b border-[#D9D3C7]">
              <th className="py-2 px-2 border-r border-[#D9D3C7] w-8 text-center">#</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7]">Dir</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right">Load, L (kg)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right">Indication, I (kg)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right">Add Load, ΔL (g)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right bg-[#12355B]">Error, E (g)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right bg-[#12355B] text-[#C8A46B] font-extrabold">Corrected Ec (g)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-right">mpe (g)</th>
              <th className="py-2 px-2 border-r border-[#D9D3C7] text-center font-sans">|Ec| ≤ |mpe|</th>
              <th className="py-2 px-2 text-center w-8 no-print">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#D9D3C7]">
            {observations.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-[#5F6B7A] font-sans italic bg-white">
                  No weighing observations recorded yet. Enter reference load and indication above.
                </td>
              </tr>
            ) : (
              observations.map((obs, idx) => (
                <tr key={obs.id || idx} className={obs.passed ? 'bg-white' : 'bg-rose-50'}>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-center font-bold text-[#0B1F3A] font-sans">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] font-sans font-semibold text-[#5F6B7A]">
                    {obs.direction === 'Increasing' ? '▲ Inc' : '▼ Dec'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right font-bold bg-[#F4ECDD]/30">
                    {obs.load.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right font-bold bg-white text-[#1A1F2B]">
                    {obs.indicatedValue.toFixed(3)}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right text-[#5F6B7A]">
                    {obs.deltaL !== undefined ? obs.deltaL : '0.0'}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right bg-[#F4ECDD]/60 text-[#0B1F3A]">
                    {obs.calculatedError > 0 ? `+${obs.calculatedError}` : obs.calculatedError}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right bg-[#F4ECDD] font-extrabold text-[#0B1F3A]">
                    {obs.adjustedError > 0 ? `+${obs.adjustedError}` : obs.adjustedError}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-right bg-slate-100 font-bold text-[#1A1F2B]">
                    ±{obs.mpeLimit}
                  </td>
                  <td className="py-1.5 px-2 border-r border-[#D9D3C7] text-center font-sans">
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
                    {!isReadOnly && onDeleteObservation && (
                      <button
                        type="button"
                        onClick={() => onDeleteObservation(obs.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="Delete observation row"
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

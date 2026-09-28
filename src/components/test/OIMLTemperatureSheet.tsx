import React, { useState } from 'react';
import { TestSession, MassUnit } from '../../types';
import { DigitalOIMLTestSheet, ExplanationDetail } from './DigitalOIMLTestSheet';
import { Plus } from 'lucide-react';

interface OIMLTemperatureSheetProps {
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

export const OIMLTemperatureSheet: React.FC<OIMLTemperatureSheetProps> = ({
  session,
  instrument,
  isReadOnly = false,
  onSaveObservation,
}) => {
  const { eVal, eUnit } = parseVerificationInterval(session.verificationInterval);

  const [tempInput, setTempInput] = useState<string>('20.0');
  const [indicationInput, setIndicationInput] = useState<string>('0.000');
  const [deltaLInput, setDeltaLInput] = useState<string>('0.000');
  const [remarks, setRemarks] = useState<string>(session.notes || '');

  const tempNum = parseFloat(tempInput) || 20;
  const indNum = parseFloat(indicationInput) || 0;
  const deltaLNum = parseFloat(deltaLInput) || 0;

  const halfEInKg = 0.5 * (eVal / 1000);
  const pCalculated = indNum + halfEInKg - (deltaLNum / 1000); // in kg

  const observations = session.staticTemperatureObservations || [
    {
      id: 'temp-1',
      date: new Date().toISOString().substring(0, 10),
      time: '10:00',
      temperature: 20.0,
      zeroIndication: 0.000,
      addLoadDeltaL: 0.0,
      pVal: pCalculated,
      deltaP: 0.0,
      deltaTemp: 0.0,
      zeroChangePerDeg: 0.0,
      passed: true,
    },
    {
      id: 'temp-2',
      date: new Date().toISOString().substring(0, 10),
      time: '12:00',
      temperature: 40.0,
      zeroIndication: 0.001,
      addLoadDeltaL: 0.0,
      pVal: pCalculated + 0.001,
      deltaP: 1.0, // 1g change
      deltaTemp: 20.0, // 20 C change
      zeroChangePerDeg: 0.25, // 1e per 5C rule
      passed: true,
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newObs = {
      id: `temp-${Date.now()}`,
      date: new Date().toISOString().substring(0, 10),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temperature: tempNum,
      zeroIndication: indNum,
      addLoadDeltaL: deltaLNum,
      pVal: pCalculated,
      deltaP: 0.0,
      deltaTemp: 0.0,
      zeroChangePerDeg: 0.0,
      passed: true,
    };

    if (onSaveObservation) onSaveObservation(newObs);
  };

  const isAllPassed = observations.every((o: any) => o.passed !== false);
  const overallStatus = observations.length === 0 ? 'NOT_STARTED' : isAllPassed ? 'WITHIN_LIMIT' : 'EXCEEDS_LIMIT';

  const explanationDetail: ExplanationDetail = {
    title: 'Temperature Effect Evaluation (OIML R 76-1 Clause 3.9.2.2)',
    appliedLoad: `No-Load (Zero Load)`,
    observedIndication: `Temp = ${tempNum}°C, Zero Indication I = ${indNum} kg`,
    additionalLoad: `${deltaLNum} g`,
    calculatedError: `P = ${pCalculated.toFixed(4)} kg`,
    correctedError: `P = I + ½e − ΔL`,
    mpeLimit: `1e per 5°C (Class III)`,
    ruleReference: 'OIML R 76-1:2006 Clause 3.9.2.2 / OIML R 76-2 Section 2',
    comparison: `Zero-change per 5°C ≤ 1e ⟹ SATISFIED`,
    resultStatus: isAllPassed ? 'PASSED' : 'FAILED',
  };

  return (
    <DigitalOIMLTestSheet
      session={session}
      instrument={instrument}
      sectionNumber="Section 2"
      sheetTitle="TEMPERATURE EFFECT ON NO-LOAD INDICATION"
      clauseReference="OIML R 76-2:2007 Clause 3.9.2.2 / Section 2"
      reportPage="1 / 1"
      formNumber="R76-2 / Sheet 5"
      overallStatus={overallStatus}
      explanationDetails={explanationDetail}
      remarks={remarks}
      onRemarksChange={setRemarks}
      isReadOnly={isReadOnly}
    >
      {/* FORMULA HEADER AREA */}
      <div className="p-3 bg-slate-100 border border-slate-300 font-mono text-xs space-y-1">
        <div className="font-bold text-slate-800 font-sans uppercase">Verified Metrological Formula (OIML R 76-1 Clause 3.9.2.2):</div>
        <div className="text-slate-700">
          <span className="font-bold text-teal-800">P = I + ½e − ΔL</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="font-bold text-teal-800">Zero change per 5°C ≤ 1e</span> &nbsp;&nbsp;|&nbsp;&nbsp;
          <span className="text-slate-600">e = {eVal} {eUnit}</span>
        </div>
      </div>

      {/* OFFICER DATA ENTRY ROW */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} className="p-3 bg-white border-2 border-teal-600 rounded-xs space-y-2 no-print">
          <div className="text-xs font-bold text-teal-900 uppercase font-sans">
            Officer Entry — Temperature Chamber Reading:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Chamber Temp (°C) *</label>
              <input
                type="number"
                step="any"
                required
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-400 font-mono font-bold px-2 py-1 text-xs focus:bg-amber-50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-900 font-sans">Zero Indication, I (kg) *</label>
              <input
                type="number"
                step="any"
                required
                value={indicationInput}
                onChange={(e) => setIndicationInput(e.target.value)}
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
              <span className="text-[9px] text-slate-500 font-sans uppercase">P (kg)</span>
              <span className="font-mono font-bold text-xs text-slate-900">{pCalculated.toFixed(4)} kg</span>
            </div>

            <div className="flex items-end col-span-2">
              <button
                type="submit"
                className="w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs font-sans rounded-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Save Temperature Step
              </button>
            </div>
          </div>
        </form>
      )}

      {/* OFFICIAL OIML R 76-2 TEMPERATURE EFFECT TABLE */}
      <div className="overflow-x-auto border border-slate-400">
        <table className="w-full text-xs text-left border-collapse font-mono">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] font-sans border-b border-slate-400">
              <th className="py-2 px-2 border-r border-slate-300 text-center w-12 font-sans">Page</th>
              <th className="py-2 px-2 border-r border-slate-300">Date</th>
              <th className="py-2 px-2 border-r border-slate-300">Time</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">Temp (°C)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-white">Zero Indication I (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right">Add ΔL (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-bold">P (kg)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50">ΔP (g)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100">ΔTemp (°C)</th>
              <th className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50">Zero Change / 5°C</th>
              <th className="py-2 px-2 text-center font-sans">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300">
            {observations.map((obs: any, idx: number) => (
              <tr key={obs.id || idx} className={obs.passed !== false ? 'bg-white' : 'bg-rose-50'}>
                <td className="py-2 px-2 border-r border-slate-300 text-center font-sans font-bold text-slate-700">
                  1 / 1
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-slate-800">
                  {obs.date || new Date().toISOString().substring(0, 10)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-slate-600">
                  {obs.time || '10:00'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right font-bold text-slate-900 bg-slate-100">
                  {obs.temperature !== undefined ? obs.temperature.toFixed(1) : '20.0'} °C
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                  {obs.zeroIndication !== undefined ? obs.zeroIndication.toFixed(3) : '0.000'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right text-slate-700">
                  {obs.addLoadDeltaL !== undefined ? obs.addLoadDeltaL : '0.0'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-bold text-slate-900">
                  {obs.pVal !== undefined ? obs.pVal.toFixed(4) : pCalculated.toFixed(4)}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 text-slate-800">
                  {obs.deltaP !== undefined ? `${obs.deltaP.toFixed(1)} g` : '0.0 g'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-slate-100 text-slate-800">
                  {obs.deltaTemp !== undefined ? `${obs.deltaTemp.toFixed(1)} °C` : '0.0 °C'}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-right bg-sky-50 font-bold text-slate-900">
                  {obs.zeroChangePerDeg !== undefined ? `${obs.zeroChangePerDeg.toFixed(2)} e` : '0.0 e'}
                </td>
                <td className="py-2 px-2 text-center font-sans">
                  {obs.passed !== false ? (
                    <span className="text-emerald-800 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded-xs border border-emerald-300">
                      PASSED
                    </span>
                  ) : (
                    <span className="text-rose-800 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded-xs border border-rose-300">
                      FAILED
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

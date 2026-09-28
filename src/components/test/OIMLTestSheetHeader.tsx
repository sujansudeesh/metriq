import React, { useState, useEffect } from 'react';
import { TestSession, EnvironmentalConditionRow, EnvironmentalConditionsData } from '../../types';
import { authService } from '../../services/authService';
import { updateTestSession } from '../../mock/store';
import { testSessionService } from '../../services/testSessionService';
import { testObservationService } from '../../services/testObservationService';

interface OIMLTestSheetHeaderProps {
  session: TestSession;
  instrument?: any;
  sheetTitle: string;
  clauseReference: string;
  formNumber?: string;
  tempAtMax?: number;
  tempAtEnd?: number;
  humidityAtMax?: number;
  humidityAtEnd?: number;
  isReadOnly?: boolean;
}

export const OIMLTestSheetHeader: React.FC<OIMLTestSheetHeaderProps> = ({
  session,
  instrument,
  sheetTitle,
  clauseReference,
  formNumber = 'R76-2 / A.4',
  tempAtMax,
  tempAtEnd,
  humidityAtMax,
  humidityAtEnd,
  isReadOnly = false,
}) => {
  const [observerName, setObserverName] = useState<string>(session.assignedOfficer || 'Testing Officer');

  useEffect(() => {
    let isMounted = true;
    authService.getCurrentUser().then((user) => {
      if (isMounted && user) {
        setObserverName(user.name || user.email || session.assignedOfficer || 'Testing Officer');
      }
    });
    return () => {
      isMounted = false;
    };
  }, [session.assignedOfficer]);

  const eStr = session.verificationInterval || instrument?.verificationInterval || '5 g';
  const dStr = session.scaleInterval || instrument?.scaleInterval || eStr;
  const maxCapStr = session.maxCapacity || instrument?.capacity || '30 kg';
  const accClassStr = session.accuracyClass || instrument?.accuracyClass || 'Class III';
  const sessionCode = session.session_code || session.id || 'TS-2026-001';
  const modelDesignation =
    `${session.manufacturer || instrument?.manufacturer || ''} ${session.instrumentModel || instrument?.model || ''}`.trim() ||
    'NAWI Weighing Instrument';
  const serialNo = session.serialNumber || instrument?.serialNumber || 'SN-2026';
  const dateStr = session.startedOn || new Date().toISOString().substring(0, 10);
  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Environmental Data State Resolution
  const envData = session.environmentalConditions || {};
  const startEnv = envData.start || {};
  const maxLoadEnv = envData.maxLoad || {};
  const endEnv = envData.end || {};

  const startTemp = startEnv.temp !== undefined ? startEnv.temp : session.ambientTemp ?? 22.0;
  const startHumidity = startEnv.humidity !== undefined ? startEnv.humidity : session.relativeHumidity ?? 50;
  const startTime = startEnv.time !== undefined ? startEnv.time : currentTimeStr;
  const startPressure = startEnv.pressure !== undefined ? startEnv.pressure : session.barometricPressure ?? 1013.2;
  const startPressureNA = !!startEnv.pressureNotApplicable;

  const maxTemp = maxLoadEnv.temp !== undefined ? maxLoadEnv.temp : tempAtMax !== undefined ? tempAtMax : '';
  const maxHumidity = maxLoadEnv.humidity !== undefined ? maxLoadEnv.humidity : humidityAtMax !== undefined ? humidityAtMax : '';
  const maxTime = maxLoadEnv.time !== undefined ? maxLoadEnv.time : '';
  const maxPressure = maxLoadEnv.pressure !== undefined ? maxLoadEnv.pressure : '';
  const maxPressureNA = maxLoadEnv.pressureNotApplicable !== undefined ? maxLoadEnv.pressureNotApplicable : false;

  const endTemp = endEnv.temp !== undefined ? endEnv.temp : tempAtEnd !== undefined ? tempAtEnd : '';
  const endHumidity = endEnv.humidity !== undefined ? endEnv.humidity : humidityAtEnd !== undefined ? humidityAtEnd : '';
  const endTime = endEnv.time !== undefined ? endEnv.time : '';
  const endPressure = endEnv.pressure !== undefined ? endEnv.pressure : '';
  const endPressureNA = endEnv.pressureNotApplicable !== undefined ? endEnv.pressureNotApplicable : false;

  const handleUpdateEnv = (period: 'start' | 'maxLoad' | 'end', field: keyof EnvironmentalConditionRow, value: any) => {
    if (isReadOnly) return;

    const currentEnv: EnvironmentalConditionsData = session.environmentalConditions || {
      start: { temp: startTemp, humidity: startHumidity, time: startTime, pressure: startPressure, pressureNotApplicable: startPressureNA },
      maxLoad: { temp: maxTemp, humidity: maxHumidity, time: maxTime, pressure: maxPressure, pressureNotApplicable: maxPressureNA },
      end: { temp: endTemp, humidity: endHumidity, time: endTime, pressure: endPressure, pressureNotApplicable: endPressureNA },
    };

    const periodObj = currentEnv[period] || {};
    const updatedPeriod = { ...periodObj, [field]: value };
    const updatedEnvData: EnvironmentalConditionsData = {
      ...currentEnv,
      [period]: updatedPeriod,
    };

    const updatedSession: TestSession = {
      ...session,
      environmentalConditions: updatedEnvData,
      ...(period === 'start' && field === 'temp' && !isNaN(Number(value)) && value !== '' ? { ambientTemp: Number(value) } : {}),
      ...(period === 'start' && field === 'humidity' && !isNaN(Number(value)) && value !== '' ? { relativeHumidity: Number(value) } : {}),
      ...(period === 'start' && field === 'pressure' && !isNaN(Number(value)) && value !== '' ? { barometricPressure: Number(value) } : {}),
    };

    updateTestSession(updatedSession);
    testSessionService.saveSession(updatedSession);
    if (session.id) {
      testObservationService.saveEnvironmentalConditions(session.id, updatedEnvData).catch((err) => {
        console.error('Failed to persist environmental conditions to Supabase:', err);
      });
    }
  };

  const renderPressureCell = (
    period: 'start' | 'maxLoad' | 'end',
    val: number | string,
    isNA: boolean
  ) => {
    if (isNA) {
      return (
        <div className="flex items-center justify-between gap-1 bg-slate-100 border border-[#D9D3C7] rounded px-2 py-1 select-none">
          <span className="text-slate-400 font-bold font-mono text-center w-full">—</span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => handleUpdateEnv(period, 'pressureNotApplicable', false)}
              className="text-[9px] font-sans font-bold text-teal-700 bg-white border border-teal-300 px-1 py-0.5 rounded hover:bg-teal-50 cursor-pointer shrink-0"
              title="Enable pressure entry for this period"
            >
              + Edit
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {isReadOnly ? (
          <span className="font-bold text-[#0B1F3A] font-mono text-xs w-full text-center block">
            {val !== '' && val !== undefined ? `${val} hPa` : '—'}
          </span>
        ) : (
          <>
            <input
              type="number"
              step="0.1"
              value={val}
              onChange={(e) => handleUpdateEnv(period, 'pressure', e.target.value)}
              className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
              placeholder="hPa"
            />
            <button
              type="button"
              onClick={() => handleUpdateEnv(period, 'pressureNotApplicable', true)}
              className="text-[9px] font-sans font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-1 py-0.5 rounded cursor-pointer shrink-0"
              title="Mark barometric pressure as Not Applicable"
            >
              N/A
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="border border-[#D9D3C7] bg-[#F9F9F7] text-[#1A1F2B] font-sans text-xs mb-4">
      {/* Table 1: Instrument & Session Traceability Metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border-b border-[#D9D3C7] font-mono">
        <div className="p-2 border-r border-[#D9D3C7] bg-[#F4ECDD]/40">
          <span className="text-[10px] text-[#5F6B7A] font-sans uppercase font-bold block">Application / Session No.</span>
          <span className="font-bold text-[#0B1F3A] truncate block">{sessionCode}</span>
        </div>

        <div className="p-2 border-r border-[#D9D3C7] bg-[#F4ECDD]/40 col-span-1 md:col-span-2">
          <span className="text-[10px] text-[#5F6B7A] font-sans uppercase font-bold block">Type Designation / Model</span>
          <span className="font-bold text-[#0B1F3A] truncate block">
            {modelDesignation} ({serialNo})
          </span>
        </div>

        <div className="p-2 border-r border-[#D9D3C7] bg-[#F4ECDD]/40">
          <span className="text-[10px] text-[#5F6B7A] font-sans uppercase font-bold block">Date of Test</span>
          <span className="font-bold text-[#0B1F3A] block">{dateStr}</span>
        </div>

        <div className="p-2 border-r border-[#D9D3C7] bg-[#F4ECDD]/40">
          <span className="text-[10px] text-[#5F6B7A] font-sans uppercase font-bold block">Observer / Officer</span>
          <span className="font-bold text-[#0B1F3A] truncate block">{observerName}</span>
        </div>

        <div className="p-2 bg-[#F4ECDD]/40">
          <span className="text-[10px] text-[#5F6B7A] font-sans uppercase font-bold block">Class / Capacity / e / d</span>
          <span className="font-bold text-[#0B1F3A] block">
            {accClassStr} • Max {maxCapStr} • e={eStr} • d={dStr}
          </span>
        </div>
      </div>

      {/* Table 2: Environmental Conditions Table (Official OIML R 76-2 Observations Table) */}
      <div className="p-2 bg-white">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-[#0B1F3A] uppercase tracking-wider block">
            Environmental Conditions (Official Observations Table):
          </span>
          {!isReadOnly && (
            <span className="text-[10px] text-[#C8A46B] font-bold">
              ✏️ Editable Observation Cells
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse border border-[#D9D3C7] text-[11px] font-mono">
            <thead>
              <tr className="bg-[#0B1F3A] text-white font-bold font-sans border-b border-[#D9D3C7]">
                <th className="py-1.5 px-3 border-r border-[#D9D3C7] text-left w-32">Period</th>
                <th className="py-1.5 px-3 border-r border-[#D9D3C7] w-1/4">Temp. (°C)</th>
                <th className="py-1.5 px-3 border-r border-[#D9D3C7] w-1/4">Rel. Humidity (%)</th>
                <th className="py-1.5 px-3 border-r border-[#D9D3C7] w-1/4">Time</th>
                <th className="py-1.5 px-3 w-1/4">Bar. Press. (hPa)</th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: At Start */}
              <tr className="border-b border-[#D9D3C7] bg-[#F9F9F7]">
                <td className="py-1.5 px-3 border-r border-[#D9D3C7] font-sans text-left font-bold text-[#0B1F3A]">
                  At Start
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{startTemp} °C</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={startTemp}
                      onChange={(e) => handleUpdateEnv('start', 'temp', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="°C"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{startHumidity} %</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={startHumidity}
                      onChange={(e) => handleUpdateEnv('start', 'humidity', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="%"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="text-[#0B1F3A] font-bold">{startTime}</span>
                  ) : (
                    <input
                      type="text"
                      value={startTime}
                      onChange={(e) => handleUpdateEnv('start', 'time', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="HH:MM"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2">
                  {renderPressureCell('start', startPressure, startPressureNA)}
                </td>
              </tr>

              {/* Row 2: At Max Load */}
              <tr className="border-b border-[#D9D3C7] bg-white">
                <td className="py-1.5 px-3 border-r border-[#D9D3C7] font-sans text-left font-bold text-[#0B1F3A]">
                  At Max Load
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{maxTemp !== '' ? `${maxTemp} °C` : '—'}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={maxTemp}
                      onChange={(e) => handleUpdateEnv('maxLoad', 'temp', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="°C"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{maxHumidity !== '' ? `${maxHumidity} %` : '—'}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={maxHumidity}
                      onChange={(e) => handleUpdateEnv('maxLoad', 'humidity', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="%"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="text-[#0B1F3A] font-bold">{maxTime || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={maxTime}
                      onChange={(e) => handleUpdateEnv('maxLoad', 'time', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="HH:MM"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2">
                  {renderPressureCell('maxLoad', maxPressure, maxPressureNA)}
                </td>
              </tr>

              {/* Row 3: At End */}
              <tr className="bg-[#F9F9F7]">
                <td className="py-1.5 px-3 border-r border-[#D9D3C7] font-sans text-left font-bold text-[#0B1F3A]">
                  At End
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{endTemp !== '' ? `${endTemp} °C` : '—'}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      value={endTemp}
                      onChange={(e) => handleUpdateEnv('end', 'temp', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="°C"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="font-bold text-[#0B1F3A]">{endHumidity !== '' ? `${endHumidity} %` : '—'}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={endHumidity}
                      onChange={(e) => handleUpdateEnv('end', 'humidity', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="%"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 border-r border-[#D9D3C7]">
                  {isReadOnly ? (
                    <span className="text-[#0B1F3A] font-bold">{endTime || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => handleUpdateEnv('end', 'time', e.target.value)}
                      className="w-full text-center bg-white border border-[#D9D3C7] rounded px-2 py-1 text-xs font-mono font-bold text-[#0B1F3A] focus:outline-hidden focus:border-[#C8A46B] focus:ring-1 focus:ring-[#C8A46B]"
                      placeholder="HH:MM"
                    />
                  )}
                </td>
                <td className="py-1.5 px-2">
                  {renderPressureCell('end', endPressure, endPressureNA)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

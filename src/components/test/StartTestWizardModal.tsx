import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { Instrument } from '../../types';
import { PlayCircle, ChevronRight } from 'lucide-react';
import { useToast } from '../common/Toast';
import { instrumentService } from '../../services/instrumentService';
import { testSessionService } from '../../services/testSessionService';
import { generateRecommendedTestPlan } from '../../services/testPlanService';

interface StartTestWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartTestWizardModal: React.FC<StartTestWizardModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loadingInsts, setLoadingInsts] = useState<boolean>(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state
  const [selectedInstId, setSelectedInstId] = useState('');
  const [ambientTemp, setAmbientTemp] = useState<number>(22.0);
  const [humidity, setHumidity] = useState<number>(50);
  const [pressure, setPressure] = useState<number>(1013.2);
  const [officerName, setOfficerName] = useState<string>('Dr. Ananya Rao');
  const [starting, setStarting] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchInstruments = async () => {
      try {
        const insts = await instrumentService.getInstruments();
        if (isMounted) {
          setInstruments(insts);
          if (insts.length > 0 && !selectedInstId) {
            setSelectedInstId(insts[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          showToast('Error', 'Unable to load instruments: ' + err.message, 'error');
        }
      } finally {
        if (isMounted) setLoadingInsts(false);
      }
    };
    if (isOpen) {
      fetchInstruments();
    }
  }, [isOpen]);

  const selectedInst = instruments.find((i) => i.id === selectedInstId) || instruments[0];

  const handleStartTesting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInst) {
      showToast('Validation Error', 'Please select an instrument.', 'error');
      return;
    }

    setStarting(true);
    try {
      const newSession = await testSessionService.createSession({
        instrumentId: selectedInst.id,
        testContext: 'TYPE_EXAMINATION',
        verificationMode: 'INITIAL',
        officerName,
        ambientTemp,
        relativeHumidity: humidity,
        barometricPressure: pressure,
      });

      showToast('Test Session Created', `Started evaluation for ${selectedInst.model.modelName}`, 'success');
      onClose();
      navigate(`/test-sessions/${newSession.id}`);
    } catch (err: any) {
      showToast('Session Creation Error', err.message || 'Unable to create test session.', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start New OIML Test Session"
      subtitle="Complete the 3-step wizard to initialize laboratory evaluation."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Stepper Progress */}
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold select-none pb-2 border-b border-slate-100">
          <div className={`p-2.5 rounded-lg text-center transition-colors ${step === 1 ? 'bg-[#0B1F3A] text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
            1. Select Instrument
          </div>
          <div className={`p-2.5 rounded-lg text-center transition-colors ${step === 2 ? 'bg-[#0B1F3A] text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
            2. Laboratory & Plan
          </div>
          <div className={`p-2.5 rounded-lg text-center transition-colors ${step === 3 ? 'bg-[#0B1F3A] text-white font-bold' : 'bg-slate-100 text-slate-500'}`}>
            3. Confirm & Start
          </div>
        </div>

        {/* STEP 1: Select Instrument */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Select Registered Instrument *</label>
              {loadingInsts ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 animate-pulse">
                  Loading registered instruments from database...
                </div>
              ) : (
                <select
                  value={selectedInstId}
                  onChange={(e) => setSelectedInstId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:border-[#C8A46B]"
                >
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.id} — {inst.model.modelName} ({inst.metrology.accuracyClass}, S/N: {inst.model.serialNumber})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Instrument Preview Card */}
            {selectedInst && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{selectedInst.model.modelName}</span>
                  <span className="text-[#C8A46B] font-mono font-extrabold">{selectedInst.metrology.accuracyClass}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                  <p>Manufacturer: <span className="font-medium text-slate-800">{selectedInst.manufacturer.name}</span></p>
                  <p>Serial Number: <span className="font-mono text-slate-800">{selectedInst.model.serialNumber}</span></p>
                  <p>Max Capacity: <span className="font-bold text-slate-900">{selectedInst.metrology.maxCapacity} {selectedInst.metrology.maxUnit}</span></p>
                  <p>Interval (e): <span className="font-bold text-slate-900">{selectedInst.metrology.verificationIntervalE} {selectedInst.metrology.eUnit}</span></p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!selectedInst}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Continue to Laboratory Setup <ChevronRight className="w-4 h-4 text-[#C8A46B]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Laboratory Environmental Details & Plan Preview */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ambient Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={ambientTemp}
                  onChange={(e) => setAmbientTemp(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Relative Humidity (%)</label>
                <input
                  type="number"
                  required
                  value={humidity}
                  onChange={(e) => setHumidity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Barometric Pressure (hPa)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={pressure}
                  onChange={(e) => setPressure(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Testing Officer Name</label>
                <input
                  type="text"
                  required
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                />
              </div>
            </div>

            {selectedInst && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#0B1F3A] border-b border-slate-200 pb-1">
                  <span>OIML R 76 Recommended Test Scope</span>
                  <span className="text-[#C8A46B]">Class {selectedInst.metrology.accuracyClass}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {generateRecommendedTestPlan(selectedInst, 'TYPE_EXAMINATION').map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded border bg-slate-50 border-slate-200 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className="text-[10px] text-emerald-700 font-bold">✓ Ready</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0B1F3A] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Continue to Confirm <ChevronRight className="w-4 h-4 text-[#C8A46B]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirm & Start */}
        {step === 3 && selectedInst && (
          <form onSubmit={handleStartTesting} className="space-y-4 text-xs">
            <div className="p-4 bg-[#0B1F3A] text-white rounded-xl space-y-2 border-l-4 border-[#C8A46B]">
              <h4 className="font-bold text-[#C8A46B] text-sm">Ready to Start Test Evaluation</h4>
              <p className="text-xs text-slate-300">
                Session will initialize for instrument <strong className="text-white">{selectedInst.model.modelName}</strong> (S/N: {selectedInst.model.serialNumber}).
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800 text-slate-400">
                <p>Officer: <span className="text-white">{officerName}</span></p>
                <p>Temp / Hum: <span className="text-white">{ambientTemp}°C / {humidity}%</span></p>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="submit"
                disabled={starting}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#C8A46B] hover:bg-[#b5925a] text-[#0B1F3A] font-extrabold text-xs rounded-lg transition-colors shadow-md cursor-pointer disabled:opacity-50"
              >
                {starting ? (
                  <span>Initializing Session...</span>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" /> Start OIML Test Session
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

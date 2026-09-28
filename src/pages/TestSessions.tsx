import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Plus, Search, Filter, PlayCircle, Eye, RefreshCw } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { getTestSessionsStore, getInstrumentsStore, updateTestSession } from '../mock/store';
import { TestSession } from '../types';
import { calculateTestProgress } from '../utils/metrologyService';

import { testSessionService } from '../services/testSessionService';

export const TestSessions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterInstId = searchParams.get('instrumentId') || '';
  const filterStatusParam = searchParams.get('status') || 'All';

  const [sessions, setSessions] = useState(() => testSessionService.getAllSessions());
  const instruments = getInstrumentsStore();

  const [searchTerm, setSearchTerm] = useState(filterInstId);
  const [statusFilter, setStatusFilter] = useState(filterStatusParam);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState(instruments[0]?.id || '');

  React.useEffect(() => {
    let isMounted = true;
    const handleSync = async () => {
      try {
        const data = await testSessionService.getAllSessionsAsync();
        if (isMounted) setSessions(data);
      } catch (err: any) {
        console.warn('Async session fetch fallback:', err.message);
        if (isMounted) setSessions(testSessionService.getAllSessions());
      }
    };

    handleSync();

    window.addEventListener('storage', handleSync);
    window.addEventListener('nawi_session_updated', handleSync);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('nawi_session_updated', handleSync);
    };
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      searchTerm === '' ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.instrumentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.instrumentModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      s.status === statusFilter ||
      s.workflowStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const inst = instruments.find((i) => i.id === selectedInstId) || instruments[0];

    const newSession: TestSession = {
      id: `TS-2026-${Math.floor(100 + Math.random() * 900)}`,
      instrumentId: inst.id,
      instrumentModel: inst.model.modelName,
      serialNumber: inst.model.serialNumber,
      manufacturer: inst.manufacturer.name,
      accuracyClass: inst.metrology.accuracyClass,
      maxCapacity: `${inst.metrology.maxCapacity} ${inst.metrology.maxUnit}`,
      verificationInterval: `${inst.metrology.verificationIntervalE} ${inst.metrology.eUnit}`,
      startedOn: new Date().toISOString().replace('T', ' ').substring(0, 16),
      progress: 0,
      status: 'In Progress',
      assignedOfficer: 'Dr. Ananya Rao',
      ambientTemp: 22.0,
      relativeHumidity: 50,
      barometricPressure: 1013.0,
      weighingObservations: [],
      repeatabilityObservations: [],
      eccentricityObservations: [],
      tareObservations: [],
      discriminationObservations: [],
    };

    updateTestSession(newSession);
    setSessions(getTestSessionsStore());
    setIsModalOpen(false);
    navigate(`/test-sessions/${newSession.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">OIML R-76 Test Sessions</h2>
          <p className="text-xs text-[#5F6B7A] mt-1">
            Active evaluation logs, prescribed test observations, and compliance reviews.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C8A46B]" />
          Start New Test Session
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9D3C7] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F6B7A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Test ID, Instrument ID, model, or manufacturer..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] placeholder-[#5F6B7A] focus:outline-hidden focus:bg-white focus:border-[#C8A46B]"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-[#5F6B7A] shrink-0 hidden md:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] font-medium focus:outline-hidden focus:border-[#C8A46B]"
            >
              <option value="All">All Test Session Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Awaiting Review">Awaiting Review</option>
              <option value="Compliant">Compliant</option>
              <option value="Non-Compliant">Non-Compliant</option>
              <option value="Finalized">Finalized</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
            }}
            className="p-2 text-[#5F6B7A] hover:text-[#0B1F3A] hover:bg-[#F4ECDD] rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Test Sessions Table */}
      <div className="bg-white rounded-xl border border-[#D9D3C7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1F3A] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Test ID</th>
                <th className="py-3 px-4">Instrument ID</th>
                <th className="py-3 px-4">Model & Manufacturer</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Started On</th>
                <th className="py-3 px-4">Progress</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Officer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D3C7] text-xs text-[#1A1F2B]">
              {filteredSessions.map((session) => (
                <tr
                  key={session.id}
                  onClick={() => navigate(`/test-sessions/${session.id}`)}
                  className="hover:bg-[#F4ECDD]/30 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">{session.id}</td>
                  <td className="py-3.5 px-4 font-mono text-[#5F6B7A]">{session.instrumentId}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#0B1F3A]">{session.instrumentModel}</div>
                    <div className="text-[10px] text-[#5F6B7A]">{session.manufacturer}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={session.accuracyClass} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-[#5F6B7A]">{session.startedOn}</td>
                  <td className="py-3.5 px-4 w-32">
                    {(() => {
                      const { percentage } = calculateTestProgress(session);
                      return (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                percentage === 100 ? 'bg-emerald-500' : 'bg-[#0B1F3A]'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-[#5F6B7A]">{percentage}%</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={session.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-[#1A1F2B] font-medium">{session.assignedOfficer}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/test-sessions/${session.id}`);
                      }}
                      className="px-3 py-1 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-[11px] rounded transition-colors border border-[#C8A46B]/40"
                    >
                      Open Workspace
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Start New Session Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate OIML R-76 Test Session"
        subtitle="Select a registered instrument to begin prescribed metrological evaluations."
        maxWidth="md"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0B1F3A] mb-1.5">
              Select Registered Instrument
            </label>
            <select
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] font-medium focus:outline-hidden focus:border-[#C8A46B]"
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.id} — {inst.model.modelName} ({inst.metrology.accuracyClass}, S/N: {inst.model.serialNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-[#F4ECDD] border border-[#D9D3C7] rounded-lg text-xs text-[#0B1F3A] space-y-1">
            <p className="font-bold">OIML R-76 Evaluation Protocol</p>
            <p className="text-[11px] text-[#5F6B7A]">
              Initializes prescribed test modules: Weighing performance, repeatability, eccentricity loading, subtractive tare, and discrimination.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1A1F2B] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 shadow-xs cursor-pointer"
            >
              <PlayCircle className="w-4 h-4 text-[#C8A46B]" /> Start Evaluation Workspace
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

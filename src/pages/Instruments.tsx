import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, Scale, Eye, PlayCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { instrumentService } from '../services/instrumentService';
import { Instrument } from '../types';
import { calculateVerificationIntervals } from '../utils/metrologyService';

export const Instruments: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const loadInstruments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await instrumentService.getInstruments();
      setInstruments(data);
    } catch (err: any) {
      setError(err.message || 'Unable to load instruments. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstruments();
  }, []);

  const filteredInstruments = useMemo(() => {
    return instruments.filter((inst) => {
      const matchesSearch =
        searchTerm === '' ||
        inst.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.model.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.model.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.manufacturer.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesClass = selectedClass === 'All' || inst.metrology.accuracyClass === selectedClass;
      const matchesType = selectedType === 'All' || inst.model.instrumentType === selectedType;
      const matchesStatus = selectedStatus === 'All' || inst.status === selectedStatus;

      return matchesSearch && matchesClass && matchesType && matchesStatus;
    });
  }, [instruments, searchTerm, selectedClass, selectedType, selectedStatus]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedClass('All');
    setSelectedType('All');
    setSelectedStatus('All');
  };

  return (
    <div className="space-y-6">
      {/* Heading Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">Registered Instruments</h2>
          <p className="text-xs text-[#5F6B7A] mt-1">
            Registry of Non-Automatic Weighing Instruments undergoing type evaluation and verification.
          </p>
        </div>

        <Link
          to="/instruments/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-xs rounded-lg transition-colors border border-[#C8A46B]/40 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4 text-[#C8A46B]" />
          Register Instrument
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadInstruments} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9D3C7] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Field */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F6B7A]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, model, serial no. or manufacturer..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] placeholder-[#5F6B7A] focus:outline-hidden focus:bg-white focus:border-[#C8A46B]"
            />
          </div>

          {/* Accuracy Class Filter */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <Filter className="w-3.5 h-3.5 text-[#5F6B7A] shrink-0 hidden md:block" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] font-medium focus:outline-hidden focus:border-[#C8A46B]"
            >
              <option value="All">All Accuracy Classes</option>
              <option value="Class I">Class I</option>
              <option value="Class II">Class II</option>
              <option value="Class III">Class III</option>
              <option value="Class IIII">Class IIII</option>
            </select>
          </div>

          {/* Instrument Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full md:w-auto px-3 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] font-medium focus:outline-hidden focus:border-[#C8A46B]"
          >
            <option value="All">All Instrument Types</option>
            <option value="Electronic Weighing Scale">Electronic Scale</option>
            <option value="Platform Scale">Platform Scale</option>
            <option value="Laboratory Balance">Laboratory Balance</option>
            <option value="Weighbridge">Weighbridge</option>
            <option value="Bench Scale">Bench Scale</option>
          </select>

          {/* Compliance Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-auto px-3 py-2 text-xs bg-[#F9F9F7] border border-[#D9D3C7] rounded-lg text-[#1A1F2B] font-medium focus:outline-hidden focus:border-[#C8A46B]"
          >
            <option value="All">All Compliance Statuses</option>
            <option value="Compliant">Compliant</option>
            <option value="Under Evaluation">Under Evaluation</option>
            <option value="Non-Compliant">Non-Compliant</option>
            <option value="Pending Review">Pending Review</option>
          </select>

          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="p-2 text-[#5F6B7A] hover:text-[#0B1F3A] hover:bg-[#F4ECDD] rounded-lg transition-colors shrink-0 cursor-pointer"
            title="Reset Filters"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Instruments Table */}
      <div className="bg-white rounded-xl border border-[#D9D3C7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1F3A] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Instrument ID</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4">Model & Serial</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Min</th>
                <th className="py-3 px-4">Max</th>
                <th className="py-3 px-4">d</th>
                <th className="py-3 px-4">e</th>
                <th className="py-3 px-4">n</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D3C7] text-xs text-[#1A1F2B]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#5F6B7A]">
                    <div className="w-6 h-6 border-2 border-[#0B1F3A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading registered instruments from database...</p>
                  </td>
                </tr>
              ) : filteredInstruments.length > 0 ? (
                filteredInstruments.map((inst) => {
                  const maxUnit = inst.metrology.maxUnit;
                  const minUnit = inst.metrology.minUnit;
                  const dUnit = inst.metrology.dUnit;
                  const eUnit = inst.metrology.eUnit;
                  const n = inst.metrology.verificationScaleIntervalsN ?? calculateVerificationIntervals(
                    inst.metrology.maxCapacity,
                    maxUnit,
                    inst.metrology.verificationIntervalE,
                    eUnit
                  );

                  return (
                    <tr
                      key={inst.id}
                      onClick={() => navigate(`/instruments/${inst.id}`)}
                      className="hover:bg-[#F4ECDD]/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">{inst.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0B1F3A]">{inst.manufacturer.name}</div>
                        <div className="text-[10px] text-[#5F6B7A]">{inst.manufacturer.country}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#0B1F3A]">{inst.model.modelName}</div>
                        <div className="text-[10px] font-mono text-[#5F6B7A]">S/N: {inst.model.serialNumber}</div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1A1F2B]">{inst.model.instrumentType}</td>
                      <td className="py-3.5 px-4">
                        <Badge status={inst.metrology.accuracyClass} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#5F6B7A]">
                        {inst.metrology.minCapacity} {minUnit}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0B1F3A]">
                        {inst.metrology.maxCapacity} {maxUnit}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#5F6B7A]">
                        {inst.metrology.scaleIntervalD} {dUnit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">
                        {inst.metrology.verificationIntervalE} {eUnit}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">
                        {n > 0 ? n.toLocaleString() : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge status={inst.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/instruments/${inst.id}`)}
                            className="p-1.5 rounded text-[#5F6B7A] hover:text-[#0B1F3A] hover:bg-[#F4ECDD]"
                            title="View Instrument Specifications"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/test-sessions?instrumentId=${inst.id}`)}
                            className="p-1.5 rounded text-[#0B1F3A] hover:bg-[#F4ECDD]"
                            title="Start OIML Test Session"
                          >
                            <PlayCircle className="w-4 h-4 text-[#C8A46B]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-[#5F6B7A]">
                    <Scale className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-[#1A1F2B] text-sm">No registered instruments match your filter criteria.</p>
                    <button
                      onClick={resetFilters}
                      className="mt-2 text-xs font-bold text-[#C8A46B] hover:underline"
                    >
                      Clear search filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

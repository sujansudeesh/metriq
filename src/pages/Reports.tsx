import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Eye, Award } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { reportService } from '../services/reportService';
import { Report } from '../types';

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSync = async () => {
      setLoading(true);
      const fetchedReports = await reportService.getReports();
      setReports(fetchedReports);
      setLoading(false);
    };

    handleSync();

    window.addEventListener('storage', handleSync);
    window.addEventListener('nawi_session_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('nawi_session_updated', handleSync);
    };
  }, []);

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      searchTerm === '' ||
      r.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.certificateId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.instrumentModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#D9D3C7] shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A] tracking-tight">OIML R 76 Test Evaluation Reports</h2>
          <p className="text-xs text-[#5F6B7A] mt-1">
            OIML R 76 Test Evaluation Reports, audit sign-offs, and printable evaluation records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-[#F4ECDD] text-[#0B1F3A] border border-[#C8A46B]/40 font-bold text-xs rounded-lg flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#C8A46B]" />
            Evaluation Complete
          </span>
        </div>
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
              placeholder="Search by Report No, Certificate ID, model or manufacturer..."
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
              <option value="All">All Certificate Statuses</option>
              <option value="Finalized">Finalized</option>
              <option value="Awaiting Review">Awaiting Review</option>
              <option value="Approved">Approved</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-[#D9D3C7] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B1F3A] text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Report Number</th>
                <th className="py-3 px-4">Certificate ID</th>
                <th className="py-3 px-4">Instrument / Model</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Verdict</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Signatories</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D3C7] text-xs text-[#1A1F2B]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#5F6B7A]">
                    Loading reports from database...
                  </td>
                </tr>
              ) : filteredReports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => navigate(`/reports/${report.id}`)}
                  className="hover:bg-[#F4ECDD]/30 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0B1F3A]">{report.reportNumber}</td>
                  <td className="py-3.5 px-4 font-mono text-[#5F6B7A]">{report.certificateId}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[#0B1F3A]">{report.instrumentModel}</div>
                    <div className="text-[10px] text-[#5F6B7A]">{report.manufacturer}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={report.accuracyClass} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-[#5F6B7A]">{report.issueDate}</td>
                  <td className="py-3.5 px-4">
                    <Badge status={report.verdict} size="sm" />
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={report.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-[#5F6B7A]">
                    <div>Officer: <span className="text-[#0B1F3A] font-semibold">{report.testingOfficer}</span></div>
                    <div>Director: <span className="text-[#0B1F3A] font-semibold">{report.labDirector}</span></div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/reports/${report.id}`)}
                        className="px-3 py-1 bg-[#0B1F3A] hover:bg-[#12355B] text-[#C8A46B] font-bold text-[11px] rounded transition-colors flex items-center gap-1 border border-[#C8A46B]/40"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#C8A46B]" /> View Certificate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types';

export const AuditTrail: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSync = async () => {
      setLoading(true);
      try {
        const fetchedLogs = await auditService.getAuditEvents();
        setLogs(fetchedLogs);
      } catch (err: any) {
        console.error('Failed to load audit trail:', err);
      } finally {
        setLoading(false);
      }
    };

    handleSync();

    window.addEventListener('storage', handleSync);
    window.addEventListener('nawi_session_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('nawi_session_updated', handleSync);
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.instrumentOrSessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEntity =
      selectedEntity === 'ALL' ||
      (log.entityType && log.entityType.toLowerCase() === selectedEntity.toLowerCase());

    return matchesSearch && matchesEntity;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Laboratory Activity Audit Trail</h2>
          <p className="text-xs text-slate-500 mt-1">
            Traceable activity log capturing all authenticated metrology events, before/after values, and workflow transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-slate-900 text-teal-400 font-mono text-xs rounded-lg flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4" /> Traceability History Log
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-2/3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit log by officer, action, target ID, details or reason..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-1/3">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:bg-white"
          >
            <option value="ALL">All Entity Types</option>
            <option value="auth">Auth & Session</option>
            <option value="instrument">Instruments</option>
            <option value="test_session">Test Sessions</option>
            <option value="test_observation">Test Observations</option>
            <option value="report">Reports & Certificates</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <th className="py-3 px-4">Log ID &amp; Timestamp</th>
                <th className="py-3 px-4">Officer / User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Target Entity ID</th>
                <th className="py-3 px-4">Details / Reason</th>
                <th className="py-3 px-4 text-right">Diffs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    Loading audit events...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const hasDiff = log.beforeValue !== undefined || log.afterValue !== undefined;
                  const isExpanded = expandedLogId === log.id;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{log.id}</div>
                          <div className="text-[10px] text-slate-400 font-sans">{log.timestamp}</div>
                        </td>
                        <td className="py-3.5 px-4 font-sans font-semibold text-slate-900">{log.user}</td>
                        <td className="py-3.5 px-4 font-sans text-slate-500">{log.role}</td>
                        <td className="py-3.5 px-4 font-sans">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium text-slate-800 text-[11px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-teal-700">{log.instrumentOrSessionId}</td>
                        <td className="py-3.5 px-4 font-sans text-slate-600 max-w-xs truncate">
                          {log.details}
                          {log.reason && <div className="text-[11px] text-rose-700 italic font-mono mt-0.5">Reason: "{log.reason}"</div>}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {hasDiff && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-sans font-bold text-teal-700 hover:text-teal-900 bg-teal-50 border border-teal-200 px-2 py-1 rounded cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Diffs
                            </button>
                          )}
                        </td>
                      </tr>

                      {isExpanded && hasDiff && (
                        <tr className="bg-slate-900 text-slate-100">
                          <td colSpan={7} className="p-4 font-mono text-[11px]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                                <span className="text-rose-400 font-bold block mb-1">BEFORE VALUE:</span>
                                <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.beforeValue, null, 2) || 'None'}
                                </pre>
                              </div>
                              <div className="p-3 bg-slate-950 rounded border border-slate-800">
                                <span className="text-emerald-400 font-bold block mb-1">AFTER VALUE:</span>
                                <pre className="text-slate-300 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.afterValue, null, 2) || 'None'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

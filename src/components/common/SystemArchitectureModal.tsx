import React from 'react';
import { Server, ShieldCheck, Cpu, Database, Lock, Layers, X, FileText, CheckCircle2 } from 'lucide-react';

interface SystemArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemArchitectureModal: React.FC<SystemArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full p-6 space-y-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white">METRIQ System Architecture</h2>
              <p className="text-xs text-slate-400">Technical Stack, Security Story, Traceability &amp; Hardware Integration Model</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Architecture Diagram */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <Layers className="w-4 h-4" /> End-to-End Technical Architecture
          </h4>
          <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2 text-center">
            <p className="font-bold text-white">METRIQ (React 18 + TypeScript + Vite)</p>
            <p className="text-slate-500">│</p>
            <p className="font-bold text-teal-300">Application Services &amp; Workflow Layer</p>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300 my-2">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-teal-400 block">OIML Rule Engine</span>
                `src/rules/oimlR76/2006/`
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-teal-400 block">Workflow Engine</span>
                `testSessionService.ts`
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-teal-400 block">Reporting Engine</span>
                `pdfGeneratorService.ts`
              </div>
            </div>
            <p className="text-slate-500">│</p>
            <p className="font-bold text-teal-400">Supabase Cloud Platform</p>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300">
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-white block">PostgreSQL</span>
                11 RLS Tables
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-white block">Supabase Auth</span>
                Multi-Role JWT
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800">
                <span className="font-bold text-white block">Supabase Storage</span>
                Private Evidence Buckets
              </div>
            </div>
          </div>
        </div>

        {/* Hardware Integration Panel & Security Story */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Hardware Info Panel */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-[11px] flex items-center gap-1.5">
              <Cpu className="w-4 h-4" /> Hardware Connectivity Story
            </h4>
            <div className="space-y-1 text-slate-300 leading-relaxed text-[11px]">
              <p><strong>CURRENT SIH PROTOTYPE:</strong> Certified test weights are physically applied by the laboratory officer, who enters the instrument indication into METRIQ.</p>
              <p><strong>FUTURE EXPANSION:</strong> Direct data acquisition through supported instrument interfaces such as RS-232 / USB ports.</p>
            </div>
          </div>

          {/* Security & Traceability Story */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-extrabold uppercase tracking-wider text-sky-400 text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Security &amp; Traceability
            </h4>
            <ul className="space-y-1 text-slate-300 text-[11px] font-mono">
              <li>✓ Authenticated Users (Supabase Auth)</li>
              <li>✓ Role-Based Permissions (Officer, Reviewer, Director)</li>
              <li>✓ Row-Level Security (RLS) PostgreSQL Policies</li>
              <li>✓ Private Storage Buckets &amp; Signed URLs</li>
              <li>✓ Laboratory Activity Audit Trail Logs (Append-Only)</li>
              <li>✓ Read-Only Finalized Reports</li>
            </ul>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button onClick={onClose} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl">
            Close Architecture View
          </button>
        </div>
      </div>
    </div>
  );
};

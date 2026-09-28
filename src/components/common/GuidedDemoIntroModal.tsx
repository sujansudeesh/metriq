import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  FileCheck2,
  Layers,
  PlayCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Server,
  Code,
  HelpCircle,
  Cpu,
  X,
} from 'lucide-react';
import { resetGuidedDemoSession } from '../../mock/store';
import { useToast } from './Toast';

interface GuidedDemoIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuidedDemoIntroModal: React.FC<GuidedDemoIntroModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'intro' | 'comparison' | 'architecture' | 'readiness'>('intro');

  if (!isOpen) return null;

  const handleStartDemo = () => {
    resetGuidedDemoSession();
    showToast('SIH 2026 Guided Demo Started', 'Loaded clean demonstration session TS-2026-101 (MetriScale Pro 500).', 'info');
    onClose();
    navigate('/test-sessions/TS-2026-101');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl max-w-4xl w-full p-6 space-y-6 relative overflow-hidden">
        {/* Decorative Grid Accent */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-white">METRIQ</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-500 text-slate-950">
                  SIH 2026 DEMONSTRATION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Digital OIML R 76-1:2006 Test Evaluation &amp; Legal Metrology Reporting System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-bold select-none">
          <button
            onClick={() => setActiveSubTab('intro')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'intro' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            1. Problem &amp; Core Idea
          </button>
          <button
            onClick={() => setActiveSubTab('comparison')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'comparison' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            2. Before vs After Workflow
          </button>
          <button
            onClick={() => setActiveSubTab('architecture')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'architecture' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            3. Architecture &amp; Tech Stack
          </button>
          <button
            onClick={() => setActiveSubTab('readiness')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeSubTab === 'readiness' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            4. System Readiness Checks
          </button>
        </div>

        {/* TAB 1: INTRO & CORE IDEA */}
        {activeSubTab === 'intro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 block">
                  CURRENT CHALLENGE
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Testing of non-automatic weighing instruments involves multiple raw observations, manual calculations, complex rule lookups, review steps, and physical paper certificate preparation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400 block">
                  OUR SOLUTION
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  METRIQ converts the legal metrology test procedure into a guided, rule-driven digital laboratory workflow with automated OIML R 76 tolerances and multi-role approvals.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 block">
                  CORE IDEA
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter raw test observations. The system applies the applicable OIML rule, explains the calculation, supports laboratory traceability workflows, and generates authentic QR-verified reports.
                </p>
              </div>
            </div>

            {/* UNIQUE VALUE STATEMENT CALLOUT */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/80 via-slate-950 to-slate-950 border border-teal-500/40 text-center space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-400">
                UNIQUE VALUE STATEMENT
              </span>
              <p className="text-sm font-extrabold text-white">
                “We are not merely digitizing a test report. We are digitizing the test evaluation logic and laboratory workflow.”
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: BEFORE VS AFTER WORKFLOW */}
        {activeSubTab === 'comparison' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[11px]">
                  TRADITIONAL WORKFLOW (Typical manual process)
                </span>
              </div>
              <ul className="space-y-2 text-slate-400 font-mono text-[11px]">
                <li className="flex items-center gap-2"><span>1. Manual observations on paper sheets</span></li>
                <li className="flex items-center gap-2"><span>2. Manual calculation of MPE tolerances</span></li>
                <li className="flex items-center gap-2"><span>3. Manual OIML standard clause lookup</span></li>
                <li className="flex items-center gap-2"><span>4. Spreadsheet / word document preparation</span></li>
                <li className="flex items-center gap-2"><span>5. Manual paper review &amp; physical signatures</span></li>
                <li className="flex items-center gap-2"><span>6. Printed paper certificate distribution</span></li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/40 space-y-3">
              <div className="flex items-center justify-between border-b border-teal-800/60 pb-2">
                <span className="font-extrabold text-teal-400 uppercase tracking-wider text-[11px]">
                  METRIQ WORKFLOW (Digital System)
                </span>
              </div>
              <ul className="space-y-2 text-teal-200 font-mono text-[11px]">
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 1. Registered instrument characteristics</span></li>
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 2. Automatic test plan generation</span></li>
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 3. Raw measurement entry with validation</span></li>
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 4. Versioned OIML R 76-1 rule engine</span></li>
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 5. Automatic evaluation &amp; explainability</span></li>
                <li className="flex items-center gap-2 text-emerald-300 font-bold"><span>✓ 6. Multi-role review &amp; QR-verified report</span></li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: ARCHITECTURE & TECH STACK */}
        {activeSubTab === 'architecture' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-bold uppercase tracking-wider text-teal-400 text-xs flex items-center gap-2">
                <Server className="w-4 h-4" /> System Architecture
              </h4>
              <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-2 text-center">
                <p className="font-bold text-teal-300">React + TypeScript Frontend (Vite &amp; Tailwind CSS)</p>
                <p className="text-slate-500">│</p>
                <p className="font-bold text-white">Application Services &amp; Workflow State Machine</p>
                <p className="text-slate-500">├─── Versioned OIML R 76-1:2006 Rule Engine (`src/rules/oimlR76/2006/`)</p>
                <p className="text-slate-500">├─── Test Plan Applicability Engine (`testPlanService.ts`)</p>
                <p className="text-slate-500">└─── PDF Report &amp; QR Generator Service (`pdfGeneratorService.ts`)</p>
                <p className="text-slate-500">│</p>
                <p className="font-bold text-teal-400">Supabase Cloud Backend (PostgreSQL + Auth + Storage + RLS)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">FRONTEND</span>
                <span className="font-bold text-white">React 18 + TS + Vite</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">BACKEND</span>
                <span className="font-bold text-teal-300">Supabase PostgreSQL</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">SECURITY</span>
                <span className="font-bold text-white">RLS Policies &amp; Auth</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[9px]">REPORTS</span>
                <span className="font-bold text-teal-300">pdf-lib + qrcode</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM READINESS CHECKS */}
        {activeSubTab === 'readiness' && (
          <div className="space-y-3 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-teal-400 text-xs">
              SIH Demonstration Environment Readiness Status
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>Frontend Build</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>Database Schema</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>Rule Engine</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>177 Metrology Tests</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>Demo Instrument</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>Demo Roles</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>PDF Generator</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <span>QR Verification</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Target: MetriScale Pro 500 (Class III, Max 30kg, e=5g)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Explore Application
            </button>

            <button
              onClick={handleStartDemo}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-900/30 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <PlayCircle className="w-4 h-4" />
              <span>▶ Start Guided SIH Demo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

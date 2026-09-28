import React, { useState, useEffect } from 'react';
import { TestSession } from '../../types';
import { OIMLTestSheetHeader } from './OIMLTestSheetHeader';
import { Printer, HelpCircle, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';

export interface ExplanationDetail {
  title: string;
  appliedLoad?: string;
  observedIndication?: string;
  additionalLoad?: string;
  calculatedError?: string;
  correctedError?: string;
  mpeLimit?: string;
  ruleReference?: string;
  comparison?: string;
  resultStatus?: 'PASSED' | 'FAILED' | 'PENDING';
}

interface DigitalOIMLTestSheetProps {
  session: TestSession;
  instrument?: any;
  sectionNumber: string; // e.g. "Section 1"
  sheetTitle: string; // e.g. "WEIGHING PERFORMANCE"
  clauseReference: string; // e.g. "A.4.4, A.5.3.1"
  reportPage?: string; // e.g. "1 / 1"
  formNumber?: string; // e.g. "R76-2 / A.4"
  overallStatus?: 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT' | 'IN_PROGRESS' | 'NOT_STARTED';
  explanationDetails?: ExplanationDetail;
  remarks?: string;
  onRemarksChange?: (newRemarks: string) => void;
  isReadOnly?: boolean;
  children: React.ReactNode;
}

export const DigitalOIMLTestSheet: React.FC<DigitalOIMLTestSheetProps> = ({
  session,
  instrument,
  sectionNumber,
  sheetTitle,
  clauseReference,
  reportPage = '1 / 1',
  formNumber = 'R76-2 / A.4',
  overallStatus = 'IN_PROGRESS',
  explanationDetails,
  remarks,
  onRemarksChange,
  isReadOnly = false,
  children,
}) => {
  const { t, i18n } = useTranslation();
  const [showWhyResult, setShowWhyResult] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => {
      if (user) setAuthenticatedUser(user);
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = () => {
    if (overallStatus === 'WITHIN_LIMIT') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 border border-emerald-400 text-emerald-900 font-sans font-extrabold text-xs rounded-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> PASSED (WITHIN LIMIT)
        </span>
      );
    }
    if (overallStatus === 'EXCEEDS_LIMIT') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 border border-rose-400 text-rose-900 font-sans font-extrabold text-xs rounded-xs">
          <XCircle className="w-3.5 h-3.5 text-rose-700" /> FAILED (EXCEEDS LIMIT)
        </span>
      );
    }
    if (overallStatus === 'NOT_STARTED') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-300 text-slate-600 font-sans font-bold text-xs rounded-xs">
          NOT STARTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 font-sans font-bold text-xs rounded-xs">
        IN PROGRESS
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar above Paper Sheet (Screen Only) */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print bg-[#0B1F3A] p-3 rounded-lg border border-[#D9D3C7] text-xs text-white">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white uppercase tracking-wide">
            OIML R 76-2 {sectionNumber} Sheet
          </span>
          {saveStatus === 'saving' && (
            <span className="text-amber-400 text-[11px] font-mono animate-pulse">
              ● Saving observation...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-400 text-[11px] font-mono">
              ✓ Saved to Supabase
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {explanationDetails && (
            <button
              type="button"
              onClick={() => setShowWhyResult(!showWhyResult)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12355B] hover:bg-[#08162A] text-[#C8A46B] font-semibold rounded border border-[#C8A46B]/40 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C8A46B]" />
              <span>Why This Result?</span>
              {showWhyResult ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C8A46B] hover:bg-[#B79055] text-[#08162A] font-extrabold rounded shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#08162A]" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Collapsible "WHY THIS RESULT?" Panel (Outside Paper Sheet) */}
      {showWhyResult && explanationDetails && (
        <div className="no-print p-4 bg-[#0B1F3A] border-2 border-[#C8A46B]/60 rounded-lg text-slate-200 text-xs space-y-3 font-sans shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2 font-bold text-[#C8A46B] text-sm">
              <Info className="w-4 h-4 text-[#C8A46B]" />
              <span>WHY THIS RESULT? — Deterministic Metrological Evaluation</span>
            </div>
            {explanationDetails.ruleReference && (
              <span className="font-mono bg-[#08162A] text-[#C8A46B] border border-[#C8A46B]/40 px-2 py-0.5 rounded text-[11px]">
                {explanationDetails.ruleReference}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
            {explanationDetails.appliedLoad && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Applied Load (L)</span>
                <span className="font-bold text-white text-xs">{explanationDetails.appliedLoad}</span>
              </div>
            )}
            {explanationDetails.observedIndication && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Indication (I)</span>
                <span className="font-bold text-white text-xs">{explanationDetails.observedIndication}</span>
              </div>
            )}
            {explanationDetails.additionalLoad && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Add. Load (ΔL)</span>
                <span className="font-bold text-white text-xs">{explanationDetails.additionalLoad}</span>
              </div>
            )}
            {explanationDetails.calculatedError && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Calculated Error (E)</span>
                <span className="font-bold text-amber-300 text-xs">{explanationDetails.calculatedError}</span>
              </div>
            )}
            {explanationDetails.correctedError && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Corrected Error (Ec)</span>
                <span className="font-bold text-[#C8A46B] text-xs">{explanationDetails.correctedError}</span>
              </div>
            )}
            {explanationDetails.mpeLimit && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700">
                <span className="text-[10px] text-slate-400 font-sans block">Applicable MPE</span>
                <span className="font-bold text-sky-300 text-xs">{explanationDetails.mpeLimit}</span>
              </div>
            )}
            {explanationDetails.comparison && (
              <div className="bg-[#08162A] p-2.5 rounded border border-slate-700 col-span-2">
                <span className="text-[10px] text-slate-400 font-sans block">Evaluation Math</span>
                <span className="font-bold text-emerald-300 text-xs">{explanationDetails.comparison}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KANNADA GUIDANCE ASSISTANCE STRIP (Above Paper Sheet in Kannada Mode) */}
      {i18n.language === 'kn' && (
        <div lang="kn" className="no-print p-3.5 bg-[#F4ECDD] border-l-4 border-[#C8A46B] text-[#0B1F3A] rounded-r-lg shadow-sm flex items-start gap-3 max-w-5xl mx-auto">
          <BookOpen className="w-4 h-4 text-[#C8A46B] shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs font-sans">
            <span className="font-extrabold text-[#0B1F3A] block uppercase tracking-wide">
              {t('tests.kannadaGuidanceNotice')}
            </span>
            <p className="text-slate-800 leading-relaxed">
              {sheetTitle.includes('WEIGHING')
                ? t('testModules.guidance.weighing')
                : sheetTitle.includes('REPEATABILITY')
                ? t('testModules.guidance.repeatability')
                : sheetTitle.includes('ECCENTRICITY')
                ? t('testModules.guidance.eccentricity')
                : sheetTitle.includes('DISCRIMINATION')
                ? t('testModules.guidance.discrimination')
                : sheetTitle.includes('ZERO')
                ? t('testModules.guidance.zeroSetting')
                : sheetTitle.includes('TARE')
                ? t('testModules.guidance.tare')
                : t('testModules.guidance.weighing')}
            </p>
          </div>
        </div>
      )}

      {/* CENTRAL A4 PAPER SHEET CONTAINER */}
      <div lang="en" className="bg-white text-[#1A1F2B] border border-[#D9D3C7] shadow-xl rounded-sm p-6 md:p-8 font-sans max-w-5xl mx-auto overflow-x-auto print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
        
        {/* OFFICIAL OIML R 76-2 FORM TOP BAR */}
        <div className="border-b-2 border-[#0B1F3A] pb-3 mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold text-[#5F6B7A] tracking-wider font-mono">
              OIML R 76-2:2007 (E) — TEST REPORT FORMAT
            </div>
            <h1 className="text-base font-extrabold text-[#0B1F3A] uppercase tracking-tight mt-0.5">
              {sectionNumber}: {sheetTitle}
            </h1>
            <div className="text-[10px] text-[#5F6B7A] font-mono mt-0.5">
              Clause reference: {clauseReference}
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs font-mono font-bold text-[#0B1F3A] border border-[#D9D3C7] px-2.5 py-1 bg-[#F4ECDD]">
              Report page: <span className="text-[#0B1F3A]">{reportPage}</span>
            </div>
            <div className="text-[10px] font-mono text-[#5F6B7A] mt-1">
              Form ref: {formNumber}
            </div>
          </div>
        </div>

        {/* COMMON OIML HEADER BLOCK */}
        <OIMLTestSheetHeader
          session={session}
          instrument={instrument}
          sheetTitle={sheetTitle}
          clauseReference={clauseReference}
          formNumber={formNumber}
          isReadOnly={isReadOnly}
        />

        {/* MAIN SHEET TABLE CONTENT */}
        <div className="my-6 space-y-4">
          {children}
        </div>

        {/* FOOTER RESULT & REMARKS AREA */}
        <div className="border-t-2 border-[#0B1F3A] pt-4 mt-6 space-y-4">
          {/* Automatic System Evaluation Check */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#F4ECDD]/30 border border-[#D9D3C7] rounded-xs">
            <div className="text-xs">
              <span className="font-bold text-[#0B1F3A] block">
                Official Compliance Evaluation (Automated System Control)
              </span>
              <span className="text-[11px] text-[#5F6B7A] font-mono">
                Condition: |Ec| ≤ |mpe| per OIML R 76-1:2006
              </span>
            </div>

            <div className="shrink-0">
              {getStatusBadge()}
            </div>
          </div>

          {/* Remarks Textarea */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
              Remarks &amp; Laboratory Notes:
            </label>
            <textarea
              rows={2}
              disabled={isReadOnly}
              value={remarks || ''}
              onChange={(e) => onRemarksChange && onRemarksChange(e.target.value)}
              placeholder="Enter official laboratory notes, environmental anomalies, or inspector remarks..."
              className="w-full bg-white text-[#1A1F2B] border border-[#D9D3C7] font-sans text-xs p-2 focus:bg-[#F4ECDD] focus:outline-none focus:ring-1 focus:ring-[#C8A46B]"
            />
          </div>

          {/* Signature Block for Print / Official Record */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-300 text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Testing Officer Signature:</span>
              <div className="h-8 border-b border-slate-400 mt-1 font-bold text-slate-800 flex items-end">
                {authenticatedUser?.name || session.assignedOfficer || 'Testing Officer'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 block">Date of Evaluation:</span>
              <div className="h-8 border-b border-slate-400 mt-1 font-bold text-slate-800 flex items-end">
                {session.startedOn || new Date().toISOString().substring(0, 10)}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

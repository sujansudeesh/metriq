import React, { useState } from 'react';
import { Report, TestSession, Instrument } from '../../types';
import { Logo } from '../common/Logo';
import { ShieldCheck, Award, Printer, Download, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { docxReportService } from '../../services/docxReportService';

interface ReportCertificateProps {
  report: Report;
  session?: TestSession;
  instrument?: Instrument;
  onPrint?: () => void;
}

export const ReportCertificate: React.FC<ReportCertificateProps> = ({
  report,
  session,
  instrument,
  onPrint,
}) => {
  const isCompliant = report.verdict === 'Compliant';
  const [downloadingDocx, setDownloadingDocx] = useState(false);

  const handleDownloadDocx = async () => {
    try {
      setDownloadingDocx(true);
      await docxReportService.downloadDocxReport(report, session, instrument);
    } catch (err) {
      console.error('Failed to generate docx report:', err);
    } finally {
      setDownloadingDocx(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar (Hidden when printing) */}
      <div className="no-print flex items-center justify-between p-4 bg-[#0B1F3A] text-white rounded-xl shadow-md border border-[#C8A46B]/40">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[#C8A46B]" />
          <span className="font-semibold text-sm">OIML R 76 Test Evaluation Report View</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#0B1F3A] hover:bg-[#1E293B] text-[#C8A46B] border border-[#C8A46B] font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-[#C8A46B]" />
            {downloadingDocx ? 'Generating Word...' : 'Download Word (.docx)'}
          </button>
          <button
            onClick={onPrint || (() => window.print())}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-[#C8A46B] hover:bg-[#B79055] text-[#08162A] font-extrabold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#08162A]" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Official Printable Certificate Document Body */}
      <div className="bg-white p-8 md:p-12 rounded-xl shadow-lg border border-slate-200 text-slate-900 font-serif relative">
        {/* Certificate Watermark Stamp */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <ShieldCheck className="w-96 h-96 text-slate-900" />
        </div>

        {/* Certificate Header / Emblem */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-6">
          <div className="space-y-1">
            <Logo variant="light" showSubtitle={false} />
            <p className="text-xs font-sans text-slate-500 font-medium tracking-wide uppercase">
              Government of India • Directorate of Legal Metrology
            </p>
            <p className="text-[11px] font-sans text-slate-400">
              National Metrology Laboratory • Type Evaluation Division
            </p>
          </div>

          <div className="text-right font-sans text-xs space-y-1">
            <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 font-bold text-slate-900 rounded">
              REPORT NO: {report.reportNumber}
            </div>
            <p className="text-slate-600">REPORT ID: <span className="font-semibold">{report.certificateId}</span></p>
            <p className="text-slate-500">ISSUE DATE: {report.issueDate}</p>
          </div>
        </div>

        {/* Title & Status Badge */}
        <div className="text-center my-6 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-sans font-bold text-[10px] uppercase rounded">
              SIH Prototype Demonstration Report
            </span>
            <span className="px-2.5 py-0.5 bg-slate-900 text-white font-sans font-bold text-[10px] uppercase rounded">
              {session?.workflowStatus === 'FINALIZED' || report.status === 'Finalized'
                ? 'FINAL TEST REPORT'
                : session?.workflowStatus === 'APPROVED' || report.status === 'Approved'
                ? 'APPROVED TEST REPORT'
                : 'DRAFT TEST REPORT'}
            </span>
          </div>

          <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 inline-block pb-1">
            OIML R 76 TEST EVALUATION REPORT
          </h2>
          <p className="text-xs font-sans text-slate-600 uppercase tracking-widest mt-1">
            Non-Automatic Weighing Instrument (NAWI) • OIML Recommendation R-76-1:2006 (E)
          </p>
        </div>

        {/* Section 1: Instrument & Manufacturer Specification */}
        <div className="mb-6 font-sans text-xs">
          <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider bg-slate-100 p-2 border-l-4 border-slate-900 mb-3">
            1. Instrument Identification & Metrological Specifications
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border border-slate-200 rounded bg-slate-50/50">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Manufacturer Name</span>
              <span className="font-semibold text-slate-900">{report.manufacturer}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Model Number</span>
              <span className="font-semibold text-slate-900">{report.instrumentModel}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Serial Number</span>
              <span className="font-mono font-semibold text-slate-900">{session?.serialNumber || 'XP600-2026-8841'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Accuracy Class</span>
              <span className="font-semibold text-slate-900">{report.accuracyClass}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Maximum Capacity (Max)</span>
              <span className="font-semibold text-slate-900">{session?.maxCapacity || '600 g'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Verification Interval (e)</span>
              <span className="font-semibold text-slate-900">{session?.verificationInterval || '0.1 g'}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Environmental Test Conditions */}
        <div className="mb-6 font-sans text-xs">
          <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider bg-slate-100 p-2 border-l-4 border-slate-900 mb-3">
            2. Environmental Testing Conditions
          </h3>
          <div className="grid grid-cols-3 gap-4 p-3 border border-slate-200 rounded text-center bg-slate-50/50">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Ambient Temperature</span>
              <span className="font-semibold text-slate-900">{session?.ambientTemp || 22.4} °C</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Relative Humidity</span>
              <span className="font-semibold text-slate-900">{session?.relativeHumidity || 54} %</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Barometric Pressure</span>
              <span className="font-semibold text-slate-900">{session?.barometricPressure || 1013.2} hPa</span>
            </div>
          </div>
        </div>

        {/* Section 3: Prescribed OIML R-76 Test Results Summary */}
        <div className="mb-6 font-sans text-xs space-y-4">
          <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider bg-slate-100 p-2 border-l-4 border-slate-900">
            3A. Applicable Metrological Tests Conducted
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-left">
            <thead>
              <tr className="bg-slate-200 text-slate-800 text-[11px] uppercase">
                <th className="p-2 border border-slate-300">OIML R-76 Clause</th>
                <th className="p-2 border border-slate-300">Prescribed Test Module</th>
                <th className="p-2 border border-slate-300">Tolerance Limit (MPE)</th>
                <th className="p-2 border border-slate-300">Result</th>
                <th className="p-2 border border-slate-300">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 3.5 / A.4.4</td>
                <td className="p-2 border border-slate-300 font-medium">Weighing Performance & Accuracy</td>
                <td className="p-2 border border-slate-300">± 0.5e to ± 1.5e</td>
                <td className="p-2 border border-slate-300 font-mono">Max Err = +0.03g</td>
                <td className="p-2 border border-slate-300 font-semibold text-emerald-700">PASSED</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 3.6.1 / A.4.10</td>
                <td className="p-2 border border-slate-300 font-medium">Repeatability Test</td>
                <td className="p-2 border border-slate-300">Max diff ≤ MPE</td>
                <td className="p-2 border border-slate-300 font-mono">Range = 0.02g</td>
                <td className="p-2 border border-slate-300 font-semibold text-emerald-700">PASSED</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 3.6.2 / A.4.7</td>
                <td className="p-2 border border-slate-300 font-medium">Eccentricity Loading Test</td>
                <td className="p-2 border border-slate-300">1/3 Max load @ positions 1-5</td>
                <td className="p-2 border border-slate-300 font-mono">Max Err = +0.02g</td>
                <td className="p-2 border border-slate-300 font-semibold text-emerald-700">PASSED</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 4.5.2 / A.4.2.3</td>
                <td className="p-2 border border-slate-300 font-medium">Zero-Setting Accuracy Test</td>
                <td className="p-2 border border-slate-300">± 0.25e</td>
                <td className="p-2 border border-slate-300 font-mono">
                  {session?.zeroSettingObservations && session.zeroSettingObservations.length > 0
                    ? `E₀ = ${session.zeroSettingObservations[0].calculatedZeroError >= 0 ? '+' : ''}${session.zeroSettingObservations[0].calculatedZeroError.toFixed(2)} g`
                    : 'E₀ = +0.50g'}
                </td>
                <td className={`p-2 border border-slate-300 font-semibold ${
                  session?.zeroSettingObservations && session.zeroSettingObservations.length > 0
                    ? session.zeroSettingObservations[0].passed
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                    : 'text-emerald-700'
                }`}>
                  {session?.zeroSettingObservations && session.zeroSettingObservations.length > 0
                    ? session.zeroSettingObservations[0].resultStatus.replace('_', ' ')
                    : 'WITHIN LIMIT'}
                </td>
              </tr>
              {/* Conditional Tare Row */}
              {(!session?.testPlan || session.testPlan.find((p) => p.id === 'tare')?.status === 'APPLICABLE') && (
                <tr>
                  <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 4.6 / A.4.6</td>
                  <td className="p-2 border border-slate-300 font-medium">Tare Operation & Net Weighing Test</td>
                  <td className="p-2 border border-slate-300">Tare setting ±0.25e, Net within MPE</td>
                  <td className="p-2 border border-slate-300 font-mono">
                    {session?.tareTestSession?.netWeighingObservations && session.tareTestSession.netWeighingObservations.length > 0
                      ? `Max Net Err = ${
                          session.tareTestSession.netWeighingObservations.reduce((max, obs) =>
                            Math.abs(obs.netError) > Math.abs(max.netError) ? obs : max
                          ).netErrorFormatted
                        } (Tare: ${session.tareTestSession.appliedTare} kg)`
                      : 'Applied Tare = 5.0 kg, Max Net Err = +3 g'}
                  </td>
                  <td className={`p-2 border border-slate-300 font-semibold ${
                    session?.tareTestSession
                      ? session.tareTestSession.overallResult === 'COMPLETED_WITHIN_LIMITS'
                        ? 'text-emerald-700'
                        : session.tareTestSession.overallResult === 'NEEDS_ATTENTION'
                        ? 'text-rose-700'
                        : 'text-amber-600'
                      : 'text-emerald-700'
                  }`}>
                    {session?.tareTestSession
                      ? session.tareTestSession.overallResult === 'COMPLETED_WITHIN_LIMITS'
                        ? 'PASSED'
                        : session.tareTestSession.overallResult === 'NEEDS_ATTENTION'
                        ? 'FAILED'
                        : 'IN PROGRESS'
                      : 'PASSED'}
                  </td>
                </tr>
              )}
              {/* Conditional Discrimination Row */}
              {(!session?.testPlan || session.testPlan.find((p) => p.id === 'discrimination')?.status === 'APPLICABLE') && (
                <tr>
                  <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 3.8 / A.4.8</td>
                  <td className="p-2 border border-slate-300 font-medium">Digital Discrimination / Sensitivity</td>
                  <td className="p-2 border border-slate-300">Response to 1.4d addition</td>
                  <td className="p-2 border border-slate-300 font-mono">Confirmed ΔI = +0.14g</td>
                  <td className="p-2 border border-slate-300 font-semibold text-emerald-700">PASSED</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Section 3B: Tests Evaluated as Not Applicable */}
          <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider bg-slate-100 p-2 border-l-4 border-slate-600 pt-3">
            3B. Prescribed OIML Tests Evaluated as Not Applicable
          </h3>
          <table className="w-full border-collapse border border-slate-300 text-left">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-[11px] uppercase">
                <th className="p-2 border border-slate-300">OIML Clause</th>
                <th className="p-2 border border-slate-300">Test Module Name</th>
                <th className="p-2 border border-slate-300">Applicability Status</th>
                <th className="p-2 border border-slate-300">OIML Regulatory Reason / Justification</th>
              </tr>
            </thead>
            <tbody>
              {session?.testPlan && session.testPlan.filter((t) => t.status === 'NOT_APPLICABLE').length > 0 ? (
                session.testPlan
                  .filter((t) => t.status === 'NOT_APPLICABLE')
                  .map((item) => (
                    <tr key={item.id} className="bg-slate-50/50">
                      <td className="p-2 border border-slate-300 font-mono text-[11px]">{item.ruleReference}</td>
                      <td className="p-2 border border-slate-300 font-medium text-slate-800">{item.name}</td>
                      <td className="p-2 border border-slate-300 font-semibold text-slate-500">NOT APPLICABLE</td>
                      <td className="p-2 border border-slate-300 text-slate-600 italic text-[11px]">{item.reason}</td>
                    </tr>
                  ))
              ) : (
                <tr className="bg-slate-50/50">
                  <td className="p-2 border border-slate-300 font-mono text-[11px]">Clause 5.3 / A.5.3</td>
                  <td className="p-2 border border-slate-300 font-medium text-slate-800">Static Temperature & Influence Tests</td>
                  <td className="p-2 border border-slate-300 font-semibold text-slate-500">NOT APPLICABLE</td>
                  <td className="p-2 border border-slate-300 text-slate-600 italic text-[11px]">
                    Influence factor testing required only during Laboratory Type Approval evaluation per Clause 5.3.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Section 4: Formal Evaluation Verdict */}
        <div className="my-8 p-6 border-2 border-slate-900 rounded-lg flex items-center justify-between bg-slate-50 font-sans">
          <div>
            <span className="text-xs uppercase text-slate-500 font-bold block">Final Metrological Verdict</span>
            <p className="text-sm font-semibold text-slate-900 mt-1">
              {isCompliant
                ? 'The instrument meets all requirements of OIML R-76-1 Edition 2006 (E) for Type Evaluation.'
                : 'The instrument FAILS to meet OIML R-76 tolerances and is declared NON-COMPLIANT.'}
            </p>
          </div>
          <div className="shrink-0 ml-4">
            {isCompliant ? (
              <div className="flex items-center gap-2 px-6 py-2 bg-emerald-700 text-white font-bold text-sm tracking-wider uppercase rounded-md shadow-sm">
                <CheckCircle2 className="w-5 h-5" /> COMPLIANT
              </div>
            ) : (
              <div className="flex items-center gap-2 px-6 py-2 bg-rose-700 text-white font-bold text-sm tracking-wider uppercase rounded-md shadow-sm">
                <XCircle className="w-5 h-5" /> NON-COMPLIANT
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Official Digital Signatures Block */}
        <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 font-sans text-xs text-center">
          <div className="space-y-8">
            <div className="h-10 flex items-center justify-center text-teal-800 font-serif italic text-sm">
              Dr. Ananya Rao
            </div>
            <div className="border-t border-slate-400 pt-1">
              <p className="font-bold text-slate-900">{report.testingOfficer}</p>
              <p className="text-[10px] text-slate-500 uppercase">Senior Testing Officer</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="h-10 flex items-center justify-center text-teal-800 font-serif italic text-sm">
              V. Verma
            </div>
            <div className="border-t border-slate-400 pt-1">
              <p className="font-bold text-slate-900">{report.technicalReviewer}</p>
              <p className="text-[10px] text-slate-500 uppercase">Technical Auditor</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="h-10 flex items-center justify-center text-teal-800 font-serif italic text-sm">
              Dr. K. S. Murthy
            </div>
            <div className="border-t border-slate-400 pt-1">
              <p className="font-bold text-slate-900">{report.labDirector}</p>
              <p className="text-[10px] text-slate-500 uppercase">Director of Legal Metrology</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

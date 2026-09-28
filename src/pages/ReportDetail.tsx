import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, History, Printer, Eye, Award, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ReportCertificate } from '../components/reports/ReportCertificate';
import { DocumentViewer } from '../components/common/DocumentViewer';
import { reportService, ReportVersionRecord } from '../services/reportService';
import { documentService, DocumentRecord } from '../services/documentService';
import { testSessionService } from '../services/testSessionService';
import { instrumentService } from '../services/instrumentService';
import { authService } from '../services/authService';
import { docxReportService } from '../services/docxReportService';
import { useToast } from '../components/common/Toast';
import { Report, TestSession, Instrument } from '../types';

export const ReportDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [report, setReport] = useState<Report | null>(null);
  const [session, setSession] = useState<TestSession | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [versions, setVersions] = useState<ReportVersionRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const handleDownloadDocx = async () => {
    if (!report) return;
    setDownloadingDocx(true);
    try {
      const userProfile = await authService.getCurrentProfile();
      await docxReportService.downloadDocxReport(report, session || undefined, instrument || undefined, userProfile || undefined);
      showToast('Word Report Downloaded', `Editable Word (.docx) report generated and downloaded.`, 'success');
    } catch (err: any) {
      showToast('Docx Generation Error', err.message || 'Unable to generate Word report.', 'error');
    } finally {
      setDownloadingDocx(false);
    }
  };

  const loadReportData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const foundReport = await reportService.getReportBySessionId(id);
      if (foundReport) {
        setReport(foundReport);
        const targetSessionId = foundReport.testSessionId;
        const allSessions = await testSessionService.getAllSessionsAsync();
        const foundSession = allSessions.find((s) => s.id === targetSessionId) || testSessionService.getSession(targetSessionId);
        if (foundSession) {
          setSession(foundSession);
          const foundInst = await instrumentService.getInstrumentById(foundSession.instrumentId);
          setInstrument(foundInst);
          const docs = await documentService.getDocuments({ sessionId: targetSessionId, instrumentId: foundSession.instrumentId });
          setDocuments(docs);
        }
        const vers = await reportService.getReportVersions(foundReport.id);
        setVersions(vers);
      }
    } catch (err) {
      console.error('Failed to load report detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [id]);

  const handleGeneratePdf = async () => {
    if (!report || !session) return;
    setGeneratingPdf(true);
    try {
      const userProfile = await authService.getCurrentProfile();
      const { report: updatedReport, pdfUrl } = await reportService.generateRealReport(
        session.id,
        userProfile || undefined,
        report.status === 'Finalized' ? 'FINAL' : report.status === 'Approved' ? 'APPROVED' : 'DRAFT'
      );
      setReport(updatedReport);
      showToast('PDF Report Generated', `Official report PDF generated and stored in Supabase Storage.`, 'success');

      // Refresh version history
      const vers = await reportService.getReportVersions(updatedReport.id);
      setVersions(vers);

      // Open PDF in new tab
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
      }
    } catch (err: any) {
      showToast('PDF Generation Error', err.message || 'Unable to generate PDF report.', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 space-y-3">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs">Loading official report certificate and version history...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-12 text-center text-slate-500 space-y-3">
        <p className="font-bold text-slate-700">Report Record Not Found</p>
        <button onClick={() => navigate('/reports')} className="text-xs font-semibold text-teal-600 hover:underline">
          Return to Reports Registry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header Navigation & Action Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <button
          onClick={() => navigate('/reports')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Certificates & Reports Registry
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowVersionHistory(!showVersionHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition-colors border border-slate-200"
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span>Version History ({versions.length})</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Layout</span>
          </button>

          <button
            onClick={handleDownloadDocx}
            disabled={downloadingDocx}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0B1F3A] hover:bg-[#1E293B] text-[#C8A46B] border border-[#C8A46B]/60 font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {downloadingDocx ? (
              <span>Generating Word...</span>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-[#C8A46B]" />
                <span>Download Word (.docx)</span>
              </>
            )}
          </button>

          <button
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            {generatingPdf ? (
              <span>Generating PDF...</span>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Generate & Download Real PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* VERSION HISTORY PANEL (If toggled) */}
      {showVersionHistory && (
        <div className="no-print bg-slate-900 text-white p-5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <History className="w-4 h-4" /> Report Snapshot Version History
            </h3>
            <span className="text-[10px] text-slate-400">Total Versions: {versions.length}</span>
          </div>

          {versions.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No historical PDF report snapshots logged yet. Click &quot;Generate & Download Real PDF&quot; to create Version 1.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {versions.map((ver) => (
                <div key={ver.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-teal-300 font-mono">Version {ver.versionNumber}</span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-300">
                        {ver.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Generated by {ver.generatedByName || 'Officer'} on {new Date(ver.generatedAt).toLocaleString()}
                    </span>
                  </div>

                  {ver.signedUrl && (
                    <a
                      href={ver.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 bg-teal-600/20 text-teal-300 border border-teal-500/30 hover:bg-teal-600/40 rounded text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF v{ver.versionNumber}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Official Certificate View Component */}
      <ReportCertificate
        report={report}
        session={session || undefined}
        instrument={instrument || undefined}
      />

      {/* Attached Test Evidence & Documents Section */}
      {documents.length > 0 && (
        <div className="no-print pt-4">
          <DocumentViewer
            documents={documents}
            title="4. SUPPORTING TEST EVIDENCE & ATTACHMENTS"
            allowFilter={true}
          />
        </div>
      )}
    </div>
  );
};

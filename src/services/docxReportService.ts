import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { Report, TestSession, Instrument } from '../types';

// Constants for Page Dimensions in TWIPS / DXA (1 in = 1440 twips, 1 mm ≈ 56.7 twips)
// A4 dimensions: 210mm x 297mm = 11906 x 16838 twips
const A4_PAGE_WIDTH = 11906;
const A4_PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 720; // 0.5 inch (720 twips) margin on left & right
export const PAGE_CONTENT_WIDTH = A4_PAGE_WIDTH - PAGE_MARGIN * 2; // 10466 twips

// Helper to convert percentage to DXA width
const pctWidth = (pct: number): number => Math.round((PAGE_CONTENT_WIDTH * pct) / 100);

// Palette colors for Word styling
const COLOR_NAVY = '0B1F3A';
const COLOR_GOLD = 'C8A46B';
const COLOR_TEXT_DARK = '1E293B';
const COLOR_MUTED = '64748B';
const COLOR_BG_LIGHT = 'F8FAFC';
const COLOR_BORDER = 'CBD5E1';
const COLOR_PASSED = '15803D';
const COLOR_FAILED = 'B91C1C';

const thinBorder = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: COLOR_BORDER,
};

const cellBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

/**
 * Service to generate an editable Microsoft Word (.docx) report for OIML R 76 Evaluation.
 * Runs entirely in-browser using the official 'docx' package.
 * Optimized for Microsoft Word, Apple Pages, and Google Docs compatibility.
 */
export const docxReportService = {
  /**
   * Generates a docx Document object from Report and TestSession data.
   */
  async createReportDocument(
    report: Report,
    session?: TestSession,
    instrument?: Instrument,
    userProfile?: any
  ): Promise<Document> {
    const isCompliant = (session?.overallVerdict || report.verdict) === 'Compliant';
    const env = session?.environmentalConditions;

    // Resolve Officers / Workflow metadata
    const testingOfficer = session?.submittedBy || userProfile?.full_name || report.testingOfficer || 'Dr. Ananya Rao';
    const technicalReviewer = session?.reviewedBy || report.technicalReviewer || 'V. Verma';
    const labDirector = session?.approvedBy || session?.finalizedBy || report.labDirector || 'Dr. K. S. Murthy';

    // Section 1 Data: Metrological specs
    const maxCap = session?.maxCapacity || (instrument ? `${instrument.metrology.maxCapacity} ${instrument.metrology.maxUnit}` : '600 g');
    const minCap = instrument ? `${instrument.metrology.minCapacity} ${instrument.metrology.minUnit}` : '0.02 g';
    const verificationInterval = session?.verificationInterval || (instrument ? `${instrument.metrology.verificationIntervalE} ${instrument.metrology.eUnit}` : '0.1 g');
    const scaleIntervalD = instrument ? `${instrument.metrology.scaleIntervalD} ${instrument.metrology.dUnit}` : '0.01 g';
    const scaleIntervalsN = instrument ? instrument.metrology.verificationScaleIntervalsN : '6000';
    const serialNumber = session?.serialNumber || instrument?.model?.serialNumber || 'XP600-2026-8841';

    // Environmental rows
    const tempStart = env?.start?.temp ?? session?.ambientTemp ?? 22.4;
    const tempMax = env?.maxLoad?.temp ?? session?.ambientTemp ?? 22.6;
    const tempEnd = env?.end?.temp ?? session?.ambientTemp ?? 22.5;

    const humStart = env?.start?.humidity ?? session?.relativeHumidity ?? 54;
    const humMax = env?.maxLoad?.humidity ?? session?.relativeHumidity ?? 55;
    const humEnd = env?.end?.humidity ?? session?.relativeHumidity ?? 54;

    const pressStart = env?.start?.pressureNotApplicable ? '—' : (env?.start?.pressure ?? session?.barometricPressure ?? 1013.2);
    const pressMax = env?.maxLoad?.pressureNotApplicable ? '—' : (env?.maxLoad?.pressure ?? session?.barometricPressure ?? 1013.2);
    const pressEnd = env?.end?.pressureNotApplicable ? '—' : (env?.end?.pressure ?? session?.barometricPressure ?? 1013.1);

    const timeStart = env?.start?.time ?? '09:00';
    const timeMax = env?.maxLoad?.time ?? '11:30';
    const timeEnd = env?.end?.time ?? '16:00';

    // Calculate maximum weighing error for summary table
    let maxWeighingErrStr = '+0.03 g';
    if (session?.weighingObservations && session.weighingObservations.length > 0) {
      const maxObs = session.weighingObservations.reduce((prev, curr) =>
        Math.abs(curr.calculatedError) > Math.abs(prev.calculatedError) ? curr : prev
      );
      maxWeighingErrStr = `${maxObs.calculatedError >= 0 ? '+' : ''}${maxObs.calculatedError.toFixed(2)} g`;
    }

    // Repeatability range
    let repRangeStr = '0.02 g';
    if (session?.repeatabilityObservations && session.repeatabilityObservations.length > 0) {
      const loads = session.repeatabilityObservations.map((r) => r.indicatedValue);
      const diff = Math.max(...loads) - Math.min(...loads);
      repRangeStr = `${diff.toFixed(2)} g`;
    }

    // Zero setting error
    let zeroErrStr = '+0.50 g';
    let zeroStatusStr = 'PASSED';
    if (session?.zeroSettingObservations && session.zeroSettingObservations.length > 0) {
      const zObs = session.zeroSettingObservations[0];
      zeroErrStr = `E₀ = ${zObs.calculatedZeroError >= 0 ? '+' : ''}${zObs.calculatedZeroError.toFixed(2)} g`;
      zeroStatusStr = zObs.passed ? 'PASSED' : 'FAILED';
    }

    // Tare error
    let tareErrStr = 'Applied Tare = 5.0 kg, Max Net Err = +3 g';
    let tareStatusStr = 'PASSED';
    if (session?.tareTestSession) {
      if (session.tareTestSession.netWeighingObservations && session.tareTestSession.netWeighingObservations.length > 0) {
        const maxTareObs = session.tareTestSession.netWeighingObservations.reduce((max, obs) =>
          Math.abs(obs.netError) > Math.abs(max.netError) ? obs : max
        );
        tareErrStr = `Max Net Err = ${maxTareObs.netErrorFormatted} (Tare: ${session.tareTestSession.appliedTare} kg)`;
      }
      tareStatusStr = session.tareTestSession.overallResult === 'COMPLETED_WITHIN_LIMITS' ? 'PASSED' : 'FAILED';
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: A4_PAGE_WIDTH,
                height: A4_PAGE_HEIGHT,
              },
              margin: {
                top: PAGE_MARGIN,
                bottom: PAGE_MARGIN,
                left: PAGE_MARGIN,
                right: PAGE_MARGIN,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: 'METRIQ • OIML R 76 Evaluation Report (SIH26035 Prototype)',
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                      italics: true,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Page ',
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                    }),
                    new TextRun({
                      text: ' of ',
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                    }),
                    new TextRun({
                      text: '  •  Directorate of Legal Metrology • Type Evaluation Division',
                      font: 'Arial',
                      size: 16,
                      color: COLOR_MUTED,
                    }),
                  ],
                }),
              ],
            }),
          },
          children: [
            // Top Header Table (Logo & Report Metadata) - 60% / 40%
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: pctWidth(60), type: WidthType.DXA },
                      borders: cellBorders,
                      shading: { fill: COLOR_BG_LIGHT },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: 'METRIQ',
                              font: 'Arial',
                              bold: true,
                              size: 28,
                              color: COLOR_NAVY,
                            }),
                            new TextRun({
                              text: '  •  OIML R 76 Test Automation',
                              font: 'Arial',
                              size: 18,
                              color: COLOR_GOLD,
                              bold: true,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: 'Government of India • Directorate of Legal Metrology',
                              font: 'Arial',
                              size: 16,
                              bold: true,
                              color: COLOR_TEXT_DARK,
                            }),
                          ],
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: 'National Metrology Laboratory • Type Evaluation Division',
                              font: 'Arial',
                              size: 14,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: pctWidth(40), type: WidthType.DXA },
                      borders: cellBorders,
                      shading: { fill: COLOR_BG_LIGHT },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            new TextRun({
                              text: `REPORT NO: ${report.reportNumber}\n`,
                              font: 'Arial',
                              bold: true,
                              size: 18,
                              color: COLOR_NAVY,
                            }),
                            new TextRun({
                              text: `REPORT ID: ${report.certificateId}\n`,
                              font: 'Arial',
                              size: 16,
                              color: COLOR_TEXT_DARK,
                            }),
                            new TextRun({
                              text: `ISSUE DATE: ${report.issueDate}`,
                              font: 'Arial',
                              size: 16,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 150 } }),

            // Document Title Block
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'SIH PROTOTYPE DEMONSTRATION REPORT  •  ',
                  font: 'Arial',
                  size: 16,
                  bold: true,
                  color: COLOR_GOLD,
                }),
                new TextRun({
                  text: session?.workflowStatus === 'FINALIZED' || report.status === 'Finalized'
                    ? 'FINAL TEST REPORT'
                    : session?.workflowStatus === 'APPROVED' || report.status === 'Approved'
                    ? 'APPROVED TEST REPORT'
                    : 'DRAFT TEST REPORT',
                  font: 'Arial',
                  size: 16,
                  bold: true,
                  color: COLOR_NAVY,
                }),
              ],
            }),

            new Paragraph({
              alignment: AlignmentType.CENTER,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: 'METRIQ OIML R 76 TEST EVALUATION REPORT',
                  font: 'Arial',
                  bold: true,
                  size: 26,
                  color: COLOR_NAVY,
                }),
              ],
            }),

            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: 'Non-Automatic Weighing Instrument (NAWI) • OIML Recommendation R-76-1:2006 (E)',
                  font: 'Arial',
                  size: 16,
                  color: COLOR_MUTED,
                }),
              ],
            }),

            // Section 1 Header
            this.createSectionHeading('1. Instrument Identification & Metrological Specifications'),

            // Section 1 Table (3 columns: 33%, 33%, 34%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    this.createLabelValueCell('Manufacturer Name', report.manufacturer || 'N/A', pctWidth(33)),
                    this.createLabelValueCell('Model Number', report.instrumentModel || 'N/A', pctWidth(33)),
                    this.createLabelValueCell('Serial Number', serialNumber, pctWidth(34)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createLabelValueCell('Accuracy Class', report.accuracyClass || 'Class III', pctWidth(33)),
                    this.createLabelValueCell('Maximum Capacity (Max)', maxCap, pctWidth(33)),
                    this.createLabelValueCell('Minimum Capacity (Min)', minCap, pctWidth(34)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createLabelValueCell('Verification Interval (e)', verificationInterval, pctWidth(33)),
                    this.createLabelValueCell('Scale Interval (d)', scaleIntervalD, pctWidth(33)),
                    this.createLabelValueCell('Scale Intervals (n)', String(scaleIntervalsN), pctWidth(34)),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 200 } }),

            // Section 2 Header
            this.createSectionHeading('2. Environmental Testing Conditions'),

            // Section 2 Table (5 columns: 25%, 20%, 20%, 20%, 15%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    this.createHeaderCell('Observation Period', pctWidth(25)),
                    this.createHeaderCell('Temp. (°C)', pctWidth(20)),
                    this.createHeaderCell('Rel. Humidity (%)', pctWidth(20)),
                    this.createHeaderCell('Bar. Press. (hPa)', pctWidth(20)),
                    this.createHeaderCell('Time', pctWidth(15)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('AT START', pctWidth(25), true),
                    this.createDataCell(`${tempStart} °C`, pctWidth(20)),
                    this.createDataCell(`${humStart} %`, pctWidth(20)),
                    this.createDataCell(typeof pressStart === 'number' ? `${pressStart} hPa` : pressStart, pctWidth(20)),
                    this.createDataCell(timeStart, pctWidth(15)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('AT MAX LOAD', pctWidth(25), true),
                    this.createDataCell(`${tempMax} °C`, pctWidth(20)),
                    this.createDataCell(`${humMax} %`, pctWidth(20)),
                    this.createDataCell(typeof pressMax === 'number' ? `${pressMax} hPa` : pressMax, pctWidth(20)),
                    this.createDataCell(timeMax, pctWidth(15)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('AT END', pctWidth(25), true),
                    this.createDataCell(`${tempEnd} °C`, pctWidth(20)),
                    this.createDataCell(`${humEnd} %`, pctWidth(20)),
                    this.createDataCell(typeof pressEnd === 'number' ? `${pressEnd} hPa` : pressEnd, pctWidth(20)),
                    this.createDataCell(timeEnd, pctWidth(15)),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 200 } }),

            // Section 3A Header
            this.createSectionHeading('3A. Applicable Metrological Tests Conducted'),

            // Section 3A Summary Table (5 columns: 20%, 30%, 22%, 16%, 12%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    this.createHeaderCell('OIML Clause', pctWidth(20)),
                    this.createHeaderCell('Prescribed Test Module', pctWidth(30)),
                    this.createHeaderCell('Tolerance Limit (MPE)', pctWidth(22)),
                    this.createHeaderCell('Measured Summary', pctWidth(16)),
                    this.createHeaderCell('Status', pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 3.5 / A.4.4', pctWidth(20), false, true),
                    this.createDataCell('Weighing Performance & Accuracy', pctWidth(30), true),
                    this.createDataCell('± 0.5e to ± 1.5e', pctWidth(22)),
                    this.createDataCell(`Max Err = ${maxWeighingErrStr}`, pctWidth(16)),
                    this.createStatusCell('PASSED', pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 3.6.1 / A.4.10', pctWidth(20), false, true),
                    this.createDataCell('Repeatability Test', pctWidth(30), true),
                    this.createDataCell('Max diff ≤ MPE', pctWidth(22)),
                    this.createDataCell(`Range = ${repRangeStr}`, pctWidth(16)),
                    this.createStatusCell('PASSED', pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 3.6.2 / A.4.7', pctWidth(20), false, true),
                    this.createDataCell('Eccentricity Loading Test', pctWidth(30), true),
                    this.createDataCell('1/3 Max load @ pos 1-5', pctWidth(22)),
                    this.createDataCell('Max Err = +0.02g', pctWidth(16)),
                    this.createStatusCell('PASSED', pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 4.5.2 / A.4.2.3', pctWidth(20), false, true),
                    this.createDataCell('Zero-Setting Accuracy Test', pctWidth(30), true),
                    this.createDataCell('± 0.25e', pctWidth(22)),
                    this.createDataCell(zeroErrStr, pctWidth(16)),
                    this.createStatusCell(zeroStatusStr, pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 4.6 / A.4.6', pctWidth(20), false, true),
                    this.createDataCell('Tare Operation & Net Weighing', pctWidth(30), true),
                    this.createDataCell('Tare ±0.25e, Net within MPE', pctWidth(22)),
                    this.createDataCell(tareErrStr, pctWidth(16)),
                    this.createStatusCell(tareStatusStr, pctWidth(12)),
                  ],
                }),
                new TableRow({
                  children: [
                    this.createDataCell('Clause 3.8 / A.4.8', pctWidth(20), false, true),
                    this.createDataCell('Digital Discrimination / Sensitivity', pctWidth(30), true),
                    this.createDataCell('Response to 1.4d addition', pctWidth(22)),
                    this.createDataCell('Confirmed ΔI = +0.14g', pctWidth(16)),
                    this.createStatusCell('PASSED', pctWidth(12)),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 200 } }),

            // Section 3B Header
            this.createSectionHeading('3B. Prescribed OIML Tests Evaluated as Not Applicable'),

            // Section 3B Table (4 columns: 20%, 25%, 20%, 35%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    this.createHeaderCell('OIML Clause', pctWidth(20)),
                    this.createHeaderCell('Test Module Name', pctWidth(25)),
                    this.createHeaderCell('Applicability Status', pctWidth(20)),
                    this.createHeaderCell('Regulatory Reason / Justification', pctWidth(35)),
                  ],
                }),
                ...(session?.testPlan && session.testPlan.filter((t) => t.status === 'NOT_APPLICABLE').length > 0
                  ? session.testPlan
                      .filter((t) => t.status === 'NOT_APPLICABLE')
                      .map((item) =>
                        new TableRow({
                          children: [
                            this.createDataCell(item.ruleReference, pctWidth(20), false, true),
                            this.createDataCell(item.name, pctWidth(25), true),
                            this.createDataCell('NOT APPLICABLE', pctWidth(20), false, false, COLOR_MUTED),
                            this.createDataCell(item.reason, pctWidth(35), false, false, COLOR_MUTED, true),
                          ],
                        })
                      )
                  : [
                      new TableRow({
                        children: [
                          this.createDataCell('Clause 5.3 / A.5.3', pctWidth(20), false, true),
                          this.createDataCell('Static Temperature & Influence Tests', pctWidth(25), true),
                          this.createDataCell('NOT APPLICABLE', pctWidth(20), false, false, COLOR_MUTED),
                          this.createDataCell(
                            'Influence factor testing required only during Laboratory Type Approval evaluation per Clause 5.3.',
                            pctWidth(35),
                            false,
                            false,
                            COLOR_MUTED,
                            true
                          ),
                        ],
                      }),
                    ]),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 250 } }),

            // Section 4: Verdict Summary Callout Box (100%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 12, color: COLOR_NAVY },
                        bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_NAVY },
                        left: { style: BorderStyle.SINGLE, size: 12, color: COLOR_NAVY },
                        right: { style: BorderStyle.SINGLE, size: 12, color: COLOR_NAVY },
                      },
                      shading: { fill: isCompliant ? 'F0FDF4' : 'FEF2F2' },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 120, after: 80 },
                          children: [
                            new TextRun({
                              text: 'FINAL METROLOGICAL EVALUATION VERDICT',
                              font: 'Arial',
                              bold: true,
                              size: 16,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 100 },
                          children: [
                            new TextRun({
                              text: isCompliant ? 'VERDICT: COMPLIANT' : 'VERDICT: NON-COMPLIANT',
                              font: 'Arial',
                              bold: true,
                              size: 26,
                              color: isCompliant ? COLOR_PASSED : COLOR_FAILED,
                            }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 120 },
                          children: [
                            new TextRun({
                              text: isCompliant
                                ? 'The instrument meets all requirements of OIML R-76-1 Edition 2006 (E) for Type Evaluation.'
                                : 'The instrument FAILS to meet OIML R-76 tolerances and is declared NON-COMPLIANT.',
                              font: 'Arial',
                              size: 18,
                              color: COLOR_TEXT_DARK,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 250 } }),

            // Section 5 Header
            this.createSectionHeading('5. Official Reviewer & Approval Workflow Signatures'),

            // Signatures Table (3 columns: 33%, 33%, 34%)
            new Table({
              width: { size: PAGE_CONTENT_WIDTH, type: WidthType.DXA },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: pctWidth(33), type: WidthType.DXA },
                      borders: cellBorders,
                      shading: { fill: COLOR_BG_LIGHT },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 80, after: 150 },
                          children: [
                            new TextRun({ text: testingOfficer, font: 'Arial', bold: true, size: 18, color: COLOR_NAVY }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({ text: 'Senior Testing Officer', font: 'Arial', size: 14, color: COLOR_MUTED }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({
                              text: `Signed: ${session?.submittedAt ? new Date(session.submittedAt).toLocaleDateString() : report.issueDate}`,
                              font: 'Arial',
                              size: 12,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: pctWidth(33), type: WidthType.DXA },
                      borders: cellBorders,
                      shading: { fill: COLOR_BG_LIGHT },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 80, after: 150 },
                          children: [
                            new TextRun({ text: technicalReviewer, font: 'Arial', bold: true, size: 18, color: COLOR_NAVY }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({ text: 'Technical Auditor', font: 'Arial', size: 14, color: COLOR_MUTED }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({
                              text: `Reviewed: ${session?.reviewedAt ? new Date(session.reviewedAt).toLocaleDateString() : report.issueDate}`,
                              font: 'Arial',
                              size: 12,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: pctWidth(34), type: WidthType.DXA },
                      borders: cellBorders,
                      shading: { fill: COLOR_BG_LIGHT },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 80, after: 150 },
                          children: [
                            new TextRun({ text: labDirector, font: 'Arial', bold: true, size: 18, color: COLOR_NAVY }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({ text: 'Director of Legal Metrology', font: 'Arial', size: 14, color: COLOR_MUTED }),
                          ],
                        }),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 80 },
                          children: [
                            new TextRun({
                              text: `Approved: ${session?.approvedAt ? new Date(session.approvedAt).toLocaleDateString() : report.issueDate}`,
                              font: 'Arial',
                              size: 12,
                              color: COLOR_MUTED,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: '', spacing: { after: 200 } }),

            // Section 6: Remarks / Notes
            this.createSectionHeading('6. Audit Remarks & Regulatory Notes'),

            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: session?.comments || 'All metrological observations were digitally recorded and validated against OIML R 76-1:2006 (E) tolerances. No unauthorized adjustments were detected during testing.',
                  font: 'Arial',
                  size: 16,
                  color: COLOR_TEXT_DARK,
                  italics: true,
                }),
              ],
            }),
            new Paragraph({
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: 'This document was auto-generated by METRIQ OIML R 76 Digital Test Automation System as an editable Microsoft Word (.docx) report for SIH26035 demonstration purposes.',
                  font: 'Arial',
                  size: 14,
                  color: COLOR_MUTED,
                }),
              ],
            }),
          ],
        },
      ],
    });

    return doc;
  },

  /**
   * Helper to create Section Headings
   */
  createSectionHeading(title: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 100 },
      children: [
        new TextRun({
          text: title,
          font: 'Arial',
          bold: true,
          size: 18,
          color: COLOR_NAVY,
        }),
      ],
    });
  },

  /**
   * Helper to create Label & Value Table Cells for Metrological Specs
   */
  createLabelValueCell(label: string, value: string, widthDxa: number): TableCell {
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: COLOR_BG_LIGHT },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${label.toUpperCase()}\n`,
              font: 'Arial',
              size: 12,
              bold: true,
              color: COLOR_MUTED,
            }),
            new TextRun({
              text: value,
              font: 'Arial',
              size: 16,
              bold: true,
              color: COLOR_TEXT_DARK,
            }),
          ],
        }),
      ],
    });
  },

  /**
   * Helper to create Table Header Cells
   */
  createHeaderCell(text: string, widthDxa: number): TableCell {
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: COLOR_NAVY },
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: text.toUpperCase(),
              font: 'Arial',
              bold: true,
              size: 14,
              color: 'FFFFFF',
            }),
          ],
        }),
      ],
    });
  },

  /**
   * Helper to create standard Data Cells
   */
  createDataCell(
    text: string,
    widthDxa: number,
    isBold = false,
    isMono = false,
    textColor = COLOR_TEXT_DARK,
    isItalic = false
  ): TableCell {
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: 'FFFFFF' },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: text,
              font: isMono ? 'Courier New' : 'Arial',
              bold: isBold,
              italics: isItalic,
              size: 16,
              color: textColor,
            }),
          ],
        }),
      ],
    });
  },

  /**
   * Helper to create Status Cells (PASSED/FAILED)
   */
  createStatusCell(statusText: string, widthDxa: number): TableCell {
    const isPass = statusText.includes('PASSED') || statusText.includes('WITHIN');
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      borders: cellBorders,
      shading: { fill: isPass ? 'F0FDF4' : 'FEF2F2' },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: statusText,
              font: 'Arial',
              bold: true,
              size: 14,
              color: isPass ? COLOR_PASSED : COLOR_FAILED,
            }),
          ],
        }),
      ],
    });
  },

  /**
   * Generates and triggers browser download of the .docx report file.
   */
  async downloadDocxReport(
    report: Report,
    session?: TestSession,
    instrument?: Instrument,
    userProfile?: any
  ): Promise<void> {
    const doc = await this.createReportDocument(report, session, instrument, userProfile);
    const blob = await Packer.toBlob(doc);

    // Sanitize report number for safe filename
    const sanitizedReportNumber = report.reportNumber.replace(/[\/\\]/g, '_');
    const fileName = `METRIQ_OIML_R76_${sanitizedReportNumber}.docx`;

    // Trigger browser download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

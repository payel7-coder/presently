import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';
import {
  calculateFormFillupBatchTotals,
  calculateStudentFormFillupFee,
  formatResultStatusLabel,
  StudentResultInput,
} from './formFillupLogic';
import { drawInstitutionalPdfHeader } from './pdfHeader';

export interface FormFillupPDFOptions {
  classGroup: ClassGroup;
  students: Student[];
  records: FormFillupStudentRecord[];
  feeConfig: FormFillupFeeConfig;
  defaultPracticalCount?: number;
  coordinator?: User;
  generatedBy?: User | null;
}

export function generateFormFillupPDF(options: FormFillupPDFOptions): jsPDF {
  const {
    classGroup,
    students,
    records,
    feeConfig,
    defaultPracticalCount = 0,
    coordinator,
    generatedBy,
  } = options;

  const activeStudents = [...students]
    .filter(s => s.classId === classGroup.id && s.status === 'active')
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  const recordMap = new Map<string, FormFillupStudentRecord>();
  records.forEach(r => {
    if (r.classId === classGroup.id) {
      recordMap.set(r.studentId, r);
    }
  });

  const batchSummary = calculateFormFillupBatchTotals({
    students,
    records,
    feeConfig,
    defaultPracticalCount,
  });

  // A4 Landscape (297mm x 210mm) for clean 9-metric breakdown columns
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  const bannerHeight = drawInstitutionalPdfHeader(doc, {
    reportTitle: `${classGroup.name.toUpperCase()} (${classGroup.section})`,
    boardSubtitle: 'BANGLADESH TECHNICAL EDUCATION BOARD (BTEB) • DIPLOMA IN CST (85) • SEMESTER FINAL FORM FILL-UP FEE SCHEDULE',
    accentColor: [5, 150, 105],
    titleColor: [110, 231, 183],
  });

  // Metadata Box
  const metaY = bannerHeight + 4; // 37mm
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, metaY, pageWidth - 20, 20, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Assigned Coordinator:', 14, metaY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    coordinator ? `${coordinator.name} (${coordinator.email})` : 'Department Administration',
    49,
    metaY + 6.5
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Fee Rates (Tk):', 14, metaY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Exam: ${feeConfig.examFee} | Ref/Sub: ${feeConfig.referredExamFeePerSubject} | MS Reg: ${feeConfig.marksheetFeeRegular} | MS Ref/Sem: ${feeConfig.marksheetFeeReferredPerSemester} | Center Reg: ${feeConfig.centerFeeRegular} | Center Ref/Sem: ${feeConfig.centerFeeReferredPerSemester} | Prac/Sub: ${feeConfig.practicalFeePerSubject} | Qn: ${feeConfig.questionFee} | Delay: ${feeConfig.delayFee}`,
    39,
    metaY + 13.5
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Total Collectible:', pageWidth - 75, metaY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Tk ${batchSummary.totalCollectibleTk.toLocaleString()} (${batchSummary.totalStudents} Students)`,
    pageWidth - 46,
    metaY + 6.5
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Collected / Paid:', pageWidth - 75, metaY + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Tk ${batchSummary.totalCollectedTk.toLocaleString()} (${batchSummary.paidOrSubmittedCount}/${batchSummary.totalStudents})`,
    pageWidth - 46,
    metaY + 13.5
  );

  const tableBody = activeStudents.map(stu => {
    const rec = recordMap.get(stu.id);
    const input: StudentResultInput = rec
      ? {
          resultStatus: rec.resultStatus,
          referredSubjectsCount: rec.referredSubjectsCount,
          referredSemestersCount: rec.referredSemestersCount,
          practicalSubjectsCount: rec.practicalSubjectsCount,
          applyDelayFee: rec.applyDelayFee,
        }
      : {
          resultStatus: 'regular',
          referredSubjectsCount: 0,
          referredSemestersCount: 0,
          practicalSubjectsCount: defaultPracticalCount,
          applyDelayFee: false,
        };
    const b = calculateStudentFormFillupFee(feeConfig, input);
    const statusLabel = rec?.paymentStatus ? rec.paymentStatus.toUpperCase() : 'PENDING';

    return [
      stu.rollNumber,
      stu.name,
      formatResultStatusLabel(input.resultStatus),
      String(input.referredSubjectsCount),
      String(input.referredSemestersCount),
      String(input.practicalSubjectsCount),
      String(b.examFeeAmount),
      String(b.referredExamFeeAmount),
      String(b.marksheetRegularAmount + b.marksheetReferredAmount),
      String(b.centerRegularAmount + b.centerReferredAmount),
      String(b.practicalFeeAmount),
      String(b.questionFeeAmount),
      String(b.delayFeeAmount),
      `${b.totalAmountTk}`,
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: metaY + 24,
    margin: { left: 10, right: 10 },
    head: [[
      'Roll',
      'Student Name',
      'Result',
      'Ref Sub',
      'Ref Sem',
      'Prac Sub',
      'Exam',
      'Ref Exam',
      'Marksheet',
      'Center',
      'Practical',
      'Question',
      'Delay',
      'Total (Tk)',
      'Status',
    ]],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 40 },
      2: { halign: 'left', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 13 },
      4: { halign: 'center', cellWidth: 13 },
      5: { halign: 'center', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 16 },
      8: { halign: 'right', cellWidth: 18 },
      9: { halign: 'right', cellWidth: 16 },
      10: { halign: 'right', cellWidth: 17 },
      11: { halign: 'right', cellWidth: 16 },
      12: { halign: 'right', cellWidth: 14 },
      13: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      14: { halign: 'center', cellWidth: 18 },
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY || 140) + 12;
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated by ${generatedBy?.name || coordinator?.name || 'Presently'} on ${new Date().toISOString().split('T')[0]}`,
    12,
    Math.min(finalY, 198)
  );

  return doc;
}

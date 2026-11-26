import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User } from '../types/attendance';
import { formatResultStatusLabel } from './formFillupLogic';
import { StudentProfileDossier } from './studentProfileLogic';
import { drawInstitutionalPdfHeader } from './pdfHeader';

export function generateStudentDossierPDF(
  dossier: StudentProfileDossier,
  generatedBy?: User | null
): jsPDF {
  const {
    student,
    classGroup,
    attendanceStats,
    courseworkSummary,
    subjectRows,
    formFillupRecord,
  } = dossier;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Minimalist Black & White Institutional Header
  const bannerHeight = drawInstitutionalPdfHeader(doc, {
    reportTitle: 'OFFICIAL STUDENT ACADEMIC DOSSIER',
    boardSubtitle: 'BANGLADESH TECHNICAL EDUCATION BOARD (BTEB) • DIPLOMA IN ENGINEERING (PROBIDHAN 2022)',
    footerNote: `Generated: ${new Date().toISOString().split('T')[0]} · Authorized By: ${
      generatedBy?.name || 'Academic Registrar'
    }`,
  });

  // Student Identity & Registrar Block
  const identityY = bannerHeight + 9; // 45mm
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(student.name, 14, identityY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(
    `Board Roll: ${student.rollNumber}  ·  Registration No: ${
      student.registrationNumber || 'N/A'
    }  ·  Batch: ${classGroup?.name || student.classId}`,
    14,
    identityY + 6
  );

  // Metadata Summary Table
  autoTable(doc, {
    startY: identityY + 11,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [170, 170, 170],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    body: [
      [
        'Semester & Shift',
        `${classGroup?.semester || student.semester || '—'} Semester (${
          student.shift || classGroup?.section || 'Day'
        })`,
        'Academic Session',
        student.session || classGroup?.academicYear || '2022–2023',
      ],
      [
        'Overall Attendance',
        `${attendanceStats.attendancePercentage}% (${attendanceStats.present + attendanceStats.late + attendanceStats.excused}/${attendanceStats.totalSessions} classes)`,
        'BTEB Exam Eligibility',
        attendanceStats.isAtRisk
          ? `Below 75% Threshold (Need ${attendanceStats.requiredForThreshold})`
          : 'Eligible (>= 75%)',
      ],
      [
        'Coursework Average',
        courseworkSummary.averagePercentage !== null
          ? `${courseworkSummary.averagePercentage}% (${courseworkSummary.gradedCount}/${courseworkSummary.totalAssignments} graded)`
          : `${courseworkSummary.totalAssignments} assigned (Pending grading)`,
        'Form Fill-up Status',
        formFillupRecord
          ? `${formatResultStatusLabel(formFillupRecord.resultStatus)} · BDT ${formFillupRecord.calculatedAmountTk.toLocaleString()} (${formFillupRecord.paymentStatus})`
          : 'Not recorded yet',
      ],
      [
        'Student Contact',
        `${student.phone || '—'} / ${student.email}`,
        'Guardian Contact',
        `${student.guardianName || 'Guardian'} · ${
          student.parentContact || student.parentEmail || '—'
        }`,
      ],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [255, 255, 255], cellWidth: 36 },
      1: { cellWidth: 56 },
      2: { fontStyle: 'bold', fillColor: [255, 255, 255], cellWidth: 36 },
      3: { cellWidth: 54 },
    },
    margin: { left: 14, right: 14 },
  });

  const nextY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 102;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Subject-wise Attendance & Coursework Performance', 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.3,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      lineColor: [170, 170, 170],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    head: [
      [
        'Code',
        'Subject Title',
        'Cr',
        'Theory Att.',
        'Practical Att.',
        'Combined %',
        'Coursework',
        'Standing',
      ],
    ],
    body:
      subjectRows.length > 0
        ? subjectRows.map(row => [
            row.subject.code,
            row.subject.name,
            String(row.subject.credits),
            row.theoryPercentage !== null
              ? `${row.theoryAttended}/${row.theorySessions} (${row.theoryPercentage}%)`
              : '—',
            row.practicalPercentage !== null
              ? `${row.practicalAttended}/${row.practicalSessions} (${row.practicalPercentage}%)`
              : '—',
            row.combinedSessions > 0 ? `${row.combinedPercentage}%` : '—',
            row.courseworkAveragePct !== null
              ? `${row.courseworkAveragePct}% (${row.gradedAssignmentsCount})`
              : `${row.assignmentsCount} task(s)`,
            row.combinedSessions === 0
              ? 'No Sessions'
              : row.isAtRisk
              ? 'At Risk (<75%)'
              : 'Eligible',
          ])
        : [['—', 'No enrolled subjects recorded for this semester', '—', '—', '—', '—', '—', '—']],
    margin: { left: 14, right: 14 },
  });

  return doc;
}

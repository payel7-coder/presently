import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AttendanceRecord,
  AttendanceSession,
  ClassGroup,
  Student,
  Subject,
  SubjectPart,
  User,
} from '../types/attendance';
import {
  AbsentListFilterOptions,
  buildSubjectDateAbsentList,
} from './attendanceLogic';
import { drawInstitutionalPdfHeader } from './pdfHeader';

export interface AbsentListPDFOptions {
  subjects: Subject[];
  classes: ClassGroup[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  teachers?: User[];
  requestedBy?: User | null;
  filters?: AbsentListFilterOptions;
}

export function generateAbsentListPDF(options: AbsentListPDFOptions): jsPDF {
  const {
    subjects,
    classes,
    students,
    sessions,
    records,
    teachers = [],
    requestedBy,
    filters = {},
  } = options;

  const result = buildSubjectDateAbsentList({
    subjects,
    classes,
    students,
    sessions,
    records,
    teachers,
    filters,
  });

  const selectedSubject =
    filters.subjectId && filters.subjectId !== 'all'
      ? subjects.find(s => s.id === filters.subjectId)
      : undefined;

  const selectedClass =
    filters.classId && filters.classId !== 'all'
      ? classes.find(c => c.id === filters.classId)
      : selectedSubject
      ? classes.find(c => c.id === selectedSubject.classId)
      : undefined;

  const partLabel =
    filters.part === 'theory'
      ? 'Theory Only'
      : filters.part === 'practical'
      ? 'Practical Only'
      : 'Theory & Practical (All Parts)';

  // A4 Portrait (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Institutional Header (Minimalist B&W)
  const bannerHeight = drawInstitutionalPdfHeader(doc, {
    reportTitle: 'SUBJECT & DATE-WISE STUDENT ABSENT LIST',
    boardSubtitle: 'BANGLADESH TECHNICAL EDUCATION BOARD (BTEB) • PROBIDHAN 2022 • CST (TECH CODE: 85)',
  });

  // 2. Metadata Box
  const metaY = bannerHeight + 4; // 37mm
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.2);
  doc.roundedRect(10, metaY, pageWidth - 20, 28, 1.5, 1.5, 'D');

  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  // Left Column
  doc.setFont('helvetica', 'bold');
  doc.text('Subject:', 14, metaY + 6.5);
  doc.setFont('helvetica', 'normal');
  const subjectText = selectedSubject
    ? `${selectedSubject.code} — ${selectedSubject.name}`
    : `All Assigned Subjects (${subjects.length})`;
  doc.text(subjectText.slice(0, 52), 34, metaY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Course Part:', 14, metaY + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.text(partLabel, 34, metaY + 12.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Class / Batch:', 14, metaY + 18.5);
  doc.setFont('helvetica', 'normal');
  const classText = selectedClass
    ? `${selectedClass.name} (${selectedClass.section})`
    : 'All Applicable Semesters';
  doc.text(classText.slice(0, 52), 34, metaY + 18.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Date Scope:', 14, metaY + 24.5);
  doc.setFont('helvetica', 'normal');
  doc.text(result.dateScopeLabel, 34, metaY + 24.5);

  // Right Column
  const col2X = pageWidth / 2 + 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared By:', col2X, metaY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    requestedBy ? `${requestedBy.name} (${requestedBy.employeeId || 'Faculty'})` : 'Faculty Member',
    col2X + 26,
    metaY + 6.5
  );

  doc.setFont('helvetica', 'bold');
  doc.text('Sessions Held:', col2X, metaY + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${result.totalMatchingSessions} session(s)`, col2X + 26, metaY + 12.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Absences:', col2X, metaY + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${result.totalAbsentMarks} record(s)`, col2X + 26, metaY + 18.5);

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Unique Students:', col2X, metaY + 24.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${result.uniqueAbsentStudents} student(s)`, col2X + 26, metaY + 24.5);

  let currentY = metaY + 33;

  if (result.entries.length === 0) {
    // Clean minimalist empty-state box
    doc.setDrawColor(140, 140, 140);
    doc.setLineWidth(0.2);
    doc.roundedRect(10, currentY, pageWidth - 20, 22, 1.5, 1.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('No Absent Students Recorded', pageWidth / 2, currentY + 9, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    const emptyMsg =
      result.totalMatchingSessions === 0
        ? `No attendance sessions were found for "${subjectText}" (${result.dateScopeLabel}).`
        : `All students across ${result.totalMatchingSessions} recorded session(s) had zero absent marks.`;
    doc.text(emptyMsg, pageWidth / 2, currentY + 15.5, { align: 'center' });
    currentY += 28;
  } else {
    // Main Absent List Table
    const headRows = [
      ['#', 'Date', 'Subject & Part', 'Board Roll', 'Student Full Name', 'Contact / Guardian', 'Remarks'],
    ];

    const bodyRows = result.entries.map((entry, idx) => [
      `${idx + 1}`,
      entry.date,
      `${entry.subjectCode} (${entry.part === 'practical' ? 'Prac' : 'Theo'})\n${entry.subjectName}`,
      entry.rollNumber,
      `${entry.studentName}\n${entry.className}`,
      entry.parentContact || '-',
      entry.remarks || '—',
    ]);

    autoTable(doc, {
      head: headRows,
      body: bodyRows,
      startY: currentY,
      margin: { left: 10, right: 10, bottom: 34 },
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle',
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [170, 170, 170],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 42, halign: 'left' },
        3: { cellWidth: 21, halign: 'center', fontStyle: 'bold' },
        4: { cellWidth: 42, halign: 'left', fontStyle: 'bold' },
        5: { cellWidth: 28, halign: 'left' },
        6: { cellWidth: 28, halign: 'left' },
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 6;
  }

  // Session Breakdown Summary if multiple sessions matched and space permits
  if (result.sessionSummaries.length > 0 && currentY < pageHeight - 60) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Session-Wise Attendance Summary', 10, currentY);

    autoTable(doc, {
      head: [['Date', 'Subject', 'Part', 'Class', 'Total', 'Present', 'Absent', 'Late']],
      body: result.sessionSummaries.map(s => [
        s.date,
        `${s.subjectCode} · ${s.subjectName}`,
        s.part === 'practical' ? 'Practical' : 'Theory',
        s.className,
        `${s.totalStudents}`,
        `${s.presentCount}`,
        `${s.absentCount}`,
        `${s.lateCount}`,
      ]),
      startY: currentY + 2.5,
      margin: { left: 10, right: 10, bottom: 34 },
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle',
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [170, 170, 170],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 13, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0] },
        7: { cellWidth: 12, halign: 'center' },
      },
    });
  }

  // Footer & Signatures
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i === totalPages) {
      const sigY = pageHeight - 19;
      const sigWidth = 60;

      // Left signature: Course Teacher
      doc.setDrawColor(60, 60, 60);
      doc.line(14, sigY, 14 + sigWidth, sigY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Course Teacher Signature', 14 + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(`${requestedBy?.name || 'Instructor'} • Date: ________`, 14 + sigWidth / 2, sigY + 8, {
        align: 'center',
      });

      // Right signature: Head of Department
      const rightX = pageWidth - 14 - sigWidth;
      doc.setDrawColor(60, 60, 60);
      doc.line(rightX, sigY, rightX + sigWidth, sigY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Head of Department (CST)', rightX + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text('Verification & Follow-up • Date: ________', rightX + sigWidth / 2, sigY + 8, {
        align: 'center',
      });
    }

    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated via Presently • Subject & Date-Wise Absent List • BTEB Probidhan 2022 • ${new Date().toLocaleDateString('en-GB')}`,
      10,
      pageHeight - 4
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 4, { align: 'right' });
  }

  return doc;
}

export function getAbsentListPdfFileName(
  options: Pick<AbsentListPDFOptions, 'subjects' | 'filters'>
): string {
  const { subjects, filters = {} } = options;
  const sub =
    filters.subjectId && filters.subjectId !== 'all'
      ? subjects.find(s => s.id === filters.subjectId)
      : undefined;
  const subTag = sub
    ? `${sub.code}_${sub.name.replace(/[^a-zA-Z0-9]+/g, '_')}`
    : 'All_Subjects';
  const partTag =
    filters.part && filters.part !== 'all'
      ? `_${filters.part === 'practical' ? 'Practical' : 'Theory'}`
      : '';
  const dateTag = filters.date
    ? `_${filters.date}`
    : filters.startDate && filters.endDate
    ? `_${filters.startDate}_to_${filters.endDate}`
    : filters.startDate
    ? `_from_${filters.startDate}`
    : filters.endDate
    ? `_until_${filters.endDate}`
    : '_All_Dates';

  return `BTEB_Absent_List_${subTag}${partTag}${dateTag}.pdf`;
}

export function downloadAbsentListPDF(options: AbsentListPDFOptions): void {
  const doc = generateAbsentListPDF(options);
  const fileName = getAbsentListPdfFileName(options);
  doc.save(fileName);
}

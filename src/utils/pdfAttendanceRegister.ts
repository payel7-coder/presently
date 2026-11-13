import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subject, ClassGroup, Student, AttendanceSession, AttendanceRecord, User, SubjectPart } from '../types/attendance';

export interface PDFRegisterOptions {
  subject: Subject;
  classGroup: ClassGroup;
  teacher?: User | null;
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  isBlankTemplate?: boolean;
  startDate?: string;
  endDate?: string;
  part?: SubjectPart;
}

export function generateAttendanceRegisterPDF(options: PDFRegisterOptions): jsPDF {
  const {
    subject,
    classGroup,
    teacher,
    students,
    sessions,
    records,
    isBlankTemplate = false,
    startDate,
    endDate,
    part,
  } = options;

  // Filter sessions by subject, optional part, and date range
  let targetSessions = sessions.filter(s => s.subjectId === subject.id);
  if (part) {
    targetSessions = targetSessions.filter(s => (s.part || 'theory') === part);
  }
  if (startDate) {
    targetSessions = targetSessions.filter(s => s.date >= startDate);
  }
  if (endDate) {
    targetSessions = targetSessions.filter(s => s.date <= endDate);
  }

  // Sort chronological
  targetSessions.sort((a, b) => a.date.localeCompare(b.date));

  // Initialize jsPDF A4 in Landscape mode (297mm width x 210mm height)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Institutional Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Emerald accent top border line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Institution title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BANGLADESH TECHNICAL EDUCATION BOARD (BTEB)', pageWidth / 2, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('DIPLOMA IN ENGINEERING • PROBIDHAN 2022 (CURRICULUM-2022)', pageWidth / 2, 16, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(52, 211, 153); // emerald-400
  const subHeading = isBlankTemplate
    ? 'SEMESTER CONTINUOUS ATTENDANCE REGISTER (CLASSROOM LOG SHEET)'
    : 'OFFICIAL COURSE ATTENDANCE REGISTER & CONTINUOUS ASSESSMENT LEDGER';
  doc.text(subHeading, pageWidth / 2, 22, { align: 'center' });

  // 2. Metadata Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(10, 32, pageWidth - 20, 26, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);

  // Left column
  const partLabel = part === 'practical' ? 'Practical' : part === 'theory' ? 'Theory' : 'Theory & Practical';
  doc.setFont('helvetica', 'bold');
  doc.text('Course / Subject:', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subject.name} [${partLabel}] (Code: ${subject.code}) - ${subject.credits || 3} Cr`, 45, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Semester & Class:', 14, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(`${classGroup.name} (${classGroup.semester} Semester) • Section: ${classGroup.section}`, 45, 44);

  doc.setFont('helvetica', 'bold');
  doc.text('Technology / Dept:', 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(`${classGroup.department || 'Computer Science & Technology'} (Tech Code: 85)`, 45, 50);

  // Right column
  const col2X = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text(part ? `${partLabel} Teacher:` : 'Course Teacher:', col2X, 38);
  doc.setFont('helvetica', 'normal');
  const teacherText = teacher ? `${teacher.name} (${teacher.employeeId || 'Faculty'})` : 'Institutional Faculty';
  doc.text(teacherText, col2X + 30, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Academic Session:', col2X, 44);
  doc.setFont('helvetica', 'normal');
  doc.text(`${classGroup.academicYear || '2026-2027'} • Probidhan-2022`, col2X + 30, 44);

  doc.setFont('helvetica', 'bold');
  doc.text('Register Type:', col2X, 50);
  doc.setFont('helvetica', 'normal');
  const regTypeText = isBlankTemplate
    ? `Blank Form for ${partLabel} Log (22 Class Slots)`
    : `Recorded ${partLabel} Ledger (${targetSessions.length} Classes • ${students.length} Enrolled)`;
  doc.text(regTypeText, col2X + 30, 50);

  // Sort students by Roll number
  const sortedStudents = [...students].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));

  // Build Table Data
  let headRows: string[][];
  let bodyRows: string[][];

  if (isBlankTemplate) {
    // Generate blank grid with 25 class columns
    const blankHeaders = ['#', 'Roll No', 'Registration', 'Student Full Name'];
    for (let i = 1; i <= 22; i++) {
      blankHeaders.push(`${i}`);
    }
    blankHeaders.push('Pres', 'Abs', 'Attn %', 'Remarks');
    headRows = [blankHeaders];

    bodyRows = sortedStudents.map((stu, idx) => {
      const row = [
        `${idx + 1}`,
        stu.rollNumber,
        stu.registrationNumber || '-',
        stu.name,
      ];
      // 22 blank slots
      for (let i = 1; i <= 22; i++) {
        row.push('');
      }
      // Blank summary
      row.push('', '', '', '');
      return row;
    });
  } else {
    // Build ledger with actual sessions (up to 20 recent/filtered sessions)
    const displaySessions = targetSessions.slice(-20);
    const headers = ['#', 'Board Roll', 'Registration', 'Student Full Name'];

    displaySessions.forEach(sess => {
      // Date label mm/dd
      const d = sess.date.split('-');
      headers.push(`${d[1] || ''}/${d[2] || ''}`);
    });

    headers.push('Held', 'Pres', 'Abs', 'Attn %', 'BTEB Eligibility');
    headRows = [headers];

    // Compute student stats
    bodyRows = sortedStudents.map((stu, idx) => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      const sessionMarks = displaySessions.map(sess => {
        const rec = records.find(r => r.sessionId === sess.id && r.studentId === stu.id);
        if (!rec) return '-';
        if (rec.status === 'present') {
          presentCount++;
          return 'P';
        }
        if (rec.status === 'absent') {
          absentCount++;
          return 'A';
        }
        if (rec.status === 'late') {
          lateCount++;
          presentCount++; // In BTEB standard, late counts toward presence with penalty or recorded as present
          return 'L';
        }
        if (rec.status === 'excused') {
          return 'E';
        }
        return '-';
      });

      const totalHeld = targetSessions.length;
      // Calculate overall across all target sessions (not just displayed 20)
      let overallPresent = 0;
      let overallAbsent = 0;
      targetSessions.forEach(sess => {
        const rec = records.find(r => r.sessionId === sess.id && r.studentId === stu.id);
        if (rec?.status === 'present' || rec?.status === 'late') overallPresent++;
        if (rec?.status === 'absent') overallAbsent++;
      });

      const rate = totalHeld > 0 ? Math.round((overallPresent / totalHeld) * 100) : 0;

      // BTEB Exam Eligibility Rules:
      // Regular: >= 75%
      // Non-Collegiate: 65% - 74% (Eligible with special permission / fine)
      // Discollegiate: < 65% (Disbarred / Ineligible for Final Exam)
      let eligibility = 'Regular';
      if (totalHeld >= 2) {
        if (rate >= 75) eligibility = 'Eligible (Reg)';
        else if (rate >= 65) eligibility = 'Non-Collegiate';
        else eligibility = 'Discollegiate';
      } else {
        eligibility = 'Ongoing';
      }

      return [
        `${idx + 1}`,
        stu.rollNumber,
        stu.registrationNumber || '-',
        stu.name,
        ...sessionMarks,
        `${totalHeld}`,
        `${overallPresent}`,
        `${overallAbsent}`,
        `${rate}%`,
        eligibility,
      ];
    });
  }

  // Draw AutoTable
  autoTable(doc, {
    head: headRows,
    body: bodyRows,
    startY: 61,
    margin: { left: 10, right: 10, bottom: 35 },
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      halign: 'center',
      valign: 'middle',
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineWidth: 0.2,
      lineColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' }, // Sl
      1: { cellWidth: 20, fontStyle: 'bold', halign: 'center' }, // Roll
      2: { cellWidth: 24, halign: 'center' }, // Reg
      3: { cellWidth: 38, halign: 'left', fontStyle: 'bold' }, // Name
    },
    didParseCell: (data) => {
      // Highlight absent marks in red and eligibility status
      if (data.section === 'body') {
        const val = String(data.cell.raw);
        if (val === 'A') {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'P') {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
        } else if (val === 'L') {
          data.cell.styles.textColor = [217, 119, 6]; // amber-600
        } else if (val === 'Discollegiate') {
          data.cell.styles.textColor = [225, 29, 72];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [255, 241, 242];
        } else if (val === 'Non-Collegiate') {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [254, 243, 199];
        } else if (val === 'Eligible (Reg)') {
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Footer & Signatures (attach to bottom of every page or last page)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Signature Area on the last page
    if (i === totalPages) {
      const sigY = pageHeight - 20;

      // 3 signature lines
      const sigWidth = 55;
      const spacing = (pageWidth - 20 - sigWidth * 3) / 2;

      // 1. Teacher Signature
      const sig1X = 10;
      doc.setDrawColor(100, 116, 139);
      doc.line(sig1X, sigY, sig1X + sigWidth, sigY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Course Teacher Signature', sig1X + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`${teacher?.name || 'Subject Instructor'} • Date: ________`, sig1X + sigWidth / 2, sigY + 8, { align: 'center' });

      // 2. HOD Signature
      const sig2X = sig1X + sigWidth + spacing;
      doc.setDrawColor(100, 116, 139);
      doc.line(sig2X, sigY, sig2X + sigWidth, sigY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Head of Department (CST)', sig2X + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Verification & Seal • Date: ________', sig2X + sigWidth / 2, sigY + 8, { align: 'center' });

      // 3. Principal Signature
      const sig3X = sig2X + sigWidth + spacing;
      doc.setDrawColor(100, 116, 139);
      doc.line(sig3X, sigY, sig3X + sigWidth, sigY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Principal / Academic In-charge', sig3X + sigWidth / 2, sigY + 4, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Approved for BTEB Board Exam', sig3X + sigWidth / 2, sigY + 8, { align: 'center' });
    }

    // Bottom tracking banner
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated via Presently • BTEB Probidhan-2022 Official Ledger • Technology: CST (85) • Date: ${new Date().toLocaleDateString('en-GB')}`,
      10,
      pageHeight - 4
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageHeight - 4, { align: 'right' });
  }

  return doc;
}

export function downloadAttendanceRegisterPDF(options: PDFRegisterOptions): void {
  const doc = generateAttendanceRegisterPDF(options);
  const cleanCode = options.subject.code || 'BTEB';
  const cleanName = options.subject.name.replace(/[^a-zA-Z0-9]/g, '_');
  const partSuffix = options.part ? `_${options.part === 'practical' ? 'Practical' : 'Theory'}` : '';
  const typePrefix = options.isBlankTemplate ? 'Blank_Register' : 'Attendance_Ledger';
  const fileName = `BTEB_${typePrefix}_${cleanCode}_${cleanName}${partSuffix}.pdf`;
  doc.save(fileName);
}

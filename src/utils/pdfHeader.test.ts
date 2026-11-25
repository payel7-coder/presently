import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import {
  drawInstitutionalPdfHeader,
  PDF_DEPARTMENT_NAME,
  PDF_INSTITUTE_NAME,
} from './pdfHeader';
import { generateFormFillupPDF } from './pdfFormFillup';
import { generateStudentDossierPDF } from './pdfStudentDossier';
import {
  ClassGroup,
  FormFillupFeeConfig,
  Student,
  User,
} from '../types/attendance';
import { StudentProfileDossier } from './studentProfileLogic';

test('drawInstitutionalPdfHeader renders Model Institute of Science and Technology and Department of Computer Science & Technology', () => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const bannerHeight = drawInstitutionalPdfHeader(doc, {
    reportTitle: 'TEST REPORT',
  });
  assert.equal(bannerHeight, 33);

  const output = doc.output();
  assert.ok(output.includes(PDF_INSTITUTE_NAME), 'PDF output must include institute name');
  assert.ok(output.includes(PDF_DEPARTMENT_NAME), 'PDF output must include department name');

  const docWithFooter = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const tallerBanner = drawInstitutionalPdfHeader(docWithFooter, {
    reportTitle: 'DOSSIER',
    footerNote: 'Generated: 2026-11-24',
  });
  assert.equal(tallerBanner, 36);
});

test('generateFormFillupPDF includes institute and department header lines', () => {
  const classGroup: ClassGroup = {
    id: 'cls-4',
    name: 'CST 4th Semester',
    section: 'Shift-1 (Day)',
    semester: '4th',
    department: 'Computer Science & Technology',
    technology: 'Computer Science & Technology (85)',
    academicYear: '2026',
    roomNumber: '401',
  };

  const feeConfig: FormFillupFeeConfig = {
    id: 'fee-4',
    semester: '4th',
    classId: 'cls-4',
    examFee: 700,
    referredExamFeePerSubject: 125,
    marksheetFeeRegular: 80,
    marksheetFeeReferredPerSemester: 80,
    centerFeeRegular: 600,
    centerFeeReferredPerSemester: 250,
    practicalFeePerSubject: 40,
    questionFee: 50,
    delayFee: 300,
    updatedAt: '2026-11-24',
  };

  const students: Student[] = [
    {
      id: 'stu-1',
      name: 'Sabbir Hossain',
      rollNumber: '623101',
      email: 'sabbir@student.bteb.edu.bd',
      gender: 'Male',
      classId: 'cls-4',
      status: 'active',
    },
  ];

  const doc = generateFormFillupPDF({
    classGroup,
    students,
    records: [],
    feeConfig,
    defaultPracticalCount: 4,
  });

  const pdfOutput = doc.output();
  assert.ok(pdfOutput.includes(PDF_INSTITUTE_NAME));
  assert.ok(pdfOutput.includes(PDF_DEPARTMENT_NAME));
});

test('generateStudentDossierPDF includes institute and department header lines', () => {
  const student: Student = {
    id: 'stu-1',
    name: 'Sumaiya Akter',
    rollNumber: '623102',
    registrationNumber: '1502148202',
    email: 'sumaiya@student.bteb.edu.bd',
    gender: 'Female',
    classId: 'cls-4',
    semester: '4th',
    session: '2024-2025',
    status: 'active',
  };

  const classGroup: ClassGroup = {
    id: 'cls-4',
    name: 'CST 4th Semester',
    section: 'Shift-1 (Day)',
    semester: '4th',
    department: 'Computer Science & Technology',
    technology: 'Computer Science & Technology (85)',
    academicYear: '2026',
    roomNumber: '401',
  };

  const dossier: StudentProfileDossier = {
    student,
    classGroup,
    attendanceStats: {
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      totalSessions: 10,
      present: 9,
      absent: 1,
      late: 0,
      excused: 0,
      attendancePercentage: 90,
      isAtRisk: false,
      requiredForThreshold: 0,
      currentStreak: 4,
    },
    courseworkSummary: {
      studentId: student.id,
      rollNumber: student.rollNumber,
      studentName: student.name,
      totalAssignments: 2,
      submittedCount: 0,
      lateCount: 0,
      gradedCount: 2,
      missingCount: 0,
      pendingCount: 0,
      evaluatedCount: 2,
      totalMarksObtained: 44,
      totalMaxMarks: 50,
      averagePercentage: 88,
      standing: 'Excellent',
    },
    subjectRows: [],
    attendanceHistory: [],
    courseworkHistory: [],
    totalCreditsEnrolled: 16,
    eligibleSubjectsCount: 4,
    atRiskSubjectsCount: 0,
  };

  const registrar: User = {
    id: 'adm-1',
    name: 'Academic Registrar',
    email: 'registrar@mist.edu.bd',
    role: 'admin',
    department: 'Computer Science & Technology',
    employeeId: 'REG-01',
    avatar: '',
  };

  const doc = generateStudentDossierPDF(dossier, registrar);
  const pdfOutput = doc.output();
  assert.ok(pdfOutput.includes(PDF_INSTITUTE_NAME));
  assert.ok(pdfOutput.includes(PDF_DEPARTMENT_NAME));
});

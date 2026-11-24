import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFormFillupInvoiceSummary,
  canGenerateFormFillupInvoice,
  deriveTechnologyShortLabel,
} from './formFillupInvoiceLogic';
import {
  calculateStudentFormFillupFee,
  normalizeResultInput,
} from './formFillupLogic';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupResponsibility,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';

const class7th: ClassGroup = {
  id: 'cls-7',
  name: 'CST 7th Semester',
  section: 'Shift-1 (Day)',
  department: 'Computer Science & Technology',
  semester: '7th',
  academicYear: '2026',
  roomNumber: '701',
  technology: 'Computer Science & Technology (85)',
};

// Matches the exact fee schedule shown in the reference invoice photo
const photoFeeConfig: FormFillupFeeConfig = {
  id: 'ff-fee-cls-7',
  semester: '7th',
  classId: 'cls-7',
  examFee: 700,
  referredExamFeePerSubject: 125,
  marksheetFeeRegular: 80,
  marksheetFeeReferredPerSemester: 80,
  centerFeeRegular: 600,
  centerFeeReferredPerSemester: 250,
  practicalFeePerSubject: 40,
  questionFee: 50,
  delayFee: 300,
  updatedAt: '2026-11-22T00:00:00Z',
};

test('buildFormFillupInvoiceSummary reproduces exact reference photo totals (75315 = 35475 Board + 39840 Institute)', () => {
  const students: Student[] = Array.from({ length: 31 }, (_, i) => ({
    id: `stu-${i + 1}`,
    rollNumber: `${700100 + i}`,
    name: `Student ${i + 1}`,
    email: `s${i + 1}@bteb.edu.bd`,
    gender: 'Male',
    classId: 'cls-7',
    status: 'active',
  }));

  // Distribute 49 referred semesters and 59 referred subjects across the 31 regular candidates
  const records: FormFillupStudentRecord[] = students.map((stu, idx) => {
    const refSems = idx < 18 ? 2 : idx < 31 ? 1 : 0; // 18*2 + 13*1 = 49 referred semesters
    const refSubs = idx < 28 ? 2 : 1; // 28*2 + 3*1 = 59 referred subjects
    return {
      id: `rec-${stu.id}`,
      semester: '7th',
      classId: 'cls-7',
      studentId: stu.id,
      resultStatus: 'regular_with_referred',
      referredSubjectsCount: refSubs,
      referredSemestersCount: refSems,
      practicalSubjectsCount: 6, // 31 * 6 = 186 practical entries
      applyDelayFee: false,
      calculatedAmountTk: 0,
      paymentStatus: idx < 15 ? 'paid' : 'pending',
      updatedAt: '2026-11-22T00:00:00Z',
    };
  });

  const invoice = buildFormFillupInvoiceSummary({
    classGroup: class7th,
    students,
    records,
    feeConfig: photoFeeConfig,
    options: {
      examSession: 'Aug -2026 ইং',
    },
  });

  assert.equal(invoice.technologyLabel, 'CST-7th');
  assert.equal(invoice.semester, '7th');
  assert.equal(invoice.includedStudentCount, 31);

  assert.equal(invoice.rows.examFee.count, 31);
  assert.equal(invoice.rows.examFee.totalTk, 21700);
  assert.equal(invoice.rows.examFee.boardShareTk, 21700);
  assert.equal(invoice.rows.examFee.instituteShareTk, 0);

  // Marksheet fee two parts: Regular + Referred
  assert.equal(invoice.rows.marksheetRegular.count, 31);
  assert.equal(invoice.rows.marksheetRegular.totalTk, 2480);
  assert.equal(invoice.rows.marksheetRegular.boardShareTk, 2480);

  assert.equal(invoice.rows.marksheetReferred.count, 49);
  assert.equal(invoice.rows.marksheetReferred.totalTk, 3920);
  assert.equal(invoice.rows.marksheetReferred.boardShareTk, 3920);

  assert.equal(invoice.rows.questionFee.count, 31);
  assert.equal(invoice.rows.questionFee.totalTk, 1550);
  assert.equal(invoice.rows.questionFee.instituteShareTk, 1550);

  assert.equal(invoice.rows.referredExamFee.count, 59);
  assert.equal(invoice.rows.referredExamFee.totalTk, 7375);
  assert.equal(invoice.rows.referredExamFee.boardShareTk, 7375);

  assert.equal(invoice.rows.delayFee.count, 0);
  assert.equal(invoice.rows.delayFee.totalTk, 0);

  // Center fee two parts: Regular + Referred
  assert.equal(invoice.rows.centerRegular.count, 31);
  assert.equal(invoice.rows.centerRegular.totalTk, 18600);
  assert.equal(invoice.rows.centerRegular.instituteShareTk, 18600);

  assert.equal(invoice.rows.centerReferred.count, 49);
  assert.equal(invoice.rows.centerReferred.totalTk, 12250);
  assert.equal(invoice.rows.centerReferred.instituteShareTk, 12250);

  assert.equal(invoice.rows.practicalFee.rateDisplay, '40×6');
  assert.equal(invoice.rows.practicalFee.count, 186);
  assert.equal(invoice.rows.practicalFee.totalTk, 7440);
  assert.equal(invoice.rows.practicalFee.instituteShareTk, 7440);

  assert.equal(invoice.boardTotalTk, 35475);
  assert.equal(invoice.instituteTotalTk, 39840);
  assert.equal(invoice.grandTotalTk, 75315);
  assert.equal(invoice.boardTotalTk + invoice.instituteTotalTk, invoice.grandTotalTk);
});

test('buildFormFillupInvoiceSummary handles distinct regular vs referred rates, referred-only students, delay fee, and paid_submitted scope', () => {
  const customConfig: FormFillupFeeConfig = {
    ...photoFeeConfig,
    marksheetFeeRegular: 150,
    marksheetFeeReferredPerSemester: 90,
    centerFeeRegular: 500,
    centerFeeReferredPerSemester: 200,
  };

  const students: Student[] = [
    { id: 's1', rollNumber: '1', name: 'Regular One', email: '1@s.bd', gender: 'Male', classId: 'cls-7', status: 'active' },
    { id: 's2', rollNumber: '2', name: 'Mixed Two', email: '2@s.bd', gender: 'Female', classId: 'cls-7', status: 'active' },
    { id: 's3', rollNumber: '3', name: 'Ref Only Three', email: '3@s.bd', gender: 'Male', classId: 'cls-7', status: 'active' },
    { id: 's4', rollNumber: '4', name: 'Inactive Four', email: '4@s.bd', gender: 'Male', classId: 'cls-7', status: 'inactive' },
  ];

  const records: FormFillupStudentRecord[] = [
    {
      id: 'r1',
      semester: '7th',
      classId: 'cls-7',
      studentId: 's1',
      resultStatus: 'regular',
      referredSubjectsCount: 0,
      referredSemestersCount: 0,
      practicalSubjectsCount: 4,
      applyDelayFee: false,
      calculatedAmountTk: 0,
      paymentStatus: 'paid',
      updatedAt: '2026-11-22T00:00:00Z',
    },
    {
      id: 'r2',
      semester: '7th',
      classId: 'cls-7',
      studentId: 's2',
      resultStatus: 'regular_with_referred',
      referredSubjectsCount: 2,
      referredSemestersCount: 1,
      practicalSubjectsCount: 3,
      applyDelayFee: true,
      calculatedAmountTk: 0,
      paymentStatus: 'submitted',
      updatedAt: '2026-11-22T00:00:00Z',
    },
    {
      id: 'r3',
      semester: '7th',
      classId: 'cls-7',
      studentId: 's3',
      resultStatus: 'referred_only',
      referredSubjectsCount: 3,
      referredSemestersCount: 2,
      practicalSubjectsCount: 0,
      applyDelayFee: true,
      calculatedAmountTk: 0,
      paymentStatus: 'pending',
      updatedAt: '2026-11-22T00:00:00Z',
    },
  ];

  // Full batch check against sum of individual student breakdowns
  const fullInvoice = buildFormFillupInvoiceSummary({
    classGroup: class7th,
    students,
    records,
    feeConfig: customConfig,
  });

  const expectedIndividualSum = records.reduce((sum, rec) => {
    const b = calculateStudentFormFillupFee(customConfig, normalizeResultInput(rec));
    return sum + b.totalAmountTk;
  }, 0);

  assert.equal(fullInvoice.includedStudentCount, 3);
  assert.equal(fullInvoice.regularCandidateCount, 2); // s1 + s2
  assert.equal(fullInvoice.referredOnlyCandidateCount, 1); // s3
  assert.equal(fullInvoice.rows.marksheetRegular.rate, 150);
  assert.equal(fullInvoice.rows.marksheetReferred.rate, 90);
  assert.equal(fullInvoice.rows.marksheetRegular.totalTk, 300); // 2 * 150
  assert.equal(fullInvoice.rows.marksheetReferred.totalTk, 270); // (1+2) * 90
  assert.equal(fullInvoice.rows.centerRegular.totalTk, 1000); // 2 * 500
  assert.equal(fullInvoice.rows.centerReferred.totalTk, 600); // (1+2) * 200
  assert.equal(fullInvoice.rows.practicalFee.rateDisplay, '40'); // mixed 4 vs 3
  assert.equal(fullInvoice.rows.practicalFee.count, 7);
  assert.equal(fullInvoice.rows.delayFee.count, 2);
  assert.equal(fullInvoice.rows.delayFee.boardShareTk, 600);
  assert.equal(fullInvoice.grandTotalTk, expectedIndividualSum);
  assert.equal(fullInvoice.boardTotalTk + fullInvoice.instituteTotalTk, fullInvoice.grandTotalTk);

  // Paid/submitted scope excludes pending s3
  const paidInvoice = buildFormFillupInvoiceSummary({
    classGroup: class7th,
    students,
    records,
    feeConfig: customConfig,
    options: { scope: 'paid_submitted', delayFeeShare: 'institute' },
  });
  assert.equal(paidInvoice.includedStudentCount, 2);
  assert.equal(paidInvoice.rows.delayFee.count, 1);
  assert.equal(paidInvoice.rows.delayFee.boardShareTk, 0);
  assert.equal(paidInvoice.rows.delayFee.instituteShareTk, 300);
});

test('canGenerateFormFillupInvoice authorizes only assigned coordinator or admin', () => {
  const teacherAssigned: User = {
    id: 'tch-7',
    name: 'Assigned Teacher',
    email: 't7@bteb.edu.bd',
    role: 'teacher',
    avatar: '',
    department: 'CST',
    employeeId: 'T7',
  };
  const teacherOther: User = {
    id: 'tch-2',
    name: 'Other Teacher',
    email: 't2@bteb.edu.bd',
    role: 'teacher',
    avatar: '',
    department: 'CST',
    employeeId: 'T2',
  };
  const admin: User = {
    id: 'adm-1',
    name: 'Admin',
    email: 'admin@bteb.edu.bd',
    role: 'admin',
    avatar: '',
    department: 'CST',
    employeeId: 'A1',
  };
  const responsibilities: FormFillupResponsibility[] = [
    {
      id: 'ff-resp-7',
      semester: '7th',
      classId: 'cls-7',
      teacherId: 'tch-7',
      academicYear: '2026',
      assignedAt: '2026-11-22',
    },
  ];

  assert.equal(
    canGenerateFormFillupInvoice({ currentUser: teacherAssigned, classGroup: class7th, responsibilities }),
    true
  );
  assert.equal(
    canGenerateFormFillupInvoice({ currentUser: teacherOther, classGroup: class7th, responsibilities }),
    false
  );
  assert.equal(
    canGenerateFormFillupInvoice({ currentUser: admin, classGroup: class7th, responsibilities }),
    true
  );
  assert.equal(deriveTechnologyShortLabel(class7th), 'CST-7th');
});

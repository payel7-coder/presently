import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFormFillupBatchTotals,
  calculateStudentFormFillupFee,
  canEditFormFillupFeeConfig,
  createDefaultFeeConfig,
  exportFormFillupToCSV,
  filterVisibleFormFillupClasses,
  normalizeResultInput,
  validateFeeConfig,
} from './formFillupLogic';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupResponsibility,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';

const sampleConfig: FormFillupFeeConfig = {
  id: 'ff-fee-cls-4',
  semester: '4th',
  classId: 'cls-4',
  examFee: 400,
  referredExamFeePerSubject: 150,
  marksheetFeeRegular: 150,
  marksheetFeeReferredPerSemester: 150,
  centerFeeRegular: 250,
  centerFeeReferredPerSemester: 100,
  practicalFeePerSubject: 100,
  questionFee: 100,
  delayFee: 200,
  updatedAt: '2026-11-15T00:00:00Z',
};

test('calculateStudentFormFillupFee computes exact Tk total for regular student without delay', () => {
  const breakdown = calculateStudentFormFillupFee(sampleConfig, {
    resultStatus: 'regular',
    referredSubjectsCount: 0,
    referredSemestersCount: 0,
    practicalSubjectsCount: 4,
    applyDelayFee: false,
  });

  assert.equal(breakdown.examFeeAmount, 400);
  assert.equal(breakdown.referredExamFeeAmount, 0);
  assert.equal(breakdown.marksheetRegularAmount, 150);
  assert.equal(breakdown.marksheetReferredAmount, 0);
  assert.equal(breakdown.centerRegularAmount, 250);
  assert.equal(breakdown.centerReferredAmount, 0);
  assert.equal(breakdown.practicalFeeAmount, 400); // 4 * 100
  assert.equal(breakdown.questionFeeAmount, 100);
  assert.equal(breakdown.delayFeeAmount, 0);
  assert.equal(breakdown.totalAmountTk, 1300);
});

test('calculateStudentFormFillupFee computes all 9 fee components for regular + referred student with delay fee', () => {
  const breakdown = calculateStudentFormFillupFee(sampleConfig, {
    resultStatus: 'regular_with_referred',
    referredSubjectsCount: 2,
    referredSemestersCount: 1,
    practicalSubjectsCount: 3,
    applyDelayFee: true,
  });

  assert.equal(breakdown.examFeeAmount, 400);
  assert.equal(breakdown.referredExamFeeAmount, 300); // 2 * 150
  assert.equal(breakdown.marksheetRegularAmount, 150);
  assert.equal(breakdown.marksheetReferredAmount, 150); // 1 * 150
  assert.equal(breakdown.centerRegularAmount, 250);
  assert.equal(breakdown.centerReferredAmount, 100); // 1 * 100
  assert.equal(breakdown.practicalFeeAmount, 300); // 3 * 100
  assert.equal(breakdown.questionFeeAmount, 100);
  assert.equal(breakdown.delayFeeAmount, 200);
  assert.equal(breakdown.totalAmountTk, 1950);
});

test('calculateStudentFormFillupFee excludes regular base fees for referred_only student', () => {
  const breakdown = calculateStudentFormFillupFee(sampleConfig, {
    resultStatus: 'referred_only',
    referredSubjectsCount: 3,
    referredSemestersCount: 2,
    practicalSubjectsCount: 1,
    applyDelayFee: false,
  });

  assert.equal(breakdown.examFeeAmount, 0);
  assert.equal(breakdown.marksheetRegularAmount, 0);
  assert.equal(breakdown.centerRegularAmount, 0);
  assert.equal(breakdown.referredExamFeeAmount, 450); // 3 * 150
  assert.equal(breakdown.marksheetReferredAmount, 300); // 2 * 150
  assert.equal(breakdown.centerReferredAmount, 200); // 2 * 100
  assert.equal(breakdown.practicalFeeAmount, 100); // 1 * 100
  assert.equal(breakdown.questionFeeAmount, 100);
  assert.equal(breakdown.delayFeeAmount, 0);
  assert.equal(breakdown.totalAmountTk, 1150);
});

test('normalizeResultInput auto-upgrades regular with referred subjects and clamps negative counts', () => {
  const normalized = normalizeResultInput({
    resultStatus: 'regular',
    referredSubjectsCount: 2,
    referredSemestersCount: 0,
    practicalSubjectsCount: -3,
    applyDelayFee: true,
  });

  assert.equal(normalized.resultStatus, 'regular_with_referred');
  assert.equal(normalized.referredSubjectsCount, 2);
  assert.equal(normalized.referredSemestersCount, 1);
  assert.equal(normalized.practicalSubjectsCount, 0);
  assert.equal(normalized.applyDelayFee, true);
});

test('validateFeeConfig rejects negative or invalid fee amounts', () => {
  const ok = validateFeeConfig(createDefaultFeeConfig('1st', 'cls-1'));
  assert.equal(ok.valid, true);

  const bad = validateFeeConfig({
    ...sampleConfig,
    delayFee: -50,
  });
  assert.equal(bad.valid, false);
  assert.match(bad.error || '', /Delay Fee/);
});

test('filterVisibleFormFillupClasses restricts teachers strictly to assigned semesters while admins see all', () => {
  const classes: ClassGroup[] = [
    { id: 'cls-1', name: 'CST 1st Semester', section: 'Shift-1', department: 'CST', semester: '1st', academicYear: '2026', roomNumber: '101', technology: '85' },
    { id: 'cls-4', name: 'CST 4th Semester', section: 'Shift-1', department: 'CST', semester: '4th', academicYear: '2026', roomNumber: '401', technology: '85' },
  ];
  const responsibilities: FormFillupResponsibility[] = [
    { id: 'ff-resp-4th-cls-4', semester: '4th', classId: 'cls-4', teacherId: 'tch-1', academicYear: '2026', assignedAt: '2026-11-15' },
  ];
  const teacher: User = {
    id: 'tch-1', name: 'Teacher 1', email: 't1@bteb.edu.bd', role: 'teacher',
    avatar: '', department: 'CST', employeeId: 'E1',
  };
  const admin: User = {
    id: 'adm-1', name: 'Admin', email: 'admin@bteb.edu.bd', role: 'admin',
    avatar: '', department: 'CST', employeeId: 'A1',
  };

  const teacherVisible = filterVisibleFormFillupClasses({ currentUser: teacher, classes, responsibilities });
  assert.equal(teacherVisible.length, 1);
  assert.equal(teacherVisible[0].id, 'cls-4');

  const adminVisible = filterVisibleFormFillupClasses({ currentUser: admin, classes, responsibilities });
  assert.equal(adminVisible.length, 2);
});

test('calculateFormFillupBatchTotals and exportFormFillupToCSV summarize collectible and collected amounts accurately', () => {
  const students: Student[] = [
    { id: 's1', rollNumber: '101', name: 'Alice', email: 'a@s.com', gender: 'Female', classId: 'cls-4', status: 'active' },
    { id: 's2', rollNumber: '102', name: 'Bob', email: 'b@s.com', gender: 'Male', classId: 'cls-4', status: 'active' },
  ];
  const records: FormFillupStudentRecord[] = [
    {
      id: 'ff-rec-cls-4-s1',
      semester: '4th',
      classId: 'cls-4',
      studentId: 's1',
      resultStatus: 'regular',
      referredSubjectsCount: 0,
      referredSemestersCount: 0,
      practicalSubjectsCount: 4,
      applyDelayFee: false,
      calculatedAmountTk: 1300,
      paymentStatus: 'paid',
      updatedAt: '2026-11-15T00:00:00Z',
    },
    {
      id: 'ff-rec-cls-4-s2',
      semester: '4th',
      classId: 'cls-4',
      studentId: 's2',
      resultStatus: 'regular_with_referred',
      referredSubjectsCount: 2,
      referredSemestersCount: 1,
      practicalSubjectsCount: 3,
      applyDelayFee: true,
      resultSummaryNote: 'Ref: 28531, 28532',
      calculatedAmountTk: 1950,
      paymentStatus: 'pending',
      updatedAt: '2026-11-15T00:00:00Z',
    },
  ];

  const totals = calculateFormFillupBatchTotals({
    students,
    records,
    feeConfig: sampleConfig,
    defaultPracticalCount: 4,
  });

  assert.equal(totals.totalStudents, 2);
  assert.equal(totals.regularCount, 1);
  assert.equal(totals.referredCount, 1);
  assert.equal(totals.delayFeeCount, 1);
  assert.equal(totals.paidOrSubmittedCount, 1);
  assert.equal(totals.totalCollectibleTk, 3250);
  assert.equal(totals.totalCollectedTk, 1300);

  const cls: ClassGroup = {
    id: 'cls-4', name: 'CST 4th Semester', section: 'Shift-1', department: 'CST', semester: '4th', academicYear: '2026', roomNumber: '401', technology: '85',
  };
  const csv = exportFormFillupToCSV({ classGroup: cls, students, records, feeConfig: sampleConfig });
  assert.match(csv, /Alice/);
  assert.match(csv, /1300/);
  assert.match(csv, /1950/);
  assert.match(csv, /Ref: 28531, 28532/);
});

test('canEditFormFillupFeeConfig permits only admin users to change examination fee rates', () => {
  const teacher: User = {
    id: 'tch-1', name: 'Teacher 1', email: 't1@bteb.edu.bd', role: 'teacher',
    avatar: '', department: 'CST', employeeId: 'E1',
  };
  const admin: User = {
    id: 'adm-1', name: 'Admin', email: 'admin@bteb.edu.bd', role: 'admin',
    avatar: '', department: 'CST', employeeId: 'A1',
  };

  assert.equal(canEditFormFillupFeeConfig(null), false);
  assert.equal(canEditFormFillupFeeConfig(teacher), false);
  assert.equal(canEditFormFillupFeeConfig(admin), true);
});


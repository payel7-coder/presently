import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentProfileDossier,
  validateStudentProfileUpdate,
} from './studentProfileLogic.ts';
import {
  AttendanceRecord,
  AttendanceSession,
  ClassGroup,
  CourseworkAssignment,
  FormFillupFeeConfig,
  FormFillupStudentRecord,
  Student,
  StudentAssignmentEvaluation,
  Subject,
  SubjectAssignment,
  User,
} from '../types/attendance.ts';

const sampleClass: ClassGroup = {
  id: 'class-cst-4',
  name: 'CST 4th Semester',
  section: '1st Shift (Morning)',
  department: 'Computer Science & Technology',
  semester: '4th',
  academicYear: '2025-2026',
  roomNumber: 'Lab-402',
  technology: 'Computer Science & Technology (85)',
};

const sampleStudent: Student = {
  id: 'stu-621045',
  rollNumber: '621045',
  registrationNumber: '1502189401',
  name: 'Tanvir Hasan',
  email: 'tanvir.621045@student.bteb.edu.bd',
  gender: 'Male',
  classId: 'class-cst-4',
  semester: '4th',
  phone: '+8801711002233',
  guardianName: 'Md. Abdul Karim',
  parentContact: '+8801811009988',
  parentEmail: 'karim.guardian@example.com',
  bloodGroup: 'O+',
  session: '2022–2023',
  status: 'active',
};

const sampleSubjects: Subject[] = [
  {
    id: 'sub-28541',
    code: '28541',
    name: 'Java Programming',
    description: 'OOP in Java',
    color: 'emerald',
    classId: 'class-cst-4',
    credits: 4,
    semester: '4th',
    curriculum: 'BTEB Probidhan 2022',
    technology: 'CST',
  },
  {
    id: 'sub-28542',
    code: '28542',
    name: 'Data Structure & Algorithm',
    description: 'Linear and non-linear DS',
    color: 'indigo',
    classId: 'class-cst-4',
    credits: 3,
    semester: '4th',
    curriculum: 'BTEB Probidhan 2022',
    technology: 'CST',
  },
];

const sampleUsers: User[] = [
  {
    id: 'tch-1',
    name: 'Engr. Farhana Akter',
    email: 'farhana@bteb.edu.bd',
    role: 'teacher',
    avatar: '',
    department: 'CST',
    employeeId: 'BTEB-101',
  },
  {
    id: 'tch-2',
    name: 'Engr. Mahmudul Hasan',
    email: 'mahmud@bteb.edu.bd',
    role: 'teacher',
    avatar: '',
    department: 'CST',
    employeeId: 'BTEB-102',
  },
];

const sampleAssignments: SubjectAssignment[] = [
  {
    id: 'asg-1',
    subjectId: 'sub-28541',
    teacherId: 'tch-1',
    classId: 'class-cst-4',
    part: 'theory',
    academicYear: '2025-2026',
    assignedAt: '2026-01-10',
  },
  {
    id: 'asg-2',
    subjectId: 'sub-28541',
    teacherId: 'tch-2',
    classId: 'class-cst-4',
    part: 'practical',
    academicYear: '2025-2026',
    assignedAt: '2026-01-10',
  },
];

test('buildStudentProfileDossier computes subject attendance, coursework avg, and form fillup dossier accurately', () => {
  const sessions: AttendanceSession[] = [
    {
      id: 'sess-1',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      teacherId: 'tch-1',
      part: 'theory',
      date: '2026-11-10',
      topic: 'Polymorphism',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-10T09:00:00Z',
      isSubmitted: true,
    },
    {
      id: 'sess-2',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      teacherId: 'tch-2',
      part: 'practical',
      date: '2026-11-12',
      topic: 'Lab 03: Interfaces',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-12T11:00:00Z',
      isSubmitted: true,
    },
    {
      id: 'sess-3',
      subjectId: 'sub-28542',
      classId: 'class-cst-4',
      teacherId: 'tch-1',
      part: 'theory',
      date: '2026-11-14',
      topic: 'Binary Search Trees',
      totalStudents: 1,
      presentCount: 0,
      absentCount: 1,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-14T10:00:00Z',
      isSubmitted: true,
    },
  ];

  const records: AttendanceRecord[] = [
    { id: 'rec-1', sessionId: 'sess-1', studentId: 'stu-621045', status: 'present', markedAt: '2026-11-10' },
    { id: 'rec-2', sessionId: 'sess-2', studentId: 'stu-621045', status: 'late', markedAt: '2026-11-12' },
    { id: 'rec-3', sessionId: 'sess-3', studentId: 'stu-621045', status: 'absent', markedAt: '2026-11-14' },
  ];

  const courseworkAssignments: CourseworkAssignment[] = [
    {
      id: 'cw-1',
      title: 'OOP Assignment 1',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      part: 'theory',
      teacherId: 'tch-1',
      assignedDate: '2026-11-01',
      dueDate: '2026-11-11',
      maxMarks: 20,
      createdAt: '2026-11-01',
    },
  ];

  const studentEvaluations: StudentAssignmentEvaluation[] = [
    {
      id: 'ev-1',
      courseworkId: 'cw-1',
      studentId: 'stu-621045',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      part: 'theory',
      status: 'graded',
      marksObtained: 18,
      feedback: 'Clean class hierarchy.',
    },
  ];

  const feeConfig: FormFillupFeeConfig = {
    id: 'ff-fee-class-cst-4',
    semester: '4th',
    classId: 'class-cst-4',
    examFee: 400,
    referredExamFeePerSubject: 150,
    marksheetFeeRegular: 150,
    marksheetFeeReferredPerSemester: 150,
    centerFeeRegular: 250,
    centerFeeReferredPerSemester: 100,
    practicalFeePerSubject: 100,
    questionFee: 100,
    delayFee: 200,
    updatedAt: '2026-11-15',
  };

  const ffRecord: FormFillupStudentRecord = {
    id: 'ff-rec-class-cst-4-stu-621045',
    semester: '4th',
    classId: 'class-cst-4',
    studentId: 'stu-621045',
    resultStatus: 'regular',
    referredSubjectsCount: 0,
    referredSemestersCount: 0,
    practicalSubjectsCount: 2,
    applyDelayFee: false,
    resultSummaryNote: 'GPA 3.72',
    calculatedAmountTk: 1100,
    paymentStatus: 'paid',
    updatedAt: '2026-11-15',
  };

  const dossier = buildStudentProfileDossier({
    student: sampleStudent,
    classes: [sampleClass],
    subjects: sampleSubjects,
    assignments: sampleAssignments,
    users: sampleUsers,
    sessions,
    records,
    courseworkAssignments,
    studentEvaluations,
    formFillupRecords: [ffRecord],
    formFillupFeeConfigs: [feeConfig],
  });

  assert.equal(dossier.classGroup?.name, 'CST 4th Semester');
  assert.equal(dossier.totalCreditsEnrolled, 7);
  assert.equal(dossier.attendanceStats.totalSessions, 3);
  assert.equal(dossier.attendanceStats.absent, 1);
  assert.equal(dossier.courseworkSummary.averagePercentage, 90);
  assert.equal(dossier.formFillupBreakdown?.totalAmountTk, 1100);
  assert.equal(dossier.eligibleSubjectsCount, 1);
  assert.equal(dossier.atRiskSubjectsCount, 1);

  const javaRow = dossier.subjectRows.find(r => r.subject.code === '28541')!;
  assert.equal(javaRow.theoryTeacherName, 'Engr. Farhana Akter');
  assert.equal(javaRow.practicalTeacherName, 'Engr. Mahmudul Hasan');
  assert.equal(javaRow.theoryPercentage, 100);
  assert.equal(javaRow.practicalPercentage, 100);
  assert.equal(javaRow.courseworkAveragePct, 90);

  const dsRow = dossier.subjectRows.find(r => r.subject.code === '28542')!;
  assert.equal(dsRow.isAtRisk, true);
  assert.equal(dsRow.combinedPercentage, 0);

  // Attendance timeline newest-first
  assert.equal(dossier.attendanceHistory[0].date, '2026-11-14');
  assert.equal(dossier.attendanceHistory[0].status, 'absent');
});

test('validateStudentProfileUpdate enforces required fields, duplicate roll protection, and trims optional fields', () => {
  const peerStudent: Student = {
    ...sampleStudent,
    id: 'stu-621046',
    rollNumber: '621046',
    name: 'Nusrat Jahan',
  };

  const missingName = validateStudentProfileUpdate(
    { ...sampleStudent, name: '   ' },
    [sampleStudent, peerStudent]
  );
  assert.equal(missingName.valid, false);

  const duplicateRoll = validateStudentProfileUpdate(
    { ...sampleStudent, rollNumber: '621046' },
    [sampleStudent, peerStudent]
  );
  assert.equal(duplicateRoll.valid, false);
  assert.match(duplicateRoll.error || '', /already assigned/);

  const validEdit = validateStudentProfileUpdate(
    {
      ...sampleStudent,
      name: '  Tanvir Hasan Updated  ',
      bloodGroup: '  A+  ',
      presentAddress: '   ',
    },
    [sampleStudent, peerStudent]
  );
  assert.equal(validEdit.valid, true);
  assert.equal(validEdit.normalized?.name, 'Tanvir Hasan Updated');
  assert.equal(validEdit.normalized?.bloodGroup, 'A+');
  assert.equal(validEdit.normalized?.presentAddress, undefined);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCourseworkInput,
  validateEvaluationScore,
  calculateCourseworkProgress,
  calculateStudentCourseworkSummary,
  filterVisibleCoursework,
  exportCourseworkEvaluationsToCSV,
} from './courseworkLogic';
import {
  CourseworkAssignment,
  Student,
  StudentAssignmentEvaluation,
  Subject,
  SubjectAssignment,
  User,
} from '../types/attendance';

test('validateCourseworkInput enforces required fields, dueDate ordering, and marks bounds', () => {
  const valid = validateCourseworkInput({
    title: 'Lab 01: Linked List Traversal',
    subjectId: 'bteb-28542',
    classId: 'class-cst-4',
    part: 'practical',
    assignedDate: '2026-11-10',
    dueDate: '2026-11-17',
    maxMarks: 25,
  });
  assert.equal(valid.valid, true);

  assert.equal(
    validateCourseworkInput({
      title: '   ',
      subjectId: 'bteb-28542',
      classId: 'class-cst-4',
      part: 'theory',
      assignedDate: '2026-11-10',
      dueDate: '2026-11-17',
      maxMarks: 20,
    }).valid,
    false
  );

  const badDates = validateCourseworkInput({
    title: 'Quiz 1',
    subjectId: 'bteb-28542',
    classId: 'class-cst-4',
    part: 'theory',
    assignedDate: '2026-11-17',
    dueDate: '2026-11-10',
    maxMarks: 20,
  });
  assert.equal(badDates.valid, false);
  assert.ok(badDates.error?.includes('Due date'));

  const badMarks = validateCourseworkInput({
    title: 'Quiz 1',
    subjectId: 'bteb-28542',
    classId: 'class-cst-4',
    part: 'theory',
    assignedDate: '2026-11-10',
    dueDate: '2026-11-17',
    maxMarks: 0,
  });
  assert.equal(badMarks.valid, false);
});

test('validateEvaluationScore guards marks between 0 and maxMarks', () => {
  assert.equal(validateEvaluationScore(null, 20).valid, true);
  assert.equal(validateEvaluationScore(0, 20).valid, true);
  assert.equal(validateEvaluationScore(18.5, 20).valid, true);
  assert.equal(validateEvaluationScore(-1, 20).valid, false);
  assert.equal(validateEvaluationScore(21, 20).valid, false);
});

test('calculateCourseworkProgress & calculateStudentCourseworkSummary aggregate student evaluations accurately', () => {
  const students: Student[] = [
    { id: 's1', rollNumber: '621001', name: 'Naimur Rahman', email: 's1@s.edu', gender: 'Male', classId: 'c4', status: 'active' },
    { id: 's2', rollNumber: '621002', name: 'Jannatul Ferdous', email: 's2@s.edu', gender: 'Female', classId: 'c4', status: 'active' },
    { id: 's3', rollNumber: '621003', name: 'Sabbir Ahmed', email: 's3@s.edu', gender: 'Male', classId: 'c4', status: 'active' },
    { id: 's4', rollNumber: '621004', name: 'Inactive Student', email: 's4@s.edu', gender: 'Male', classId: 'c4', status: 'inactive' },
  ];

  const cw1: CourseworkAssignment = {
    id: 'cw-1',
    title: 'Assignment 1: Algorithms',
    subjectId: 'sub-dsa',
    classId: 'c4',
    part: 'theory',
    teacherId: 'tch-1',
    assignedDate: '2026-11-01',
    dueDate: '2026-11-07',
    maxMarks: 20,
    createdAt: '2026-11-01T09:00:00Z',
  };
  const cw2: CourseworkAssignment = {
    id: 'cw-2',
    title: 'Lab Job 2: Binary Tree',
    subjectId: 'sub-dsa',
    classId: 'c4',
    part: 'practical',
    teacherId: 'tch-1',
    assignedDate: '2026-11-08',
    dueDate: '2026-11-14',
    maxMarks: 30,
    createdAt: '2026-11-08T09:00:00Z',
  };

  const evaluations: StudentAssignmentEvaluation[] = [
    // cw-1: s1 graded 18/20, s2 submitted (not yet graded), s3 missing
    { id: 'e1', courseworkId: 'cw-1', studentId: 's1', subjectId: 'sub-dsa', classId: 'c4', part: 'theory', status: 'graded', marksObtained: 18 },
    { id: 'e2', courseworkId: 'cw-1', studentId: 's2', subjectId: 'sub-dsa', classId: 'c4', part: 'theory', status: 'submitted' },
    { id: 'e3', courseworkId: 'cw-1', studentId: 's3', subjectId: 'sub-dsa', classId: 'c4', part: 'theory', status: 'missing', marksObtained: 0 },
    // cw-2: s1 graded 27/30, s2 late (ungraded), s3 pending
    { id: 'e4', courseworkId: 'cw-2', studentId: 's1', subjectId: 'sub-dsa', classId: 'c4', part: 'practical', status: 'graded', marksObtained: 27 },
    { id: 'e5', courseworkId: 'cw-2', studentId: 's2', subjectId: 'sub-dsa', classId: 'c4', part: 'practical', status: 'late' },
  ];

  const prog1 = calculateCourseworkProgress(cw1, students, evaluations);
  assert.equal(prog1.totalStudents, 3); // excludes inactive student
  assert.equal(prog1.gradedCount, 1);
  assert.equal(prog1.submittedCount, 1);
  assert.equal(prog1.missingCount, 1);
  assert.equal(prog1.completedCount, 2); // graded + submitted
  assert.equal(prog1.completionRate, 66.7);
  // Scored items: s1 (18) + s3 (0) = avg 9.0 out of 20 = 45.0%
  assert.equal(prog1.averageScore, 9);
  assert.equal(prog1.averagePercentage, 45);

  // s1 cumulative: 18 + 27 = 45 out of 50 = 90% -> Excellent
  const s1Summary = calculateStudentCourseworkSummary(students[0], [cw1, cw2], evaluations);
  assert.equal(s1Summary.totalAssignments, 2);
  assert.equal(s1Summary.gradedCount, 2);
  assert.equal(s1Summary.totalMarksObtained, 45);
  assert.equal(s1Summary.totalMaxMarks, 50);
  assert.equal(s1Summary.averagePercentage, 90);
  assert.equal(s1Summary.standing, 'Excellent');

  // s2 cumulative: 1 submitted, 1 late, 0 graded -> Not Evaluated
  const s2Summary = calculateStudentCourseworkSummary(students[1], [cw1, cw2], evaluations);
  assert.equal(s2Summary.submittedCount, 1);
  assert.equal(s2Summary.lateCount, 1);
  assert.equal(s2Summary.evaluatedCount, 0);
  assert.equal(s2Summary.averagePercentage, null);
  assert.equal(s2Summary.standing, 'Not Evaluated');

  // s3 cumulative: 1 missing (0/20), 1 pending -> 0% -> Needs Attention
  const s3Summary = calculateStudentCourseworkSummary(students[2], [cw1, cw2], evaluations);
  assert.equal(s3Summary.missingCount, 1);
  assert.equal(s3Summary.pendingCount, 1);
  assert.equal(s3Summary.averagePercentage, 0);
  assert.equal(s3Summary.standing, 'Needs Attention');
});

test('filterVisibleCoursework enforces admin full access and teacher part-scoped access', () => {
  const admin: User = { id: 'adm', name: 'Admin', email: 'a@b.c', role: 'admin', avatar: '', department: 'CST', employeeId: 'A1' };
  const teacher: User = { id: 'tch-1', name: 'T1', email: 't@b.c', role: 'teacher', avatar: '', department: 'CST', employeeId: 'T1' };

  const assignments: SubjectAssignment[] = [
    { id: 'a1', subjectId: 'sub-1', classId: 'c4', teacherId: 'tch-1', part: 'theory', academicYear: '2026', assignedAt: '2026-09-01' },
  ];

  const courseworkList: CourseworkAssignment[] = [
    { id: 'cw-theory', title: 'Theory Essay', subjectId: 'sub-1', classId: 'c4', part: 'theory', teacherId: 'tch-1', assignedDate: '2026-11-01', dueDate: '2026-11-10', maxMarks: 20, createdAt: '' },
    { id: 'cw-practical', title: 'Lab Job', subjectId: 'sub-1', classId: 'c4', part: 'practical', teacherId: 'tch-2', assignedDate: '2026-11-01', dueDate: '2026-11-12', maxMarks: 25, createdAt: '' },
  ];

  assert.equal(filterVisibleCoursework({ currentUser: admin, courseworkList, assignments }).length, 2);
  const teacherVisible = filterVisibleCoursework({ currentUser: teacher, courseworkList, assignments });
  assert.deepEqual(teacherVisible.map(c => c.id), ['cw-theory']);
});

test('exportCourseworkEvaluationsToCSV formats student marks and feedback cleanly', () => {
  const cw: CourseworkAssignment = {
    id: 'cw-1',
    title: 'Lab 01',
    subjectId: 'sub-1',
    classId: 'c4',
    part: 'practical',
    teacherId: 't1',
    assignedDate: '2026-11-01',
    dueDate: '2026-11-07',
    maxMarks: 20,
    createdAt: '',
  };
  const subject: Subject = {
    id: 'sub-1',
    code: '28542',
    name: 'Data Structure & Algorithm',
    description: '',
    color: 'emerald',
    classId: 'c4',
    credits: 3,
    semester: '4th',
    curriculum: 'BTEB Probidhan 2022',
    technology: 'CST (85)',
  };
  const students: Student[] = [
    { id: 's1', rollNumber: '621001', name: 'Naimur Rahman', email: 'n@s.edu', gender: 'Male', classId: 'c4', status: 'active' },
  ];
  const evaluations: StudentAssignmentEvaluation[] = [
    { id: 'ev-1', courseworkId: 'cw-1', studentId: 's1', subjectId: 'sub-1', classId: 'c4', part: 'practical', status: 'graded', marksObtained: 19, feedback: 'Well structured code', evaluatedAt: '2026-11-08T10:00:00Z' },
  ];

  const csv = exportCourseworkEvaluationsToCSV({ coursework: cw, subject, students, evaluations });
  assert.ok(csv.includes('# Assignment Evaluation Ledger: Lab 01'));
  assert.ok(csv.includes('28542 - Data Structure & Algorithm (PRACTICAL)'));
  assert.ok(csv.includes('"621001","Naimur Rahman","GRADED",19,20,"95.0%","Well structured code","2026-11-08"'));
});

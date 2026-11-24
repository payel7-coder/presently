import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveSessionFromAdmissionYear,
  deriveAdmissionYearFromSession,
  normalizeStudentSessionFields,
  getNextSemesterClass,
  buildPromotedStudentsPlan,
  getDistinctStudentSessions,
} from './studentSessionLogic';
import { ClassGroup, Student } from '../types/attendance';

const sampleClasses: ClassGroup[] = [
  {
    id: 'class-cst-1',
    name: 'CST 1st Semester',
    section: 'Shift-1 (Day)',
    semester: '1st',
    department: 'Computer Science & Technology',
    technology: 'CST (85)',
    academicYear: '2026-2027',
    roomNumber: '101',
  },
  {
    id: 'class-cst-2',
    name: 'CST 2nd Semester',
    section: 'Shift-1 (Day)',
    semester: '2nd',
    department: 'Computer Science & Technology',
    technology: 'CST (85)',
    academicYear: '2026-2027',
    roomNumber: '102',
  },
  {
    id: 'class-cst-7',
    name: 'CST 7th Semester',
    section: 'Shift-1 (Day)',
    semester: '7th',
    department: 'Computer Science & Technology',
    technology: 'CST (85)',
    academicYear: '2026-2027',
    roomNumber: '401',
  },
  {
    id: 'class-cst-8',
    name: 'CST 8th Semester',
    section: 'Industrial Training Shift',
    semester: '8th',
    department: 'Computer Science & Technology',
    technology: 'CST (85)',
    academicYear: '2026-2027',
    roomNumber: '402',
  },
];

test('deriveSessionFromAdmissionYear & normalizeStudentSessionFields keep session and admissionYear synchronized', () => {
  assert.equal(deriveSessionFromAdmissionYear('2022'), '2022-23');
  assert.equal(deriveSessionFromAdmissionYear('2024'), '2024-25');
  assert.equal(deriveSessionFromAdmissionYear('2023–2024'), '2023-2024');
  assert.equal(deriveAdmissionYearFromSession('2022-23'), '2022');
  assert.equal(deriveAdmissionYearFromSession('2021–2022'), '2021');

  assert.deepEqual(normalizeStudentSessionFields({ admissionYear: '2023' }), {
    session: '2023-24',
    admissionYear: '2023',
  });
  assert.deepEqual(normalizeStudentSessionFields({ session: '2021-22' }), {
    session: '2021-22',
    admissionYear: '2021',
  });
  assert.deepEqual(normalizeStudentSessionFields({ session: '2025' }), {
    session: '2025-26',
    admissionYear: '2025',
  });
});

test('getNextSemesterClass resolves sequential BTEB semesters and identifies 8th semester graduation', () => {
  const firstToSecond = getNextSemesterClass(sampleClasses[0], sampleClasses);
  assert.equal(firstToSecond.isFinalSemester, false);
  assert.equal(firstToSecond.nextSemester, '2nd');
  assert.equal(firstToSecond.nextClass?.id, 'class-cst-2');

  const seventhToEighth = getNextSemesterClass(sampleClasses[2], sampleClasses);
  assert.equal(seventhToEighth.isFinalSemester, false);
  assert.equal(seventhToEighth.nextSemester, '8th');
  assert.equal(seventhToEighth.nextClass?.id, 'class-cst-8');

  const eighthGrad = getNextSemesterClass(sampleClasses[3], sampleClasses);
  assert.equal(eighthGrad.isFinalSemester, true);
  assert.equal(eighthGrad.nextClass, null);
});

test('buildPromotedStudentsPlan promotes students to next semester while keeping admission session permanent', () => {
  const students: Student[] = [
    {
      id: 'stu-1',
      rollNumber: '621051',
      name: 'Naimur Rahman',
      email: 'naimur@student.bteb.edu.bd',
      gender: 'Male',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2024-25',
      admissionYear: '2024',
      status: 'active',
    },
    {
      id: 'stu-2',
      rollNumber: '621052',
      name: 'Readmitted Student',
      email: 'readmit@student.bteb.edu.bd',
      gender: 'Female',
      classId: 'class-cst-1',
      semester: '1st',
      admissionYear: '2022', // no explicit session yet -> derived as 2022-23
      status: 'active',
    },
    {
      id: 'stu-3',
      rollNumber: '621053',
      name: 'Conflict Student',
      email: 'conflict@student.bteb.edu.bd',
      gender: 'Male',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2024-25',
      status: 'active',
    },
    {
      id: 'stu-existing-2nd',
      rollNumber: '621053',
      name: 'Already In 2nd Sem',
      email: 'existing@student.bteb.edu.bd',
      gender: 'Male',
      classId: 'class-cst-2',
      semester: '2nd',
      session: '2023-24',
      status: 'active',
    },
  ];

  const plan = buildPromotedStudentsPlan({
    allStudents: students,
    selectedStudentIds: ['stu-1', 'stu-2', 'stu-3'],
    sourceClass: sampleClasses[0],
    targetClass: sampleClasses[1],
    promotedBy: 'admin@bteb.edu.bd',
    promotedAt: '2026-11-24T10:00:00.000Z',
  });

  assert.equal(plan.isGraduation, false);
  assert.equal(plan.fromSemester, '1st');
  assert.equal(plan.toSemester, '2nd');
  assert.equal(plan.promotedStudents.length, 2);
  assert.equal(plan.skippedRollConflicts.length, 1);
  assert.equal(plan.skippedRollConflicts[0].student.id, 'stu-3');

  // Regular student moves to 2nd semester, session stays 2024-25 (NOT overwritten by 2026-2027)
  assert.equal(plan.promotedStudents[0].classId, 'class-cst-2');
  assert.equal(plan.promotedStudents[0].semester, '2nd');
  assert.equal(plan.promotedStudents[0].session, '2024-25');
  assert.equal(plan.promotedStudents[0].admissionYear, '2024');
  assert.equal(plan.promotedStudents[0].semesterHistory?.length, 1);
  assert.equal(plan.promotedStudents[0].semesterHistory?.[0].semester, '1st');
  assert.equal(plan.promotedStudents[0].semesterHistory?.[0].session, '2024-25');

  // Readmitted student keeps 2022-23 session while studying in 2nd semester
  assert.equal(plan.promotedStudents[1].classId, 'class-cst-2');
  assert.equal(plan.promotedStudents[1].session, '2022-23');
  assert.equal(plan.promotedStudents[1].admissionYear, '2022');
});

test('buildPromotedStudentsPlan handles 8th semester graduation while preserving session', () => {
  const finalStudent: Student = {
    id: 'stu-8th',
    rollNumber: '510101',
    name: 'Final Year Student',
    email: 'final@student.bteb.edu.bd',
    gender: 'Female',
    classId: 'class-cst-8',
    semester: '8th',
    session: '2021-22',
    admissionYear: '2021',
    status: 'active',
  };

  const gradPlan = buildPromotedStudentsPlan({
    allStudents: [finalStudent],
    selectedStudentIds: ['stu-8th'],
    sourceClass: sampleClasses[3],
    targetClass: null,
    promotedAt: '2026-11-24T10:00:00.000Z',
  });

  assert.equal(gradPlan.isGraduation, true);
  assert.equal(gradPlan.promotedStudents.length, 1);
  assert.equal(gradPlan.promotedStudents[0].status, 'inactive');
  assert.equal(gradPlan.promotedStudents[0].academicStanding, 'Graduated');
  assert.equal(gradPlan.promotedStudents[0].session, '2021-22');
  assert.equal(gradPlan.promotedStudents[0].admissionYear, '2021');
});

test('getDistinctStudentSessions returns unique sessions sorted newest first', () => {
  const list: Student[] = [
    { id: '1', rollNumber: '1', name: 'A', email: 'a@x.com', gender: 'Male', classId: 'c1', session: '2022-23', status: 'active' },
    { id: '2', rollNumber: '2', name: 'B', email: 'b@x.com', gender: 'Male', classId: 'c1', admissionYear: '2024', status: 'active' },
    { id: '3', rollNumber: '3', name: 'C', email: 'c@x.com', gender: 'Female', classId: 'c1', session: '2023-24', status: 'active' },
    { id: '4', rollNumber: '4', name: 'D', email: 'd@x.com', gender: 'Female', classId: 'c1', session: '2024-25', status: 'active' },
  ];

  assert.deepEqual(getDistinctStudentSessions(list), ['2024-25', '2023-24', '2022-23']);
});

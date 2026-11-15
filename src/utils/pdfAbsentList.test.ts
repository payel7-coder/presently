import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubjectDateAbsentList } from './attendanceLogic';
import { generateAbsentListPDF, getAbsentListPdfFileName } from './pdfAbsentList';
import {
  AttendanceRecord,
  AttendanceSession,
  ClassGroup,
  Student,
  Subject,
  User,
} from '../types/attendance';

const mockClasses: ClassGroup[] = [
  {
    id: 'class-cst-4',
    name: 'CST 4th Semester',
    section: 'Shift-1 (Day)',
    semester: '4th',
    department: 'Computer Science & Technology',
    technology: 'Computer Science & Technology (85)',
    academicYear: '2026-2027',
    roomNumber: 'Lab 203',
  },
];

const mockSubjects: Subject[] = [
  {
    id: 'sub-28542',
    code: '28542',
    name: 'Data Structure & Algorithm',
    description: 'Stacks, queues, trees.',
    color: 'emerald',
    classId: 'class-cst-4',
    credits: 4,
    semester: '4th',
    curriculum: 'BTEB Probidhan 2022',
    technology: 'CST (85)',
  },
  {
    id: 'sub-28544',
    code: '28544',
    name: 'Microprocessor & Interfacing',
    description: '8086 architecture and assembly.',
    color: 'indigo',
    classId: 'class-cst-4',
    credits: 3,
    semester: '4th',
    curriculum: 'BTEB Probidhan 2022',
    technology: 'CST (85)',
  },
];

const mockTeacher: User = {
  id: 'tch-1',
  name: 'Engr. Test Teacher',
  email: 'teacher@polytechnic.edu.bd',
  role: 'teacher',
  department: 'Computer Science & Technology',
  employeeId: 'BTEB-TCH-101',
  avatar: '',
};

const mockStudents: Student[] = [
  {
    id: 'stu-1',
    rollNumber: '621010',
    registrationNumber: '1502148210',
    name: 'Sabbir Hossain',
    email: 'sabbir@student.bteb.edu.bd',
    gender: 'Male',
    classId: 'class-cst-4',
    parentContact: '+880 1711-111111',
    status: 'active',
  },
  {
    id: 'stu-2',
    rollNumber: '621002',
    registrationNumber: '1502148202',
    name: 'Sumaiya Akter',
    email: 'sumaiya@student.bteb.edu.bd',
    gender: 'Female',
    classId: 'class-cst-4',
    parentContact: '+880 1711-222222',
    status: 'active',
  },
  {
    id: 'stu-3',
    rollNumber: '621005',
    registrationNumber: '1502148205',
    name: 'Rakibul Islam',
    email: 'rakib@student.bteb.edu.bd',
    gender: 'Male',
    classId: 'class-cst-4',
    parentContact: '+880 1711-333333',
    status: 'active',
  },
];

const mockSessions: AttendanceSession[] = [
  {
    id: 'sess-1',
    subjectId: 'sub-28542',
    classId: 'class-cst-4',
    teacherId: 'tch-1',
    part: 'theory',
    date: '2026-11-10',
    totalStudents: 3,
    presentCount: 1,
    absentCount: 2,
    lateCount: 0,
    excusedCount: 0,
    createdAt: '2026-11-10T09:00:00Z',
    isSubmitted: true,
  },
  {
    id: 'sess-2',
    subjectId: 'sub-28542',
    classId: 'class-cst-4',
    teacherId: 'tch-1',
    part: 'practical',
    date: '2026-11-12',
    totalStudents: 3,
    presentCount: 2,
    absentCount: 1,
    lateCount: 0,
    excusedCount: 0,
    createdAt: '2026-11-12T11:00:00Z',
    isSubmitted: true,
  },
  {
    id: 'sess-3',
    subjectId: 'sub-28544',
    classId: 'class-cst-4',
    teacherId: 'tch-1',
    part: 'theory',
    date: '2026-11-12',
    totalStudents: 3,
    presentCount: 3,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 0,
    createdAt: '2026-11-12T14:00:00Z',
    isSubmitted: true,
  },
];

const mockRecords: AttendanceRecord[] = [
  // sess-1 (28542 Theory, 2026-11-10): stu-1 & stu-2 absent, stu-3 present
  { id: 'r1', sessionId: 'sess-1', studentId: 'stu-1', status: 'absent', remarks: 'Fever', markedAt: '' },
  { id: 'r2', sessionId: 'sess-1', studentId: 'stu-2', status: 'absent', remarks: '', markedAt: '' },
  { id: 'r3', sessionId: 'sess-1', studentId: 'stu-3', status: 'present', markedAt: '' },
  // sess-2 (28542 Practical, 2026-11-12): stu-2 present, stu-1 present, stu-3 absent
  { id: 'r4', sessionId: 'sess-2', studentId: 'stu-1', status: 'present', markedAt: '' },
  { id: 'r5', sessionId: 'sess-2', studentId: 'stu-2', status: 'present', markedAt: '' },
  { id: 'r6', sessionId: 'sess-2', studentId: 'stu-3', status: 'absent', remarks: 'Family emergency', markedAt: '' },
  // sess-3 (28544 Theory, 2026-11-12): all present
  { id: 'r7', sessionId: 'sess-3', studentId: 'stu-1', status: 'present', markedAt: '' },
  { id: 'r8', sessionId: 'sess-3', studentId: 'stu-2', status: 'present', markedAt: '' },
  { id: 'r9', sessionId: 'sess-3', studentId: 'stu-3', status: 'present', markedAt: '' },
];

test('buildSubjectDateAbsentList filters by subject, part, and date with numeric roll ordering', () => {
  // Exact date + subject
  const res1 = buildSubjectDateAbsentList({
    subjects: mockSubjects,
    classes: mockClasses,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    teachers: [mockTeacher],
    filters: { subjectId: 'sub-28542', date: '2026-11-10' },
  });

  assert.equal(res1.totalMatchingSessions, 1);
  assert.equal(res1.totalAbsentMarks, 2);
  assert.equal(res1.uniqueAbsentStudents, 2);
  // Sorted numerically by roll: 621002 before 621010
  assert.deepEqual(
    res1.entries.map(e => e.rollNumber),
    ['621002', '621010']
  );
  assert.equal(res1.entries[1].remarks, 'Fever');
  assert.equal(res1.entries[0].subjectCode, '28542');
  assert.equal(res1.entries[0].part, 'theory');

  // Filter by date 2026-11-12 + part=practical
  const res2 = buildSubjectDateAbsentList({
    subjects: mockSubjects,
    classes: mockClasses,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    filters: { date: '2026-11-12', part: 'practical' },
  });

  assert.equal(res2.totalMatchingSessions, 1);
  assert.equal(res2.totalAbsentMarks, 1);
  assert.equal(res2.entries[0].studentName, 'Rakibul Islam');
  assert.equal(res2.entries[0].part, 'practical');

  // Subject 28544 has 0 absences on 2026-11-12
  const resZero = buildSubjectDateAbsentList({
    subjects: mockSubjects,
    classes: mockClasses,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    filters: { subjectId: 'sub-28544', date: '2026-11-12' },
  });
  assert.equal(resZero.totalMatchingSessions, 1);
  assert.equal(resZero.sessionsWithAbsences, 0);
  assert.equal(resZero.totalAbsentMarks, 0);
  assert.equal(resZero.entries.length, 0);
});

test('generateAbsentListPDF builds valid Portrait A4 PDFs for absent entries and nil-absence cases', () => {
  const docWithAbsences = generateAbsentListPDF({
    subjects: mockSubjects,
    classes: mockClasses,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    teachers: [mockTeacher],
    requestedBy: mockTeacher,
    filters: { subjectId: 'sub-28542', startDate: '2026-11-10', endDate: '2026-11-12' },
  });

  assert.ok(docWithAbsences);
  const w = docWithAbsences.internal.pageSize.getWidth();
  const h = docWithAbsences.internal.pageSize.getHeight();
  assert.ok(h > w, 'Absent list PDF should be portrait A4');
  assert.equal(Math.round(w), 210);
  assert.equal(Math.round(h), 297);

  const outAbsences = docWithAbsences.output();
  assert.ok(outAbsences.includes('%PDF-'));
  assert.ok(outAbsences.length > 1000);

  const docNil = generateAbsentListPDF({
    subjects: mockSubjects,
    classes: mockClasses,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    requestedBy: mockTeacher,
    filters: { subjectId: 'sub-28544', date: '2026-11-12' },
  });
  const outNil = docNil.output();
  assert.ok(outNil.includes('%PDF-'));
  assert.notEqual(outAbsences, outNil);
});

test('getAbsentListPdfFileName produces clear subject and date-wise filenames', () => {
  const file1 = getAbsentListPdfFileName({
    subjects: mockSubjects,
    filters: { subjectId: 'sub-28542', part: 'theory', date: '2026-11-10' },
  });
  assert.equal(file1, 'BTEB_Absent_List_28542_Data_Structure_Algorithm_Theory_2026-11-10.pdf');

  const file2 = getAbsentListPdfFileName({
    subjects: mockSubjects,
    filters: { subjectId: 'all', part: 'all', startDate: '2026-11-01', endDate: '2026-11-13' },
  });
  assert.equal(file2, 'BTEB_Absent_List_All_Subjects_2026-11-01_to_2026-11-13.pdf');
});

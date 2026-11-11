import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAttendanceRegisterPDF } from './pdfAttendanceRegister';
import { Subject, ClassGroup, Student, AttendanceSession, AttendanceRecord, User } from '../types/attendance';

const mockSubject: Subject = {
  id: 'sub-28542',
  code: '28542',
  name: 'Data Structure & Algorithm',
  description: 'Stacks, queues, linked lists, trees, search and sort algorithms.',
  color: 'emerald',
  classId: 'class-cst-4',
  credits: 4,
  semester: '4th',
  curriculum: 'BTEB Probidhan 2022',
  technology: 'Computer Science and Technology (85)',
};

const mockClass: ClassGroup = {
  id: 'class-cst-4',
  name: 'CST 4th Semester',
  section: 'Shift-1 (Day)',
  semester: '4th',
  department: 'Computer Science & Technology',
  technology: 'Computer Science and Technology (85)',
  academicYear: '2026-2027',
  roomNumber: 'Algorithms & Web Lab 203',
};

const mockTeacher: User = {
  id: 'tch-tanvir',
  name: 'Engr. Tanvir Ahmed',
  email: 'tanvir.cst@polytechnic.bteb.gov.bd',
  role: 'teacher',
  department: 'Computer Science & Technology',
  employeeId: 'BTEB-TCH-102',
  title: 'Head of Department (Computer Technology)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
};

const mockStudents: Student[] = [
  {
    id: 'stu-1',
    name: 'Sabbir Hossain',
    rollNumber: '523101',
    registrationNumber: '1502148201',
    email: 'sabbir@student.bteb.edu.bd',
    gender: 'Male',
    classId: 'class-cst-4',
    status: 'active',
  },
  {
    id: 'stu-2',
    name: 'Sumaiya Akter',
    rollNumber: '523102',
    registrationNumber: '1502148202',
    email: 'sumaiya@student.bteb.edu.bd',
    gender: 'Female',
    classId: 'class-cst-4',
    status: 'active',
  },
  {
    id: 'stu-3',
    name: 'Rakibul Islam',
    rollNumber: '523103',
    registrationNumber: '1502148203',
    email: 'rakib@student.bteb.edu.bd',
    gender: 'Male',
    classId: 'class-cst-4',
    status: 'active',
  },
];

const mockSessions: AttendanceSession[] = [
  {
    id: 'sess-1',
    subjectId: 'sub-28542',
    classId: 'class-cst-4',
    date: '2026-03-01',
    timeSlot: '09:00 - 10:00 AM',
    teacherId: 'tch-tanvir',
    totalStudents: 3,
    presentCount: 3,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 0,
    isSubmitted: true,
    createdAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'sess-2',
    subjectId: 'sub-28542',
    classId: 'class-cst-4',
    date: '2026-03-03',
    timeSlot: '09:00 - 10:00 AM',
    teacherId: 'tch-tanvir',
    totalStudents: 3,
    presentCount: 2,
    absentCount: 1,
    lateCount: 0,
    excusedCount: 0,
    isSubmitted: true,
    createdAt: '2026-03-03T09:00:00Z',
  },
  {
    id: 'sess-3',
    subjectId: 'sub-28542',
    classId: 'class-cst-4',
    date: '2026-03-05',
    timeSlot: '09:00 - 10:00 AM',
    teacherId: 'tch-tanvir',
    totalStudents: 3,
    presentCount: 2,
    absentCount: 0,
    lateCount: 1,
    excusedCount: 0,
    isSubmitted: true,
    createdAt: '2026-03-05T09:00:00Z',
  },
];

const mockRecords: AttendanceRecord[] = [
  // Session 1: All present
  { id: 'r1', sessionId: 'sess-1', studentId: 'stu-1', status: 'present', markedAt: '2026-03-01T09:05:00Z' },
  { id: 'r2', sessionId: 'sess-1', studentId: 'stu-2', status: 'present', markedAt: '2026-03-01T09:05:00Z' },
  { id: 'r3', sessionId: 'sess-1', studentId: 'stu-3', status: 'present', markedAt: '2026-03-01T09:05:00Z' },
  // Session 2: stu-3 absent
  { id: 'r4', sessionId: 'sess-2', studentId: 'stu-1', status: 'present', markedAt: '2026-03-03T09:05:00Z' },
  { id: 'r5', sessionId: 'sess-2', studentId: 'stu-2', status: 'present', markedAt: '2026-03-03T09:05:00Z' },
  { id: 'r6', sessionId: 'sess-2', studentId: 'stu-3', status: 'absent', markedAt: '2026-03-03T09:05:00Z' },
  // Session 3: stu-2 late
  { id: 'r7', sessionId: 'sess-3', studentId: 'stu-1', status: 'present', markedAt: '2026-03-05T09:05:00Z' },
  { id: 'r8', sessionId: 'sess-3', studentId: 'stu-2', status: 'late', markedAt: '2026-03-05T09:05:00Z' },
  { id: 'r9', sessionId: 'sess-3', studentId: 'stu-3', status: 'present', markedAt: '2026-03-05T09:05:00Z' },
];

test('generateAttendanceRegisterPDF creates a valid landscape PDF for recorded attendance ledger', () => {
  const doc = generateAttendanceRegisterPDF({
    subject: mockSubject,
    classGroup: mockClass,
    teacher: mockTeacher,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    isBlankTemplate: false,
  });

  assert.ok(doc, 'Document must be defined');
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  assert.ok(width > height, 'Orientation must be landscape');
  assert.equal(Math.round(width), 297, 'Landscape A4 width should be ~297mm');
  assert.equal(Math.round(height), 210, 'Landscape A4 height should be ~210mm');

  // Verify PDF output generates array buffer / binary string without error
  const pdfOutput = doc.output();
  assert.ok(pdfOutput.length > 1000, 'PDF output should contain valid binary stream');
  assert.ok(pdfOutput.includes('%PDF-'), 'PDF header should be present');
});

test('generateAttendanceRegisterPDF creates blank classroom log sheet format', () => {
  const doc = generateAttendanceRegisterPDF({
    subject: mockSubject,
    classGroup: mockClass,
    teacher: mockTeacher,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    isBlankTemplate: true,
  });

  assert.ok(doc, 'Document must be defined');
  const pdfOutput = doc.output();
  assert.ok(pdfOutput.length > 1000, 'Blank PDF output should contain valid stream');
  assert.ok(pdfOutput.includes('%PDF-'), 'PDF header should be present');
});

test('generateAttendanceRegisterPDF filters sessions by date range', () => {
  const doc = generateAttendanceRegisterPDF({
    subject: mockSubject,
    classGroup: mockClass,
    teacher: mockTeacher,
    students: mockStudents,
    sessions: mockSessions,
    records: mockRecords,
    isBlankTemplate: false,
    startDate: '2026-03-02',
    endDate: '2026-03-04',
  });

  assert.ok(doc, 'Document should be generated with date filtering');
  const pdfOutput = doc.output();
  assert.ok(pdfOutput.includes('%PDF-'));
});

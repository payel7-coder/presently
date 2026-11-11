import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStudentCSV,
  generateStudentCSVTemplate,
  calculateStudentAttendanceStats,
  exportAttendanceToCSV,
  isValidAttendanceDate,
  calculateDailyClassTargetProgress,
} from './attendanceLogic';
import { Student, AttendanceSession, AttendanceRecord } from '../types/attendance';

test('parseStudentCSV successfully parses valid CSV rows', () => {
  const sampleCSV = `Roll Number, Name, Email, Gender, Phone
STU-001, John Doe, john@example.com, Male, 1234567890
STU-002, Jane Smith, jane@example.com, Female, 9876543210`;

  const result = parseStudentCSV(sampleCSV, 'class-1');
  assert.equal(result.errors.length, 0);
  assert.equal(result.validCount, 2);
  assert.equal(result.students[0].name, 'John Doe');
  assert.equal(result.students[0].rollNumber, 'STU-001');
  assert.equal(result.students[0].gender, 'Male');
  assert.equal(result.students[1].name, 'Jane Smith');
  assert.equal(result.students[1].gender, 'Female');
});

test('parseStudentCSV handles quotes with commas inside fields', () => {
  const sampleCSV = `Roll Number, Name, Email, Gender
STU-003, "O'Connor, Liam", liam@example.com, Male`;

  const result = parseStudentCSV(sampleCSV, 'class-1');
  assert.equal(result.errors.length, 0);
  assert.equal(result.validCount, 1);
  assert.equal(result.students[0].name, "O'Connor, Liam");
  assert.equal(result.students[0].rollNumber, 'STU-003');
});

test('parseStudentCSV flags missing required headers and duplicate roll numbers', () => {
  // Missing roll number header
  const invalidHeaderCSV = `Name, Email
Alice, alice@example.com`;
  const invalidResult = parseStudentCSV(invalidHeaderCSV, 'class-1');
  assert.ok(invalidResult.errors.some(e => e.message.includes('Roll Number')));

  // Duplicate roll number in rows
  const duplicateRollCSV = `Roll Number, Name, Email
STU-010, Alice Walker, alice@example.com
STU-010, Bob Walker, bob@example.com`;
  const dupResult = parseStudentCSV(duplicateRollCSV, 'class-1');
  assert.equal(dupResult.validCount, 1);
  assert.ok(dupResult.errors.some(e => e.message.includes('Duplicate Roll Number')));
});

test('calculateStudentAttendanceStats computes accurate stats and streak', () => {
  const student: Student = {
    id: 's1',
    name: 'Alice Johnson',
    rollNumber: 'R-101',
    email: 'alice@student.edu',
    gender: 'Female',
    classId: 'c1',
    status: 'active',
  };

  const sessions: AttendanceSession[] = [
    {
      id: 'sess-1',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId: 't1',
      date: '2026-11-01',
      timeSlot: '09:00 - 10:00 AM',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-01',
      isSubmitted: true,
    },
    {
      id: 'sess-2',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId: 't1',
      date: '2026-11-02',
      timeSlot: '09:00 - 10:00 AM',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-02',
      isSubmitted: true,
    },
    {
      id: 'sess-3',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId: 't1',
      date: '2026-11-03',
      timeSlot: '09:00 - 10:00 AM',
      totalStudents: 1,
      presentCount: 0,
      absentCount: 1,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-03',
      isSubmitted: true,
    },
    {
      id: 'sess-4',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId: 't1',
      date: '2026-11-04',
      timeSlot: '09:00 - 10:00 AM',
      totalStudents: 1,
      presentCount: 1,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-04',
      isSubmitted: true,
    },
  ];

  const records: AttendanceRecord[] = [
    { id: 'r1', sessionId: 'sess-1', studentId: 's1', status: 'present', markedAt: '2026-11-01' },
    { id: 'r2', sessionId: 'sess-2', studentId: 's1', status: 'present', markedAt: '2026-11-02' },
    { id: 'r3', sessionId: 'sess-3', studentId: 's1', status: 'absent', markedAt: '2026-11-03' },
    { id: 'r4', sessionId: 'sess-4', studentId: 's1', status: 'present', markedAt: '2026-11-04' },
  ];

  const stats = calculateStudentAttendanceStats(student, sessions, records, 75);
  assert.equal(stats.totalSessions, 4);
  assert.equal(stats.present, 3);
  assert.equal(stats.absent, 1);
  assert.equal(stats.attendancePercentage, 75);
  // Current streak looking from latest date (sess-4 is present, sess-3 was absent -> streak is 1)
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.isAtRisk, false);
});

test('calculateStudentAttendanceStats identifies at-risk students below 75%', () => {
  const student: Student = {
    id: 's2',
    name: 'Bob Miller',
    rollNumber: 'R-102',
    email: 'bob@student.edu',
    gender: 'Male',
    classId: 'c1',
    status: 'active',
  };

  const sessions: AttendanceSession[] = [
    { id: 'sess-1', subjectId: 'sub-1', classId: 'c1', teacherId: 't1', date: '2026-11-01', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
    { id: 'sess-2', subjectId: 'sub-1', classId: 'c1', teacherId: 't1', date: '2026-11-02', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
    { id: 'sess-3', subjectId: 'sub-1', classId: 'c1', teacherId: 't1', date: '2026-11-03', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
    { id: 'sess-4', subjectId: 'sub-1', classId: 'c1', teacherId: 't1', date: '2026-11-04', timeSlot: '09:00', totalStudents: 1, presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
  ];

  const records: AttendanceRecord[] = [
    { id: 'r1', sessionId: 'sess-1', studentId: 's2', status: 'absent', markedAt: '' },
    { id: 'r2', sessionId: 'sess-2', studentId: 's2', status: 'absent', markedAt: '' },
    { id: 'r3', sessionId: 'sess-3', studentId: 's2', status: 'absent', markedAt: '' },
    { id: 'r4', sessionId: 'sess-4', studentId: 's2', status: 'present', markedAt: '' },
  ];

  const stats = calculateStudentAttendanceStats(student, sessions, records, 75);
  assert.equal(stats.attendancePercentage, 25);
  assert.equal(stats.isAtRisk, true);
  assert.ok(stats.requiredForThreshold > 0);
});

test('generateStudentCSVTemplate returns template with headers', () => {
  const template = generateStudentCSVTemplate();
  assert.ok(template.includes('Roll Number,Registration Number,Name'));
  assert.ok(template.includes('Naimur Rahman'));
});

test('exportAttendanceToCSV produces formatted CSV with metadata and summary headers', () => {
  const student: Student = {
    id: 's1',
    name: 'Alice Johnson',
    rollNumber: 'R-101',
    email: 'alice@student.edu',
    gender: 'Female',
    classId: 'c1',
    status: 'active',
  };
  const sessions: AttendanceSession[] = [
    { id: 'sess-1', subjectId: 'sub-1', classId: 'c1', teacherId: 't1', date: '2026-11-01', timeSlot: '09:00 AM', totalStudents: 1, presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true }
  ];
  const records: AttendanceRecord[] = [
    { id: 'r1', sessionId: 'sess-1', studentId: 's1', status: 'present', markedAt: '' }
  ];

  const csv = exportAttendanceToCSV(sessions, [student], records, 'Calculus', 'Grade 10-A');
  assert.ok(csv.includes('# Attendance Report: Calculus - Grade 10-A'));
  assert.ok(csv.includes('"Alice Johnson"'));
  assert.ok(csv.includes('"Present"'));
  assert.ok(csv.includes('"100.0%"'));
});

test('isValidAttendanceDate validates that tomorrow and future dates cannot be selected', () => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Today is valid
  const todayRes = isValidAttendanceDate(todayStr);
  assert.equal(todayRes.isValid, true);
  assert.equal(todayRes.error, undefined);

  // Past dates are valid
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const yesterdayRes = isValidAttendanceDate(yesterday);
  assert.equal(yesterdayRes.isValid, true);

  const pastDateRes = isValidAttendanceDate('2024-01-15');
  assert.equal(pastDateRes.isValid, true);

  // Tomorrow is invalid
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tomorrowRes = isValidAttendanceDate(tomorrow);
  assert.equal(tomorrowRes.isValid, false);
  assert.ok(tomorrowRes.error?.includes('future dates'));

  // Distant future is invalid
  const futureRes = isValidAttendanceDate('2099-12-31');
  assert.equal(futureRes.isValid, false);

  // Empty string is invalid
  const emptyRes = isValidAttendanceDate('');
  assert.equal(emptyRes.isValid, false);
});

test('calculateDailyClassTargetProgress accurately computes daily progress, percentage and status', () => {
  const teacherId = 'teacher-tanvir';
  const testDate = '2026-11-10';

  const sampleSessions: AttendanceSession[] = [
    {
      id: 'sess-1',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId,
      date: testDate,
      totalStudents: 30,
      presentCount: 28,
      absentCount: 2,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-10',
      isSubmitted: true,
    },
    {
      id: 'sess-2',
      subjectId: 'sub-2',
      classId: 'c2',
      teacherId,
      date: testDate,
      totalStudents: 25,
      presentCount: 24,
      absentCount: 1,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-10',
      isSubmitted: true,
    },
    // Session on different date (should not count)
    {
      id: 'sess-3',
      subjectId: 'sub-1',
      classId: 'c1',
      teacherId,
      date: '2026-11-09',
      totalStudents: 30,
      presentCount: 30,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-09',
      isSubmitted: true,
    },
    // Session by different teacher (should not count)
    {
      id: 'sess-4',
      subjectId: 'sub-3',
      classId: 'c3',
      teacherId: 'teacher-other',
      date: testDate,
      totalStudents: 20,
      presentCount: 20,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-10',
      isSubmitted: true,
    },
    // Unsubmitted session (should not count)
    {
      id: 'sess-5',
      subjectId: 'sub-4',
      classId: 'c4',
      teacherId,
      date: testDate,
      totalStudents: 20,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-10',
      isSubmitted: false,
    },
  ];

  // Case 1: Target = 4, 2 conducted today -> 50%
  const res1 = calculateDailyClassTargetProgress(4, sampleSessions, teacherId, testDate);
  assert.equal(res1.target, 4);
  assert.equal(res1.conductedCount, 2);
  assert.equal(res1.percentage, 50);
  assert.equal(res1.remaining, 2);
  assert.equal(res1.isCompleted, false);
  assert.equal(res1.status, 'in_progress');
  assert.equal(res1.conductedSessions.length, 2);

  // Case 2: Target = 2, 2 conducted today -> 100% completed
  const res2 = calculateDailyClassTargetProgress(2, sampleSessions, teacherId, testDate);
  assert.equal(res2.percentage, 100);
  assert.equal(res2.remaining, 0);
  assert.equal(res2.isCompleted, true);
  assert.equal(res2.status, 'completed');

  // Case 3: Target = 1, 2 conducted today -> exceeded
  const res3 = calculateDailyClassTargetProgress(1, sampleSessions, teacherId, testDate);
  assert.equal(res3.percentage, 100);
  assert.equal(res3.remaining, 0);
  assert.equal(res3.isCompleted, true);
  assert.equal(res3.status, 'exceeded');

  // Case 4: No sessions conducted on this date
  const res4 = calculateDailyClassTargetProgress(3, sampleSessions, teacherId, '2026-11-08');
  assert.equal(res4.conductedCount, 0);
  assert.equal(res4.percentage, 0);
  assert.equal(res4.remaining, 3);
  assert.equal(res4.isCompleted, false);
  assert.equal(res4.status, 'not_started');

  // Case 5: Target <= 0 defaults to 1
  const res5 = calculateDailyClassTargetProgress(0, sampleSessions, teacherId, testDate);
  assert.equal(res5.target, 1);
  assert.equal(res5.isCompleted, true);
});


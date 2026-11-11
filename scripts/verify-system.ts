import { BTEB_CURRICULUM_2022_SUBJECTS, BTEB_CLASSES, BTEB_FACULTY_USERS, BTEB_INITIAL_STUDENTS } from '../src/data/btebCurriculum.ts';
import {
  parseStudentCSV,
  calculateStudentAttendanceStats,
  calculateSessionSummary,
  exportAttendanceToCSV,
  generateStudentCSVTemplate
} from '../src/utils/attendanceLogic.ts';
import assert from 'node:assert';

console.log('--- Verifying BTEB Curricula 2022 Implementation ---');

// 1. Verify BTEB Semesters
const expectedSemesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
for (const sem of expectedSemesters) {
  const subjectsInSem = BTEB_CURRICULUM_2022_SUBJECTS.filter(s => s.semester === sem);
  console.log(`Semester ${sem}: Found ${subjectsInSem.length} BTEB 2022 subjects`);
  assert(subjectsInSem.length > 0, `Semester ${sem} must have BTEB subjects`);
}

// 2. Verify Key Course Codes from BTEB Probidhan 2022
const keyCodes = ['28542', '28561', '28562', '28581', '25711', '26611'];
for (const code of keyCodes) {
  const found = BTEB_CURRICULUM_2022_SUBJECTS.find(s => s.code === code);
  assert(found, `Course code ${code} should exist in curriculum`);
  console.log(`Verified course: ${found.code} - ${found.name} (${found.semester} Semester)`);
}

// 3. Verify Admin and Faculty User Roles
const admin = BTEB_FACULTY_USERS.find(u => u.role === 'admin');
const teachers = BTEB_FACULTY_USERS.filter(u => u.role === 'teacher');
assert(admin, 'Admin user must exist');
assert(teachers.length >= 3, 'At least 3 teachers must exist');
console.log(`Admin user verified: ${admin.name} (${admin.email})`);
console.log(`Teacher count: ${teachers.length}`);

// 4. Verify CSV Import with BTEB Board Roll and Registration Numbers
const btebSample = generateStudentCSVTemplate();
const parsed = parseStudentCSV(btebSample, 'bteb-class-cst-4th');
assert.strictEqual(parsed.errors.length, 0, 'Sample template should parse with zero errors');
assert(parsed.validCount >= 3, 'Sample template should have valid student count');
console.log(`CSV Parser verified: successfully parsed ${parsed.validCount} BTEB students`);
assert(parsed.students[0].rollNumber, 'Student must have roll number');
assert(parsed.students[0].registrationNumber, 'Student must have registration number');
console.log(`First student: Roll ${parsed.students[0].rollNumber}, Reg ${parsed.students[0].registrationNumber}, Name ${parsed.students[0].name}`);

// 5. Verify Attendance Metrics and At-Risk Calculations (<75%)
const dummyStudent = BTEB_INITIAL_STUDENTS[0];
const mockSessions = [
  { id: 's1', subjectId: 'bteb-28542', classId: dummyStudent.classId, teacherId: 't1', date: '2026-11-01', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
  { id: 's2', subjectId: 'bteb-28542', classId: dummyStudent.classId, teacherId: 't1', date: '2026-11-02', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true },
  { id: 's3', subjectId: 'bteb-28542', classId: dummyStudent.classId, teacherId: 't1', date: '2026-11-03', timeSlot: '09:00', totalStudents: 1, presentCount: 0, absentCount: 1, lateCount: 0, excusedCount: 0, createdAt: '', isSubmitted: true }
];
const mockRecords = [
  { id: 'r1', sessionId: 's1', studentId: dummyStudent.id, status: 'absent' as const, markedAt: '' },
  { id: 'r2', sessionId: 's2', studentId: dummyStudent.id, status: 'absent' as const, markedAt: '' },
  { id: 'r3', sessionId: 's3', studentId: dummyStudent.id, status: 'absent' as const, markedAt: '' }
];
const stats = calculateStudentAttendanceStats(dummyStudent, mockSessions, mockRecords, 75);
assert.strictEqual(stats.isAtRisk, true, 'Student with 0% over 3 sessions should be flagged at-risk');
console.log(`At-risk algorithm verified: Student flagged at-risk with ${stats.attendancePercentage}% attendance`);

// 6. Verify CSV Export Functionality
const csvExport = exportAttendanceToCSV(mockSessions, [dummyStudent], mockRecords, 'Data Structure', 'CST 4th');
assert(csvExport.includes('Data Structure'), 'CSV Export must include subject title');
assert(csvExport.includes(dummyStudent.name), 'CSV Export must include student name');
console.log('CSV Export verified: Formatted export successfully produced');

console.log('\n--- ALL SYSTEM VERIFICATION CHECKS PASSED ---');

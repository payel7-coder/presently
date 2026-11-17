import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserProfileUpdatePayload,
  calculateUserTeachingSummary,
} from './userProfileLogic.ts';
import {
  AttendanceSession,
  ClassGroup,
  CourseworkAssignment,
  FormFillupResponsibility,
  Subject,
  SubjectAssignment,
  User,
} from '../types/attendance.ts';

const teacherUser: User = {
  id: 'tch-101',
  name: 'Engr. Mahmudul Hasan',
  email: 'mahmud@bteb.edu.bd',
  role: 'teacher',
  avatar: '',
  department: 'Computer Science & Technology',
  employeeId: 'BTEB-TCH-101',
  title: 'Instructor (Computer Technology)',
  dailyClassTarget: 4,
  approvalStatus: 'approved',
  approvedBy: 'payelahmed70@gmail.com',
};

test('buildUserProfileUpdatePayload validates required fields, clamps daily target, and preserves immutable role/email', () => {
  const missingName = buildUserProfileUpdatePayload(teacherUser, {
    name: '   ',
    department: 'CST',
    employeeId: 'BTEB-101',
  });
  assert.equal(missingName.valid, false);
  assert.match(missingName.error || '', /Full name is required/);

  const badAvatar = buildUserProfileUpdatePayload(teacherUser, {
    name: 'Engr. Mahmudul Hasan',
    department: 'CST',
    employeeId: 'BTEB-101',
    avatar: 'javascript:alert(1)',
  });
  assert.equal(badAvatar.valid, false);

  const valid = buildUserProfileUpdatePayload(teacherUser, {
    name: '  Engr. Mahmudul Hasan, M.Sc.  ',
    department: '  Computer Science & Technology  ',
    employeeId: '  BTEB-202  ',
    title: '  Chief Instructor (CST)  ',
    phone: '  +8801711223344  ',
    qualification: '  M.Sc. in CSE, BUET  ',
    specialization: '  Operating Systems, Distributed Databases  ',
    officeRoom: '  Academic Bhaban-1, Room 208  ',
    officeHours: '  Sun-Thu 11:00 AM - 01:00 PM  ',
    joiningDate: '2020-02-15',
    bloodGroup: 'B+',
    bio: '  Faculty lead for BTEB CST core lab courses.  ',
    dailyClassTarget: 45, // should clamp to 20
    avatar: 'data:image/jpeg;base64,abcd1234',
  });

  assert.equal(valid.valid, true);
  assert.ok(valid.updatedUser);
  assert.equal(valid.updatedUser!.role, 'teacher'); // immutable
  assert.equal(valid.updatedUser!.email, 'mahmud@bteb.edu.bd'); // immutable
  assert.equal(valid.updatedUser!.approvalStatus, 'approved'); // immutable
  assert.equal(valid.updatedUser!.name, 'Engr. Mahmudul Hasan, M.Sc.');
  assert.equal(valid.updatedUser!.employeeId, 'BTEB-202');
  assert.equal(valid.updatedUser!.qualification, 'M.Sc. in CSE, BUET');
  assert.equal(valid.updatedUser!.dailyClassTarget, 20);
  assert.equal(valid.updatedUser!.avatar, 'data:image/jpeg;base64,abcd1234');
});

test('calculateUserTeachingSummary computes allocations, sessions, coursework, form fillup roles, and completeness', () => {
  const classes: ClassGroup[] = [
    {
      id: 'class-cst-4',
      name: 'CST 4th Semester',
      section: '1st Shift',
      department: 'CST',
      semester: '4th',
      academicYear: '2026',
      roomNumber: '402',
      technology: 'CST (85)',
    },
  ];
  const subjects: Subject[] = [
    {
      id: 'sub-28541',
      code: '28541',
      name: 'Java Programming',
      description: 'OOP',
      color: 'emerald',
      classId: 'class-cst-4',
      credits: 4,
      semester: '4th',
      curriculum: 'BTEB 2022',
      technology: 'CST',
    },
  ];
  const assignments: SubjectAssignment[] = [
    {
      id: 'asg-1',
      subjectId: 'sub-28541',
      teacherId: 'tch-101',
      classId: 'class-cst-4',
      part: 'theory',
      academicYear: '2026',
      assignedAt: '2026-01-10',
    },
    {
      id: 'asg-2',
      subjectId: 'sub-28541',
      teacherId: 'tch-101',
      classId: 'class-cst-4',
      part: 'practical',
      academicYear: '2026',
      assignedAt: '2026-01-10',
    },
  ];
  const sessions: AttendanceSession[] = [
    {
      id: 'sess-1',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      teacherId: 'tch-101',
      part: 'theory',
      date: '2026-11-15',
      totalStudents: 30,
      presentCount: 28,
      absentCount: 2,
      lateCount: 0,
      excusedCount: 0,
      createdAt: '2026-11-15',
      isSubmitted: true,
    },
  ];
  const courseworkAssignments: CourseworkAssignment[] = [
    {
      id: 'cw-1',
      title: 'Lab 01',
      subjectId: 'sub-28541',
      classId: 'class-cst-4',
      part: 'practical',
      teacherId: 'tch-101',
      assignedDate: '2026-11-01',
      dueDate: '2026-11-10',
      maxMarks: 20,
      createdAt: '2026-11-01',
    },
  ];
  const formFillupResponsibilities: FormFillupResponsibility[] = [
    {
      id: 'ff-resp-class-cst-4',
      semester: '4th',
      classId: 'class-cst-4',
      teacherId: 'tch-101',
      academicYear: '2026',
      assignedAt: '2026-11-12',
    },
  ];

  const summary = calculateUserTeachingSummary({
    user: {
      ...teacherUser,
      phone: '+8801711000000',
      qualification: 'B.Sc. in CSE',
    },
    assignments,
    subjects,
    classes,
    sessions,
    courseworkAssignments,
    formFillupResponsibilities,
  });

  assert.equal(summary.allocations.length, 2);
  assert.equal(summary.distinctCoursesCount, 1);
  assert.equal(summary.sessionsConductedCount, 1);
  assert.equal(summary.assignmentsCreatedCount, 1);
  assert.deepEqual(summary.coordinatorSemesters, ['CST 4th Semester']);
  assert.equal(summary.completenessPercent, 50); // 4 of 8 profile fields populated
  assert.ok(summary.missingFields.includes('Office Hours'));
});

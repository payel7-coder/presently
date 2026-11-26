import {
  AttendanceRecord,
  AttendanceSession,
  Student,
  SubjectAssignment,
  User,
} from '../types/attendance';

export type DevPreviewRole = 'admin' | 'teacher';

export interface DevPreviewDataset {
  currentUser: User;
  users: User[];
  assignments: SubjectAssignment[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
}

export function getDevPreviewRole(): DevPreviewRole | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }
  const param = new URLSearchParams(window.location.search).get('preview_role');
  if (param === 'admin' || param === 'teacher') {
    return param;
  }
  return null;
}

export function createDevPreviewDataset(role: DevPreviewRole): DevPreviewDataset {
  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  const adminUser: User = {
    id: 'preview-root-admin',
    name: 'Root Admin',
    email: 'payelahmed70@gmail.com',
    role: 'admin',
    avatar: '',
    employeeId: 'ROOT-001',
    approvalStatus: 'approved',
    department: 'Computer Science & Technology',
    title: 'Head of Department',
    dailyClassTarget: 4,
    registeredAt: '2026-01-10T08:00:00.000Z',
  };

  const teacherUser: User = {
    id: 'preview-teacher-1',
    name: 'Tanvir Hasan',
    email: 'tanvir.cst@mist.edu.bd',
    role: 'teacher',
    avatar: '',
    approvalStatus: 'approved',
    department: 'Computer Science & Technology',
    title: 'Instructor (CST)',
    employeeId: 'FAC-104',
    dailyClassTarget: 4,
    registeredAt: '2026-01-12T08:00:00.000Z',
  };

  const users: User[] = [adminUser, teacherUser];

  const assignments: SubjectAssignment[] = [
    {
      id: 'preview-asg-21011-theory',
      subjectId: 'bteb-21011',
      teacherId: teacherUser.id,
      classId: 'class-cst-1',
      part: 'theory',
      academicYear: '2026-2027',
      assignedAt: '2026-01-15',
    },
    {
      id: 'preview-asg-21011-practical',
      subjectId: 'bteb-21011',
      teacherId: teacherUser.id,
      classId: 'class-cst-1',
      part: 'practical',
      academicYear: '2026-2027',
      assignedAt: '2026-01-15',
    },
  ];

  const students: Student[] = [
    {
      id: 'preview-stu-1',
      name: 'Nafis Rahman',
      email: 'nafis.740101@mist.edu.bd',
      gender: 'Male',
      rollNumber: '740101',
      registrationNumber: '1502410011',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2026-2027',
      admissionYear: '2026',
      status: 'active',
    },
    {
      id: 'preview-stu-2',
      name: 'Sadia Afrin',
      email: 'sadia.740102@mist.edu.bd',
      gender: 'Female',
      rollNumber: '740102',
      registrationNumber: '1502410012',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2026-2027',
      admissionYear: '2026',
      status: 'active',
    },
    {
      id: 'preview-stu-3',
      name: 'Mahmudul Islam',
      email: 'mahmudul.740103@mist.edu.bd',
      gender: 'Male',
      rollNumber: '740103',
      registrationNumber: '1502410013',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2026-2027',
      admissionYear: '2026',
      status: 'active',
    },
    {
      id: 'preview-stu-4',
      name: 'Farhana Akter',
      email: 'farhana.740104@mist.edu.bd',
      gender: 'Female',
      rollNumber: '740104',
      registrationNumber: '1502410014',
      classId: 'class-cst-1',
      semester: '1st',
      session: '2026-2027',
      admissionYear: '2026',
      status: 'active',
    },
  ];

  const sessions: AttendanceSession[] = [
    {
      id: 'preview-ses-today',
      subjectId: 'bteb-21011',
      classId: 'class-cst-1',
      teacherId: teacherUser.id,
      part: 'theory',
      date: today,
      timeSlot: '09:00 AM - 09:45 AM',
      topic: 'Orthographic Projection Fundamentals',
      totalStudents: 4,
      presentCount: 2,
      absentCount: 1,
      lateCount: 1,
      excusedCount: 0,
      academicYear: '2026-2027',
      createdAt: `${today}T09:15:00.000Z`,
      isSubmitted: true,
    },
    {
      id: 'preview-ses-yesterday',
      subjectId: 'bteb-21011',
      classId: 'class-cst-1',
      teacherId: teacherUser.id,
      part: 'practical',
      date: yesterday,
      timeSlot: '11:00 AM - 12:30 PM',
      topic: 'Isometric Scale & Drawing Instruments Lab',
      totalStudents: 4,
      presentCount: 3,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 1,
      academicYear: '2026-2027',
      createdAt: `${yesterday}T11:30:00.000Z`,
      isSubmitted: true,
    },
  ];

  const records: AttendanceRecord[] = [
    {
      id: 'preview-ses-today_preview-stu-1',
      sessionId: 'preview-ses-today',
      studentId: 'preview-stu-1',
      status: 'present',
      markedAt: `${today}T09:15:00.000Z`,
    },
    {
      id: 'preview-ses-today_preview-stu-2',
      sessionId: 'preview-ses-today',
      studentId: 'preview-stu-2',
      status: 'present',
      markedAt: `${today}T09:15:00.000Z`,
    },
    {
      id: 'preview-ses-today_preview-stu-3',
      sessionId: 'preview-ses-today',
      studentId: 'preview-stu-3',
      status: 'absent',
      remarks: 'Uninformed absence',
      markedAt: `${today}T09:15:00.000Z`,
    },
    {
      id: 'preview-ses-today_preview-stu-4',
      sessionId: 'preview-ses-today',
      studentId: 'preview-stu-4',
      status: 'late',
      remarks: 'Arrived 10 mins late',
      markedAt: `${today}T09:15:00.000Z`,
    },
    {
      id: 'preview-ses-yesterday_preview-stu-1',
      sessionId: 'preview-ses-yesterday',
      studentId: 'preview-stu-1',
      status: 'present',
      markedAt: `${yesterday}T11:30:00.000Z`,
    },
    {
      id: 'preview-ses-yesterday_preview-stu-2',
      sessionId: 'preview-ses-yesterday',
      studentId: 'preview-stu-2',
      status: 'present',
      markedAt: `${yesterday}T11:30:00.000Z`,
    },
    {
      id: 'preview-ses-yesterday_preview-stu-3',
      sessionId: 'preview-ses-yesterday',
      studentId: 'preview-stu-3',
      status: 'present',
      markedAt: `${yesterday}T11:30:00.000Z`,
    },
    {
      id: 'preview-ses-yesterday_preview-stu-4',
      sessionId: 'preview-ses-yesterday',
      studentId: 'preview-stu-4',
      status: 'excused',
      remarks: 'Medical leave submitted',
      markedAt: `${yesterday}T11:30:00.000Z`,
    },
  ];

  return {
    currentUser: role === 'admin' ? adminUser : teacherUser,
    users,
    assignments,
    students,
    sessions,
    records,
  };
}

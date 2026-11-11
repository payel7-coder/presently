export type UserRole = 'admin' | 'teacher';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  employeeId: string;
  title?: string;
  dailyClassTarget?: number;
}

export interface ClassGroup {
  id: string;
  name: string;
  section: string; // e.g. "Shift-1 (Day)" or "Shift-2 (Morning)"
  department: string;
  semester: string; // e.g. "1st", "2nd", "3rd", ... "8th"
  academicYear: string;
  roomNumber: string;
  technology: string; // e.g. "Computer Science & Technology (85)"
}

export interface Subject {
  id: string;
  code: string; // e.g. "28542"
  name: string; // e.g. "Data Structure & Algorithm"
  description: string;
  color: string;
  classId: string;
  credits: number;
  semester: string; // "1st" through "8th"
  curriculum: string; // "BTEB Probidhan 2022"
  technology: string;
}

export interface SubjectAssignment {
  id: string;
  subjectId: string;
  teacherId: string;
  classId: string;
  academicYear: string;
  assignedAt: string;
}

export interface Student {
  id: string;
  rollNumber: string; // BTEB Board Roll / Class Roll (e.g. "621045", "CST-401")
  registrationNumber?: string; // BTEB Registration (e.g. "1502189401")
  name: string;
  email: string;
  gender: 'Male' | 'Female' | 'Other';
  classId: string;
  semester?: string;
  avatar?: string;
  phone?: string;
  parentContact?: string;
  parentEmail?: string;
  status: 'active' | 'inactive';
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
  markedAt: string;
}

export interface AttendanceSession {
  id: string;
  subjectId: string;
  classId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  timeSlot?: string; // Optional period label
  topic?: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  createdAt: string;
  isSubmitted: boolean;
}

export interface StudentAttendanceStats {
  studentId: string;
  studentName: string;
  rollNumber: string;
  registrationNumber?: string;
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
  currentStreak: number;
  isAtRisk: boolean;
  requiredForThreshold: number;
}

export interface CSVParseResult {
  students: Omit<Student, 'id'>[];
  errors: { line: number; message: string }[];
  totalParsed: number;
  validCount: number;
}

export type UserRole = 'admin' | 'teacher';

export type SubjectPart = 'theory' | 'practical';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type UserApprovalStatus = 'approved' | 'pending' | 'rejected';

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
  phone?: string;
  qualification?: string;
  specialization?: string;
  officeRoom?: string;
  officeHours?: string;
  joiningDate?: string;
  bloodGroup?: string;
  bio?: string;
  profileUpdatedAt?: string;
  approvalStatus?: UserApprovalStatus;
  registeredAt?: string;
  approvedAt?: string;
  approvedBy?: string;
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
  part: SubjectPart; // 'theory' | 'practical' — different teachers handle theory and practical
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
  guardianName?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
  session?: string;
  shift?: string;
  admissionYear?: string;
  presentAddress?: string;
  permanentAddress?: string;
  academicStanding?: string;
  remarks?: string;
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
  part?: SubjectPart; // 'theory' | 'practical'
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

export type AssignmentSubmissionStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'missing';

export interface CourseworkAssignment {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  classId: string;
  part: SubjectPart;
  teacherId: string;
  assignedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  maxMarks: number;
  createdAt: string;
}

export interface StudentAssignmentEvaluation {
  id: string;
  courseworkId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  part: SubjectPart;
  status: AssignmentSubmissionStatus;
  marksObtained?: number | null;
  submittedAt?: string;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
}

export type FormFillupResultStatus = 'regular' | 'regular_with_referred' | 'referred_only';

export type FormFillupPaymentStatus = 'pending' | 'verified' | 'paid' | 'submitted';

export interface FormFillupResponsibility {
  id: string;
  semester: string; // e.g. "1st" .. "8th"
  classId: string;
  teacherId: string;
  academicYear: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface FormFillupFeeConfig {
  id: string;
  semester: string;
  classId: string;
  examFee: number; // 1. flat per regular/promoted student
  referredExamFeePerSubject: number; // 2. per referred subject
  marksheetFeeRegular: number; // 3. flat regular marksheet fee
  marksheetFeeReferredPerSemester: number; // 4. per referred semester
  centerFeeRegular: number; // 5. flat regular center fee
  centerFeeReferredPerSemester: number; // 6. per referred semester
  practicalFeePerSubject: number; // 7. per practical subject
  questionFee: number; // 8. flat per student
  delayFee: number; // 9. late / delay fee when applicable
  updatedAt: string;
  updatedBy?: string;
}

export interface FormFillupStudentRecord {
  id: string;
  semester: string;
  classId: string;
  studentId: string;
  resultStatus: FormFillupResultStatus;
  referredSubjectsCount: number;
  referredSemestersCount: number;
  practicalSubjectsCount: number;
  applyDelayFee: boolean;
  resultSummaryNote?: string;
  calculatedAmountTk: number;
  paymentStatus: FormFillupPaymentStatus;
  updatedAt: string;
  updatedBy?: string;
}

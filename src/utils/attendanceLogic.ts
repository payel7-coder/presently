import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  ClassGroup,
  CSVParseResult,
  Student,
  StudentAttendanceStats,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
  UserApprovalStatus,
  UserRole,
} from '../types/attendance';
import { normalizeStudentSessionFields } from './studentSessionLogic';

/**
 * Parses raw CSV string into student records with line-by-line validation.
 */
export function parseStudentCSV(csvContent: string, targetClassId: string): CSVParseResult {
  const result: CSVParseResult = {
    students: [],
    errors: [],
    totalParsed: 0,
    validCount: 0,
  };

  if (!csvContent || !csvContent.trim()) {
    result.errors.push({ line: 1, message: 'CSV file is empty' });
    return result;
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length < 2) {
    result.errors.push({ line: 1, message: 'CSV must contain a header row and at least one student row' });
    return result;
  }

  // Parse header
  const headerTokens = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/['"]/g, ''));
  
  // Find column indices with exact priority so Father/Mother Name and Guardian Phone don't collide with Name/Phone
  const findExactOrFiltered = (exactList: string[], predicate: (h: string) => boolean) => {
    const exactIdx = headerTokens.findIndex(h => exactList.includes(h));
    if (exactIdx !== -1) return exactIdx;
    return headerTokens.findIndex(predicate);
  };

  const nameIndex = findExactOrFiltered(
    ['name', 'student name', 'student_name', 'full name', 'full_name'],
    h =>
      h.includes('name') &&
      !h.includes('father') &&
      !h.includes('mother') &&
      !h.includes('guardian') &&
      !h.includes('parent')
  );
  const rollIndex = findExactOrFiltered(
    ['roll number', 'roll no', 'roll', 'board roll', 'class roll', 'roll_number'],
    h => h.includes('roll') || (h.includes('id') && !h.includes('guid'))
  );
  const regIndex = headerTokens.findIndex(h => h.includes('reg'));
  const emailIndex = findExactOrFiltered(
    ['student email', 'student_email', 'email', 'email address'],
    h =>
      h.includes('email') &&
      !h.includes('parent') &&
      !h.includes('guardian') &&
      !h.includes('father') &&
      !h.includes('mother')
  );
  const genderIndex = headerTokens.findIndex(h => h.includes('gender') || h.includes('sex'));
  const dobIndex = findExactOrFiltered(
    ['date of birth', 'date_of_birth', 'dob', 'birth date', 'birthdate'],
    h => h === 'dob' || h.includes('date of birth') || h.includes('date_of_birth') || h.includes('birth')
  );
  const fatherNameIndex = findExactOrFiltered(
    ['father name', 'father_name', "father's name"],
    h => h.includes('father')
  );
  const motherNameIndex = findExactOrFiltered(
    ['mother name', 'mother_name', "mother's name"],
    h => h.includes('mother')
  );
  const phoneIndex = findExactOrFiltered(
    ['phone', 'student phone', 'mobile', 'student mobile'],
    h =>
      (h.includes('phone') || h.includes('mobile') || h.includes('contact')) &&
      !h.includes('guardian') &&
      !h.includes('parent') &&
      !h.includes('father') &&
      !h.includes('mother')
  );
  const guardianPhoneIndex = findExactOrFiltered(
    ['guardian phone', 'guardian_phone', 'guardian mobile', 'guardian contact', 'parent phone', 'parent contact'],
    h =>
      (h.includes('guardian') || h.includes('parent')) &&
      (h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('number'))
  );
  const sessionIndex = findExactOrFiltered(
    ['session', 'academic session', 'academic_session', 'admission session', 'admission_session'],
    h => h === 'session' || h.includes('academic session') || h.includes('admission session')
  );
  const admissionYearIndex = findExactOrFiltered(
    ['admission year', 'admission_year', 'adm year', 'adm_year', 'intake year'],
    h => h.includes('admission') && h.includes('year')
  );

  if (nameIndex === -1) {
    result.errors.push({ line: 1, message: 'Missing required "Name" column in CSV header' });
  }
  if (rollIndex === -1) {
    result.errors.push({ line: 1, message: 'Missing required "Roll Number" column in CSV header' });
  }

  if (result.errors.length > 0) {
    return result;
  }

  const seenRollNumbers = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1;
    const tokens = parseCSVLine(lines[i]);
    result.totalParsed++;

    const name = (tokens[nameIndex] || '').trim();
    const rollNumber = (tokens[rollIndex] || '').trim();
    const registrationNumber = regIndex !== -1 ? (tokens[regIndex] || '').trim() : undefined;
    const email = emailIndex !== -1 ? (tokens[emailIndex] || '').trim() : '';
    const rawGender = genderIndex !== -1 ? (tokens[genderIndex] || '').trim().toLowerCase() : '';
    const dateOfBirth = dobIndex !== -1 ? (tokens[dobIndex] || '').trim() : '';
    const fatherName = fatherNameIndex !== -1 ? (tokens[fatherNameIndex] || '').trim() : '';
    const motherName = motherNameIndex !== -1 ? (tokens[motherNameIndex] || '').trim() : '';
    const phone = phoneIndex !== -1 ? (tokens[phoneIndex] || '').trim() : '';
    const guardianPhone = guardianPhoneIndex !== -1 ? (tokens[guardianPhoneIndex] || '').trim() : '';
    const rawSession = sessionIndex !== -1 ? (tokens[sessionIndex] || '').trim() : '';
    const rawAdmissionYear = admissionYearIndex !== -1 ? (tokens[admissionYearIndex] || '').trim() : '';

    if (!name) {
      result.errors.push({ line: lineNumber, message: 'Student Name is empty' });
      continue;
    }

    if (!rollNumber) {
      result.errors.push({ line: lineNumber, message: `Student "${name}" is missing a Roll Number` });
      continue;
    }

    if (seenRollNumbers.has(rollNumber.toLowerCase())) {
      result.errors.push({ line: lineNumber, message: `Duplicate Roll Number "${rollNumber}" found in CSV` });
      continue;
    }
    seenRollNumbers.add(rollNumber.toLowerCase());

    // Basic email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.errors.push({ line: lineNumber, message: `Invalid student email format "${email}" for student ${name}` });
      continue;
    }

    let gender: 'Male' | 'Female' | 'Other' = 'Other';
    if (rawGender.startsWith('m')) {
      gender = 'Male';
    } else if (rawGender.startsWith('f')) {
      gender = 'Female';
    }

    const { session, admissionYear } = normalizeStudentSessionFields({
      session: rawSession,
      admissionYear: rawAdmissionYear,
    });

    result.students.push({
      rollNumber,
      registrationNumber: registrationNumber || undefined,
      name,
      email: email || `${rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.bteb.edu.bd`,
      gender,
      classId: targetClassId,
      dateOfBirth: dateOfBirth || undefined,
      fatherName: fatherName || undefined,
      motherName: motherName || undefined,
      phone: phone || undefined,
      parentContact: guardianPhone || undefined,
      session,
      admissionYear,
      status: 'active',
    });
    result.validCount++;
  }

  return result;
}

/**
 * Splits a CSV line respecting standard double-quoted commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cleanFieldValue(current));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(cleanFieldValue(current));
  return result;
}

function cleanFieldValue(val: string): string {
  let trimmed = val.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Generates sample CSV template for teachers/admins to download.
 */
export function generateStudentCSVTemplate(): string {
  return [
    'Roll Number,Registration Number,Name,Student Email,Gender,Date of Birth,Father Name,Mother Name,Phone,Guardian Phone,Session,Admission Year',
    '621051,1502189407,Naimur Rahman,naimur.621051@student.bteb.edu.bd,Male,2005-03-14,Md. Shafiqur Rahman,Salma Begum,+880 1711-234567,+880 1811-234567,2024-25,2024',
    '621052,1502189408,Jannatul Ferdous,jannatul.621052@student.bteb.edu.bd,Female,2005-07-22,Abdul Karim,Nasrin Akter,+880 1711-234568,+880 1811-234568,2024-25,2024',
    '621053,1502189409,Sabbir Ahmed,sabbir.621053@student.bteb.edu.bd,Male,2004-11-08,Mahbubur Rahman,Rokeya Sultana,+880 1711-234569,+880 1811-234569,2023-24,2023',
    '621054,1502189410,Sumaiya Islam,sumaiya.621054@student.bteb.edu.bd,Female,2005-01-19,Kamrul Islam,Tahmina Khatun,+880 1711-234570,+880 1811-234570,2024-25,2024',
  ].join('\n');
}

/**
 * Calculates individual student attendance metrics, streak, and at-risk status.
 */
export function calculateStudentAttendanceStats(
  student: Student,
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  minThreshold: number = 75
): StudentAttendanceStats {
  const sessionMap = new Map<string, AttendanceSession>();
  sessions.forEach(s => sessionMap.set(s.id, s));

  // Find all records for this student in the relevant sessions
  const studentRecords = records.filter(r => r.studentId === student.id && sessionMap.has(r.sessionId));
  const totalSessions = studentRecords.length;

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  studentRecords.forEach(r => {
    switch (r.status) {
      case 'present':
        present++;
        break;
      case 'absent':
        absent++;
        break;
      case 'late':
        late++;
        break;
      case 'excused':
        excused++;
        break;
    }
  });

  // Educational standard: Present + Late (counted as 0.75 attended) or excused not penalized
  // Percentage = ((present + late * 0.75 + excused * 1.0) / totalSessions) * 100
  // If no sessions, return 100%
  const effectiveAttended = present + late * 0.75 + excused * 1.0;
  const attendancePercentage = totalSessions > 0
    ? Math.min(100, Math.round((effectiveAttended / totalSessions) * 1000) / 10)
    : 100;

  // Calculate current streak (sort sessions descending by date)
  const sortedRecords = [...studentRecords].sort((a, b) => {
    const sA = sessionMap.get(a.sessionId)?.date || '';
    const sB = sessionMap.get(b.sessionId)?.date || '';
    return sB.localeCompare(sA);
  });

  let currentStreak = 0;
  for (const r of sortedRecords) {
    if (r.status === 'present' || r.status === 'excused') {
      currentStreak++;
    } else {
      break;
    }
  }

  const isAtRisk = totalSessions >= 3 && attendancePercentage < minThreshold;

  // Calculate how many consecutive present sessions needed to reach minThreshold
  // (effectiveAttended + X) / (totalSessions + X) >= minThreshold / 100
  let requiredForThreshold = 0;
  if (isAtRisk) {
    const target = minThreshold / 100;
    const numerator = target * totalSessions - effectiveAttended;
    const denominator = 1 - target;
    requiredForThreshold = Math.max(0, Math.ceil(numerator / denominator));
  }

  return {
    studentId: student.id,
    studentName: student.name,
    rollNumber: student.rollNumber,
    totalSessions,
    present,
    absent,
    late,
    excused,
    attendancePercentage,
    currentStreak,
    isAtRisk,
    requiredForThreshold,
  };
}

/**
 * Calculates aggregate stats for a list of sessions.
 */
export function calculateSessionSummary(sessions: AttendanceSession[]) {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      averageAttendanceRate: 0,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalExcused: 0,
    };
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalExcused = 0;
  let totalPossible = 0;

  sessions.forEach(s => {
    totalPresent += s.presentCount;
    totalAbsent += s.absentCount;
    totalLate += s.lateCount;
    totalExcused += s.excusedCount;
    totalPossible += s.totalStudents;
  });

  const effectivePresent = totalPresent + totalLate * 0.75 + totalExcused;
  const averageAttendanceRate = totalPossible > 0
    ? Math.round((effectivePresent / totalPossible) * 1000) / 10
    : 0;

  return {
    totalSessions: sessions.length,
    averageAttendanceRate,
    totalPresent,
    totalAbsent,
    totalLate,
    totalExcused,
  };
}

/**
 * Exports complete attendance matrix to a structured CSV format.
 */
/**
 * Validates that an attendance date is not in the future (tomorrow or beyond).
 * Under institutional policy, attendance cannot be taken for future dates.
 */
export function isValidAttendanceDate(dateString: string): { isValid: boolean; error?: string } {
  if (!dateString) {
    return { isValid: false, error: 'Session date is required.' };
  }
  const today = new Date().toISOString().split('T')[0];
  if (dateString > today) {
    return {
      isValid: false,
      error: `Attendance cannot be taken for tomorrow or future dates (${dateString}). Please select today (${today}) or a previous class date.`,
    };
  }
  return { isValid: true };
}

export function exportAttendanceToCSV(
  sessions: AttendanceSession[],
  students: Student[],
  records: AttendanceRecord[],
  subjectName: string,
  className: string
): string {
  // Sort sessions chronologically
  const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  
  // Header row
  const sessionHeaders = sortedSessions.map(s => s.timeSlot ? `"${s.date} (${s.timeSlot})"` : `"${s.date}"`);
  const headers = ['Roll No', 'Student Name', 'Email', ...sessionHeaders, 'Total Present', 'Total Absent', 'Total Late', 'Attendance %', 'Status'];

  // Map of studentId -> sessionId -> record
  const recordMap = new Map<string, Map<string, AttendanceRecord>>();
  records.forEach(r => {
    if (!recordMap.has(r.studentId)) {
      recordMap.set(r.studentId, new Map());
    }
    recordMap.get(r.studentId)!.set(r.sessionId, r);
  });

  const rows: string[] = [];
  rows.push(`# Attendance Report: ${subjectName} - ${className}`);
  rows.push(`# Generated At: ${new Date().toISOString()}`);
  rows.push(`# Total Sessions: ${sortedSessions.length} | Total Students: ${students.length}`);
  rows.push(headers.join(','));

  students.forEach(student => {
    const studentRecords = recordMap.get(student.id) || new Map();
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    const sessionValues = sortedSessions.map(s => {
      const rec = studentRecords.get(s.id);
      if (!rec) return 'N/A';
      switch (rec.status) {
        case 'present':
          present++;
          return 'Present';
        case 'absent':
          absent++;
          return 'Absent';
        case 'late':
          late++;
          return 'Late';
        case 'excused':
          excused++;
          return 'Excused';
        default:
          return 'N/A';
      }
    });

    const totalSessions = present + absent + late + excused;
    const effectiveAttended = present + late * 0.75 + excused;
    const pct = totalSessions > 0 ? ((effectiveAttended / totalSessions) * 100).toFixed(1) : '100.0';
    const riskStatus = parseFloat(pct) < 75 ? 'AT RISK (<75%)' : 'Good Standing';

    const row = [
      `"${student.rollNumber}"`,
      `"${student.name}"`,
      `"${student.email}"`,
      ...sessionValues.map(v => `"${v}"`),
      present,
      absent,
      late,
      `"${pct}%"`,
      `"${riskStatus}"`,
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

export interface DailyClassTargetProgress {
  target: number;
  conductedCount: number;
  percentage: number;
  remaining: number;
  isCompleted: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'exceeded';
  conductedSessions: AttendanceSession[];
}

/**
 * Calculates a teacher's daily class progress towards their configured target.
 *
 * @param target The target number of classes to conduct per day (min 1).
 * @param sessions All attendance sessions in the system.
 * @param teacherId The ID of the teacher.
 * @param date The session date to evaluate (defaults to today YYYY-MM-DD).
 */
export function calculateDailyClassTargetProgress(
  target: number,
  sessions: AttendanceSession[],
  teacherId: string,
  date: string = new Date().toISOString().split('T')[0]
): DailyClassTargetProgress {
  const safeTarget = Math.max(1, Math.round(Number(target) || 1));

  // Filter sessions conducted by this teacher on the given date that are submitted
  const conductedSessions = sessions.filter(
    s => s.teacherId === teacherId && s.date === date && s.isSubmitted
  );

  const conductedCount = conductedSessions.length;
  const percentage = Math.min(100, Math.round((conductedCount / safeTarget) * 100));
  const remaining = Math.max(0, safeTarget - conductedCount);
  const isCompleted = conductedCount >= safeTarget;

  let status: 'not_started' | 'in_progress' | 'completed' | 'exceeded' = 'not_started';
  if (conductedCount === 0) {
    status = 'not_started';
  } else if (conductedCount < safeTarget) {
    status = 'in_progress';
  } else if (conductedCount === safeTarget) {
    status = 'completed';
  } else {
    status = 'exceeded';
  }

  return {
    target: safeTarget,
    conductedCount,
    percentage,
    remaining,
    isCompleted,
    status,
    conductedSessions,
  };
}

/**
 * Validates a Theory or Practical assignment payload.
 * Theory and Practical are separate parts of each subject; they can be taught
 * either by different teachers or by the same teacher independently.
 */
export function validateSubjectPartAssignment(
  _assignments: SubjectAssignment[],
  subjectId: string,
  classId: string,
  part: SubjectPart,
  teacherId: string
): { valid: boolean; error?: string } {
  if (!subjectId || !classId || !teacherId) {
    return { valid: false, error: 'Teacher, course, and class group are all required.' };
  }

  if (part !== 'theory' && part !== 'practical') {
    return { valid: false, error: 'Subject part must be either Theory or Practical.' };
  }

  return { valid: true };
}

export interface WeeklyStudentAttendancePoint {
  studentId: string;
  rollNumber: string;
  studentName: string;
  shortLabel: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalSessions: number;
  attendancePercentage: number;
  isAtRisk: boolean;
}

export interface WeeklyAttendanceSummary {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  totalWeekSessions: number;
  weeklyAveragePercentage: number;
  studentsWithSessions: number;
  studentPoints: WeeklyStudentAttendancePoint[];
}

function toUTCDateOnly(input?: Date | string): Date {
  if (!input) {
    const iso = new Date().toISOString().split('T')[0];
    return new Date(`${iso}T00:00:00Z`);
  }
  if (typeof input === 'string') {
    const clean = input.split('T')[0];
    return new Date(`${clean}T00:00:00Z`);
  }
  const iso = input.toISOString().split('T')[0];
  return new Date(`${iso}T00:00:00Z`);
}

function formatUTCDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatShortMonthDay(date: Date, includeYear: boolean): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const base = `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return includeYear ? `${base}, ${date.getUTCFullYear()}` : base;
}

/**
 * Computes Sunday–Saturday calendar bounds (YYYY-MM-DD) for the week containing referenceDate.
 */
export function getCurrentWeekBounds(referenceDate?: Date | string): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const ref = toUTCDateOnly(referenceDate);
  const dayOfWeek = ref.getUTCDay(); // 0 = Sun, 6 = Sat

  const start = new Date(ref);
  start.setUTCDate(ref.getUTCDate() - dayOfWeek);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const label = `${formatShortMonthDay(start, !sameYear)} – ${formatShortMonthDay(end, true)}`;

  return {
    startDate: formatUTCDateString(start),
    endDate: formatUTCDateString(end),
    label,
  };
}

/**
 * Calculates average attendance percentage per student for the current week.
 */
export function calculateWeeklyStudentAttendanceSummary(
  students: Student[],
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  referenceDate?: Date | string,
  minThreshold: number = 75
): WeeklyAttendanceSummary {
  const { startDate, endDate, label } = getCurrentWeekBounds(referenceDate);

  const weekSessions = sessions.filter(
    s => s.date >= startDate && s.date <= endDate
  );
  const weekSessionIds = new Set(weekSessions.map(s => s.id));

  const studentPoints: WeeklyStudentAttendancePoint[] = [];

  if (weekSessionIds.size > 0) {
    students.forEach(student => {
      const studentWeekRecords = records.filter(
        r => r.studentId === student.id && weekSessionIds.has(r.sessionId)
      );
      const totalSessions = studentWeekRecords.length;
      if (totalSessions === 0) return;

      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      studentWeekRecords.forEach(r => {
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;
        else if (r.status === 'excused') excused++;
      });

      const effectiveAttended = present + late * 0.75 + excused;
      const attendancePercentage = Math.min(
        100,
        Math.round((effectiveAttended / totalSessions) * 1000) / 10
      );

      const firstName = student.name.trim().split(/\s+/)[0] || student.name;
      const shortLabel = `${firstName} (${student.rollNumber})`;

      studentPoints.push({
        studentId: student.id,
        rollNumber: student.rollNumber,
        studentName: student.name,
        shortLabel,
        present,
        absent,
        late,
        excused,
        totalSessions,
        attendancePercentage,
        isAtRisk: attendancePercentage < minThreshold,
      });
    });

    studentPoints.sort((a, b) =>
      a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
    );
  }

  const weeklyAveragePercentage =
    studentPoints.length > 0
      ? Math.round(
          (studentPoints.reduce((sum, p) => sum + p.attendancePercentage, 0) /
            studentPoints.length) *
            10
        ) / 10
      : 0;

  return {
    weekStart: startDate,
    weekEnd: endDate,
    weekLabel: label,
    totalWeekSessions: weekSessions.length,
    weeklyAveragePercentage,
    studentsWithSessions: studentPoints.length,
    studentPoints,
  };
}

export interface RoleVisibilityScope {
  visibleSubjects: Subject[];
  visibleClasses: ClassGroup[];
  visibleAssignments: SubjectAssignment[];
  visibleSessions: AttendanceSession[];
  visibleStudents: Student[];
  assignedPartKeys: Set<string>;
}

/**
 * Computes role-based visibility scope:
 * - Admin sees all subjects, classes, assignments, sessions, and students.
 * - Teacher sees only their assigned subjects, corresponding classes, and sessions matching their assigned (subjectId, part).
 */
export function getRoleBasedVisibilityScope(params: {
  currentUser: User | null;
  subjects: Subject[];
  classes: ClassGroup[];
  assignments: SubjectAssignment[];
  sessions: AttendanceSession[];
  students: Student[];
}): RoleVisibilityScope {
  const { currentUser, subjects, classes, assignments, sessions, students } = params;

  if (!currentUser) {
    return {
      visibleSubjects: [],
      visibleClasses: [],
      visibleAssignments: [],
      visibleSessions: [],
      visibleStudents: [],
      assignedPartKeys: new Set<string>(),
    };
  }

  if (currentUser.role === 'admin') {
    const allPartKeys = new Set<string>();
    assignments.forEach(a => {
      allPartKeys.add(`${a.subjectId}::${a.part || 'theory'}`);
    });
    return {
      visibleSubjects: subjects,
      visibleClasses: classes,
      visibleAssignments: assignments,
      visibleSessions: sessions,
      visibleStudents: students,
      assignedPartKeys: allPartKeys,
    };
  }

  // Teacher role: strictly scoped to assignments for this teacher
  const teacherAssignments = assignments.filter(a => a.teacherId === currentUser.id);
  const assignedSubjectIds = new Set(teacherAssignments.map(a => a.subjectId));
  const assignedClassIds = new Set(teacherAssignments.map(a => a.classId));
  const assignedPartKeys = new Set(
    teacherAssignments.map(a => `${a.subjectId}::${a.part || 'theory'}`)
  );

  return {
    visibleSubjects: subjects.filter(s => assignedSubjectIds.has(s.id)),
    visibleClasses: classes.filter(c => assignedClassIds.has(c.id)),
    visibleAssignments: teacherAssignments,
    visibleSessions: sessions.filter(s =>
      assignedPartKeys.has(`${s.subjectId}::${s.part || 'theory'}`)
    ),
    visibleStudents: students.filter(stu => assignedClassIds.has(stu.classId)),
    assignedPartKeys,
  };
}

export interface AbsentListFilterOptions {
  subjectId?: string; // 'all' or specific subject ID
  part?: 'all' | SubjectPart;
  classId?: string; // 'all' or specific class ID
  date?: string; // Exact YYYY-MM-DD match
  startDate?: string; // Inclusive start YYYY-MM-DD
  endDate?: string; // Inclusive end YYYY-MM-DD
}

export interface AbsentStudentEntry {
  recordId: string;
  sessionId: string;
  date: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  part: SubjectPart;
  classId: string;
  className: string;
  classSection: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  rollNumber: string;
  registrationNumber: string;
  studentName: string;
  studentEmail: string;
  parentContact: string;
  remarks: string;
  topic: string;
}

export interface AbsentSessionSummary {
  sessionId: string;
  date: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  part: SubjectPart;
  className: string;
  teacherName: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
}

export interface SubjectDateAbsentListResult {
  entries: AbsentStudentEntry[];
  sessionSummaries: AbsentSessionSummary[];
  totalMatchingSessions: number;
  sessionsWithAbsences: number;
  totalAbsentMarks: number;
  uniqueAbsentStudents: number;
  dateScopeLabel: string;
}

/**
 * Builds a structured subject-wise and date-wise list of absent students
 * from attendance sessions and records.
 */
export function buildSubjectDateAbsentList(params: {
  subjects: Subject[];
  classes: ClassGroup[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  teachers?: User[];
  filters?: AbsentListFilterOptions;
}): SubjectDateAbsentListResult {
  const {
    subjects,
    classes,
    students,
    sessions,
    records,
    teachers = [],
    filters = {},
  } = params;

  const {
    subjectId = 'all',
    part = 'all',
    classId = 'all',
    date,
    startDate,
    endDate,
  } = filters;

  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const classMap = new Map(classes.map(c => [c.id, c]));
  const studentMap = new Map(students.map(stu => [stu.id, stu]));
  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  const matchingSessions = sessions
    .filter(sess => {
      const sessPart: SubjectPart = sess.part || 'theory';
      if (subjectId !== 'all' && sess.subjectId !== subjectId) return false;
      if (part !== 'all' && sessPart !== part) return false;
      if (classId !== 'all' && sess.classId !== classId) return false;
      if (date) {
        if (sess.date !== date) return false;
      } else {
        if (startDate && sess.date < startDate) return false;
        if (endDate && sess.date > endDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      const subA = subjectMap.get(a.subjectId)?.code || '';
      const subB = subjectMap.get(b.subjectId)?.code || '';
      const subCmp = subA.localeCompare(subB);
      if (subCmp !== 0) return subCmp;
      const partA = a.part || 'theory';
      const partB = b.part || 'theory';
      return partA.localeCompare(partB);
    });

  const entries: AbsentStudentEntry[] = [];
  const sessionSummaries: AbsentSessionSummary[] = [];
  const uniqueAbsentIds = new Set<string>();
  let sessionsWithAbsences = 0;

  matchingSessions.forEach(sess => {
    const sub = subjectMap.get(sess.subjectId);
    const cls = classMap.get(sess.classId);
    const tch = teacherMap.get(sess.teacherId);
    const sessPart: SubjectPart = sess.part || 'theory';

    const absentRecords = records.filter(
      r => r.sessionId === sess.id && r.status === 'absent'
    );

    const sessionAbsentEntries: AbsentStudentEntry[] = [];

    absentRecords.forEach(rec => {
      const stu = studentMap.get(rec.studentId);
      if (!stu) return;

      uniqueAbsentIds.add(stu.id);
      sessionAbsentEntries.push({
        recordId: rec.id,
        sessionId: sess.id,
        date: sess.date,
        subjectId: sess.subjectId,
        subjectCode: sub?.code || 'N/A',
        subjectName: sub?.name || 'Unknown Course',
        part: sessPart,
        classId: sess.classId,
        className: cls?.name || 'Unknown Class',
        classSection: cls?.section || '',
        teacherId: sess.teacherId,
        teacherName: tch?.name || 'Faculty',
        studentId: stu.id,
        rollNumber: stu.rollNumber,
        registrationNumber: stu.registrationNumber || '-',
        studentName: stu.name,
        studentEmail: stu.email,
        parentContact: stu.parentContact || stu.phone || stu.parentEmail || '-',
        remarks: rec.remarks || '',
        topic: sess.topic || '',
      });
    });

    sessionAbsentEntries.sort((a, b) =>
      a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
    );

    if (sessionAbsentEntries.length > 0) {
      sessionsWithAbsences++;
    }

    entries.push(...sessionAbsentEntries);

    sessionSummaries.push({
      sessionId: sess.id,
      date: sess.date,
      subjectId: sess.subjectId,
      subjectCode: sub?.code || 'N/A',
      subjectName: sub?.name || 'Unknown Course',
      part: sessPart,
      className: cls?.name || 'Unknown Class',
      teacherName: tch?.name || 'Faculty',
      totalStudents: sess.totalStudents,
      presentCount: sess.presentCount,
      absentCount: sessionAbsentEntries.length > 0 ? sessionAbsentEntries.length : sess.absentCount,
      lateCount: sess.lateCount,
      excusedCount: sess.excusedCount,
    });
  });

  let dateScopeLabel = 'All Recorded Dates';
  if (date) {
    dateScopeLabel = date;
  } else if (startDate && endDate) {
    dateScopeLabel = `${startDate} to ${endDate}`;
  } else if (startDate) {
    dateScopeLabel = `From ${startDate}`;
  } else if (endDate) {
    dateScopeLabel = `Up to ${endDate}`;
  }

  return {
    entries,
    sessionSummaries,
    totalMatchingSessions: matchingSessions.length,
    sessionsWithAbsences,
    totalAbsentMarks: entries.length,
    uniqueAbsentStudents: uniqueAbsentIds.size,
    dateScopeLabel,
  };
}

export const PRIMARY_ADMIN_EMAIL = 'payelahmed70@gmail.com';
export const ROOT_USER_EMAIL = PRIMARY_ADMIN_EMAIL;

export function isPrimaryAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL);
}

/**
 * Returns true strictly for the single system Root User account.
 */
export function isRootUser(user?: Pick<User, 'email'> | null): boolean {
  return isPrimaryAdminEmail(user?.email);
}

/**
 * Resolves the role assigned during self-registration.
 * Only the single Root User receives 'admin' upon initial account creation;
 * all self-registered accounts are unconditionally created as 'teacher'.
 */
export function resolveRegistrationRole(email?: string | null): UserRole {
  return isPrimaryAdminEmail(email) ? 'admin' : 'teacher';
}

/**
 * Only the single Root User may promote a user to Administrator or revoke Administrator privileges.
 */
export function canManageAdminRoles(actor?: Pick<User, 'email' | 'role'> | null): boolean {
  return isRootUser(actor);
}

export interface RoleChangeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates whether an actor is permitted to change a target user's role ('admin' <-> 'teacher').
 */
export function validateUserRoleChange(params: {
  actor?: Pick<User, 'id' | 'email' | 'role'> | null;
  targetUser?: Pick<User, 'id' | 'email' | 'role' | 'approvalStatus'> | null;
  nextRole: UserRole;
}): RoleChangeValidationResult {
  const { actor, targetUser, nextRole } = params;

  if (!actor || !isRootUser(actor)) {
    return {
      valid: false,
      error: 'Access Denied: Only the Root User can grant or revoke Administrator access.',
    };
  }

  if (!targetUser) {
    return {
      valid: false,
      error: 'Target user profile could not be found.',
    };
  }

  if (isRootUser(targetUser) && nextRole !== 'admin') {
    return {
      valid: false,
      error: 'The Root User account has permanent Administrator privileges and cannot be demoted.',
    };
  }

  if (resolveUserApprovalStatus(targetUser) === 'rejected') {
    return {
      valid: false,
      error: 'Declined accounts must be approved before Administrator privileges can be granted.',
    };
  }

  return { valid: true };
}

/**
 * Resolves the effective approval status of a user account.
 * - Primary institutional admin (Root User) is always approved.
 * - Legacy user profiles created before admin-approval tracking (undefined approvalStatus) default to 'approved'.
 */
export function resolveUserApprovalStatus(
  user?: Pick<User, 'email' | 'approvalStatus'> | null
): UserApprovalStatus {
  if (!user) return 'pending';
  if (isPrimaryAdminEmail(user.email)) return 'approved';
  if (
    user.approvalStatus === 'pending' ||
    user.approvalStatus === 'rejected' ||
    user.approvalStatus === 'approved'
  ) {
    return user.approvalStatus;
  }
  return 'approved';
}

export interface LoginAccessEvaluation {
  allowed: boolean;
  status: UserApprovalStatus;
  reason?: string;
}

/**
 * Evaluates whether a matched user account may sign into the application workspace.
 */
export function evaluateLoginAccess(
  user?: Pick<User, 'email' | 'approvalStatus'> | null
): LoginAccessEvaluation {
  if (!user) {
    return {
      allowed: false,
      status: 'pending',
      reason: 'No approved account found for this email. Please register and wait for administrator approval.',
    };
  }

  const status = resolveUserApprovalStatus(user);
  if (status === 'pending') {
    return {
      allowed: false,
      status: 'pending',
      reason: 'Your registration is pending administrator approval. Please wait until an administrator approves your account before signing in.',
    };
  }
  if (status === 'rejected') {
    return {
      allowed: false,
      status: 'rejected',
      reason: 'Your registration request was declined by the administrator. Please contact your department office for assistance.',
    };
  }

  return {
    allowed: true,
    status: 'approved',
  };
}

function deduplicateUsersByEmail(users: User[]): User[] {
  const byEmail = new Map<string, User>();
  const scoreUser = (u: User): number => {
    let score = 0;
    if (u.firebaseAuthUid) score += 4;
    if (u.role === 'admin') score += 2;
    if (u.roleUpdatedAt || u.approvedAt) score += 1;
    return score;
  };

  users.forEach(u => {
    const key = (u.email || u.id).trim().toLowerCase();
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, u);
      return;
    }
    const existingScore = scoreUser(existing);
    const nextScore = scoreUser(u);
    if (
      nextScore > existingScore ||
      (nextScore === existingScore &&
        (u.roleUpdatedAt || u.approvedAt || u.registeredAt || '') >
          (existing.roleUpdatedAt || existing.approvedAt || existing.registeredAt || ''))
    ) {
      byEmail.set(key, u);
    }
  });

  return Array.from(byEmail.values());
}

/**
 * Returns self-registered accounts awaiting administrator approval (newest first).
 */
export function getPendingUsers(users: User[]): User[] {
  return deduplicateUsersByEmail(users)
    .filter(u => resolveUserApprovalStatus(u) === 'pending')
    .sort((a, b) => (b.registeredAt || '').localeCompare(a.registeredAt || ''));
}

/**
 * Returns only approved teachers eligible for subject assignments and roster display.
 */
export function getApprovedTeachers(users: User[]): User[] {
  return deduplicateUsersByEmail(users).filter(
    u => u.role === 'teacher' && resolveUserApprovalStatus(u) === 'approved'
  );
}

/**
 * Returns approved directory users sorted with Root User first, then Administrators, then Teachers.
 */
export function getDirectoryUsersSorted(users: User[]): User[] {
  return deduplicateUsersByEmail(users)
    .filter(u => resolveUserApprovalStatus(u) === 'approved')
    .sort((a, b) => {
      const aRoot = isRootUser(a) ? 0 : a.role === 'admin' ? 1 : 2;
      const bRoot = isRootUser(b) ? 0 : b.role === 'admin' ? 1 : 2;
      if (aRoot !== bRoot) return aRoot - bRoot;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
}

export interface RollCallDraftEntry {
  status?: AttendanceStatus;
  remarks?: string;
}

export interface ResolvedRollCallResult {
  resolvedStatuses: Record<string, { status: AttendanceStatus; remarks?: string }>;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalStudents: number;
}

/**
 * Builds the initial roll-call map for taking attendance.
 * New sessions start with no status marked (neither P nor A),
 * while existing sessions preserve saved records and leave newly added students unmarked.
 */
export function buildInitialRollCallDraft(
  classStudents: Student[],
  existingRecords: AttendanceRecord[] = []
): Record<string, RollCallDraftEntry> {
  const recordByStudent = new Map(existingRecords.map(r => [r.studentId, r]));
  const draft: Record<string, RollCallDraftEntry> = {};

  classStudents.forEach(stu => {
    const found = recordByStudent.get(stu.id);
    if (found) {
      draft[stu.id] = {
        status: found.status,
        ...(found.remarks ? { remarks: found.remarks } : {}),
      };
    } else {
      draft[stu.id] = {};
    }
  });

  return draft;
}

/**
 * Resolves a roll-call draft before saving attendance:
 * Any student whose status is unmarked (undefined or omitted) counts as 'absent'.
 */
export function resolveRollCallForSave(
  classStudents: Student[],
  draftStatuses: Record<string, RollCallDraftEntry>
): ResolvedRollCallResult {
  const resolvedStatuses: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  const targetIds =
    classStudents.length > 0
      ? classStudents.map(s => s.id)
      : Object.keys(draftStatuses);

  targetIds.forEach(studentId => {
    const entry = draftStatuses[studentId];
    const resolvedStatus: AttendanceStatus = entry?.status ?? 'absent';

    if (resolvedStatus === 'present') presentCount++;
    else if (resolvedStatus === 'absent') absentCount++;
    else if (resolvedStatus === 'late') lateCount++;
    else if (resolvedStatus === 'excused') excusedCount++;

    resolvedStatuses[studentId] = {
      status: resolvedStatus,
      ...(entry?.remarks ? { remarks: entry.remarks } : {}),
    };
  });

  return {
    resolvedStatuses,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    totalStudents: targetIds.length,
  };
}





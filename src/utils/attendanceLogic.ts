import { AttendanceRecord, AttendanceSession, CSVParseResult, Student, StudentAttendanceStats, SubjectAssignment, SubjectPart } from '../types/attendance';

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
  
  // Find column indices with fuzzy matching
  const nameIndex = headerTokens.findIndex(h => h.includes('name'));
  const rollIndex = headerTokens.findIndex(h => h.includes('roll') || (h.includes('id') && !h.includes('guid')) || h.includes('registration'));
  const regIndex = headerTokens.findIndex(h => h.includes('reg'));
  const emailIndex = headerTokens.findIndex(h => h.includes('email') && !h.includes('parent'));
  const genderIndex = headerTokens.findIndex(h => h.includes('gender') || h.includes('sex'));
  const phoneIndex = headerTokens.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'));
  const parentEmailIndex = headerTokens.findIndex(h => h.includes('parent') && (h.includes('email') || h.includes('contact')));

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
    const phone = phoneIndex !== -1 ? (tokens[phoneIndex] || '').trim() : '';
    const parentContact = parentEmailIndex !== -1 ? (tokens[parentEmailIndex] || '').trim() : '';

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
      result.errors.push({ line: lineNumber, message: `Invalid email format "${email}" for student ${name}` });
      continue;
    }

    let gender: 'Male' | 'Female' | 'Other' = 'Other';
    if (rawGender.startsWith('m')) {
      gender = 'Male';
    } else if (rawGender.startsWith('f')) {
      gender = 'Female';
    }

    result.students.push({
      rollNumber,
      registrationNumber,
      name,
      email: email || `${rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.bteb.edu.bd`,
      gender,
      classId: targetClassId,
      phone: phone || undefined,
      parentContact: parentContact || undefined,
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
    'Roll Number,Registration Number,Name,Email,Gender,Phone,Parent Email',
    '621051,1502189407,Naimur Rahman,naimur.621051@student.bteb.edu.bd,Male,+880 1711-234567,parent.rahman@gmail.com',
    '621052,1502189408,Jannatul Ferdous,jannatul.621052@student.bteb.edu.bd,Female,+880 1711-234568,parent.ferdous@gmail.com',
    '621053,1502189409,Sabbir Ahmed,sabbir.621053@student.bteb.edu.bd,Male,+880 1711-234569,parent.ahmed@gmail.com',
    '621054,1502189410,Sumaiya Islam,sumaiya.621054@student.bteb.edu.bd,Female,+880 1711-234570,parent.islam@gmail.com',
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


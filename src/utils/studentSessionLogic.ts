import {
  ClassGroup,
  Student,
  StudentSemesterHistoryEntry,
} from '../types/attendance';

export const SEMESTER_SEQUENCE = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
] as const;

export function deriveSessionFromAdmissionYear(admissionYear?: string): string | undefined {
  const cleaned = admissionYear?.trim();
  if (!cleaned) return undefined;

  // Already looks like a range such as 2022-23 or 2022-2023
  if (/^\d{4}\s*[-–]\s*\d{2,4}$/.test(cleaned)) {
    return cleaned.replace(/\s*[-–]\s*/, '-');
  }

  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return undefined;

  const startYear = parseInt(yearMatch[1], 10);
  const nextTwoDigits = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${nextTwoDigits}`;
}

export function deriveAdmissionYearFromSession(session?: string): string | undefined {
  const cleaned = session?.trim();
  if (!cleaned) return undefined;
  const yearMatch = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  return yearMatch ? yearMatch[1] : undefined;
}

export function normalizeStudentSessionFields(input: {
  session?: string;
  admissionYear?: string;
}): { session?: string; admissionYear?: string } {
  const rawSession = input.session?.trim() || undefined;
  const rawAdmYear = input.admissionYear?.trim() || undefined;

  let session = rawSession;
  let admissionYear = rawAdmYear;

  if (session && /^\d{4}$/.test(session)) {
    if (!admissionYear) admissionYear = session;
    session = deriveSessionFromAdmissionYear(session);
  }

  if (!session && admissionYear) {
    session = deriveSessionFromAdmissionYear(admissionYear);
  }

  if (!admissionYear && session) {
    admissionYear = deriveAdmissionYearFromSession(session);
  }

  return { session, admissionYear };
}

export function getSemesterRank(semester?: string): number {
  if (!semester) return -1;
  const normalized = semester.trim().toLowerCase();
  const idx = SEMESTER_SEQUENCE.findIndex(s => s.toLowerCase() === normalized);
  if (idx !== -1) return idx + 1;
  const numMatch = normalized.match(/\d+/);
  return numMatch ? parseInt(numMatch[0], 10) : -1;
}

export interface NextSemesterResolution {
  currentSemester: string;
  nextSemester: string | null;
  nextClass: ClassGroup | null;
  isFinalSemester: boolean;
}

export function getNextSemesterClass(
  sourceClass: ClassGroup,
  classes: ClassGroup[]
): NextSemesterResolution {
  const rank = getSemesterRank(sourceClass.semester);
  if (rank < 1 || rank >= SEMESTER_SEQUENCE.length) {
    return {
      currentSemester: sourceClass.semester,
      nextSemester: null,
      nextClass: null,
      isFinalSemester: rank >= SEMESTER_SEQUENCE.length,
    };
  }

  const nextSemester = SEMESTER_SEQUENCE[rank]; // rank is 1-indexed, so index `rank` is next semester

  // Prefer matching same department & shift/section, then same department, then any class in nextSemester
  const candidates = classes.filter(
    c =>
      c.id !== sourceClass.id &&
      c.semester.trim().toLowerCase() === nextSemester.toLowerCase()
  );

  const exactMatch =
    candidates.find(
      c =>
        c.department === sourceClass.department &&
        c.section === sourceClass.section
    ) ||
    candidates.find(c => c.department === sourceClass.department) ||
    candidates[0] ||
    null;

  return {
    currentSemester: sourceClass.semester,
    nextSemester,
    nextClass: exactMatch,
    isFinalSemester: false,
  };
}

export interface RollConflictItem {
  student: Student;
  conflictStudentName: string;
}

export interface PromotionPlanResult {
  promotedStudents: Student[];
  skippedRollConflicts: RollConflictItem[];
  isGraduation: boolean;
  fromSemester: string;
  toSemester: string | null;
}

export function buildPromotedStudentsPlan(params: {
  allStudents: Student[];
  selectedStudentIds: string[];
  sourceClass: ClassGroup;
  targetClass: ClassGroup | null;
  promotedBy?: string;
  promotedAt?: string;
}): PromotionPlanResult {
  const {
    allStudents,
    selectedStudentIds,
    sourceClass,
    targetClass,
    promotedBy,
    promotedAt = new Date().toISOString(),
  } = params;

  const selectedSet = new Set(selectedStudentIds);
  const sourceStudents = allStudents.filter(
    s => s.classId === sourceClass.id && selectedSet.has(s.id)
  );

  const isGraduation = targetClass === null;
  const promotedStudents: Student[] = [];
  const skippedRollConflicts: RollConflictItem[] = [];

  const targetExistingRolls = new Map<string, Student>();
  if (targetClass) {
    allStudents
      .filter(s => s.classId === targetClass.id && !selectedSet.has(s.id))
      .forEach(s => {
        targetExistingRolls.set(s.rollNumber.trim().toLowerCase(), s);
      });
  }

  for (const stu of sourceStudents) {
    const normalizedSession = normalizeStudentSessionFields({
      session: stu.session,
      admissionYear: stu.admissionYear,
    });

    const historyEntry: StudentSemesterHistoryEntry = {
      semester: sourceClass.semester,
      classId: sourceClass.id,
      academicYear: sourceClass.academicYear,
      session: normalizedSession.session,
      promotedAt,
      ...(promotedBy ? { promotedBy } : {}),
    };

    const nextHistory = [...(stu.semesterHistory || []), historyEntry];

    if (isGraduation) {
      promotedStudents.push({
        ...stu,
        semester: sourceClass.semester,
        session: normalizedSession.session,
        admissionYear: normalizedSession.admissionYear,
        academicStanding: 'Graduated',
        status: 'inactive',
        semesterHistory: nextHistory,
      });
      continue;
    }

    const rollKey = stu.rollNumber.trim().toLowerCase();
    const conflict = targetExistingRolls.get(rollKey);
    if (conflict) {
      skippedRollConflicts.push({
        student: stu,
        conflictStudentName: conflict.name,
      });
      continue;
    }

    promotedStudents.push({
      ...stu,
      classId: targetClass.id,
      semester: targetClass.semester,
      // Admission session & admission year stay permanently fixed across promotions
      session: normalizedSession.session,
      admissionYear: normalizedSession.admissionYear,
      status: 'active',
      semesterHistory: nextHistory,
    });
  }

  return {
    promotedStudents,
    skippedRollConflicts,
    isGraduation,
    fromSemester: sourceClass.semester,
    toSemester: targetClass ? targetClass.semester : null,
  };
}

export function getDistinctStudentSessions(students: Student[]): string[] {
  const sessionSet = new Set<string>();
  students.forEach(stu => {
    const { session } = normalizeStudentSessionFields({
      session: stu.session,
      admissionYear: stu.admissionYear,
    });
    if (session) sessionSet.add(session);
  });

  return Array.from(sessionSet).sort((a, b) => {
    const yearA = parseInt(deriveAdmissionYearFromSession(a) || '0', 10);
    const yearB = parseInt(deriveAdmissionYearFromSession(b) || '0', 10);
    if (yearA !== yearB) return yearB - yearA;
    return b.localeCompare(a);
  });
}

import {
  AttendanceSession,
  ClassGroup,
  CourseworkAssignment,
  FormFillupResponsibility,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
} from '../types/attendance';

export interface UserProfileEditableInput {
  name: string;
  department: string;
  employeeId: string;
  title?: string;
  phone?: string;
  qualification?: string;
  specialization?: string;
  officeRoom?: string;
  officeHours?: string;
  joiningDate?: string;
  bloodGroup?: string;
  bio?: string;
  dailyClassTarget?: number;
  avatar?: string;
}

export interface UserProfileValidationResult {
  valid: boolean;
  error?: string;
  updatedUser?: User;
}

function cleanOptional(value?: string, maxLength = 500): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function isValidAvatarSource(avatar?: string): boolean {
  if (!avatar || !avatar.trim()) return true;
  const trimmed = avatar.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}

/**
 * Validates and constructs a sanitized User object while preserving
 * immutable privilege & approval fields (id, role, email, approvalStatus).
 */
export function buildUserProfileUpdatePayload(
  currentUser: User,
  input: UserProfileEditableInput
): UserProfileValidationResult {
  const cleanName = (input.name || '').trim();
  const cleanDepartment = (input.department || '').trim();
  const cleanEmployeeId = (input.employeeId || '').trim();

  if (!cleanName) {
    return { valid: false, error: 'Full name is required.' };
  }
  if (cleanName.length > 120) {
    return { valid: false, error: 'Full name must be 120 characters or fewer.' };
  }
  if (!cleanDepartment) {
    return { valid: false, error: 'Department name is required.' };
  }
  if (!cleanEmployeeId) {
    return { valid: false, error: 'Employee / Faculty ID is required.' };
  }

  if (!isValidAvatarSource(input.avatar)) {
    return {
      valid: false,
      error: 'Profile photo must be a valid image upload or http(s) URL.',
    };
  }

  const rawTarget =
    typeof input.dailyClassTarget === 'number' && Number.isFinite(input.dailyClassTarget)
      ? input.dailyClassTarget
      : currentUser.dailyClassTarget || 4;
  const clampedTarget = Math.max(1, Math.min(20, Math.round(rawTarget)));

  const updatedUser: User = {
    ...currentUser,
    // Immutable identity & privilege fields preserved verbatim
    id: currentUser.id,
    role: currentUser.role,
    email: currentUser.email,
    approvalStatus: currentUser.approvalStatus,
    registeredAt: currentUser.registeredAt,
    approvedAt: currentUser.approvedAt,
    approvedBy: currentUser.approvedBy,
    // Editable faculty profile fields
    name: cleanName,
    department: cleanDepartment.slice(0, 120),
    employeeId: cleanEmployeeId.slice(0, 40),
    avatar: input.avatar !== undefined ? input.avatar.trim() : currentUser.avatar,
    title: cleanOptional(input.title, 120),
    phone: cleanOptional(input.phone, 40),
    qualification: cleanOptional(input.qualification, 200),
    specialization: cleanOptional(input.specialization, 200),
    officeRoom: cleanOptional(input.officeRoom, 100),
    officeHours: cleanOptional(input.officeHours, 120),
    joiningDate: cleanOptional(input.joiningDate, 30),
    bloodGroup: cleanOptional(input.bloodGroup, 10),
    bio: cleanOptional(input.bio, 600),
    dailyClassTarget: clampedTarget,
    profileUpdatedAt: new Date().toISOString(),
  };

  return { valid: true, updatedUser };
}

export interface FacultyCourseAllocationSummary {
  assignmentId: string;
  subjectCode: string;
  subjectName: string;
  semesterName: string;
  part: SubjectPart;
  credits: number;
}

export interface UserTeachingPortfolioSummary {
  allocations: FacultyCourseAllocationSummary[];
  distinctCoursesCount: number;
  sessionsConductedCount: number;
  assignmentsCreatedCount: number;
  coordinatorSemesters: string[];
  completenessPercent: number;
  missingFields: string[];
}

export function calculateUserTeachingSummary(params: {
  user: User;
  assignments: SubjectAssignment[];
  subjects: Subject[];
  classes: ClassGroup[];
  sessions: AttendanceSession[];
  courseworkAssignments: CourseworkAssignment[];
  formFillupResponsibilities: FormFillupResponsibility[];
}): UserTeachingPortfolioSummary {
  const {
    user,
    assignments,
    subjects,
    classes,
    sessions,
    courseworkAssignments,
    formFillupResponsibilities,
  } = params;

  const subjectMap = new Map(subjects.map(s => [s.id, s]));
  const classMap = new Map(classes.map(c => [c.id, c]));

  const allocations: FacultyCourseAllocationSummary[] = assignments
    .filter(a => a.teacherId === user.id)
    .map(a => {
      const sub = subjectMap.get(a.subjectId);
      const cls = classMap.get(a.classId);
      return {
        assignmentId: a.id,
        subjectCode: sub?.code || '—',
        subjectName: sub?.name || 'Assigned Course',
        semesterName: cls?.name || `${sub?.semester || ''} Semester`,
        part: a.part || 'theory',
        credits: sub?.credits || 0,
      };
    })
    .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode, undefined, { numeric: true }));

  const distinctCoursesCount = new Set(allocations.map(a => a.subjectCode)).size;
  const sessionsConductedCount = sessions.filter(s => s.teacherId === user.id).length;
  const assignmentsCreatedCount = courseworkAssignments.filter(
    cw => cw.teacherId === user.id
  ).length;

  const coordinatorSemesters = formFillupResponsibilities
    .filter(r => r.teacherId === user.id)
    .map(r => classMap.get(r.classId)?.name || `${r.semester} Semester`);

  const profileChecks: Array<{ label: string; filled: boolean }> = [
    { label: 'Full Name', filled: Boolean(user.name?.trim()) },
    { label: 'Designation / Title', filled: Boolean(user.title?.trim()) },
    { label: 'Phone / Extension', filled: Boolean(user.phone?.trim()) },
    { label: 'Academic Qualification', filled: Boolean(user.qualification?.trim()) },
    { label: 'Specialization', filled: Boolean(user.specialization?.trim()) },
    { label: 'Office Room', filled: Boolean(user.officeRoom?.trim()) },
    { label: 'Office Hours', filled: Boolean(user.officeHours?.trim()) },
    { label: 'Faculty Bio', filled: Boolean(user.bio?.trim()) },
  ];

  const filledCount = profileChecks.filter(c => c.filled).length;
  const completenessPercent = Math.round((filledCount / profileChecks.length) * 100);
  const missingFields = profileChecks.filter(c => !c.filled).map(c => c.label);

  return {
    allocations,
    distinctCoursesCount,
    sessionsConductedCount,
    assignmentsCreatedCount,
    coordinatorSemesters,
    completenessPercent,
    missingFields,
  };
}

import {
  AssignmentSubmissionStatus,
  CourseworkAssignment,
  Student,
  StudentAssignmentEvaluation,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
} from '../types/attendance';

export interface CourseworkValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates new or edited student assignment metadata.
 */
export function validateCourseworkInput(input: {
  title?: string;
  subjectId?: string;
  classId?: string;
  part?: SubjectPart;
  assignedDate?: string;
  dueDate?: string;
  maxMarks?: number;
}): CourseworkValidationResult {
  const title = (input.title || '').trim();
  if (!title) {
    return { valid: false, error: 'Assignment title is required.' };
  }
  if (title.length > 160) {
    return { valid: false, error: 'Assignment title must be 160 characters or fewer.' };
  }
  if (!input.subjectId || !input.classId) {
    return { valid: false, error: 'Subject and class batch are required.' };
  }
  if (input.part !== 'theory' && input.part !== 'practical') {
    return { valid: false, error: 'Subject part must be Theory or Practical.' };
  }
  if (!input.assignedDate || !input.dueDate) {
    return { valid: false, error: 'Assigned date and due date are required.' };
  }
  if (input.dueDate < input.assignedDate) {
    return { valid: false, error: 'Due date cannot be earlier than the assigned date.' };
  }
  const maxMarks = Number(input.maxMarks);
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 1000) {
    return { valid: false, error: 'Maximum marks must be between 1 and 1000.' };
  }

  return { valid: true };
}

/**
 * Validates an evaluation score against assignment maxMarks.
 */
export function validateEvaluationScore(
  marks: number | null | undefined,
  maxMarks: number
): CourseworkValidationResult {
  if (marks === null || marks === undefined) {
    return { valid: true };
  }
  const numeric = Number(marks);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { valid: false, error: 'Obtained marks cannot be negative.' };
  }
  if (numeric > maxMarks) {
    return { valid: false, error: `Obtained marks (${numeric}) cannot exceed maximum marks (${maxMarks}).` };
  }
  return { valid: true };
}

export interface CourseworkProgressSummary {
  totalStudents: number;
  pendingCount: number;
  submittedCount: number;
  lateCount: number;
  gradedCount: number;
  missingCount: number;
  completedCount: number;
  completionRate: number;
  averageScore: number | null;
  averagePercentage: number | null;
}

/**
 * Computes submission and grading analytics for a single coursework assignment.
 */
export function calculateCourseworkProgress(
  coursework: CourseworkAssignment,
  classStudents: Student[],
  evaluations: StudentAssignmentEvaluation[]
): CourseworkProgressSummary {
  const activeStudents = classStudents.filter(s => s.classId === coursework.classId && s.status === 'active');
  const evalMap = new Map<string, StudentAssignmentEvaluation>();
  evaluations.forEach(ev => {
    if (ev.courseworkId === coursework.id) {
      evalMap.set(ev.studentId, ev);
    }
  });

  let pendingCount = 0;
  let submittedCount = 0;
  let lateCount = 0;
  let gradedCount = 0;
  let missingCount = 0;

  let scoredSum = 0;
  let scoredCount = 0;

  activeStudents.forEach(stu => {
    const ev = evalMap.get(stu.id);
    const status: AssignmentSubmissionStatus = ev?.status || 'pending';

    if (status === 'submitted') submittedCount++;
    else if (status === 'late') lateCount++;
    else if (status === 'graded') gradedCount++;
    else if (status === 'missing') missingCount++;
    else pendingCount++;

    const hasNumericMark = typeof ev?.marksObtained === 'number' && Number.isFinite(ev.marksObtained);
    if (hasNumericMark && (status === 'graded' || status === 'missing')) {
      scoredSum += Number(ev!.marksObtained);
      scoredCount++;
    }
  });

  const totalStudents = activeStudents.length;
  const completedCount = submittedCount + lateCount + gradedCount;
  const completionRate =
    totalStudents > 0 ? Math.round((completedCount / totalStudents) * 1000) / 10 : 0;

  const averageScore =
    scoredCount > 0 ? Math.round((scoredSum / scoredCount) * 10) / 10 : null;
  const averagePercentage =
    averageScore !== null && coursework.maxMarks > 0
      ? Math.min(100, Math.round((averageScore / coursework.maxMarks) * 1000) / 10)
      : null;

  return {
    totalStudents,
    pendingCount,
    submittedCount,
    lateCount,
    gradedCount,
    missingCount,
    completedCount,
    completionRate,
    averageScore,
    averagePercentage,
  };
}

export type StudentEvaluationStanding =
  | 'Excellent'
  | 'Good'
  | 'Satisfactory'
  | 'Needs Attention'
  | 'Not Evaluated';

export interface StudentCourseworkSummary {
  studentId: string;
  rollNumber: string;
  studentName: string;
  totalAssignments: number;
  submittedCount: number;
  lateCount: number;
  gradedCount: number;
  missingCount: number;
  pendingCount: number;
  evaluatedCount: number;
  totalMarksObtained: number;
  totalMaxMarks: number;
  averagePercentage: number | null;
  standing: StudentEvaluationStanding;
}

/**
 * Determines qualitative teacher evaluation standing from percentage score.
 */
export function resolveEvaluationStanding(percentage: number | null): StudentEvaluationStanding {
  if (percentage === null) return 'Not Evaluated';
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 65) return 'Good';
  if (percentage >= 50) return 'Satisfactory';
  return 'Needs Attention';
}

/**
 * Computes cumulative assignment submission and evaluation summary for one student
 * across a list of relevant coursework assignments.
 */
export function calculateStudentCourseworkSummary(
  student: Student,
  courseworkList: CourseworkAssignment[],
  evaluations: StudentAssignmentEvaluation[]
): StudentCourseworkSummary {
  const relevantAssignments = courseworkList.filter(cw => cw.classId === student.classId);
  const evalByCoursework = new Map<string, StudentAssignmentEvaluation>();
  evaluations.forEach(ev => {
    if (ev.studentId === student.id) {
      evalByCoursework.set(ev.courseworkId, ev);
    }
  });

  let submittedCount = 0;
  let lateCount = 0;
  let gradedCount = 0;
  let missingCount = 0;
  let pendingCount = 0;

  let evaluatedCount = 0;
  let totalMarksObtained = 0;
  let totalMaxMarks = 0;

  relevantAssignments.forEach(cw => {
    const ev = evalByCoursework.get(cw.id);
    const status: AssignmentSubmissionStatus = ev?.status || 'pending';

    if (status === 'submitted') submittedCount++;
    else if (status === 'late') lateCount++;
    else if (status === 'graded') gradedCount++;
    else if (status === 'missing') missingCount++;
    else pendingCount++;

    const hasNumericMark = typeof ev?.marksObtained === 'number' && Number.isFinite(ev.marksObtained);
    if (hasNumericMark && (status === 'graded' || status === 'missing')) {
      evaluatedCount++;
      totalMarksObtained += Number(ev!.marksObtained);
      totalMaxMarks += cw.maxMarks;
    } else if (status === 'missing') {
      // Missing submissions with no explicit mark count as 0 out of maxMarks once evaluated
      evaluatedCount++;
      totalMaxMarks += cw.maxMarks;
    }
  });

  const averagePercentage =
    evaluatedCount > 0 && totalMaxMarks > 0
      ? Math.min(100, Math.round((totalMarksObtained / totalMaxMarks) * 1000) / 10)
      : null;

  return {
    studentId: student.id,
    rollNumber: student.rollNumber,
    studentName: student.name,
    totalAssignments: relevantAssignments.length,
    submittedCount,
    lateCount,
    gradedCount,
    missingCount,
    pendingCount,
    evaluatedCount,
    totalMarksObtained: Math.round(totalMarksObtained * 10) / 10,
    totalMaxMarks: Math.round(totalMaxMarks * 10) / 10,
    averagePercentage,
    standing: resolveEvaluationStanding(averagePercentage),
  };
}

/**
 * Scopes coursework assignments by user role:
 * - Admin sees all coursework assignments
 * - Teacher sees only coursework belonging to their assigned (subjectId, part) pairs
 */
export function filterVisibleCoursework(params: {
  currentUser: User | null;
  courseworkList: CourseworkAssignment[];
  assignments: SubjectAssignment[];
}): CourseworkAssignment[] {
  const { currentUser, courseworkList, assignments } = params;
  if (!currentUser) return [];

  if (currentUser.role === 'admin') {
    return [...courseworkList].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }

  const allowedPartKeys = new Set(
    assignments
      .filter(a => a.teacherId === currentUser.id)
      .map(a => `${a.subjectId}::${a.part || 'theory'}`)
  );

  return courseworkList
    .filter(cw => allowedPartKeys.has(`${cw.subjectId}::${cw.part || 'theory'}`))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

/**
 * Exports a single assignment's student evaluations to CSV.
 */
export function exportCourseworkEvaluationsToCSV(params: {
  coursework: CourseworkAssignment;
  subject?: Subject;
  students: Student[];
  evaluations: StudentAssignmentEvaluation[];
}): string {
  const { coursework, subject, students, evaluations } = params;
  const classStudents = [...students]
    .filter(s => s.classId === coursework.classId && s.status === 'active')
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  const evalMap = new Map<string, StudentAssignmentEvaluation>();
  evaluations.forEach(ev => {
    if (ev.courseworkId === coursework.id) {
      evalMap.set(ev.studentId, ev);
    }
  });

  const rows: string[] = [];
  rows.push(`# Assignment Evaluation Ledger: ${coursework.title}`);
  rows.push(
    `# Course: ${subject ? `${subject.code} - ${subject.name}` : coursework.subjectId} (${coursework.part.toUpperCase()}) | Due: ${coursework.dueDate} | Max Marks: ${coursework.maxMarks}`
  );
  rows.push('Roll Number,Student Name,Status,Marks Obtained,Max Marks,Percentage,Feedback,Evaluated At');

  classStudents.forEach(stu => {
    const ev = evalMap.get(stu.id);
    const status = ev?.status || 'pending';
    const marks = typeof ev?.marksObtained === 'number' ? ev.marksObtained : '';
    const pct =
      typeof ev?.marksObtained === 'number' && coursework.maxMarks > 0
        ? `${((ev.marksObtained / coursework.maxMarks) * 100).toFixed(1)}%`
        : '-';
    const feedback = (ev?.feedback || '').replace(/"/g, '""');
    const evaluatedAt = ev?.evaluatedAt ? ev.evaluatedAt.split('T')[0] : '-';

    rows.push(
      [
        `"${stu.rollNumber}"`,
        `"${stu.name.replace(/"/g, '""')}"`,
        `"${status.toUpperCase()}"`,
        marks === '' ? '"-"' : marks,
        coursework.maxMarks,
        `"${pct}"`,
        `"${feedback}"`,
        `"${evaluatedAt}"`,
      ].join(',')
    );
  });

  return rows.join('\n');
}

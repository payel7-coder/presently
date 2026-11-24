import {
  AttendanceRecord,
  AttendanceSession,
  ClassGroup,
  CourseworkAssignment,
  FormFillupFeeConfig,
  FormFillupStudentRecord,
  Student,
  StudentAssignmentEvaluation,
  StudentAttendanceStats,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
} from '../types/attendance';
import { calculateStudentAttendanceStats } from './attendanceLogic';
import { calculateStudentCourseworkSummary, StudentCourseworkSummary } from './courseworkLogic';
import {
  calculateStudentFormFillupFee,
  createDefaultFeeConfig,
  FeeBreakdown,
} from './formFillupLogic';

export interface StudentSubjectPerformanceRow {
  subject: Subject;
  theoryTeacherName: string;
  practicalTeacherName: string;
  theorySessions: number;
  theoryAttended: number;
  theoryPercentage: number | null;
  practicalSessions: number;
  practicalAttended: number;
  practicalPercentage: number | null;
  combinedSessions: number;
  combinedAttended: number;
  combinedPercentage: number;
  isAtRisk: boolean;
  assignmentsCount: number;
  gradedAssignmentsCount: number;
  courseworkAveragePct: number | null;
}

export interface StudentAttendanceLogEntry {
  recordId: string;
  sessionId: string;
  date: string;
  timeSlot?: string;
  subjectCode: string;
  subjectName: string;
  part: SubjectPart;
  status: AttendanceRecord['status'];
  topic?: string;
  remarks?: string;
}

export interface StudentCourseworkLogEntry {
  assignment: CourseworkAssignment;
  subjectCode: string;
  subjectName: string;
  evaluation?: StudentAssignmentEvaluation;
  percentage: number | null;
}

export interface StudentProfileDossier {
  student: Student;
  classGroup?: ClassGroup;
  attendanceStats: StudentAttendanceStats;
  courseworkSummary: StudentCourseworkSummary;
  subjectRows: StudentSubjectPerformanceRow[];
  attendanceHistory: StudentAttendanceLogEntry[];
  courseworkHistory: StudentCourseworkLogEntry[];
  formFillupRecord?: FormFillupStudentRecord;
  formFillupFeeConfig?: FormFillupFeeConfig;
  formFillupBreakdown?: FeeBreakdown;
  totalCreditsEnrolled: number;
  eligibleSubjectsCount: number;
  atRiskSubjectsCount: number;
}

export interface BuildStudentDossierParams {
  student: Student;
  classes: ClassGroup[];
  subjects: Subject[];
  assignments: SubjectAssignment[];
  users: User[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  courseworkAssignments: CourseworkAssignment[];
  studentEvaluations: StudentAssignmentEvaluation[];
  formFillupRecords: FormFillupStudentRecord[];
  formFillupFeeConfigs: FormFillupFeeConfig[];
}

export function buildStudentProfileDossier(
  params: BuildStudentDossierParams
): StudentProfileDossier {
  const {
    student,
    classes,
    subjects,
    assignments,
    users,
    sessions,
    records,
    courseworkAssignments,
    studentEvaluations,
    formFillupRecords,
    formFillupFeeConfigs,
  } = params;

  const classGroup = classes.find(c => c.id === student.classId);

  const classSessions = sessions.filter(s => s.classId === student.classId);
  const overallAttendanceStats = calculateStudentAttendanceStats(
    student,
    classSessions,
    records
  );

  const classCoursework = courseworkAssignments.filter(
    cw => cw.classId === student.classId
  );
  const courseworkSummary = calculateStudentCourseworkSummary(
    student,
    classCoursework,
    studentEvaluations
  );

  const userMap = new Map<string, User>(users.map(u => [u.id, u]));
  const subjectMap = new Map<string, Subject>(subjects.map(s => [s.id, s]));

  const classSubjects = [...subjects]
    .filter(s => s.classId === student.classId)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const recordBySessionId = new Map<string, AttendanceRecord>();
  records.forEach(r => {
    if (r.studentId === student.id) {
      recordBySessionId.set(r.sessionId, r);
    }
  });

  const evalByCourseworkId = new Map<string, StudentAssignmentEvaluation>();
  studentEvaluations.forEach(ev => {
    if (ev.studentId === student.id) {
      evalByCourseworkId.set(ev.courseworkId, ev);
    }
  });

  const subjectRows: StudentSubjectPerformanceRow[] = classSubjects.map(sub => {
    const theoryAsg = assignments.find(
      a => a.subjectId === sub.id && a.classId === student.classId && (a.part || 'theory') === 'theory'
    );
    const pracAsg = assignments.find(
      a => a.subjectId === sub.id && a.classId === student.classId && a.part === 'practical'
    );

    const theoryTeacherName = theoryAsg
      ? userMap.get(theoryAsg.teacherId)?.name || 'Assigned Instructor'
      : 'Unassigned';
    const practicalTeacherName = pracAsg
      ? userMap.get(pracAsg.teacherId)?.name || 'Assigned Instructor'
      : 'Unassigned';

    const subSessions = classSessions.filter(s => s.subjectId === sub.id);
    let theorySessions = 0;
    let theoryAttended = 0;
    let practicalSessions = 0;
    let practicalAttended = 0;

    subSessions.forEach(sess => {
      const rec = recordBySessionId.get(sess.id);
      if (!rec) return;
      const countedAttended =
        rec.status === 'present' || rec.status === 'late' || rec.status === 'excused';
      if (sess.part === 'practical') {
        practicalSessions++;
        if (countedAttended) practicalAttended++;
      } else {
        theorySessions++;
        if (countedAttended) theoryAttended++;
      }
    });

    const combinedSessions = theorySessions + practicalSessions;
    const combinedAttended = theoryAttended + practicalAttended;
    const theoryPercentage =
      theorySessions > 0 ? Number(((theoryAttended / theorySessions) * 100).toFixed(1)) : null;
    const practicalPercentage =
      practicalSessions > 0
        ? Number(((practicalAttended / practicalSessions) * 100).toFixed(1))
        : null;
    const combinedPercentage =
      combinedSessions > 0
        ? Number(((combinedAttended / combinedSessions) * 100).toFixed(1))
        : 100;

    const subCoursework = classCoursework.filter(cw => cw.subjectId === sub.id);
    let gradedAssignmentsCount = 0;
    let marksObtainedSum = 0;
    let maxMarksSum = 0;

    subCoursework.forEach(cw => {
      const ev = evalByCourseworkId.get(cw.id);
      if (ev && typeof ev.marksObtained === 'number' && cw.maxMarks > 0) {
        gradedAssignmentsCount++;
        marksObtainedSum += ev.marksObtained;
        maxMarksSum += cw.maxMarks;
      }
    });

    const courseworkAveragePct =
      maxMarksSum > 0 ? Number(((marksObtainedSum / maxMarksSum) * 100).toFixed(1)) : null;

    return {
      subject: sub,
      theoryTeacherName,
      practicalTeacherName,
      theorySessions,
      theoryAttended,
      theoryPercentage,
      practicalSessions,
      practicalAttended,
      practicalPercentage,
      combinedSessions,
      combinedAttended,
      combinedPercentage,
      isAtRisk: combinedSessions > 0 && combinedPercentage < 75,
      assignmentsCount: subCoursework.length,
      gradedAssignmentsCount,
      courseworkAveragePct,
    };
  });

  const attendanceHistory: StudentAttendanceLogEntry[] = classSessions
    .filter(sess => recordBySessionId.has(sess.id))
    .map(sess => {
      const rec = recordBySessionId.get(sess.id)!;
      const sub = subjectMap.get(sess.subjectId);
      return {
        recordId: rec.id,
        sessionId: sess.id,
        date: sess.date,
        timeSlot: sess.timeSlot,
        subjectCode: sub?.code || '—',
        subjectName: sub?.name || 'Course Session',
        part: sess.part || 'theory',
        status: rec.status,
        topic: sess.topic,
        remarks: rec.remarks,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const courseworkHistory: StudentCourseworkLogEntry[] = [...classCoursework]
    .map(cw => {
      const sub = subjectMap.get(cw.subjectId);
      const evaluation = evalByCourseworkId.get(cw.id);
      const percentage =
        evaluation && typeof evaluation.marksObtained === 'number' && cw.maxMarks > 0
          ? Number(((evaluation.marksObtained / cw.maxMarks) * 100).toFixed(1))
          : null;
      return {
        assignment: cw,
        subjectCode: sub?.code || '—',
        subjectName: sub?.name || 'Course Assignment',
        evaluation,
        percentage,
      };
    })
    .sort((a, b) => b.assignment.dueDate.localeCompare(a.assignment.dueDate));

  const formFillupRecord = formFillupRecords.find(
    r => r.classId === student.classId && r.studentId === student.id
  );
  const formFillupFeeConfig =
    formFillupFeeConfigs.find(c => c.classId === student.classId) ||
    (classGroup ? createDefaultFeeConfig(classGroup.semester, classGroup.id) : undefined);

  const formFillupBreakdown =
    formFillupRecord && formFillupFeeConfig
      ? calculateStudentFormFillupFee(formFillupFeeConfig, {
          resultStatus: formFillupRecord.resultStatus,
          referredSubjectsCount: formFillupRecord.referredSubjectsCount,
          referredSemestersCount: formFillupRecord.referredSemestersCount,
          practicalSubjectsCount: formFillupRecord.practicalSubjectsCount,
          applyDelayFee: formFillupRecord.applyDelayFee,
        })
      : undefined;

  const totalCreditsEnrolled = classSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);
  const eligibleSubjectsCount = subjectRows.filter(
    r => r.combinedSessions > 0 && !r.isAtRisk
  ).length;
  const atRiskSubjectsCount = subjectRows.filter(r => r.isAtRisk).length;

  return {
    student,
    classGroup,
    attendanceStats: overallAttendanceStats,
    courseworkSummary,
    subjectRows,
    attendanceHistory,
    courseworkHistory,
    formFillupRecord,
    formFillupFeeConfig,
    formFillupBreakdown,
    totalCreditsEnrolled,
    eligibleSubjectsCount,
    atRiskSubjectsCount,
  };
}

export interface StudentProfileEditValidationResult {
  valid: boolean;
  error?: string;
  normalized?: Student;
}

export function validateStudentProfileUpdate(
  draft: Student,
  existingStudents: Student[]
): StudentProfileEditValidationResult {
  const cleanName = draft.name.trim();
  const cleanRoll = draft.rollNumber.trim();
  const cleanEmail = draft.email.trim();

  if (!cleanName) {
    return { valid: false, error: 'Student full name is required.' };
  }
  if (!cleanRoll) {
    return { valid: false, error: 'Board / Class roll number is required.' };
  }
  if (!cleanEmail) {
    return { valid: false, error: 'Student institutional email is required.' };
  }

  const duplicateRoll = existingStudents.find(
    s =>
      s.id !== draft.id &&
      s.classId === draft.classId &&
      s.rollNumber.trim().toLowerCase() === cleanRoll.toLowerCase()
  );
  if (duplicateRoll) {
    return {
      valid: false,
      error: `Board Roll "${cleanRoll}" is already assigned to ${duplicateRoll.name} in this batch.`,
    };
  }

  const opt = (val?: string) => (val && val.trim() ? val.trim() : undefined);

  const normalized: Student = {
    ...draft,
    name: cleanName,
    rollNumber: cleanRoll,
    email: cleanEmail,
    registrationNumber: opt(draft.registrationNumber),
    phone: opt(draft.phone),
    parentContact: opt(draft.parentContact),
    parentEmail: opt(draft.parentEmail),
    guardianName: opt(draft.guardianName),
    fatherName: opt(draft.fatherName),
    motherName: opt(draft.motherName),
    bloodGroup: opt(draft.bloodGroup),
    dateOfBirth: opt(draft.dateOfBirth),
    session: opt(draft.session),
    shift: opt(draft.shift),
    admissionYear: opt(draft.admissionYear),
    presentAddress: opt(draft.presentAddress),
    permanentAddress: opt(draft.permanentAddress),
    academicStanding: opt(draft.academicStanding),
    remarks: opt(draft.remarks),
  };

  return { valid: true, normalized };
}

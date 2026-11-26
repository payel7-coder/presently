import React, { useState, useMemo, useEffect } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  AssignmentSubmissionStatus,
  CourseworkAssignment,
  Student,
  SubjectPart,
} from '../types/attendance';
import {
  calculateCourseworkProgress,
  calculateStudentCourseworkSummary,
  exportCourseworkEvaluationsToCSV,
  filterVisibleCoursework,
  StudentCourseworkSummary,
  validateCourseworkInput,
  validateEvaluationScore,
} from '../utils/courseworkLogic';
import {
  calculateStudentAttendanceStats,
  getRoleBasedVisibilityScope,
} from '../utils/attendanceLogic';
import {
  ClipboardList,
  Plus,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Eye,
  BookOpen,
} from 'lucide-react';

interface StudentAssignmentsTrackerProps {
  initialSubjectId?: string;
  initialPart?: SubjectPart;
}

interface DraftEvaluationEntry {
  status: AssignmentSubmissionStatus;
  marksInput: string;
  feedback: string;
}

const STATUS_OPTIONS: { value: AssignmentSubmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'late', label: 'Late' },
  { value: 'graded', label: 'Graded' },
  { value: 'missing', label: 'Missing' },
];

function getStandingClasses(standing: StudentCourseworkSummary['standing']): string {
  switch (standing) {
    case 'Excellent':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Good':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Satisfactory':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Needs Attention':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export const StudentAssignmentsTracker: React.FC<StudentAssignmentsTrackerProps> = ({
  initialSubjectId,
  initialPart,
}) => {
  const {
    currentUser,
    isAdmin,
    subjects,
    classes,
    assignments,
    students,
    sessions,
    records,
    courseworkAssignments,
    studentEvaluations,
    createCourseworkAssignment,
    deleteCourseworkAssignment,
    saveStudentEvaluations,
  } = useAttendance();

  const [viewMode, setViewMode] = useState<'tracker' | 'summary'>('tracker');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>(initialSubjectId || 'all');
  const [selectedPartFilter, setSelectedPartFilter] = useState<'all' | SubjectPart>(initialPart || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentSubmissionStatus>('all');
  const [selectedCourseworkId, setSelectedCourseworkId] = useState<string | null>(null);

  // Draft evaluation edits per student for currently active assignment
  const [drafts, setDrafts] = useState<Record<string, DraftEvaluationEntry>>({});
  const [dirtyStudentIds, setDirtyStudentIds] = useState<Set<string>>(new Set());
  const [isSavingEvaluations, setIsSavingEvaluations] = useState(false);
  const [evalFeedbackBanner, setEvalFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create Assignment Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCourseKey, setCreateCourseKey] = useState<string>('');
  const [createTitle, setCreateTitle] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createMaxMarks, setCreateMaxMarks] = useState<string>('20');
  const [createAssignedDate, setCreateAssignedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [createDueDate, setCreateDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Student breakdown modal in summary mode
  const [inspectedStudent, setInspectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    setSelectedSubjectFilter(initialSubjectId || 'all');
    setSelectedPartFilter(initialPart || 'all');
  }, [initialSubjectId, initialPart, currentUser?.id]);

  // Role-based scope (teachers only see their assigned subjects/parts; admin sees all)
  const roleScope = useMemo(
    () =>
      getRoleBasedVisibilityScope({
        currentUser,
        subjects,
        classes,
        assignments,
        sessions,
        students,
      }),
    [currentUser, subjects, classes, assignments, sessions, students]
  );

  // Course allocations available for creating new assignments
  const creatableCourseOptions = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) {
      const list: Array<{
        key: string;
        subjectId: string;
        classId: string;
        part: SubjectPart;
        label: string;
      }> = [];
      [...subjects]
        .sort((a, b) => a.code.localeCompare(b.code))
        .forEach(sub => {
          const cls = classes.find(c => c.id === sub.classId);
          if (!cls) return;
          (['theory', 'practical'] as SubjectPart[]).forEach(part => {
            list.push({
              key: `${sub.id}::${cls.id}::${part}`,
              subjectId: sub.id,
              classId: cls.id,
              part,
              label: `${sub.code} · ${sub.name} (${part === 'practical' ? 'Practical' : 'Theory'}) — ${cls.name}`,
            });
          });
        });
      return list;
    }

    return assignments
      .filter(a => a.teacherId === currentUser.id)
      .map(a => {
        const sub = subjects.find(s => s.id === a.subjectId);
        const cls = classes.find(c => c.id === a.classId);
        const part: SubjectPart = a.part === 'practical' ? 'practical' : 'theory';
        if (!sub || !cls) return null;
        return {
          key: `${sub.id}::${cls.id}::${part}`,
          subjectId: sub.id,
          classId: cls.id,
          part,
          label: `${sub.code} · ${sub.name} (${part === 'practical' ? 'Practical' : 'Theory'}) — ${cls.name}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [currentUser, isAdmin, subjects, classes, assignments]);

  useEffect(() => {
    if (!createCourseKey && creatableCourseOptions.length > 0) {
      const preferred =
        creatableCourseOptions.find(
          opt =>
            (!initialSubjectId || opt.subjectId === initialSubjectId) &&
            (!initialPart || opt.part === initialPart)
        ) || creatableCourseOptions[0];
      setCreateCourseKey(preferred.key);
    }
  }, [creatableCourseOptions, createCourseKey, initialSubjectId, initialPart]);

  // Visible coursework scoped by user role
  const roleScopedCoursework = useMemo(
    () =>
      filterVisibleCoursework({
        currentUser,
        courseworkList: courseworkAssignments,
        assignments,
      }),
    [currentUser, courseworkAssignments, assignments]
  );

  // Apply toolbar filters to visible coursework
  const filteredCoursework = useMemo(() => {
    return roleScopedCoursework.filter(cw => {
      if (selectedSubjectFilter !== 'all' && cw.subjectId !== selectedSubjectFilter) {
        return false;
      }
      if (selectedPartFilter !== 'all' && cw.part !== selectedPartFilter) {
        return false;
      }
      return true;
    });
  }, [roleScopedCoursework, selectedSubjectFilter, selectedPartFilter]);

  // Ensure an assignment is selected whenever filteredCoursework updates
  useEffect(() => {
    if (filteredCoursework.length === 0) {
      setSelectedCourseworkId(null);
      return;
    }
    if (!selectedCourseworkId || !filteredCoursework.some(cw => cw.id === selectedCourseworkId)) {
      setSelectedCourseworkId(filteredCoursework[0].id);
    }
  }, [filteredCoursework, selectedCourseworkId]);

  const activeCoursework: CourseworkAssignment | null = useMemo(() => {
    if (!selectedCourseworkId) return null;
    return filteredCoursework.find(cw => cw.id === selectedCourseworkId) || null;
  }, [filteredCoursework, selectedCourseworkId]);

  const activeSubject = useMemo(
    () => (activeCoursework ? subjects.find(s => s.id === activeCoursework.subjectId) : undefined),
    [activeCoursework, subjects]
  );

  const activeClassGroup = useMemo(
    () => (activeCoursework ? classes.find(c => c.id === activeCoursework.classId) : undefined),
    [activeCoursework, classes]
  );

  const activeCourseStudents = useMemo(() => {
    if (!activeCoursework) return [];
    return students
      .filter(s => s.classId === activeCoursework.classId && s.status === 'active')
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }, [activeCoursework, students]);

  // Reset draft buffer when active assignment or underlying saved evaluations change cleanly
  useEffect(() => {
    if (!activeCoursework) {
      setDrafts({});
      setDirtyStudentIds(new Set());
      return;
    }
    const nextDrafts: Record<string, DraftEvaluationEntry> = {};
    activeCourseStudents.forEach(stu => {
      const saved = studentEvaluations.find(
        ev => ev.courseworkId === activeCoursework.id && ev.studentId === stu.id
      );
      nextDrafts[stu.id] = {
        status: saved?.status || 'pending',
        marksInput:
          typeof saved?.marksObtained === 'number' && Number.isFinite(saved.marksObtained)
            ? String(saved.marksObtained)
            : '',
        feedback: saved?.feedback || '',
      };
    });
    setDrafts(nextDrafts);
    setDirtyStudentIds(new Set());
    setConfirmDeleteId(null);
  }, [activeCoursework?.id, activeCourseStudents, studentEvaluations]);

  const activeProgress = useMemo(() => {
    if (!activeCoursework) return null;
    return calculateCourseworkProgress(activeCoursework, students, studentEvaluations);
  }, [activeCoursework, students, studentEvaluations]);

  const displayedStudentsInTracker = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeCourseStudents.filter(stu => {
      const draft = drafts[stu.id];
      const status = draft?.status || 'pending';
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      if (
        q &&
        !stu.name.toLowerCase().includes(q) &&
        !stu.rollNumber.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [activeCourseStudents, drafts, statusFilter, searchQuery]);

  // Student Evaluation Summary data (Mode 2)
  const summaryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const relevantCoursework = filteredCoursework;
    const relevantClassIds = new Set(relevantCoursework.map(cw => cw.classId));

    const targetStudents = roleScope.visibleStudents
      .filter(s => s.status === 'active')
      .filter(s => (relevantClassIds.size > 0 ? relevantClassIds.has(s.classId) : true))
      .filter(
        s =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q)
      )
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

    const scopedSessions = roleScope.visibleSessions.filter(s => {
      if (selectedSubjectFilter !== 'all' && s.subjectId !== selectedSubjectFilter) return false;
      if (selectedPartFilter !== 'all' && (s.part || 'theory') !== selectedPartFilter) return false;
      return true;
    });

    return targetStudents.map(student => {
      const evalSummary = calculateStudentCourseworkSummary(
        student,
        relevantCoursework,
        studentEvaluations
      );
      const attendanceStats = calculateStudentAttendanceStats(student, scopedSessions, records);
      const classGroup = classes.find(c => c.id === student.classId);
      return {
        student,
        classGroup,
        evalSummary,
        attendanceStats,
      };
    });
  }, [
    roleScope.visibleStudents,
    roleScope.visibleSessions,
    filteredCoursework,
    studentEvaluations,
    records,
    classes,
    searchQuery,
    selectedSubjectFilter,
    selectedPartFilter,
  ]);

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setCreateTitle('');
    setCreateDescription('');
    setCreateMaxMarks('20');
    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setCreateAssignedDate(todayStr);
    setCreateDueDate(nextWeek.toISOString().split('T')[0]);
    if (creatableCourseOptions.length > 0) {
      const matched =
        creatableCourseOptions.find(
          opt =>
            (selectedSubjectFilter === 'all' || opt.subjectId === selectedSubjectFilter) &&
            (selectedPartFilter === 'all' || opt.part === selectedPartFilter)
        ) || creatableCourseOptions[0];
      setCreateCourseKey(matched.key);
    }
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const chosen = creatableCourseOptions.find(opt => opt.key === createCourseKey);
    if (!chosen) {
      setCreateError('Please select a subject course batch.');
      return;
    }

    const numericMaxMarks = Number(createMaxMarks);
    const validation = validateCourseworkInput({
      title: createTitle,
      subjectId: chosen.subjectId,
      classId: chosen.classId,
      part: chosen.part,
      assignedDate: createAssignedDate,
      dueDate: createDueDate,
      maxMarks: numericMaxMarks,
    });

    if (!validation.valid) {
      setCreateError(validation.error || 'Please check assignment fields.');
      return;
    }

    setIsCreating(true);
    try {
      const created = await createCourseworkAssignment({
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        subjectId: chosen.subjectId,
        classId: chosen.classId,
        part: chosen.part,
        assignedDate: createAssignedDate,
        dueDate: createDueDate,
        maxMarks: numericMaxMarks,
      });
      setIsCreateModalOpen(false);
      setViewMode('tracker');
      setSelectedCourseworkId(created.id);
      setEvalFeedbackBanner({
        type: 'success',
        message: `Created "${created.title}". Ready to record student submissions and marks.`,
      });
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create assignment.');
    } finally {
      setIsCreating(false);
    }
  };

  const updateStudentDraft = (studentId: string, updater: (prev: DraftEvaluationEntry) => DraftEvaluationEntry) => {
    setDrafts(prev => {
      const current = prev[studentId] || { status: 'pending', marksInput: '', feedback: '' };
      return {
        ...prev,
        [studentId]: updater(current),
      };
    });
    setDirtyStudentIds(prev => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
    setEvalFeedbackBanner(null);
  };

  const handleSaveEvaluations = async () => {
    if (!activeCoursework) return;
    setEvalFeedbackBanner(null);

    const payload: Array<{
      studentId: string;
      status: AssignmentSubmissionStatus;
      marksObtained?: number | null;
      feedback?: string;
    }> = [];

    for (const stu of activeCourseStudents) {
      const draft = drafts[stu.id] || { status: 'pending', marksInput: '', feedback: '' };
      const trimmedMarks = draft.marksInput.trim();
      const parsedMarks = trimmedMarks === '' ? null : Number(trimmedMarks);
      const scoreCheck = validateEvaluationScore(parsedMarks, activeCoursework.maxMarks);
      if (!scoreCheck.valid) {
        setEvalFeedbackBanner({
          type: 'error',
          message: `${stu.name} (Roll ${stu.rollNumber}): ${scoreCheck.error}`,
        });
        return;
      }

      payload.push({
        studentId: stu.id,
        status: draft.status,
        marksObtained: parsedMarks,
        feedback: draft.feedback,
      });
    }

    setIsSavingEvaluations(true);
    try {
      await saveStudentEvaluations(activeCoursework.id, payload);
      setDirtyStudentIds(new Set());
      setEvalFeedbackBanner({
        type: 'success',
        message: `Saved evaluations for ${payload.length} student${payload.length === 1 ? '' : 's'}.`,
      });
    } catch (err: any) {
      setEvalFeedbackBanner({
        type: 'error',
        message: err?.message || 'Unable to save student evaluations.',
      });
    } finally {
      setIsSavingEvaluations(false);
    }
  };

  const handleMarkPendingAsMissing = () => {
    if (!activeCoursework) return;
    activeCourseStudents.forEach(stu => {
      const current = drafts[stu.id];
      if (!current || current.status === 'pending') {
        updateStudentDraft(stu.id, prev => ({
          ...prev,
          status: 'missing',
          marksInput: prev.marksInput || '0',
        }));
      }
    });
  };

  const handleExportCsv = () => {
    if (!activeCoursework) return;
    const csv = exportCourseworkEvaluationsToCSV({
      coursework: activeCoursework,
      subject: activeSubject,
      students,
      evaluations: studentEvaluations,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = activeCoursework.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.download = `${activeSubject?.code || 'course'}-${activeCoursework.part}-${slug || 'evaluations'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteCoursework = async (courseworkId: string) => {
    try {
      await deleteCourseworkAssignment(courseworkId);
      setConfirmDeleteId(null);
      setEvalFeedbackBanner({
        type: 'success',
        message: 'Assignment and associated evaluation records removed.',
      });
    } catch (err: any) {
      setEvalFeedbackBanner({
        type: 'error',
        message: err?.message || 'Unable to delete assignment.',
      });
    }
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">
      {/* Editorial Header */}
      <div className="pb-5 sm:pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700">Coursework &amp; Assessment</span>
            <span>·</span>
            <span>BTEB Probidhan 2022</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{isAdmin ? 'Institution-Wide View' : 'Assigned Courses Only'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Student Assignments &amp; Evaluation
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Create Theory and Practical assignments, track submission status per student, award marks with written feedback, and review cumulative student standing.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          disabled={creatableCourseOptions.length === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Create Assignment</span>
        </button>
      </div>

      {/* Mode Switcher & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Assignment Workspace Mode"
          className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl sm:rounded-lg w-full sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'tracker'}
            onClick={() => setViewMode('tracker')}
            className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'tracker'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assignment Tracker
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'summary'}
            onClick={() => setViewMode('summary')}
            className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'summary'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Evaluation Summary
          </button>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <div className="relative col-span-2 sm:flex-initial sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student or roll..."
              aria-label="Search student name or roll number"
              className="w-full h-9 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>

          <select
            aria-label="Filter by subject"
            value={selectedSubjectFilter}
            onChange={e => setSelectedSubjectFilter(e.target.value)}
            className="w-full sm:w-auto sm:max-w-[240px] h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 truncate"
          >
            <option value="all">
              {isAdmin ? 'All Subjects' : 'All Assigned Subjects'}
            </option>
            {[...roleScope.visibleSubjects]
              .sort((a, b) => a.code.localeCompare(b.code))
              .map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.code} · {sub.name}
                </option>
              ))}
          </select>

          <select
            aria-label="Filter by subject part"
            value={selectedPartFilter}
            onChange={e => setSelectedPartFilter(e.target.value as 'all' | SubjectPart)}
            className="w-full sm:w-auto h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          >
            <option value="all">All Parts</option>
            <option value="theory">Theory</option>
            <option value="practical">Practical</option>
          </select>
        </div>
      </div>

      {/* Empty Assignment State */}
      {creatableCourseOptions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
          <h2 className="text-sm font-bold text-slate-900">
            No Assigned Subjects Available
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Ask your department administrator to allocate at least one Theory or Practical subject to your faculty profile before creating student assignments.
          </p>
        </div>
      )}

      {/* MODE 1: ASSIGNMENT TRACKER (MASTER - DETAIL) */}
      {creatableCourseOptions.length > 0 && viewMode === 'tracker' && (
        <>
          {filteredCoursework.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <ClipboardList className="w-9 h-9 text-slate-400 mx-auto mb-3" />
              <h2 className="text-base font-bold text-slate-900">
                No Coursework Assignments Created Yet
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                Create your first Theory homework or Practical lab task to start tracking student submissions, marks, and teacher feedback.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-5 inline-flex items-center gap-2 h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Assignment</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Panel: Assignment Selector List */}
              <div className="lg:col-span-4 space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Assignments ({filteredCoursework.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {filteredCoursework.map(cw => {
                    const sub = subjects.find(s => s.id === cw.subjectId);
                    const cls = classes.find(c => c.id === cw.classId);
                    const progress = calculateCourseworkProgress(cw, students, studentEvaluations);
                    const isSelected = activeCoursework?.id === cw.id;

                    return (
                      <button
                        key={cw.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourseworkId(cw.id);
                          setEvalFeedbackBanner(null);
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-white border-emerald-600 ring-1 ring-emerald-600/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
                          <span className="font-mono font-semibold text-slate-700 truncate">
                            {sub?.code || 'Course'} · {cw.part === 'practical' ? 'Practical' : 'Theory'}
                          </span>
                          <span className="font-mono shrink-0">Due {cw.dueDate}</span>
                        </div>

                        <p className="text-sm font-bold text-slate-900 mt-1 line-clamp-2">
                          {cw.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {cls ? `${cls.name} · ${cls.section}` : sub?.name}
                        </p>

                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 transition-all"
                              style={{ width: `${Math.min(100, progress.completionRate)}%` }}
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                            <span>
                              {progress.completedCount}/{progress.totalStudents} submitted
                            </span>
                            <span className="font-mono font-medium text-slate-700">
                              {progress.averagePercentage !== null
                                ? `Avg ${progress.averagePercentage}%`
                                : `Max ${cw.maxMarks} pts`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Selected Assignment Grading Ledger */}
              {activeCoursework && activeProgress && (
                <div className="lg:col-span-8 space-y-4">
                  {/* Detail Header Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                          <span className="font-mono font-semibold text-slate-800">
                            {activeSubject?.code}
                          </span>
                          <span>·</span>
                          <span>{activeSubject?.name}</span>
                          <span>·</span>
                          <span className="font-semibold text-emerald-700">
                            {activeCoursework.part === 'practical' ? 'Practical' : 'Theory'}
                          </span>
                          {activeClassGroup && (
                            <>
                              <span>·</span>
                              <span>{activeClassGroup.name}</span>
                            </>
                          )}
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                          {activeCoursework.title}
                        </h2>
                        {activeCoursework.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {activeCoursework.description}
                          </p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span>Assigned {activeCoursework.assignedDate}</span>
                          <span>·</span>
                          <span>Due {activeCoursework.dueDate}</span>
                          <span>·</span>
                          <span className="font-semibold text-slate-700">
                            Max {activeCoursework.maxMarks} Marks
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleMarkPendingAsMissing}
                          disabled={activeCourseStudents.length === 0}
                          className="h-8 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          title="Mark all pending students as missing (0 marks)"
                        >
                          Mark Pending Missing
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          disabled={activeCourseStudents.length === 0}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Export CSV</span>
                        </button>

                        {confirmDeleteId === activeCoursework.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteCoursework(activeCoursework.id)}
                              className="h-8 px-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg whitespace-nowrap"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="h-8 px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(activeCoursework.id)}
                            aria-label={`Delete assignment ${activeCoursework.title}`}
                            className="inline-flex items-center justify-center h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors shrink-0"
                            title="Delete assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4-Column Tabular KPI Strip */}
                    <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Enrolled
                        </span>
                        <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                          {activeProgress.totalStudents}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Submitted
                        </span>
                        <span className="text-lg font-bold text-emerald-700 mt-0.5 block">
                          {activeProgress.completedCount}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Graded
                        </span>
                        <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                          {activeProgress.gradedCount}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Class Avg
                        </span>
                        <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                          {activeProgress.averagePercentage !== null
                            ? `${activeProgress.averagePercentage}%`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Banner */}
                  {evalFeedbackBanner && (
                    <div
                      role="status"
                      className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                        evalFeedbackBanner.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {evalFeedbackBanner.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{evalFeedbackBanner.message}</span>
                    </div>
                  )}

                  {/* Evaluation Ledger Card */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {(['all', 'pending', 'submitted', 'late', 'graded', 'missing'] as const).map(
                          st => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setStatusFilter(st)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                                statusFilter === st
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {dirtyStudentIds.size > 0 && (
                          <span className="text-xs font-medium text-amber-700 tabular-nums whitespace-nowrap">
                            {dirtyStudentIds.size} unsaved edit{dirtyStudentIds.size === 1 ? '' : 's'}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveEvaluations}
                          disabled={isSavingEvaluations || activeCourseStudents.length === 0}
                          className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingEvaluations ? 'Saving...' : 'Save Evaluations'}</span>
                        </button>
                      </div>
                    </div>

                    {activeCourseStudents.length === 0 ? (
                      <div className="p-10 text-center text-xs text-slate-500">
                        No active students are enrolled in {activeClassGroup?.name || 'this class'} yet.
                      </div>
                    ) : displayedStudentsInTracker.length === 0 ? (
                      <div className="p-10 text-center text-xs text-slate-500">
                        No students match the current status filter or search query.
                      </div>
                    ) : (
                      <>
                        {/* Mobile Evaluation Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                          {displayedStudentsInTracker.map(stu => {
                            const draft = drafts[stu.id] || {
                              status: 'pending' as AssignmentSubmissionStatus,
                              marksInput: '',
                              feedback: '',
                            };
                            const numericVal =
                              draft.marksInput.trim() === '' ? null : Number(draft.marksInput);
                            const isOutOfBounds =
                              numericVal !== null &&
                              (!Number.isFinite(numericVal) ||
                                numericVal < 0 ||
                                numericVal > activeCoursework.maxMarks);

                            return (
                              <div key={stu.id} className="p-4 space-y-3 text-xs">
                                <div className="flex items-center gap-2.5">
                                  <Avatar src={stu.avatar} name={stu.name} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900 truncate">
                                      {stu.name}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-500">
                                      Roll {stu.rollNumber}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                      Status
                                    </label>
                                    <select
                                      aria-label={`Submission status for ${stu.name}`}
                                      value={draft.status}
                                      onChange={e => {
                                        const nextStatus = e.target.value as AssignmentSubmissionStatus;
                                        updateStudentDraft(stu.id, prev => ({
                                          ...prev,
                                          status: nextStatus,
                                          marksInput:
                                            nextStatus === 'missing' && prev.marksInput === ''
                                              ? '0'
                                              : prev.marksInput,
                                        }));
                                      }}
                                      className="w-full h-9 px-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800"
                                    >
                                      {STATUS_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                      Marks (/{activeCoursework.maxMarks})
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={activeCoursework.maxMarks}
                                      step="0.5"
                                      aria-label={`Marks for ${stu.name}`}
                                      value={draft.marksInput}
                                      placeholder="—"
                                      onChange={e => {
                                        const raw = e.target.value;
                                        const num = raw.trim() === '' ? null : Number(raw);
                                        updateStudentDraft(stu.id, prev => {
                                          let nextStatus = prev.status;
                                          if (
                                            num !== null &&
                                            Number.isFinite(num) &&
                                            num >= 0 &&
                                            num <= activeCoursework.maxMarks &&
                                            (prev.status === 'pending' || prev.status === 'submitted')
                                          ) {
                                            nextStatus = 'graded';
                                          }
                                          return {
                                            ...prev,
                                            marksInput: raw,
                                            status: nextStatus,
                                          };
                                        });
                                      }}
                                      className={`w-full h-9 px-2.5 font-mono text-xs bg-white border rounded-lg ${
                                        isOutOfBounds
                                          ? 'border-rose-500 text-rose-700'
                                          : 'border-slate-200 text-slate-900'
                                      }`}
                                    />
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  aria-label={`Feedback for ${stu.name}`}
                                  value={draft.feedback}
                                  placeholder="Remarks or evaluation notes..."
                                  onChange={e =>
                                    updateStudentDraft(stu.id, prev => ({
                                      ...prev,
                                      feedback: e.target.value,
                                    }))
                                  }
                                  className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Evaluation Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                <th className="py-2.5 px-4">Roll</th>
                                <th className="py-2.5 px-4">Student</th>
                                <th className="py-2.5 px-4">Status</th>
                                <th className="py-2.5 px-4">Marks (/{activeCoursework.maxMarks})</th>
                                <th className="py-2.5 px-4">Teacher Feedback</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {displayedStudentsInTracker.map(stu => {
                                const draft = drafts[stu.id] || {
                                  status: 'pending' as AssignmentSubmissionStatus,
                                  marksInput: '',
                                  feedback: '',
                                };
                                const numericVal =
                                  draft.marksInput.trim() === '' ? null : Number(draft.marksInput);
                                const pct =
                                  numericVal !== null &&
                                  Number.isFinite(numericVal) &&
                                  numericVal >= 0 &&
                                  numericVal <= activeCoursework.maxMarks
                                    ? Math.round((numericVal / activeCoursework.maxMarks) * 100)
                                    : null;
                                const isOutOfBounds =
                                  numericVal !== null &&
                                  (!Number.isFinite(numericVal) ||
                                    numericVal < 0 ||
                                    numericVal > activeCoursework.maxMarks);

                                return (
                                  <tr key={stu.id} className="hover:bg-slate-50/60">
                                    <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-slate-700 whitespace-nowrap">
                                      {stu.rollNumber}
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <div className="flex items-center gap-2.5 min-w-[160px]">
                                        <Avatar src={stu.avatar} name={stu.name} size="sm" />
                                        <div className="min-w-0">
                                          <p className="font-semibold text-slate-900 truncate">
                                            {stu.name}
                                          </p>
                                          {stu.registrationNumber && (
                                            <p className="text-[11px] font-mono text-slate-400">
                                              Reg {stu.registrationNumber}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <select
                                        aria-label={`Submission status for ${stu.name}`}
                                        value={draft.status}
                                        onChange={e => {
                                          const nextStatus = e.target.value as AssignmentSubmissionStatus;
                                          updateStudentDraft(stu.id, prev => ({
                                            ...prev,
                                            status: nextStatus,
                                            marksInput:
                                              nextStatus === 'missing' && prev.marksInput === ''
                                                ? '0'
                                                : prev.marksInput,
                                          }));
                                        }}
                                        className="h-8 px-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                      >
                                        {STATUS_OPTIONS.map(opt => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <div className="flex items-center gap-2 tabular-nums">
                                        <input
                                          type="number"
                                          min={0}
                                          max={activeCoursework.maxMarks}
                                          step="0.5"
                                          aria-label={`Marks for ${stu.name}`}
                                          value={draft.marksInput}
                                          placeholder="—"
                                          onChange={e => {
                                            const raw = e.target.value;
                                            const num = raw.trim() === '' ? null : Number(raw);
                                            updateStudentDraft(stu.id, prev => {
                                              let nextStatus = prev.status;
                                              if (
                                                num !== null &&
                                                Number.isFinite(num) &&
                                                num >= 0 &&
                                                num <= activeCoursework.maxMarks &&
                                                (prev.status === 'pending' || prev.status === 'submitted')
                                              ) {
                                                nextStatus = 'graded';
                                              }
                                              return {
                                                ...prev,
                                                marksInput: raw,
                                                status: nextStatus,
                                              };
                                            });
                                          }}
                                          className={`w-20 h-8 px-2 font-mono text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 ${
                                            isOutOfBounds
                                              ? 'border-rose-500 text-rose-700 focus:ring-rose-500/20'
                                              : 'border-slate-200 text-slate-900 focus:ring-emerald-600/20 focus:border-emerald-600'
                                          }`}
                                        />
                                        <span className="text-[11px] font-mono text-slate-400 w-10">
                                          {pct !== null ? `${pct}%` : ''}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-4 min-w-[180px]">
                                      <input
                                        type="text"
                                        aria-label={`Feedback for ${stu.name}`}
                                        value={draft.feedback}
                                        placeholder="Remarks or evaluation notes..."
                                        onChange={e =>
                                          updateStudentDraft(stu.id, prev => ({
                                            ...prev,
                                            feedback: e.target.value,
                                          }))
                                        }
                                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODE 2: STUDENT EVALUATION SUMMARY */}
      {creatableCourseOptions.length > 0 && viewMode === 'summary' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Cumulative Student Evaluation Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregated coursework marks, missing work, qualitative standing, and attendance rate across {filteredCoursework.length} visible assignment{filteredCoursework.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>

          {summaryRows.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No students match the selected course filters.
            </div>
          ) : (
            <>
              {/* Mobile Evaluation Summary Cards */}
              <div className="md:hidden divide-y divide-slate-100 text-xs tabular-nums">
                {summaryRows.map(({ student, classGroup, evalSummary, attendanceStats }) => (
                  <div key={student.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={student.avatar} name={student.name} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono font-semibold text-slate-800">
                              #{student.rollNumber}
                            </span>
                            <span className="truncate">
                              · {classGroup?.name || student.classId}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {student.name}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0 ${getStandingClasses(
                          evalSummary.standing
                        )}`}
                      >
                        {evalSummary.standing}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50/80 border border-slate-200/80 p-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Tasks</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {evalSummary.submittedCount + evalSummary.lateCount + evalSummary.gradedCount}/{evalSummary.totalAssignments}
                          {evalSummary.missingCount > 0 && (
                            <span className="text-rose-700"> ({evalSummary.missingCount} miss)</span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Score</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {evalSummary.totalMaxMarks > 0 && evalSummary.averagePercentage !== null
                            ? `${evalSummary.averagePercentage}%`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Attendance</span>
                        <span
                          className={`font-mono font-semibold ${
                            attendanceStats.totalSessions === 0
                              ? 'text-slate-400'
                              : attendanceStats.isAtRisk
                                ? 'text-rose-700'
                                : 'text-slate-900'
                          }`}
                        >
                          {attendanceStats.totalSessions > 0
                            ? `${attendanceStats.attendancePercentage}%`
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectedStudent(student)}
                      aria-label={`Evaluate breakdown for ${student.name}`}
                      className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View Breakdown</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop Evaluation Summary Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-4">Roll</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Assigned</th>
                      <th className="py-2.5 px-4">Submitted · Graded</th>
                      <th className="py-2.5 px-4">Missing</th>
                      <th className="py-2.5 px-4">Cumulative Score</th>
                      <th className="py-2.5 px-4">Attendance</th>
                      <th className="py-2.5 px-4">Standing</th>
                      <th className="py-2.5 px-4 text-right">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs tabular-nums">
                    {summaryRows.map(({ student, classGroup, evalSummary, attendanceStats }) => (
                      <tr key={student.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                          {student.rollNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={student.avatar} name={student.name} size="sm" />
                            <div>
                              <p className="font-semibold text-slate-900">{student.name}</p>
                              <p className="text-[11px] text-slate-500">
                                {classGroup?.name || student.classId}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {evalSummary.totalAssignments}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {evalSummary.submittedCount + evalSummary.lateCount + evalSummary.gradedCount}{' '}
                          <span className="text-slate-400">· {evalSummary.gradedCount} graded</span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={
                              evalSummary.missingCount > 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'
                            }
                          >
                            {evalSummary.missingCount}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {evalSummary.totalMaxMarks > 0 && evalSummary.averagePercentage !== null ? (
                            <span>
                              {evalSummary.totalMarksObtained}/{evalSummary.totalMaxMarks}{' '}
                              <span className="text-emerald-700">({evalSummary.averagePercentage}%)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {attendanceStats.totalSessions > 0 ? (
                            <span
                              className={
                                attendanceStats.isAtRisk
                                  ? 'text-rose-700 font-semibold'
                                  : 'text-slate-700 font-medium'
                              }
                            >
                              {attendanceStats.attendancePercentage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${getStandingClasses(
                              evalSummary.standing
                            )}`}
                          >
                            {evalSummary.standing}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedStudent(student)}
                            aria-label={`Evaluate breakdown for ${student.name}`}
                            className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* CREATE ASSIGNMENT MODAL */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-assignment-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 id="create-assignment-title" className="text-base font-bold text-slate-900">
                  Create Coursework Assignment
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign homework, lab sheet, or continuous assessment task.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close create assignment modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="cw-course-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Subject &amp; Course Part
                </label>
                <select
                  id="cw-course-select"
                  value={createCourseKey}
                  onChange={e => setCreateCourseKey(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  required
                >
                  {creatableCourseOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="cw-title-input"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Assignment Title
                </label>
                <input
                  id="cw-title-input"
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="e.g., Assignment 01: Linked List Traversal"
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="cw-assigned-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Assigned Date
                  </label>
                  <input
                    id="cw-assigned-date"
                    type="date"
                    value={createAssignedDate}
                    onChange={e => setCreateAssignedDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="cw-due-date"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Due Date
                  </label>
                  <input
                    id="cw-due-date"
                    type="date"
                    value={createDueDate}
                    onChange={e => setCreateDueDate(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="cw-max-marks"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Max Marks
                  </label>
                  <input
                    id="cw-max-marks"
                    type="number"
                    min={1}
                    max={1000}
                    value={createMaxMarks}
                    onChange={e => setCreateMaxMarks(e.target.value)}
                    className="w-full h-10 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cw-description"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Instructions / Evaluation Rubric (Optional)
                </label>
                <textarea
                  id="cw-description"
                  rows={3}
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  placeholder="Optional submission requirements or grading notes..."
                  className="w-full p-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="h-9 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT EVALUATION BREAKDOWN MODAL */}
      {inspectedStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-eval-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Avatar src={inspectedStudent.avatar} name={inspectedStudent.name} size="md" />
                <div>
                  <h2 id="student-eval-modal-title" className="text-base font-bold text-slate-900">
                    {inspectedStudent.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    Roll {inspectedStudent.rollNumber}
                    {inspectedStudent.registrationNumber
                      ? ` · Reg ${inspectedStudent.registrationNumber}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                aria-label="Close student evaluation breakdown"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const stuSummary = calculateStudentCourseworkSummary(
                inspectedStudent,
                filteredCoursework,
                studentEvaluations
              );
              const scopedSessions = roleScope.visibleSessions.filter(s => {
                if (selectedSubjectFilter !== 'all' && s.subjectId !== selectedSubjectFilter) {
                  return false;
                }
                if (selectedPartFilter !== 'all' && (s.part || 'theory') !== selectedPartFilter) {
                  return false;
                }
                return true;
              });
              const attStats = calculateStudentAttendanceStats(
                inspectedStudent,
                scopedSessions,
                records
              );
              const studentAssignments = filteredCoursework.filter(
                cw => cw.classId === inspectedStudent.classId
              );

              return (
                <div className="p-6 overflow-y-auto space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Cumulative Score</span>
                      <span className="text-base font-bold text-slate-900 mt-0.5 block">
                        {stuSummary.averagePercentage !== null
                          ? `${stuSummary.averagePercentage}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Total Marks</span>
                      <span className="text-base font-bold text-slate-900 mt-0.5 block">
                        {stuSummary.totalMaxMarks > 0
                          ? `${stuSummary.totalMarksObtained}/${stuSummary.totalMaxMarks}`
                          : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Attendance</span>
                      <span className="text-base font-bold text-slate-900 mt-0.5 block">
                        {attStats.totalSessions > 0 ? `${attStats.attendancePercentage}%` : '—'}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Standing</span>
                      <span className="text-sm font-bold text-emerald-700 mt-1 block">
                        {stuSummary.standing}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                      Assignment-by-Assignment Breakdown
                    </h3>
                    {studentAssignments.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">
                        No assignments found for this student&apos;s class batch.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {studentAssignments.map(cw => {
                          const ev = studentEvaluations.find(
                            item => item.courseworkId === cw.id && item.studentId === inspectedStudent.id
                          );
                          const sub = subjects.find(s => s.id === cw.subjectId);
                          const status = ev?.status || 'pending';
                          const hasMark = typeof ev?.marksObtained === 'number';
                          return (
                            <div
                              key={cw.id}
                              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span className="font-mono font-semibold text-slate-700">
                                    {sub?.code}
                                  </span>
                                  <span>·</span>
                                  <span>{cw.part === 'practical' ? 'Practical' : 'Theory'}</span>
                                  <span>·</span>
                                  <span className="font-mono">Due {cw.dueDate}</span>
                                </div>
                                <p className="font-semibold text-slate-900 mt-0.5">{cw.title}</p>
                                {ev?.feedback && (
                                  <p className="text-slate-600 mt-1">Feedback: {ev.feedback}</p>
                                )}
                              </div>
                              <div className="text-left sm:text-right font-mono tabular-nums shrink-0">
                                <span className="block font-semibold text-slate-900 capitalize">
                                  {status}
                                  {hasMark ? ` · ${ev!.marksObtained}/${cw.maxMarks}` : ''}
                                </span>
                                {hasMark && cw.maxMarks > 0 && (
                                  <span className="text-[11px] text-emerald-700">
                                    {Math.round((ev!.marksObtained! / cw.maxMarks) * 100)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

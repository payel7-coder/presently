import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceStatus, Student, SubjectPart } from '../types/attendance';
import { Avatar } from './Avatar';
import {
  CheckCircle2,
  Search,
  Check,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  FileCheck,
  Grid,
  List,
  Flame,
  ArrowRight,
  FileText,
  AlertCircle,
  X
} from 'lucide-react';
import { calculateStudentAttendanceStats } from '../utils/attendanceLogic';
import { DownloadRegisterModal } from './DownloadRegisterModal';

interface AttendanceStudioProps {
  initialSubjectId?: string;
  initialPart?: SubjectPart;
  onNavigateToReports: (subjectId?: string, part?: SubjectPart) => void;
}

export const AttendanceStudio: React.FC<AttendanceStudioProps> = ({
  initialSubjectId,
  initialPart,
  onNavigateToReports,
}) => {
  const {
    currentUser,
    getTeacherSubjects,
    getClassStudents,
    saveAttendanceSession,
    getSessionByDate,
    getSessionRecords,
    sessions,
    records,
    students,
  } = useAttendance();

  const assignedSubjects = currentUser ? getTeacherSubjects(currentUser.id) : [];

  const findInitialAssignmentId = () => {
    if (initialSubjectId) {
      const exactMatch = assignedSubjects.find(
        item =>
          item.subject.id === initialSubjectId &&
          (!initialPart || (item.assignment.part || 'theory') === initialPart)
      );
      if (exactMatch) return exactMatch.assignment.id;
      const subjectMatch = assignedSubjects.find(item => item.subject.id === initialSubjectId);
      if (subjectMatch) return subjectMatch.assignment.id;
    }
    return assignedSubjects.length > 0 ? assignedSubjects[0].assignment.id : '';
  };

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(findInitialAssignmentId);

  useEffect(() => {
    if (assignedSubjects.length === 0) return;
    if (initialSubjectId) {
      const target = assignedSubjects.find(
        item =>
          item.subject.id === initialSubjectId &&
          (!initialPart || (item.assignment.part || 'theory') === initialPart)
      );
      if (target) {
        setSelectedAssignmentId(target.assignment.id);
        return;
      }
    }
    if (!assignedSubjects.some(item => item.assignment.id === selectedAssignmentId)) {
      setSelectedAssignmentId(assignedSubjects[0].assignment.id);
    }
  }, [assignedSubjects, initialSubjectId, initialPart, selectedAssignmentId]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const isFutureDate = sessionDate > today;
  const [topic, setTopic] = useState<string>('');

  const activeAssignment = assignedSubjects.find(item => item.assignment.id === selectedAssignmentId);
  const activeSubject = activeAssignment?.subject;
  const activeClass = activeAssignment?.classGroup;
  const activePart: SubjectPart = activeAssignment?.assignment.part || 'theory';
  const activeSubjectId = activeSubject?.id || '';

  const classStudents = useMemo(() => {
    return activeClass ? getClassStudents(activeClass.id) : [];
  }, [activeClass, getClassStudents]);

  const [statuses, setStatuses] = useState<Record<string, { status: AttendanceStatus; remarks?: string }>>({});
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [activeRemarkStudent, setActiveRemarkStudent] = useState<Student | null>(null);
  const [remarkInput, setRemarkInput] = useState('');

  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submittedSessionInfo, setSubmittedSessionInfo] = useState<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  } | null>(null);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    if (!activeSubjectId || !sessionDate || classStudents.length === 0) return;

    const existing = getSessionByDate(activeSubjectId, sessionDate, activePart);
    if (existing) {
      setExistingSessionId(existing.id);
      setTopic(existing.topic || '');
      const existingRecs = getSessionRecords(existing.id);
      const initialMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
      classStudents.forEach(stu => {
        const found = existingRecs.find(r => r.studentId === stu.id);
        initialMap[stu.id] = {
          status: found ? found.status : 'present',
          remarks: found?.remarks,
        };
      });
      setStatuses(initialMap);
    } else {
      setExistingSessionId(null);
      setTopic('');
      const initialMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
      classStudents.forEach(stu => {
        initialMap[stu.id] = { status: 'present' };
      });
      setStatuses(initialMap);
    }
  }, [activeSubjectId, activePart, sessionDate, classStudents.length]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const cycleStatus = (studentId: string) => {
    const current = statuses[studentId]?.status || 'present';
    const sequence: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];
    const nextIndex = (sequence.indexOf(current) + 1) % sequence.length;
    setStudentStatus(studentId, sequence[nextIndex]);
  };

  const markAll = (status: AttendanceStatus) => {
    const nextMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
    classStudents.forEach(stu => {
      nextMap[stu.id] = {
        status,
        remarks: statuses[stu.id]?.remarks,
      };
    });
    setStatuses(nextMap);
  };

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    const total = classStudents.length;

    Object.values(statuses).forEach(item => {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else if (item.status === 'excused') excused++;
    });

    const rate = total > 0 ? Math.round(((present + late * 0.75 + excused) / total) * 100) : 0;
    return { total, present, absent, late, excused, rate };
  }, [statuses, classStudents.length]);

  const filteredStudents = useMemo(() => {
    return classStudents.filter(student => {
      const currentStatus = statuses[student.id]?.status || 'present';
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = statusFilter === 'all' || currentStatus === statusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [classStudents, statuses, searchQuery, statusFilter]);

  const handleSaveAttendance = async () => {
    if (!activeSubject || !activeClass || isFutureDate) return;

    try {
      const partLabel = activePart === 'practical' ? 'Practical' : 'Theory';
      const saved = await saveAttendanceSession(
        {
          id: existingSessionId || undefined,
          subjectId: activeSubject.id,
          classId: activeClass.id,
          teacherId: currentUser?.id || '',
          part: activePart,
          date: sessionDate,
          topic: topic || `${activeSubject.name} (${partLabel})`,
        },
        statuses
      );

      setSubmittedSessionInfo({
        present: saved.presentCount,
        absent: saved.absentCount,
        late: saved.lateCount,
        excused: saved.excusedCount,
        rate: stats.rate,
      });
      setJustSubmitted(true);
    } catch (err) {
      console.error('Error saving attendance:', err);
    }
  };

  if (assignedSubjects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="bg-white rounded-xl border border-slate-200 p-10">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">No Assigned Subjects</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            You currently have no subjects assigned to your faculty account. Contact an administrator to allocate Theory or Practical courses.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Header & Subject Switcher */}
      <div className="pb-5 border-b border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-700">1-Click Roll Call</span>
              <span>·</span>
              <span
                className={`font-semibold px-2 py-0.5 rounded-md ${
                  activePart === 'practical'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                }`}
              >
                {activePart === 'practical' ? 'Practical Session' : 'Theory Session'}
              </span>
              {existingSessionId && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-sky-700 font-medium">
                    <FileCheck className="w-3.5 h-3.5" /> Editing Existing Session
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Take Student Attendance
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a course part, toggle P / A / L / E attendance marks, and commit directly to Firestore.
            </p>
          </div>
        </div>

        {/* Course & Part Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {assignedSubjects.map(({ subject, classGroup, assignment }) => {
            const part: SubjectPart = assignment.part || 'theory';
            const isSelected = assignment.id === selectedAssignmentId;
            return (
              <button
                key={assignment.id}
                type="button"
                onClick={() => {
                  setSelectedAssignmentId(assignment.id);
                  setJustSubmitted(false);
                }}
                className={`px-3.5 py-2 rounded-lg text-left border transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono font-semibold">{subject.code}</span>
                  <span
                    className={`font-semibold uppercase px-1.5 py-0.5 rounded text-[10px] ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : part === 'practical'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {part === 'practical' ? 'Practical' : 'Theory'}
                  </span>
                  <span className={isSelected ? 'text-slate-300' : 'text-slate-400'}>
                    {classGroup.name}
                  </span>
                </div>
                <p className="text-xs font-medium truncate max-w-[190px] mt-0.5">
                  {subject.name}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Session Metadata Controls */}
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Class &amp; Room
            </label>
            <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 flex items-center justify-between">
              <span>{activeClass?.name} · {activeClass?.section}</span>
              <span className="text-[11px] text-slate-500 font-mono">{activeClass?.roomNumber}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Session Date
              </label>
              {sessionDate === today ? (
                <span className="text-[11px] font-medium text-emerald-700">Today</span>
              ) : isFutureDate ? (
                <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Future date invalid
                </span>
              ) : null}
            </div>
            <input
              type="date"
              max={today}
              value={sessionDate}
              onChange={e => {
                setSessionDate(e.target.value);
                setJustSubmitted(false);
              }}
              className={`w-full h-9 px-3 bg-white border rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 transition-colors ${
                isFutureDate
                  ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-500/20'
                  : 'border-slate-300 focus:ring-emerald-600/20 focus:border-emerald-600'
              }`}
            />
            {isFutureDate && (
              <p className="mt-1 text-[11px] font-medium text-rose-600">
                Tomorrow or future dates are not allowed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Lesson / Topic (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Chapter 4 Lab Assessment"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            />
          </div>
        </div>

        {isFutureDate && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-800">
            <div className="flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Selected date ({sessionDate}) is in the future. Choose today ({today}) or an earlier date to record attendance.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSessionDate(today)}
              className="shrink-0 h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors"
            >
              Reset to Today
            </button>
          </div>
        )}
      </div>

      {/* Live Metrics HUD & 1-Click Action Bar */}
      <div className="sticky top-16 z-30 bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4 tabular-nums">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 flex items-center justify-center">
              <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={stats.rate >= 75 ? 'text-emerald-400' : 'text-amber-400'}
                  strokeDasharray={`${stats.rate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-bold tracking-tight">{stats.rate}%</span>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Attendance Rate</p>
              <p className="text-xs font-semibold text-white">
                {stats.present + stats.late + stats.excused} of {stats.total} Attended
              </p>
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {stats.present} Present
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              {stats.absent} Absent
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {stats.late} Late
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-300">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              {stats.excused} Excused
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => markAll('present')}
            disabled={isFutureDate}
            className={`h-9 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-colors border whitespace-nowrap ${
              isFutureDate
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark All Present</span>
          </button>

          <button
            type="button"
            onClick={() => markAll('absent')}
            disabled={isFutureDate}
            className={`hidden sm:flex h-9 items-center gap-1 px-2.5 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap ${
              isFutureDate
                ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isFutureDate}
            className={`h-9 flex items-center gap-1.5 px-4 font-semibold rounded-lg text-xs transition-colors whitespace-nowrap ${
              isFutureDate
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{existingSessionId ? 'Update Attendance' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Banner */}
      {justSubmitted && submittedSessionInfo && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-emerald-950">
                Attendance recorded successfully
              </h3>
              <p className="text-xs text-emerald-800 tabular-nums mt-0.5">
                {activeSubject?.name} ({activePart === 'practical' ? 'Practical' : 'Theory'}) · {sessionDate} — {submittedSessionInfo.present} Present, {submittedSessionInfo.absent} Absent ({submittedSessionInfo.rate}%)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="h-8 px-3 bg-white hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Register</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToReports(activeSubject?.id, activePart)}
              className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>View Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setJustSubmitted(false)}
              className="h-8 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Search, Filter & View Controls */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by student name or roll..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 tabular-nums">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({classStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('present')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === 'present' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Present ({stats.present})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('absent')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === 'absent' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Absent ({stats.absent})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('late')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === 'late' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Late ({stats.late})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('excused')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === 'excused' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            Excused ({stats.excused})
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Card Grid View"
            aria-label="Card Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Table List View"
            aria-label="Table List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Roster Container */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
          <p className="text-sm font-semibold text-slate-700">No students match your filter or search.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-3 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 tabular-nums">
          {filteredStudents.map(student => {
            const currentStatus = statuses[student.id]?.status || 'present';
            const remarks = statuses[student.id]?.remarks;
            const studentStats = calculateStudentAttendanceStats(student, sessions, records);

            const isPresent = currentStatus === 'present';
            const isAbsent = currentStatus === 'absent';
            const isLate = currentStatus === 'late';
            const isExcused = currentStatus === 'excused';

            return (
              <div
                key={student.id}
                className={`bg-white rounded-xl p-4 border transition-colors ${
                  isPresent
                    ? 'border-slate-200 hover:border-slate-300'
                    : isAbsent
                    ? 'border-rose-300 bg-rose-50/20'
                    : isLate
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-sky-300 bg-sky-50/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar src={student.avatar} name={student.name} size="lg" />
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-white ${
                        isPresent
                          ? 'bg-emerald-600'
                          : isAbsent
                          ? 'bg-rose-600'
                          : isLate
                          ? 'bg-amber-600'
                          : 'bg-sky-600'
                      }`}
                    >
                      {currentStatus[0].toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-mono font-semibold text-slate-600">
                        {student.rollNumber}
                      </span>
                      {studentStats.isAtRisk && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          &lt;75%
                        </span>
                      )}
                      {!studentStats.isAtRisk && studentStats.currentStreak >= 3 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700">
                          <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {studentStats.currentStreak}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 truncate mt-1">
                      {student.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      Avg {studentStats.attendancePercentage}% ({studentStats.present}/{studentStats.totalSessions})
                    </p>
                  </div>
                </div>

                {/* 1-Click Status Button Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'present')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col items-center justify-center ${
                      isPresent
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <span>P</span>
                    <span className="text-[9px] font-normal opacity-80">Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'absent')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col items-center justify-center ${
                      isAbsent
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <span>A</span>
                    <span className="text-[9px] font-normal opacity-80">Absent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'late')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col items-center justify-center ${
                      isLate
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    <span>L</span>
                    <span className="text-[9px] font-normal opacity-80">Late</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'excused')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col items-center justify-center ${
                      isExcused
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                    }`}
                  >
                    <span>E</span>
                    <span className="text-[9px] font-normal opacity-80">Excused</span>
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRemarkStudent(student);
                      setRemarkInput(remarks || '');
                    }}
                    className={`inline-flex items-center gap-1 transition-colors ${
                      remarks ? 'text-amber-700 font-medium' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>{remarks ? `Note: ${remarks.slice(0, 18)}` : '+ Add note'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cycleStatus(student.id)}
                    className="text-slate-400 hover:text-slate-600 font-mono text-[10px]"
                    title="Click to cycle status"
                  >
                    cycle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Historical Rate</th>
                  <th className="py-3 px-4 text-center">1-Click Status Controls</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const currentStatus = statuses[student.id]?.status || 'present';
                  const remarks = statuses[student.id]?.remarks;
                  const studentStats = calculateStudentAttendanceStats(student, sessions, records);

                  return (
                    <tr
                      key={student.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        currentStatus === 'absent' ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                        {student.rollNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={student.avatar} name={student.name} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 block">{student.name}</span>
                            <span className="text-[11px] text-slate-400">{student.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold ${
                              studentStats.isAtRisk
                                ? 'text-rose-600'
                                : studentStats.attendancePercentage >= 90
                                ? 'text-emerald-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {studentStats.attendancePercentage}%
                          </span>
                          {studentStats.isAtRisk && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              At Risk
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'present')}
                            className={`w-8 h-7 rounded-md text-xs font-semibold transition-colors ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-600'
                            }`}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'absent')}
                            className={`w-8 h-7 rounded-md text-xs font-semibold transition-colors ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 hover:bg-rose-50 text-slate-600'
                            }`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'late')}
                            className={`w-8 h-7 rounded-md text-xs font-semibold transition-colors ${
                              currentStatus === 'late'
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 hover:bg-amber-50 text-slate-600'
                            }`}
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'excused')}
                            className={`w-8 h-7 rounded-md text-xs font-semibold transition-colors ${
                              currentStatus === 'excused'
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 hover:bg-sky-50 text-slate-600'
                            }`}
                          >
                            E
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRemarkStudent(student);
                            setRemarkInput(remarks || '');
                          }}
                          className="text-xs text-slate-500 hover:text-slate-900 underline truncate max-w-[140px] block"
                        >
                          {remarks || '+ Add note'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remark / Absence Reason Modal */}
      {activeRemarkStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Avatar src={activeRemarkStudent.avatar} name={activeRemarkStudent.name} size="md" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Attendance Note · {activeRemarkStudent.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Roll: {activeRemarkStudent.rollNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRemarkStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for absence, lateness, or excusal
              </label>
              <textarea
                rows={3}
                value={remarkInput}
                onChange={e => setRemarkInput(e.target.value)}
                placeholder="e.g. Medical appointment, transit delay..."
                className="w-full p-3 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Illness / Fever', 'Doctor Appointment', 'Bus Delay', 'Family Emergency', 'Institute Event'].map(
                  preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRemarkInput(preset)}
                      className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700 transition-colors"
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatuses(prev => ({
                    ...prev,
                    [activeRemarkStudent.id]: {
                      ...prev[activeRemarkStudent.id],
                      remarks: undefined,
                    },
                  }));
                  setActiveRemarkStudent(null);
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 font-medium"
              >
                Clear Note
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatuses(prev => ({
                    ...prev,
                    [activeRemarkStudent.id]: {
                      ...prev[activeRemarkStudent.id],
                      remarks: remarkInput.trim() || undefined,
                    },
                  }));
                  setActiveRemarkStudent(null);
                }}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {isPdfModalOpen && activeSubject && activeClass && (
        <DownloadRegisterModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          subject={activeSubject}
          classGroup={activeClass}
          teacher={currentUser}
          students={students}
          sessions={sessions}
          records={records}
          defaultPart={activePart}
        />
      )}
    </div>
  );
};

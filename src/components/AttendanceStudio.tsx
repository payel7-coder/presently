import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceStatus, Student } from '../types/attendance';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Sparkles,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
  RotateCcw,
  MessageSquare,
  FileCheck,
  ChevronRight,
  UserCheck,
  Grid,
  List,
  Flame,
  ArrowRight,
  FileText,
  AlertCircle
} from 'lucide-react';
import { calculateStudentAttendanceStats } from '../utils/attendanceLogic';
import { DownloadRegisterModal } from './DownloadRegisterModal';

interface AttendanceStudioProps {
  initialSubjectId?: string;
  onNavigateToReports: (subjectId?: string) => void;
}

export const AttendanceStudio: React.FC<AttendanceStudioProps> = ({
  initialSubjectId,
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

  // Selected subject
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId && assignedSubjects.some(item => item.subject.id === initialSubjectId)) {
      return initialSubjectId;
    }
    return assignedSubjects.length > 0 ? assignedSubjects[0].subject.id : '';
  });

  // If assignedSubjects changes or initialSubjectId updates
  useEffect(() => {
    if (assignedSubjects.length > 0 && !assignedSubjects.some(item => item.subject.id === selectedSubjectId)) {
      setSelectedSubjectId(assignedSubjects[0].subject.id);
    }
  }, [assignedSubjects, selectedSubjectId]);

  // Date & validation (tomorrow / future dates are strictly prohibited)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [sessionDate, setSessionDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const isFutureDate = sessionDate > today;
  const [topic, setTopic] = useState<string>('');

  // Active Subject details
  const activeAssignment = assignedSubjects.find(item => item.subject.id === selectedSubjectId);
  const activeSubject = activeAssignment?.subject;
  const activeClass = activeAssignment?.classGroup;

  // Students in class
  const classStudents = useMemo(() => {
    return activeClass ? getClassStudents(activeClass.id) : [];
  }, [activeClass, getClassStudents]);

  // Attendance status dictionary: studentId -> { status, remarks }
  const [statuses, setStatuses] = useState<Record<string, { status: AttendanceStatus; remarks?: string }>>({});
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);

  // Search and view mode
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Remarks modal
  const [activeRemarkStudent, setActiveRemarkStudent] = useState<Student | null>(null);
  const [remarkInput, setRemarkInput] = useState('');

  // Submission state
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submittedSessionInfo, setSubmittedSessionInfo] = useState<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number;
  } | null>(null);

  // PDF Register Modal
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Initialize or load existing records when subject or date changes
  useEffect(() => {
    if (!selectedSubjectId || !sessionDate || classStudents.length === 0) return;

    const existing = getSessionByDate(selectedSubjectId, sessionDate);
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
      // Default all to 'present' for fast 1-click experience!
      const initialMap: Record<string, { status: AttendanceStatus; remarks?: string }> = {};
      classStudents.forEach(stu => {
        initialMap[stu.id] = { status: 'present' };
      });
      setStatuses(initialMap);
    }
  }, [selectedSubjectId, sessionDate, classStudents.length]);

  // Single-Click handlers
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

  // Metrics
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

  // Filtered student list
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
    if (!activeSubject || !activeClass) return;

    if (isFutureDate) {
      alert(`Attendance cannot be taken for future dates (${sessionDate}). Please select today (${today}) or an earlier date.`);
      return;
    }

    try {
      const saved = await saveAttendanceSession(
        {
          id: existingSessionId || undefined,
          subjectId: activeSubject.id,
          classId: activeClass.id,
          teacherId: currentUser?.id || '',
          date: sessionDate,
          topic: topic || `${activeSubject.name} Lecture`,
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
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Assigned Subjects</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
          You currently have no subjects assigned to your teacher account. Please switch to the{' '}
          <strong className="text-indigo-600">Admin profile</strong> to assign subjects to teachers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Subject Selector */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" /> 1-Click Roll Call Mode
              </span>
              {existingSessionId && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-800">
                  <FileCheck className="w-3.5 h-3.5" /> Editing Existing Session
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Take Student Attendance
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Select class, click status badges or use bulk 1-click tools, and save instantly.
            </p>
          </div>

          {/* Quick Subject Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {assignedSubjects.map(({ subject, classGroup }) => {
              const isSelected = subject.id === selectedSubjectId;
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(subject.id);
                    setJustSubmitted(false);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-left border transition-all shrink-0 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/20'
                      : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      {subject.code}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
                      {classGroup.name}
                    </span>
                  </div>
                  <p className="text-xs font-medium truncate max-w-[170px] mt-0.5">
                    {subject.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Session Metadata Controls */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Class & Room
            </label>
            <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>{activeClass?.name} - {activeClass?.section}</span>
              <span className="text-[10px] text-slate-500 font-mono">{activeClass?.roomNumber}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Session Date
              </label>
              {sessionDate === today ? (
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                  Today
                </span>
              ) : isFutureDate ? (
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <AlertCircle className="w-2.5 h-2.5" /> Future Date
                </span>
              ) : null}
            </div>
            <div className="relative">
              <input
                type="date"
                max={today}
                value={sessionDate}
                onChange={e => {
                  setSessionDate(e.target.value);
                  setJustSubmitted(false);
                }}
                className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold text-slate-800 transition-colors ${
                  isFutureDate
                    ? 'border-rose-400 bg-rose-50/60 text-rose-900 focus:ring-2 focus:ring-rose-500'
                    : 'border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-emerald-500'
                }`}
              />
            </div>
            {isFutureDate && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Tomorrow or future dates are not allowed
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Lesson / Topic (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Chapter 4 Practice Quiz"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-emerald-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Future Date Blocking Alert */}
        {isFutureDate && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-800 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs">
                <strong className="font-bold">Cannot take attendance for tomorrow or future dates:</strong>{' '}
                Selected date ({sessionDate}) is in the future. Please select today ({today}) or a past date to take attendance.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSessionDate(today)}
              className="shrink-0 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
            >
              Reset to Today
            </button>
          </div>
        )}
      </div>

      {/* Live Metrics HUD & 1-Click Action Bar */}
      <div className="sticky top-16 z-30 bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        {/* Quick Counters */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
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
              <span className="absolute text-xs font-black tracking-tight">{stats.rate}%</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Attendance Rate</p>
              <p className="text-sm font-extrabold text-white">
                {stats.present + stats.late + stats.excused} of {stats.total} Attended
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" />

          {/* Breakdown pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {stats.present} Present
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              {stats.absent} Absent
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {stats.late} Late
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              {stats.excused} Excused
            </span>
          </div>
        </div>

        {/* 1-Click Batch Actions + Save Button */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Mark All Present 1-Click CTA */}
          <button
            type="button"
            onClick={() => markAll('present')}
            disabled={isFutureDate}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
              isFutureDate
                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                : 'bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 hover:text-white border-emerald-500/30'
            }`}
            title={isFutureDate ? 'Cannot take attendance for tomorrow or future dates' : 'Single-click to mark all students present'}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>Mark All Present</span>
          </button>

          <button
            type="button"
            onClick={() => markAll('absent')}
            disabled={isFutureDate}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border ${
              isFutureDate
                ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed opacity-60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
            }`}
            title={isFutureDate ? 'Future date selected' : 'Mark all absent'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          {/* Submit CTA */}
          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isFutureDate}
            className={`flex items-center gap-2 px-5 py-2.5 font-black rounded-xl text-xs tracking-wide transition-all shadow-lg ${
              isFutureDate
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none opacity-60'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25 active:scale-95'
            }`}
            title={isFutureDate ? 'Cannot take attendance for tomorrow or future dates' : undefined}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{existingSessionId ? 'Update Attendance' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Success Celebration Alert */}
      {justSubmitted && submittedSessionInfo && (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white rounded-2xl p-5 shadow-lg border border-emerald-400/40 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                Attendance Successfully Recorded!
              </h3>
              <p className="text-xs text-emerald-100">
                {activeSubject?.name} • {sessionDate} — {submittedSessionInfo.present} Present, {submittedSessionInfo.absent} Absent ({submittedSessionInfo.rate}% rate)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-300/40 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF Register</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToReports(activeSubject?.id)}
              className="px-4 py-2 bg-white text-emerald-900 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>View Performance Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setJustSubmitted(false)}
              className="px-3 py-2 text-xs font-semibold text-emerald-100 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filter and View Controls */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student name or roll..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({classStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('present')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'present'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Present ({stats.present})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('absent')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'absent'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Absent ({stats.absent})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('late')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'late'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Late ({stats.late})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('excused')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'excused'
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            Excused ({stats.excused})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Card Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Table List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Roster Container */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <p className="text-sm font-semibold text-slate-600">No students match your filter or search.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-3 text-xs font-bold text-emerald-600 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map(student => {
            const currentStatus = statuses[student.id]?.status || 'present';
            const remarks = statuses[student.id]?.remarks;

            // Student attendance historical context
            const studentStats = calculateStudentAttendanceStats(student, sessions, records);

            const isPresent = currentStatus === 'present';
            const isAbsent = currentStatus === 'absent';
            const isLate = currentStatus === 'late';
            const isExcused = currentStatus === 'excused';

            return (
              <div
                key={student.id}
                className={`group relative bg-white rounded-2xl p-4 border transition-all duration-150 ${
                  isPresent
                    ? 'border-emerald-200/90 hover:border-emerald-300 hover:shadow-md'
                    : isAbsent
                    ? 'border-rose-300 bg-rose-50/20 shadow-xs'
                    : isLate
                    ? 'border-amber-300 bg-amber-50/20 shadow-xs'
                    : 'border-sky-300 bg-sky-50/20 shadow-xs'
                }`}
              >
                {/* Header: Avatar, Name, Roll */}
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <img
                      src={student.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`}
                      alt={student.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-100"
                    />
                    {/* Status Badge Pin */}
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-xs ${
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
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {student.rollNumber}
                      </span>
                      {studentStats.isAtRisk && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-2.5 h-2.5" /> &lt;75%
                        </span>
                      )}
                      {!studentStats.isAtRisk && studentStats.currentStreak >= 3 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {studentStats.currentStreak}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 truncate mt-1">
                      {student.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate">
                      Avg: {studentStats.attendancePercentage}% ({studentStats.present}/{studentStats.totalSessions})
                    </p>
                  </div>
                </div>

                {/* 1-Click Status Button Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'present')}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center ${
                      isPresent
                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30'
                        : 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                    }`}
                    title="Mark Present with 1-click"
                  >
                    <span>P</span>
                    <span className="text-[8px] font-medium opacity-80">Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'absent')}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center ${
                      isAbsent
                        ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/30'
                        : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700'
                    }`}
                    title="Mark Absent with 1-click"
                  >
                    <span>A</span>
                    <span className="text-[8px] font-medium opacity-80">Absent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'late')}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center ${
                      isLate
                        ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/30'
                        : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700'
                    }`}
                    title="Mark Late with 1-click"
                  >
                    <span>L</span>
                    <span className="text-[8px] font-medium opacity-80">Late</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentStatus(student.id, 'excused')}
                    className={`py-1.5 rounded-lg text-xs font-black transition-all flex flex-col items-center justify-center ${
                      isExcused
                        ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-500/30'
                        : 'bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-700'
                    }`}
                    title="Mark Excused with 1-click"
                  >
                    <span>E</span>
                    <span className="text-[8px] font-medium opacity-80">Excused</span>
                  </button>
                </div>

                {/* Remarks trigger / badge */}
                <div className="mt-2.5 flex items-center justify-between text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRemarkStudent(student);
                      setRemarkInput(remarks || '');
                    }}
                    className={`inline-flex items-center gap-1 font-medium transition-colors ${
                      remarks ? 'text-amber-700 hover:text-amber-800 font-semibold' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>{remarks ? `Note: "${remarks.slice(0, 16)}..."` : '+ Add note / reason'}</span>
                  </button>

                  {/* Quick Card Click Tip */}
                  <button
                    type="button"
                    onClick={() => cycleStatus(student.id)}
                    className="text-slate-400 hover:text-slate-600 font-mono text-[9px]"
                    title="Click to cycle status"
                  >
                    cycle ↺
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Fast Compact Table View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
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
                      className={`hover:bg-slate-50/80 transition-colors ${
                        currentStatus === 'absent' ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {student.rollNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={student.avatar}
                            alt={student.name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <div>
                            <span className="font-bold text-slate-900 block">{student.name}</span>
                            <span className="text-[10px] text-slate-500">{student.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              studentStats.isAtRisk
                                ? 'text-rose-600'
                                : studentStats.attendancePercentage >= 90
                                ? 'text-emerald-600'
                                : 'text-slate-700'
                            }`}
                          >
                            {studentStats.attendancePercentage}%
                          </span>
                          {studentStats.isAtRisk && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-rose-100 text-rose-700">
                              AT RISK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'present')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-emerald-50 text-slate-600'
                            }`}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'absent')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-rose-50 text-slate-600'
                            }`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'late')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                              currentStatus === 'late'
                                ? 'bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-amber-50 text-slate-600'
                            }`}
                          >
                            L
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentStatus(student.id, 'excused')}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                              currentStatus === 'excused'
                                ? 'bg-sky-600 text-white shadow-2xs'
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
                          className="text-xs text-slate-500 hover:text-slate-800 underline truncate max-w-[140px] block"
                        >
                          {remarks || '+ Note'}
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeRemarkStudent.avatar}
                  alt={activeRemarkStudent.name}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Attendance Note: {activeRemarkStudent.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Roll: {activeRemarkStudent.rollNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveRemarkStudent(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for Absence, Lateness, or Excusal:
              </label>
              <textarea
                rows={3}
                value={remarkInput}
                onChange={e => setRemarkInput(e.target.value)}
                placeholder="e.g. Medical doctor appointment, varsity soccer game, bus transit delay..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Illness / Fever', 'Doctor Appointment', 'Bus Delay', 'Family Emergency', 'School Event'].map(
                  preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRemarkInput(preset)}
                      className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-700"
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
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 font-semibold"
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Attendance Register Download Modal */}
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
        />
      )}
    </div>
  );
};

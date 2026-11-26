import React, { useEffect, useMemo, useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceSession, AttendanceStatus, SubjectPart } from '../types/attendance';
import {
  buildInitialRollCallDraft,
  buildSessionEditRoster,
  resolveRollCallForSave,
  RollCallDraftEntry,
} from '../utils/attendanceLogic';
import { Avatar } from './Avatar';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Pencil,
  Save,
  Search,
  X,
} from 'lucide-react';

interface EditAttendanceModalProps {
  isOpen: boolean;
  session: AttendanceSession | null;
  onClose: () => void;
  onSaved?: (updatedSession: AttendanceSession) => void;
  highlightStudentId?: string;
}

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  short: string;
  label: string;
  activeClass: string;
  idleClass: string;
}> = [
  {
    value: 'present',
    short: 'P',
    label: 'Present',
    activeClass: 'bg-emerald-600 text-white border-emerald-600',
    idleClass: 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700',
  },
  {
    value: 'absent',
    short: 'A',
    label: 'Absent',
    activeClass: 'bg-rose-600 text-white border-rose-600',
    idleClass: 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700',
  },
  {
    value: 'late',
    short: 'L',
    label: 'Late',
    activeClass: 'bg-amber-500 text-white border-amber-500',
    idleClass: 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700',
  },
  {
    value: 'excused',
    short: 'E',
    label: 'Excused',
    activeClass: 'bg-sky-600 text-white border-sky-600',
    idleClass: 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-700',
  },
];

export const EditAttendanceModal: React.FC<EditAttendanceModalProps> = ({
  isOpen,
  session,
  onClose,
  onSaved,
  highlightStudentId,
}) => {
  const {
    subjects,
    classes,
    users,
    students,
    records,
    getClassStudents,
    saveAttendanceSession,
    currentUser,
  } = useAttendance();

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const subject = useMemo(
    () => (session ? subjects.find(s => s.id === session.subjectId) : undefined),
    [subjects, session]
  );
  const classGroup = useMemo(
    () => (session ? classes.find(c => c.id === session.classId) : undefined),
    [classes, session]
  );
  const instructor = useMemo(
    () => (session ? users.find(u => u.id === session.teacherId) : undefined),
    [users, session]
  );

  const sessionRecords = useMemo(
    () => (session ? records.filter(r => r.sessionId === session.id) : []),
    [records, session]
  );

  const rosterStudents = useMemo(() => {
    if (!session) return [];
    const activeStudents = getClassStudents(session.classId);
    return buildSessionEditRoster(activeStudents, sessionRecords, students);
  }, [session, getClassStudents, sessionRecords, students]);

  const [sessionDate, setSessionDate] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [draftStatuses, setDraftStatuses] = useState<Record<string, RollCallDraftEntry>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !session) return;
    setSessionDate(session.date);
    setTopic(session.topic || '');
    setDraftStatuses(buildInitialRollCallDraft(rosterStudents, sessionRecords));
    setSearchQuery('');
    setStatusFilter('all');
    setErrorMessage(null);
  }, [isOpen, session?.id]);

  const resolvedPreview = useMemo(
    () => resolveRollCallForSave(rosterStudents, draftStatuses),
    [rosterStudents, draftStatuses]
  );

  const liveRate = useMemo(() => {
    if (resolvedPreview.totalStudents === 0) return 0;
    const effective =
      resolvedPreview.presentCount +
      resolvedPreview.lateCount * 0.75 +
      resolvedPreview.excusedCount;
    return Math.round((effective / resolvedPreview.totalStudents) * 100);
  }, [resolvedPreview]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rosterStudents.filter(stu => {
      const currentStatus: AttendanceStatus = draftStatuses[stu.id]?.status || 'absent';
      const matchesSearch =
        !q ||
        stu.name.toLowerCase().includes(q) ||
        stu.rollNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rosterStudents, draftStatuses, searchQuery, statusFilter]);

  if (!isOpen || !session) return null;

  const part: SubjectPart = session.part || 'theory';
  const isFutureDate = sessionDate > today;
  const displayedError =
    errorMessage ||
    (isFutureDate
      ? `Attendance date cannot be in the future (${sessionDate}). Select today (${today}) or an earlier date.`
      : null);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setDraftStatuses(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleRemarkChange = (studentId: string, remarks: string) => {
    setDraftStatuses(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks: remarks || undefined,
      },
    }));
  };

  const handleMarkAllPresent = () => {
    setDraftStatuses(prev => {
      const next: Record<string, RollCallDraftEntry> = {};
      rosterStudents.forEach(stu => {
        next[stu.id] = {
          status: 'present',
          ...(prev[stu.id]?.remarks ? { remarks: prev[stu.id]?.remarks } : {}),
        };
      });
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!sessionDate) {
      setErrorMessage('Session date is required.');
      return;
    }
    if (sessionDate > today) {
      setErrorMessage(
        `Attendance date cannot be in the future (${sessionDate}). Select today (${today}) or an earlier date.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const updated = await saveAttendanceSession(
        {
          id: session.id,
          subjectId: session.subjectId,
          classId: session.classId,
          teacherId: session.teacherId || currentUser?.id || '',
          part,
          date: sessionDate,
          timeSlot: session.timeSlot,
          topic: topic.trim() || session.topic,
        },
        draftStatuses
      );
      onSaved?.(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to save attendance changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-attendance-modal-title"
        className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Attendance Session</span>
              </span>
              <span className="text-slate-300">·</span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  part === 'practical'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                }`}
              >
                {part === 'practical' ? 'Practical' : 'Theory'}
              </span>
              {classGroup && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-600 font-medium">
                    {classGroup.name} ({classGroup.section})
                  </span>
                </>
              )}
            </div>
            <h2
              id="edit-attendance-modal-title"
              className="text-base sm:text-lg font-bold text-slate-900 mt-1 truncate"
            >
              {subject ? `${subject.code} — ${subject.name}` : 'Recorded Attendance Session'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Faculty: {instructor?.name || 'Department Faculty'}
              {session.updatedAt
                ? ` · Last edited ${session.updatedAt.slice(0, 10)}${session.updatedBy ? ` by ${session.updatedBy}` : ''}`
                : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            aria-label="Close edit attendance modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
          {/* Metadata & Live Summary */}
          <div className="px-5 sm:px-6 py-4 bg-slate-50/70 border-b border-slate-200 space-y-3 shrink-0">
            {displayedError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{displayedError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="edit-session-date"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Session Date
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="edit-session-date"
                    type="date"
                    max={today}
                    value={sessionDate}
                    onChange={e => {
                      setSessionDate(e.target.value);
                      setErrorMessage(null);
                    }}
                    className={`w-full h-9 pl-9 pr-3 bg-white border rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 ${
                      isFutureDate
                        ? 'border-rose-400 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:ring-emerald-600/20 focus:border-emerald-600'
                    }`}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="edit-session-topic"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Lesson / Topic
                </label>
                <input
                  id="edit-session-topic"
                  type="text"
                  placeholder="e.g. Linked List Implementation"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Live Counters + Filter Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-bold">
                  {liveRate}% Rate
                </span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                  Present: {resolvedPreview.presentCount}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  Absent: {resolvedPreview.absentCount}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                  Late: {resolvedPreview.lateCount}
                </span>
                <span className="px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-800 font-semibold">
                  Excused: {resolvedPreview.excusedCount}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search roll or name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label="Search students in session"
                    className="w-full h-8 pl-8 pr-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
                <select
                  aria-label="Filter students by attendance status"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | AttendanceStatus)}
                  className="h-8 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
                >
                  <option value="all">All ({rosterStudents.length})</option>
                  <option value="present">Present ({resolvedPreview.presentCount})</option>
                  <option value="absent">Absent ({resolvedPreview.absentCount})</option>
                  <option value="late">Late ({resolvedPreview.lateCount})</option>
                  <option value="excused">Excused ({resolvedPreview.excusedCount})</option>
                </select>
                <button
                  type="button"
                  onClick={handleMarkAllPresent}
                  className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>All Present</span>
                </button>
              </div>
            </div>
          </div>

          {/* Student Roll Call List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No students match your current search or status filter.
              </div>
            ) : (
              filteredStudents.map(student => {
                const entry = draftStatuses[student.id];
                const currentStatus: AttendanceStatus = entry?.status || 'absent';
                const isHighlighted = highlightStudentId === student.id;

                return (
                  <div
                    key={student.id}
                    className={`px-5 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                      isHighlighted ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={student.avatar} name={student.name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-700">
                            {student.rollNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {student.name}
                          </span>
                          {isHighlighted && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              Selected Student
                            </span>
                          )}
                          {student.status === 'inactive' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                      <div className="inline-flex items-center gap-1" role="group" aria-label={`Attendance status for ${student.name}`}>
                        {STATUS_OPTIONS.map(opt => {
                          const active = currentStatus === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleStatusChange(student.id, opt.value)}
                              aria-label={`Mark ${student.name} ${opt.label}`}
                              aria-pressed={active}
                              title={opt.label}
                              className={`h-8 w-8 rounded-md border text-xs font-bold transition-colors ${
                                active ? opt.activeClass : opt.idleClass
                              }`}
                            >
                              {opt.short}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={entry?.remarks || ''}
                        onChange={e => handleRemarkChange(student.id, e.target.value)}
                        placeholder="Remark (optional)"
                        aria-label={`Remark for ${student.name}`}
                        className="h-8 w-full sm:w-44 px-2.5 bg-white border border-slate-200 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Changes recalculate class attendance rates and sync to Cloud Firestore.</span>
            </span>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isFutureDate || rosterStudents.length === 0}
                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Attendance Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

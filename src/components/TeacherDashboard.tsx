import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  School,
  FileText,
  Target,
  Plus,
  Minus,
  Check,
  Settings2,
  ClipboardCheck
} from 'lucide-react';
import { calculateSessionSummary, calculateDailyClassTargetProgress } from '../utils/attendanceLogic';
import { DownloadRegisterModal } from './DownloadRegisterModal';
import { Subject, ClassGroup, SubjectPart } from '../types/attendance';

interface TeacherDashboardProps {
  onStartAttendance: (subjectId: string, part?: SubjectPart) => void;
  onViewReports: (subjectId: string, part?: SubjectPart) => void;
  onOpenBulkImport: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onStartAttendance,
  onViewReports,
  onOpenBulkImport,
}) => {
  const {
    currentUser,
    getTeacherSubjects,
    getClassStudents,
    sessions,
    getSessionByDate,
    students,
    records,
    setDailyClassTarget,
  } = useAttendance();

  const [pdfModalSubject, setPdfModalSubject] = useState<{ subject: Subject; classGroup: ClassGroup; part: SubjectPart } | null>(null);

  const dailyTarget = currentUser?.dailyClassTarget || 4;
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState<string>(String(dailyTarget));

  if (!currentUser) return null;

  const teacherAssignments = getTeacherSubjects(currentUser.id);
  const today = new Date().toISOString().split('T')[0];

  const targetProgress = calculateDailyClassTargetProgress(
    dailyTarget,
    sessions,
    currentUser.id,
    today
  );

  const pendingAssignments = teacherAssignments.filter(
    ({ subject, assignment }) => !getSessionByDate(subject.id, today, assignment.part || 'theory')
  );
  const nextPendingItem = pendingAssignments.length > 0 ? pendingAssignments[0] : null;
  const nextPendingSubject = nextPendingItem ? nextPendingItem.subject : null;
  const nextPendingPart: SubjectPart = nextPendingItem ? (nextPendingItem.assignment.part || 'theory') : 'theory';

  const handleUpdateTarget = async (newTarget: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(newTarget || 1)));
    await setDailyClassTarget(clamped);
    setCustomTargetInput(String(clamped));
    setIsEditingTarget(false);
  };

  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (ringCircumference * Math.min(targetProgress.percentage, 100)) / 100;

  const teacherSessions = sessions.filter(s =>
    teacherAssignments.some(
      a => a.subject.id === s.subjectId && (a.assignment.part || 'theory') === (s.part || 'theory')
    )
  );
  const sessionSummary = calculateSessionSummary(teacherSessions);

  const uniqueClassIds = new Set(teacherAssignments.map(a => a.classGroup.id));
  const totalStudents = Array.from(uniqueClassIds).reduce((acc, classId) => {
    return acc + getClassStudents(classId).length;
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Workspace Header */}
      <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-700">Teacher Portal</span>
              <span>·</span>
              <span className="font-mono">{currentUser.employeeId}</span>
              <span>·</span>
              <span>{currentUser.department}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              {currentUser.title || currentUser.department} · Manage Theory &amp; Practical roll calls, track student attendance, and export BTEB registers.
            </p>
          </div>
        </div>

        {teacherAssignments.length > 0 && (
          <button
            type="button"
            onClick={() => onStartAttendance(teacherAssignments[0].subject.id, teacherAssignments[0].assignment.part || 'theory')}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>Launch 1-Click Roll Call</span>
          </button>
        )}
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Assigned Parts
            </span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {teacherAssignments.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Theory &amp; Practical allocations
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Students
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {totalStudents}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across {uniqueClassIds.size} active batch{uniqueClassIds.size === 1 ? '' : 'es'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Avg Attendance Rate
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {sessionSummary.averageAttendanceRate}%
          </p>
          <p className="text-xs text-emerald-700 font-medium mt-1">
            Across {sessionSummary.totalSessions} session{sessionSummary.totalSessions === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sessions Recorded
            </span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {teacherSessions.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Verified roll calls logged
          </p>
        </div>
      </div>

      {/* Daily Teaching Target Panel */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Target className="w-3.5 h-3.5" />
                Daily Teaching Target
              </span>
              <span>·</span>
              <span className="font-mono">{today}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight mt-1">
              Today&apos;s Classes Conducted
            </h2>
          </div>

          {/* Target Controls */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200 self-start sm:self-auto tabular-nums">
            <span className="text-xs font-medium text-slate-500 px-2">Target</span>
            <button
              type="button"
              onClick={() => handleUpdateTarget(dailyTarget - 1)}
              disabled={dailyTarget <= 1}
              className="w-7 h-7 rounded-md bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 transition-colors"
              title="Decrease daily target"
              aria-label="Decrease daily target"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {isEditingTarget ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdateTarget(parseInt(customTargetInput, 10));
                }}
                className="flex items-center gap-1"
              >
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={customTargetInput}
                  onChange={(e) => setCustomTargetInput(e.target.value)}
                  className="w-12 h-7 px-1.5 text-center text-xs font-bold text-slate-900 bg-white border border-emerald-500 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-7 px-2.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700"
                >
                  Save
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCustomTargetInput(String(dailyTarget));
                  setIsEditingTarget(true);
                }}
                className="h-7 px-2.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-900 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                title="Click to set custom target"
              >
                <span>{dailyTarget} {dailyTarget === 1 ? 'Class' : 'Classes'}</span>
                <Settings2 className="w-3 h-3 text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleUpdateTarget(dailyTarget + 1)}
              disabled={dailyTarget >= 20}
              className="w-7 h-7 rounded-md bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 transition-colors"
              title="Increase daily target"
              aria-label="Increase daily target"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="hidden md:flex items-center gap-1 pl-1.5 border-l border-slate-200 ml-1">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleUpdateTarget(num)}
                  className={`w-6 h-6 rounded-md text-[11px] font-semibold transition-colors ${
                    dailyTarget === num
                      ? 'bg-slate-900 text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                  title={`Set target to ${num} classes`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ring + Status + Next Action */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Progress Ring */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center justify-center tabular-nums">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-32 h-32 -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  stroke="#f1f5f9"
                  strokeWidth="9"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  stroke={targetProgress.conductedCount > 0 ? '#059669' : '#cbd5e1'}
                  strokeWidth="9"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-slate-900 leading-none">
                  {targetProgress.percentage}%
                </span>
                <span className="text-[11px] font-medium text-slate-500 mt-1">
                  {targetProgress.conductedCount} / {targetProgress.target}
                </span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-500 mt-2 text-center">
              {targetProgress.isCompleted
                ? 'Daily goal achieved'
                : `${targetProgress.remaining} class${targetProgress.remaining > 1 ? 'es' : ''} remaining`}
            </p>
          </div>

          {/* Middle Progress Details */}
          <div className="md:col-span-8 lg:col-span-6 space-y-4">
            {targetProgress.status === 'completed' || targetProgress.status === 'exceeded' ? (
              <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Daily target completed
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    You have conducted {targetProgress.conductedCount} of {targetProgress.target} planned sessions today.
                  </p>
                </div>
              </div>
            ) : targetProgress.status === 'in_progress' ? (
              <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-950">
                    In progress ({targetProgress.conductedCount} of {targetProgress.target} completed)
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    {targetProgress.remaining} more session{targetProgress.remaining > 1 ? 's' : ''} remaining to reach today&apos;s target.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
                <Target className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Schedule ready (0 of {targetProgress.target} conducted)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Record attendance for your first scheduled class to update today&apos;s progress.
                  </p>
                </div>
              </div>
            )}

            {/* Breakdown Strip */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/40 tabular-nums">
              <div className="p-3">
                <span className="text-[11px] font-medium text-slate-500 block">Daily Target</span>
                <span className="text-base font-bold text-slate-900 mt-0.5 block">
                  {targetProgress.target}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] font-medium text-slate-500 block">Conducted</span>
                <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                  {targetProgress.conductedCount}
                </span>
              </div>
              <div className="p-3">
                <span className="text-[11px] font-medium text-slate-500 block">Remaining</span>
                <span className={`text-base font-bold mt-0.5 block ${targetProgress.remaining === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {targetProgress.remaining}
                </span>
              </div>
            </div>

            {targetProgress.conductedSessions.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Logged Today
                </span>
                <div className="flex flex-wrap gap-2">
                  {targetProgress.conductedSessions.map((session) => {
                    const match = teacherAssignments.find(a => a.subject.id === session.subjectId);
                    const sPart = session.part === 'practical' ? 'Practical' : 'Theory';
                    return (
                      <span
                        key={session.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium tabular-nums"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-mono font-semibold">{match ? match.subject.code : 'Course'}</span>
                        <span className="text-emerald-700">· {sPart}</span>
                        <span className="text-emerald-700">({session.presentCount}/{session.totalStudents})</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Action Column */}
          <div className="lg:col-span-3 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Next Action
            </span>
            {nextPendingSubject ? (
              <div>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {nextPendingSubject.name}
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5 mb-3">
                  {nextPendingSubject.code} · {nextPendingPart === 'practical' ? 'Practical' : 'Theory'}
                </p>
                <button
                  type="button"
                  onClick={() => onStartAttendance(nextPendingSubject.id, nextPendingPart)}
                  className="w-full h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>Conduct Class</span>
                </button>
              </div>
            ) : targetProgress.conductedCount > 0 ? (
              <div className="py-2">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All classes logged today</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  No pending sessions remaining for today.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-3">
                  No assigned courses scheduled yet.
                </p>
                {teacherAssignments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onStartAttendance(teacherAssignments[0].subject.id, teacherAssignments[0].assignment.part || 'theory')}
                    className="w-full h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Start Class 1</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assigned Subjects Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              My Assigned Subjects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theory and Practical allocations assigned by your department administrator.
            </p>
          </div>
          {currentUser.role === 'admin' ? (
            <button
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Class List via CSV</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 self-start sm:self-auto">
              Student rosters are managed by administration
            </span>
          )}
        </div>

        {teacherAssignments.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
            <School className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
            <h3 className="text-sm font-semibold text-slate-900">No Subjects Assigned Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Your administrator has not assigned any Theory or Practical courses to your account yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacherAssignments.map(({ subject, classGroup, assignment }) => {
              const part: SubjectPart = assignment.part || 'theory';
              const classStudents = getClassStudents(classGroup.id);
              const todaySession = getSessionByDate(subject.id, today, part);
              const partSessions = sessions.filter(
                s => s.subjectId === subject.id && (s.part || 'theory') === part
              );
              const subjectStats = calculateSessionSummary(partSessions);

              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-700">
                          {subject.code}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            part === 'practical'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                          }`}
                        >
                          {part === 'practical' ? 'Practical' : 'Theory'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 truncate">
                        {classGroup.name} · {classGroup.section}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                      {subject.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {subject.description}
                    </p>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs tabular-nums">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Enrolled</span>
                        <span className="font-semibold text-slate-900 mt-0.5 block">
                          {classStudents.length} students
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Avg Rate ({part})</span>
                        <span className="font-semibold text-emerald-700 mt-0.5 block">
                          {subjectStats.averageAttendanceRate}%
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs tabular-nums">
                      <span className="text-slate-500">
                        Today ({part === 'practical' ? 'Practical' : 'Theory'})
                      </span>
                      {todaySession ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Marked ({todaySession.presentCount}/{todaySession.totalStudents})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onStartAttendance(subject.id, part)}
                      className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      <span>Take Attendance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfModalSubject({ subject, classGroup, part })}
                      className="h-9 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                      title="Download official BTEB PDF attendance register"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewReports(subject.id, part)}
                      className="h-9 w-9 inline-flex items-center justify-center bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-colors shrink-0"
                      title="View reports & student performance trends"
                      aria-label="View subject reports"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pdfModalSubject && (
        <DownloadRegisterModal
          isOpen={Boolean(pdfModalSubject)}
          onClose={() => setPdfModalSubject(null)}
          subject={pdfModalSubject.subject}
          classGroup={pdfModalSubject.classGroup}
          teacher={currentUser}
          students={students}
          sessions={sessions}
          records={records}
          defaultPart={pdfModalSubject.part}
        />
      )}
    </div>
  );
};

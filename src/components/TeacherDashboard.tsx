import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Flame,
  Sparkles,
  School,
  FileText,
  Target,
  Plus,
  Minus,
  Award,
  Check,
  Settings2
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

  // Daily target state & custom input
  const dailyTarget = currentUser?.dailyClassTarget || 4;
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState<string>(String(dailyTarget));

  if (!currentUser) return null;

  const teacherAssignments = getTeacherSubjects(currentUser.id);
  const today = new Date().toISOString().split('T')[0];

  // Calculate teacher's daily class target progress
  const targetProgress = calculateDailyClassTargetProgress(
    dailyTarget,
    sessions,
    currentUser.id,
    today
  );

  // Find next pending subject+part for today
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

  // SVG Progress Ring calculations (radius 46, circumference 2 * PI * 46 ≈ 289.03)
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (ringCircumference * Math.min(targetProgress.percentage, 100)) / 100;

  // Calculate teacher's overall stats (for sessions belonging to this teacher's assigned subject+parts)
  const teacherSessions = sessions.filter(s =>
    teacherAssignments.some(
      a => a.subject.id === s.subjectId && (a.assignment.part || 'theory') === (s.part || 'theory')
    )
  );
  const sessionSummary = calculateSessionSummary(teacherSessions);

  // Total students across assigned class groups (unique classes)
  const uniqueClassIds = new Set(teacherAssignments.map(a => a.classGroup.id));
  const totalStudents = Array.from(uniqueClassIds).reduce((acc, classId) => {
    return acc + getClassStudents(classId).length;
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Welcome Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-emerald-500/30 shadow-lg"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Teacher Portal
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ID: {currentUser.employeeId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Welcome back, {currentUser.name}
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                {currentUser.title || currentUser.department} • Manage roll calls with 1-click speed, track student trends, and generate verified attendance reports.
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          {teacherAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => onStartAttendance(teacherAssignments[0].subject.id, teacherAssignments[0].assignment.part || 'theory')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-all active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Launch 1-Click Roll Call</span>
            </button>
          )}
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Daily Class Target & Progress Ring Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs relative overflow-hidden">
        {/* Card Header with Target Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                <Target className="w-3.5 h-3.5" /> Daily Teaching Target
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">
                {today}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Today's Classes Conducted
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set your target for daily sessions and monitor real-time class delivery progress.
            </p>
          </div>

          {/* Target Setter Controls */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-600 px-2">Target:</span>
            
            {/* Decrement Stepper */}
            <button
              type="button"
              onClick={() => handleUpdateTarget(dailyTarget - 1)}
              disabled={dailyTarget <= 1}
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 hover:text-slate-900 shadow-2xs transition-all active:scale-95"
              title="Decrease daily target"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Target Value Display / Input */}
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
                  className="w-12 px-1.5 py-0.5 text-center text-xs font-black text-slate-900 bg-white border border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-hidden"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
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
                className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200/90 text-xs font-black text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs flex items-center gap-1"
                title="Click to type custom target"
              >
                <span>{dailyTarget} {dailyTarget === 1 ? 'Class' : 'Classes'}</span>
                <Settings2 className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Increment Stepper */}
            <button
              type="button"
              onClick={() => handleUpdateTarget(dailyTarget + 1)}
              disabled={dailyTarget >= 20}
              className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 hover:text-slate-900 shadow-2xs transition-all active:scale-95"
              title="Increase daily target"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {/* Quick Presets */}
            <div className="hidden md:flex items-center gap-1 pl-1 border-l border-slate-200 ml-1">
              {[2, 3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleUpdateTarget(num)}
                  className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all ${
                    dailyTarget === num
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                  }`}
                  title={`Set target to ${num} classes`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Target Progress Ring & Metrics Grid */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Progress Ring Column */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center justify-center">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="targetRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="exceededRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Background Ring Track */}
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-slate-100"
                />

                {/* Animated Progress Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  stroke={
                    targetProgress.isCompleted
                      ? 'url(#targetRingGradient)'
                      : targetProgress.conductedCount > 0
                      ? 'url(#targetRingGradient)'
                      : '#cbd5e1'
                  }
                  strokeWidth="10"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Center Content of Ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {targetProgress.isCompleted ? (
                  <div className="flex flex-col items-center animate-in zoom-in-75 duration-300">
                    <Award className="w-6 h-6 text-emerald-600 mb-0.5" />
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {targetProgress.percentage}%
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                      Done
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {targetProgress.percentage}%
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-500 mt-0.5">
                      {targetProgress.conductedCount} / {targetProgress.target}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      Classes
                    </span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-500 mt-2 text-center">
              {targetProgress.isCompleted
                ? 'Daily Goal Achieved'
                : `${targetProgress.remaining} more class${targetProgress.remaining > 1 ? 'es' : ''} left`}
            </p>
          </div>

          {/* Middle Status Column */}
          <div className="md:col-span-8 lg:col-span-6 space-y-4">
            {/* Status Feedback Banner */}
            {targetProgress.status === 'completed' || targetProgress.status === 'exceeded' ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-950 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Flame className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-emerald-900">
                      Target Completed for Today! 🎉
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase">
                      100% Goal
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    You have successfully conducted {targetProgress.conductedCount} of {targetProgress.target} planned classes today. All your enrolled students have their attendance recorded.
                  </p>
                </div>
              </div>
            ) : targetProgress.status === 'in_progress' ? (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-amber-900">
                      Teaching in Progress ({targetProgress.conductedCount} of {targetProgress.target} Done)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white uppercase">
                      {targetProgress.percentage}%
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    You need {targetProgress.remaining} more class{targetProgress.remaining > 1 ? 'es' : ''} to meet today's teaching goal. Launch roll call when your next scheduled lecture starts.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Daily Schedule Ready (0 of {targetProgress.target} Conducted)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-300 text-slate-700 uppercase">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Your target for today is {targetProgress.target} classes. Take roll call for your first session to kick off today's progress ring!
                  </p>
                </div>
              </div>
            )}

            {/* Target Breakdown Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Daily Target
                </span>
                <span className="text-lg font-black text-slate-900">
                  {targetProgress.target} <span className="text-xs font-semibold text-slate-500">classes</span>
                </span>
              </div>
              <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Conducted Today
                </span>
                <span className="text-lg font-black text-emerald-700">
                  {targetProgress.conductedCount} <span className="text-xs font-semibold text-slate-500">done</span>
                </span>
              </div>
              <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Remaining
                </span>
                <span className={`text-lg font-black ${targetProgress.remaining === 0 ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {targetProgress.remaining} <span className="text-xs font-semibold text-slate-500">left</span>
                </span>
              </div>
            </div>

            {/* Today's conducted classes chips */}
            {targetProgress.conductedSessions.length > 0 && (
              <div className="pt-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Classes Logged Today:
                </span>
                <div className="flex flex-wrap gap-2">
                  {targetProgress.conductedSessions.map((session) => {
                    const match = teacherAssignments.find(a => a.subject.id === session.subjectId);
                    const sPart = session.part === 'practical' ? 'Practical' : 'Theory';
                    return (
                      <span
                        key={session.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        <span>{match ? match.subject.code : 'Class'}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-white text-emerald-700 border border-emerald-200">
                          {sPart}
                        </span>
                        <span className="text-emerald-600 font-medium">({session.presentCount}/{session.totalStudents} Present)</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action CTA Column */}
          <div className="lg:col-span-3 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6 pt-4 md:pt-0">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Next Action
              </span>
              {nextPendingSubject ? (
                <div>
                  <p className="text-xs font-extrabold text-slate-900 truncate">
                    {nextPendingSubject.name}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mb-3">
                    Code: {nextPendingSubject.code} • {nextPendingPart === 'practical' ? 'Practical' : 'Theory'}
                  </p>
                  <button
                    type="button"
                    onClick={() => onStartAttendance(nextPendingSubject.id, nextPendingPart)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Conduct Class</span>
                  </button>
                </div>
              ) : targetProgress.conductedCount > 0 ? (
                <div className="py-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    All Classes Completed!
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    No pending subjects for today
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-600 mb-3">
                    Ready to take attendance for today's classes
                  </p>
                  {teacherAssignments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onStartAttendance(teacherAssignments[0].subject.id, teacherAssignments[0].assignment.part || 'theory')}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all"
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
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assigned Subjects
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {teacherAssignments.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Admin assigned curriculum
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Students
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {totalStudents}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Active class roster size
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Avg Attendance Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {sessionSummary.averageAttendanceRate}%
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
            <span>Across {sessionSummary.totalSessions} sessions</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sessions Recorded
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {teacherSessions.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Historical roll calls logged
          </p>
        </div>
      </div>

      {/* Assigned Subjects Header & Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              My Assigned Subjects
            </h2>
            <p className="text-xs text-slate-500">
              Assigned by school admin. Click "Take Attendance" to mark roll call in seconds.
            </p>
          </div>
          {currentUser.role === 'admin' ? (
            <button
              type="button"
              onClick={onOpenBulkImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs self-start sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Class List via CSV</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Student Roster: Managed by Admin</span>
            </div>
          )}
        </div>

        {teacherAssignments.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
            <School className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Subjects Assigned Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              The administrator has not yet assigned any subjects to your account.
              Please contact your institutional administrator to allocate BTEB courses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                  className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top pill bar */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                          {subject.code}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                            part === 'practical'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {part === 'practical' ? 'Practical' : 'Theory'}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate">
                        {classGroup.name} • {classGroup.section}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                      {subject.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {subject.description}
                    </p>

                    {/* Stats pills */}
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Students</span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          {classStudents.length} enrolled
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Rate ({part})</span>
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {subjectStats.averageAttendanceRate}%
                        </span>
                      </div>
                    </div>

                    {/* Today's Status indicator */}
                    <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-xl text-xs bg-slate-50/70 border border-slate-100">
                      <span className="text-slate-500 font-medium">Today's {part === 'practical' ? 'Practical' : 'Theory'}:</span>
                      {todaySession ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Marked ({todaySession.presentCount}/{todaySession.totalStudents})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="mt-5 pt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onStartAttendance(subject.id, part)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      <span>Take Attendance</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfModalSubject({ subject, classGroup, part })}
                      className="flex items-center gap-1.5 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition-colors"
                      title="Download official BTEB PDF attendance register for this subject part"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-700" />
                      <span>PDF Register</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewReports(subject.id, part)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                      title="View reports & student performance trends"
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

      {/* PDF Attendance Register Download Modal */}
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

import React, { useState, useMemo } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Download,
  Printer,
  Calendar,
  Filter,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  ExternalLink,
  ChevronRight,
  Flame,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import {
  calculateSessionSummary,
  calculateStudentAttendanceStats,
  calculateWeeklyStudentAttendanceSummary,
  exportAttendanceToCSV,
  WeeklyStudentAttendancePoint,
} from '../utils/attendanceLogic';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Student, AttendanceSession, Subject, ClassGroup, SubjectPart } from '../types/attendance';
import { DownloadRegisterModal } from './DownloadRegisterModal';

interface ReportsAndTrendsProps {
  initialSubjectId?: string;
  initialPart?: SubjectPart;
  onOpenBulkImport: () => void;
}

export const ReportsAndTrends: React.FC<ReportsAndTrendsProps> = ({
  initialSubjectId,
  initialPart,
  onOpenBulkImport,
}) => {
  const { subjects, classes, students, sessions, records, currentUser } = useAttendance();

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'all');
  const [selectedPartFilter, setSelectedPartFilter] = useState<'all' | SubjectPart>(initialPart || 'all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [riskOnlyFilter, setRiskOnlyFilter] = useState<boolean>(false);

  // Drilldown modal for student history
  const [drilldownStudent, setDrilldownStudent] = useState<Student | null>(null);

  // Parent notification modal
  const [parentNoticeStudent, setParentNoticeStudent] = useState<Student | null>(null);
  const [noticeSentBanner, setNoticeSentBanner] = useState<string | null>(null);

  // PDF Register Download modal
  const [pdfModalSubject, setPdfModalSubject] = useState<{ subject: Subject; classGroup: ClassGroup } | null>(null);

  const handleOpenPdfRegister = () => {
    let targetSub = subjects.find(s => s.id === selectedSubjectId);
    if (!targetSub && subjects.length > 0) {
      targetSub = subjects[0];
    }
    if (targetSub) {
      const cls = classes.find(c => c.id === targetSub.classId) || classes[0];
      setPdfModalSubject({ subject: targetSub, classGroup: cls });
    }
  };

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchSubject = selectedSubjectId === 'all' || s.subjectId === selectedSubjectId;
      const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
      const matchPart = selectedPartFilter === 'all' || (s.part || 'theory') === selectedPartFilter;
      return matchSubject && matchClass && matchPart;
    });
  }, [sessions, selectedSubjectId, selectedClassId, selectedPartFilter]);

  // Overall metrics
  const summary = useMemo(() => {
    return calculateSessionSummary(filteredSessions);
  }, [filteredSessions]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(stu => {
      const matchClass = selectedClassId === 'all' || stu.classId === selectedClassId;
      // If subject is selected, student must belong to class of that subject
      let matchSubject = true;
      if (selectedSubjectId !== 'all') {
        const sub = subjects.find(s => s.id === selectedSubjectId);
        if (sub) {
          matchSubject = stu.classId === sub.classId;
        }
      }
      const matchSearch =
        stu.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
        stu.rollNumber.toLowerCase().includes(searchStudent.toLowerCase());

      return matchClass && matchSubject && matchSearch;
    });
  }, [students, selectedClassId, selectedSubjectId, searchStudent, subjects]);

  // Compute student stats for each
  const studentStatsList = useMemo(() => {
    return filteredStudents.map(student => {
      return {
        student,
        stats: calculateStudentAttendanceStats(student, filteredSessions, records, 75),
      };
    });
  }, [filteredStudents, filteredSessions, records]);

  // At-risk students (<75%)
  const atRiskStudents = useMemo(() => {
    return studentStatsList.filter(item => item.stats.isAtRisk);
  }, [studentStatsList]);

  // Displayed students list (respecting riskOnlyFilter)
  const displayedStudents = useMemo(() => {
    if (riskOnlyFilter) {
      return studentStatsList.filter(item => item.stats.isAtRisk);
    }
    return studentStatsList;
  }, [studentStatsList, riskOnlyFilter]);

  // Chronological sessions for trend line
  const chronologicalSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  // Weekly attendance average per student for the current week
  const weeklySummary = useMemo(() => {
    return calculateWeeklyStudentAttendanceSummary(filteredStudents, filteredSessions, records);
  }, [filteredStudents, filteredSessions, records]);

  // CSV Export Trigger
  const handleExportCSV = () => {
    const activeSubjectName =
      selectedSubjectId === 'all'
        ? 'All Subjects'
        : subjects.find(s => s.id === selectedSubjectId)?.name || 'Subject';
    const activeClassName =
      selectedClassId === 'all'
        ? 'All Classes'
        : classes.find(c => c.id === selectedClassId)?.name || 'Class';

    const csvContent = exportAttendanceToCSV(
      filteredSessions,
      filteredStudents,
      records,
      activeSubjectName,
      activeClassName
    );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendParentNotice = (student: Student) => {
    setNoticeSentBanner(`Notice dispatched to parent of ${student.name} (${student.parentEmail || student.parentContact})`);
    setParentNoticeStudent(null);
    setTimeout(() => setNoticeSentBanner(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Filter Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
              Real-Time Performance Analytics
            </span>
            <span className="text-xs text-slate-500">Live Attendance Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Attendance Reports & Trend Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor attendance health, detect chronic absenteeism early, and export audit-ready spreadsheets.
          </p>
        </div>

        {/* Export / Print Actions */}
        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenPdfRegister}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Download official BTEB PDF attendance register"
          >
            <FileText className="w-4 h-4" />
            <span>Download PDF Register</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Download formatted CSV spreadsheet"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            title="Print Attendance Summary"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {noticeSentBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{noticeSentBanner}</span>
          </div>
          <button type="button" onClick={() => setNoticeSentBanner(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filters Ribbon */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          {/* Subject Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter by Subject
            </label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Subjects ({subjects.length})</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Part Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Course Part
            </label>
            <select
              value={selectedPartFilter}
              onChange={e => setSelectedPartFilter(e.target.value as 'all' | SubjectPart)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Parts (Theory & Practical)</option>
              <option value="theory">Theory Part Only</option>
              <option value="practical">Practical Part Only</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter by Class Group
            </label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Classes ({classes.length})</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* At-Risk Toggle Pill */}
          <div className="self-end pb-0.5">
            <button
              type="button"
              onClick={() => setRiskOnlyFilter(!riskOnlyFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                riskOnlyFilter
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Show At-Risk Only (&lt;75%) ({atRiskStudents.length})</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={searchStudent}
            onChange={e => setSearchStudent(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Average Attendance
          </span>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {summary.averageAttendanceRate}%
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                summary.averageAttendanceRate >= 85
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {summary.averageAttendanceRate >= 85 ? 'Healthy Standing' : 'Needs Monitoring'}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Total Sessions
          </span>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {summary.totalSessions}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Roll calls conducted
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Present vs Absent Ratio
          </span>
          <p className="text-3xl font-black text-emerald-700 mt-2">
            {summary.totalPresent}{' '}
            <span className="text-base font-semibold text-slate-400">/ {summary.totalAbsent} abs</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.totalLate} late marks • {summary.totalExcused} excused
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            At-Risk Students (&lt;75%)
          </span>
          <p className="text-3xl font-black text-rose-600 mt-2">
            {atRiskStudents.length}
          </p>
          <p className="text-[11px] text-rose-600 font-semibold mt-1">
            Require early attendance intervention
          </p>
        </div>
      </div>

      {/* Current Week Per-Student Attendance Bar Chart Summary (Recharts) */}
      <div
        data-testid="weekly-summary-card"
        className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Current Week Student Attendance Summary</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              <span>{weeklySummary.weekLabel}</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>{weeklySummary.totalWeekSessions} session{weeklySummary.totalWeekSessions === 1 ? '' : 's'} this week</span>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>{weeklySummary.studentsWithSessions} student{weeklySummary.studentsWithSessions === 1 ? '' : 's'} evaluated</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="tabular-nums font-bold text-slate-900">
              Week Avg:{' '}
              <span
                className={
                  weeklySummary.weeklyAveragePercentage >= 85
                    ? 'text-emerald-700'
                    : weeklySummary.weeklyAveragePercentage >= 75
                    ? 'text-amber-700'
                    : weeklySummary.studentsWithSessions > 0
                    ? 'text-rose-600'
                    : 'text-slate-500'
                }
              >
                {weeklySummary.weeklyAveragePercentage}%
              </span>
            </div>
            <div className="flex items-center gap-3 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> &ge; 85% Good
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> 75%–84% Caution
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> &lt; 75% At Risk
              </span>
            </div>
          </div>
        </div>

        {weeklySummary.studentPoints.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600">
              No attendance sessions recorded for the current week ({weeklySummary.weekLabel}).
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Record a Theory or Practical roll call this week or adjust filters to inspect weekly student averages.
            </p>
          </div>
        ) : (
          <div className="w-full h-72 pt-2" data-testid="weekly-bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklySummary.studentPoints}
                margin={{ top: 16, right: 28, left: 0, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  interval={weeklySummary.studentPoints.length > 12 ? 'preserveStartEnd' : 0}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={val => `${val}%`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0].payload as WeeklyStudentAttendancePoint;
                    return (
                      <div className="bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700 space-y-1">
                        <p className="font-bold text-white">{point.studentName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Roll: {point.rollNumber} · {point.totalSessions} session{point.totalSessions === 1 ? '' : 's'}
                        </p>
                        <p className="font-black text-emerald-300 tabular-nums">
                          {point.attendancePercentage}% Weekly Avg
                        </p>
                        <p className="text-[11px] text-slate-300 tabular-nums">
                          {point.present}P / {point.absent}A / {point.late}L / {point.excused}E
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{
                    value: '75% Min',
                    position: 'right',
                    fill: '#e11d48',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="attendancePercentage"
                  name="Weekly Attendance %"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  onClick={barData => {
                    const point = barData?.payload as WeeklyStudentAttendancePoint | undefined;
                    if (!point) return;
                    const matchedStu = students.find(s => s.id === point.studentId);
                    if (matchedStu) setDrilldownStudent(matchedStu);
                  }}
                  className="cursor-pointer"
                >
                  {weeklySummary.studentPoints.map(entry => (
                    <Cell
                      key={entry.studentId}
                      fill={
                        entry.attendancePercentage >= 85
                          ? '#10b981'
                          : entry.attendancePercentage >= 75
                          ? '#f59e0b'
                          : '#f43f5e'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Visual Attendance Trend Graph */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>Session Attendance Trends Over Time</span>
            </h3>
            <p className="text-xs text-slate-500">
              Rate (%) across recent sessions with 75% critical academic threshold line.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" /> &gt;= 85% Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" /> 75% - 84% Caution
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500 border border-dashed border-rose-500" /> 75% Threshold
            </span>
          </div>
        </div>

        {chronologicalSessions.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No sessions match current filter.</p>
        ) : (
          <div className="pt-4">
            {/* SVG Visual Chart */}
            <div className="h-44 w-full flex items-end gap-2 border-b border-l border-slate-200 px-2 pb-2">
              {chronologicalSessions.map((sess, idx) => {
                const total = sess.totalStudents || 1;
                const effective = sess.presentCount + sess.lateCount * 0.75 + sess.excusedCount;
                const rate = Math.round((effective / total) * 100);
                const heightPercent = Math.min(100, Math.max(10, rate));

                return (
                  <div
                    key={sess.id}
                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] rounded-lg py-1 px-2 pointer-events-none whitespace-nowrap shadow-lg">
                      <span className="font-bold">
                        {rate}% Attendance ({sess.part === 'practical' ? 'Practical' : 'Theory'})
                      </span>
                      <span className="text-slate-400">{sess.date}</span>
                      <span className="text-emerald-300">
                        {sess.presentCount}P / {sess.absentCount}A / {sess.lateCount}L
                      </span>
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all group-hover:opacity-80 ${
                        rate >= 85
                          ? 'bg-emerald-500'
                          : rate >= 75
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />

                    {/* X-axis date label */}
                    <span className="text-[9px] text-slate-400 mt-2 truncate max-w-[36px] font-mono">
                      {sess.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* At-Risk Intervention Alert Banner */}
      {atRiskStudents.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  At-Risk Student Alerts ({atRiskStudents.length} Students Under 75% Threshold)
                </h3>
                <p className="text-xs text-slate-600">
                  School academic policy requires at least 75% attendance for exam qualification.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {atRiskStudents.map(({ student, stats }) => {
              return (
                <div
                  key={student.id}
                  className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {student.rollNumber}
                      </span>
                      <span className="text-xs font-black text-rose-600">
                        {stats.attendancePercentage}% Attendance
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1">{student.name}</h4>
                    <p className="text-[11px] text-slate-500">
                      Missed {stats.absent} of {stats.totalSessions} sessions
                    </p>
                    <p className="text-[11px] text-amber-700 font-medium mt-1">
                      Needs <strong>{stats.requiredForThreshold}</strong> consecutive attended sessions to recover to 75%.
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setParentNoticeStudent(student)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-800 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Parent Warning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrilldownStudent(student)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                    >
                      View Log →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Student Attendance Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Student Attendance Performance History
            </h3>
            <p className="text-xs text-slate-500">
              Click any student row to view their comprehensive session ledger and absence reasons.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg self-start sm:self-auto">
            Showing {displayedStudents.length} Students
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Roll</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4 text-center">Sessions</th>
                <th className="py-3 px-4 text-center">Present</th>
                <th className="py-3 px-4 text-center">Absent</th>
                <th className="py-3 px-4 text-center">Late</th>
                <th className="py-3 px-4">Attendance %</th>
                <th className="py-3 px-4">Streak</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.map(({ student, stats }) => {
                const classGroup = classes.find(c => c.id === student.classId);

                return (
                  <tr
                    key={student.id}
                    onClick={() => setDrilldownStudent(student)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
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
                          <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {student.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {classGroup?.name}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {stats.totalSessions}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      {stats.present}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-rose-600">
                      {stats.absent}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-600">
                      {stats.late}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-black ${
                            stats.isAtRisk
                              ? 'text-rose-600'
                              : stats.attendancePercentage >= 90
                              ? 'text-emerald-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {stats.attendancePercentage}%
                        </span>
                        {stats.isAtRisk ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            AT RISK
                          </span>
                        ) : stats.attendancePercentage >= 90 ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            EXCELLENT
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {stats.currentStreak >= 3 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          {stats.currentStreak} days
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {stats.currentStreak}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setDrilldownStudent(student);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        History →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drilldown History Modal */}
      {drilldownStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={drilldownStudent.avatar}
                  alt={drilldownStudent.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-500/20"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {drilldownStudent.name}
                    </h3>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {drilldownStudent.rollNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {drilldownStudent.email} • Parent: {drilldownStudent.parentEmail || 'Not configured'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownStudent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Quick Metrics */}
            {(() => {
              const stuStats = calculateStudentAttendanceStats(drilldownStudent, sessions, records);
              return (
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Rate</span>
                    <span className="text-lg font-black text-slate-900">{stuStats.attendancePercentage}%</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase block">Present</span>
                    <span className="text-lg font-black text-emerald-700">{stuStats.present}</span>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl">
                    <span className="text-[10px] text-rose-600 font-bold uppercase block">Absent</span>
                    <span className="text-lg font-black text-rose-700">{stuStats.absent}</span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <span className="text-[10px] text-amber-600 font-bold uppercase block">Late</span>
                    <span className="text-lg font-black text-amber-700">{stuStats.late}</span>
                  </div>
                </div>
              );
            })()}

            {/* Session timeline table */}
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Detailed Session Log
              </h4>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Remarks / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions
                      .filter(s => records.some(r => r.sessionId === s.id && r.studentId === drilldownStudent.id))
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(session => {
                        const rec = records.find(
                          r => r.sessionId === session.id && r.studentId === drilldownStudent.id
                        );
                        const sub = subjects.find(s => s.id === session.subjectId);
                        const status = rec?.status || 'present';

                        return (
                          <tr key={session.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {session.date}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              <span>{sub?.code || 'Course'}</span>
                              <span
                                className={`ml-1.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  session.part === 'practical'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {session.part === 'practical' ? 'Practical' : 'Theory'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                  status === 'present'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : status === 'absent'
                                    ? 'bg-rose-100 text-rose-800'
                                    : status === 'late'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {rec?.remarks || '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrilldownStudent(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Warning Notice Modal */}
      {parentNoticeStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Dispatch Attendance Warning to Parent
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Recipient: <strong className="text-slate-800">{parentNoticeStudent.parentEmail || 'guardian@academy.edu'}</strong>
            </p>

            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">
                Subject: Official Attendance Advisory Notice - {parentNoticeStudent.name}
              </p>
              <p className="text-[11px] leading-relaxed">
                Dear Guardian, this is an automated academic alert from the Academy Attendance Department.
                {parentNoticeStudent.name} currently holds an attendance rate under the mandatory 75% standard.
                Please contact the academic office or student affairs to address these missed sessions.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setParentNoticeStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendParentNotice(parentNoticeStudent)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Dispatch Warning Email
              </button>
            </div>
          </div>
        </div>
      )}

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
          defaultPart={selectedPartFilter === 'all' ? undefined : selectedPartFilter}
        />
      )}
    </div>
  );
};

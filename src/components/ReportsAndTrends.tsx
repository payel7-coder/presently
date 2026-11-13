import React, { useState, useMemo } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Download,
  Printer,
  Search,
  CheckCircle2,
  Mail,
  Flame,
  FileText,
  X
} from 'lucide-react';
import {
  calculateSessionSummary,
  calculateStudentAttendanceStats,
  calculateWeeklyStudentAttendanceSummary,
  exportAttendanceToCSV,
  getRoleBasedVisibilityScope,
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
import { Student, Subject, ClassGroup, SubjectPart } from '../types/attendance';
import { DownloadRegisterModal } from './DownloadRegisterModal';

interface ReportsAndTrendsProps {
  initialSubjectId?: string;
  initialPart?: SubjectPart;
  onOpenBulkImport: () => void;
}

export const ReportsAndTrends: React.FC<ReportsAndTrendsProps> = ({
  initialSubjectId,
  initialPart,
}) => {
  const { subjects, classes, assignments, students, sessions, records, currentUser, isAdmin } = useAttendance();

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

  const visibleSubjects = roleScope.visibleSubjects;
  const visibleClasses = roleScope.visibleClasses;
  const visibleSessions = roleScope.visibleSessions;
  const visibleStudents = roleScope.visibleStudents;

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'all');
  const [selectedPartFilter, setSelectedPartFilter] = useState<'all' | SubjectPart>(initialPart || 'all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchStudent, setSearchStudent] = useState<string>('');
  const [riskOnlyFilter, setRiskOnlyFilter] = useState<boolean>(false);

  React.useEffect(() => {
    if (selectedSubjectId !== 'all' && !visibleSubjects.some(s => s.id === selectedSubjectId)) {
      setSelectedSubjectId('all');
    }
    if (selectedClassId !== 'all' && !visibleClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId('all');
    }
  }, [visibleSubjects, visibleClasses, selectedSubjectId, selectedClassId]);

  React.useEffect(() => {
    setSelectedSubjectId(initialSubjectId || 'all');
    setSelectedPartFilter(initialPart || 'all');
    setSelectedClassId('all');
  }, [currentUser?.id, initialSubjectId, initialPart]);

  const [drilldownStudent, setDrilldownStudent] = useState<Student | null>(null);
  const [parentNoticeStudent, setParentNoticeStudent] = useState<Student | null>(null);
  const [noticeSentBanner, setNoticeSentBanner] = useState<string | null>(null);
  const [pdfModalSubject, setPdfModalSubject] = useState<{ subject: Subject; classGroup: ClassGroup } | null>(null);

  const handleOpenPdfRegister = () => {
    let targetSub = visibleSubjects.find(s => s.id === selectedSubjectId);
    if (!targetSub && visibleSubjects.length > 0) {
      targetSub = visibleSubjects[0];
    }
    if (targetSub) {
      const cls =
        visibleClasses.find(c => c.id === targetSub.classId) ||
        classes.find(c => c.id === targetSub.classId) ||
        visibleClasses[0] ||
        classes[0];
      if (cls) {
        setPdfModalSubject({ subject: targetSub, classGroup: cls });
      }
    }
  };

  const filteredSessions = useMemo(() => {
    return visibleSessions.filter(s => {
      const matchSubject = selectedSubjectId === 'all' || s.subjectId === selectedSubjectId;
      const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
      const matchPart = selectedPartFilter === 'all' || (s.part || 'theory') === selectedPartFilter;
      return matchSubject && matchClass && matchPart;
    });
  }, [visibleSessions, selectedSubjectId, selectedClassId, selectedPartFilter]);

  const summary = useMemo(() => {
    return calculateSessionSummary(filteredSessions);
  }, [filteredSessions]);

  const filteredStudents = useMemo(() => {
    return visibleStudents.filter(stu => {
      const matchClass = selectedClassId === 'all' || stu.classId === selectedClassId;
      let matchSubject = true;
      if (selectedSubjectId !== 'all') {
        const sub = visibleSubjects.find(s => s.id === selectedSubjectId);
        if (sub) {
          matchSubject = stu.classId === sub.classId;
        }
      }
      const matchSearch =
        stu.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
        stu.rollNumber.toLowerCase().includes(searchStudent.toLowerCase());

      return matchClass && matchSubject && matchSearch;
    });
  }, [visibleStudents, selectedClassId, selectedSubjectId, searchStudent, visibleSubjects]);

  const studentStatsList = useMemo(() => {
    return filteredStudents.map(student => ({
      student,
      stats: calculateStudentAttendanceStats(student, filteredSessions, records, 75),
    }));
  }, [filteredStudents, filteredSessions, records]);

  const atRiskStudents = useMemo(() => {
    return studentStatsList.filter(item => item.stats.isAtRisk);
  }, [studentStatsList]);

  const displayedStudents = useMemo(() => {
    if (riskOnlyFilter) {
      return studentStatsList.filter(item => item.stats.isAtRisk);
    }
    return studentStatsList;
  }, [studentStatsList, riskOnlyFilter]);

  const chronologicalSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredSessions]);

  const weeklySummary = useMemo(() => {
    return calculateWeeklyStudentAttendanceSummary(filteredStudents, filteredSessions, records);
  }, [filteredStudents, filteredSessions, records]);

  const handleExportCSV = () => {
    const activeSubjectName =
      selectedSubjectId === 'all'
        ? isAdmin
          ? 'All Subjects'
          : 'My Assigned Subjects'
        : visibleSubjects.find(s => s.id === selectedSubjectId)?.name || 'Subject';
    const activeClassName =
      selectedClassId === 'all'
        ? isAdmin
          ? 'All Classes'
          : 'Assigned Classes'
        : visibleClasses.find(c => c.id === selectedClassId)?.name || 'Class';

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
    setNoticeSentBanner(`Notice dispatched to parent of ${student.name} (${student.parentEmail || student.parentContact || 'Registered Contact'})`);
    setParentNoticeStudent(null);
    setTimeout(() => setNoticeSentBanner(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700">Performance Analytics</span>
            <span>·</span>
            <span>Live Attendance Ledger</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Attendance Reports &amp; Trend Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor weekly attendance standing, identify students below 75% eligibility, and export registers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleOpenPdfRegister}
            disabled={visibleSubjects.length === 0}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            title="Download official BTEB PDF attendance register"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download PDF Register</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            title="Download formatted CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
            title="Print Attendance Summary"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {noticeSentBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{noticeSentBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setNoticeSentBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-col xl:flex-row xl:items-end justify-between gap-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 min-w-0 flex-1">
          <div className="min-w-0 w-full sm:w-auto lg:max-w-[230px]">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              {isAdmin ? 'Subject (All)' : 'My Assigned Subjects'}
            </label>
            <select
              aria-label="Filter by Subject"
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="w-full max-w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 truncate"
            >
              <option value="all">
                {isAdmin
                  ? `All Subjects (${visibleSubjects.length})`
                  : `All Assigned Subjects (${visibleSubjects.length})`}
              </option>
              {visibleSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code}: {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 w-full sm:w-auto">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Course Part
            </label>
            <select
              aria-label="Filter by Course Part"
              value={selectedPartFilter}
              onChange={e => setSelectedPartFilter(e.target.value as 'all' | SubjectPart)}
              className="w-full max-w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            >
              <option value="all">All Parts (Theory &amp; Practical)</option>
              <option value="theory">Theory Part Only</option>
              <option value="practical">Practical Part Only</option>
            </select>
          </div>

          <div className="min-w-0 w-full sm:w-auto">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Class Group
            </label>
            <select
              aria-label="Filter by Class Group"
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full max-w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            >
              <option value="all">
                {isAdmin
                  ? `All Classes (${visibleClasses.length})`
                  : `Assigned Classes (${visibleClasses.length})`}
              </option>
              {visibleClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setRiskOnlyFilter(!riskOnlyFilter)}
            className={`h-9 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
              riskOnlyFilter
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>At-Risk Only (&lt;75%) ({atRiskStudents.length})</span>
          </button>
        </div>

        <div className="relative w-full xl:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search student or roll no..."
            value={searchStudent}
            onChange={e => setSearchStudent(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Teacher Unassigned Notice */}
      {!isAdmin && visibleSubjects.length === 0 && (
        <div
          data-testid="teacher-no-assigned-subjects"
          className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 flex items-start gap-3 text-amber-900"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">No Assigned Subjects Yet</h3>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Only subjects assigned to you by the administrator are visible here. Once your Theory or Practical subjects are allocated, your attendance reports and charts will populate automatically.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Average Attendance
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {summary.averageAttendanceRate}%
          </p>
          <p
            className={`text-xs font-medium mt-1.5 ${
              summary.averageAttendanceRate >= 85 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {summary.averageAttendanceRate >= 85 ? 'Healthy Standing' : 'Needs Monitoring'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Sessions
          </span>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {summary.totalSessions}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            Roll calls conducted
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Present vs Absent
          </span>
          <p className="text-3xl font-bold text-emerald-700 mt-2">
            {summary.totalPresent}{' '}
            <span className="text-base font-medium text-slate-400">/ {summary.totalAbsent} abs</span>
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {summary.totalLate} late · {summary.totalExcused} excused
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            At-Risk Students (&lt;75%)
          </span>
          <p className="text-3xl font-bold text-rose-600 mt-2">
            {atRiskStudents.length}
          </p>
          <p className="text-xs text-rose-600 font-medium mt-1.5">
            Require early intervention
          </p>
        </div>
      </div>

      {/* Current Week Per-Student Attendance Bar Chart Summary (Recharts) */}
      <div
        data-testid="weekly-summary-card"
        className="bg-white rounded-xl p-6 border border-slate-200 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
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
            <div className="tabular-nums font-semibold text-slate-900">
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
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs bg-emerald-500" /> &ge; 85% Good
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs bg-amber-500" /> 75%–84% Caution
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs bg-rose-500" /> &lt; 75% At Risk
              </span>
            </div>
          </div>
        </div>

        {weeklySummary.studentPoints.length === 0 ? (
          <div className="py-10 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600">
              No attendance sessions recorded for the current week ({weeklySummary.weekLabel}).
            </p>
            <p className="text-xs text-slate-400 mt-1">
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
                      <div className="bg-slate-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg border border-slate-800 space-y-1">
                        <p className="font-semibold text-white">{point.studentName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Roll {point.rollNumber} · {point.totalSessions} session{point.totalSessions === 1 ? '' : 's'}
                        </p>
                        <p className="font-bold text-emerald-400 tabular-nums">
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
                    fontWeight: 600,
                  }}
                />
                <Bar
                  dataKey="attendancePercentage"
                  name="Weekly Attendance %"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
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

      {/* Session Attendance Trend Chart */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Session Attendance Trends Over Time</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Session-by-session rate (%) relative to the 75% examination eligibility threshold.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-emerald-500" /> &ge; 85% Good
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-amber-500" /> 75%–84% Caution
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-rose-500" /> &lt; 75% Risk
            </span>
          </div>
        </div>

        {chronologicalSessions.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">No sessions match current filter.</p>
        ) : (
          <div className="pt-4">
            <div className="h-44 w-full flex items-end gap-2 border-b border-l border-slate-200 px-3 pb-2">
              {chronologicalSessions.map((sess) => {
                const total = sess.totalStudents || 1;
                const effective = sess.presentCount + sess.lateCount * 0.75 + sess.excusedCount;
                const rate = Math.round((effective / total) * 100);
                const heightPercent = Math.min(100, Math.max(10, rate));

                return (
                  <div
                    key={sess.id}
                    className="flex-1 flex flex-col items-center group relative h-full justify-end"
                  >
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[11px] rounded-lg py-1.5 px-2.5 pointer-events-none whitespace-nowrap shadow-lg tabular-nums">
                      <span className="font-semibold">
                        {rate}% ({sess.part === 'practical' ? 'Practical' : 'Theory'})
                      </span>
                      <span className="text-slate-400 text-[10px]">{sess.date}</span>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[26px] rounded-t-sm transition-opacity group-hover:opacity-80 ${
                        rate >= 85
                          ? 'bg-emerald-500'
                          : rate >= 75
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />

                    <span className="text-[10px] text-slate-400 mt-2 truncate max-w-[40px] font-mono tabular-nums">
                      {sess.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* At-Risk Intervention Section */}
      {atRiskStudents.length > 0 && (
        <div className="bg-white border border-rose-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                At-Risk Student Alerts ({atRiskStudents.length} below 75%)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                BTEB academic policy requires at least 75% attendance for semester examination eligibility.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 tabular-nums">
            {atRiskStudents.map(({ student, stats }) => (
              <div
                key={student.id}
                className="bg-rose-50/40 p-4 rounded-lg border border-rose-200/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-slate-700">
                      {student.rollNumber}
                    </span>
                    <span className="text-xs font-bold text-rose-600">
                      {stats.attendancePercentage}%
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mt-1">{student.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Missed {stats.absent} of {stats.totalSessions} sessions
                  </p>
                  <p className="text-xs text-amber-800 font-medium mt-1">
                    Needs <strong>{stats.requiredForThreshold}</strong> consecutive sessions to reach 75%.
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-rose-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setParentNoticeStudent(student)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Parent Warning</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrilldownStudent(student)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    View Log →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Attendance Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Student Attendance Performance History
            </h3>
            <p className="text-xs text-slate-500">
              Select a student row to inspect their complete session log and remarks.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            Showing {displayedStudents.length} student{displayedStudents.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
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
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      {student.rollNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={student.avatar} name={student.name} size="sm" />
                        <div>
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors block">
                            {student.name}
                          </span>
                          <span className="text-[11px] text-slate-400">{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {classGroup?.name}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">
                      {stats.totalSessions}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-emerald-700">
                      {stats.present}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-rose-600">
                      {stats.absent}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-amber-600">
                      {stats.late}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${
                            stats.isAtRisk
                              ? 'text-rose-600'
                              : stats.attendancePercentage >= 90
                              ? 'text-emerald-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {stats.attendancePercentage}%
                        </span>
                        {stats.isAtRisk ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            At Risk
                          </span>
                        ) : stats.attendancePercentage >= 90 ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Good
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {stats.currentStreak >= 3 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          {stats.currentStreak}d
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
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
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
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Avatar src={drilldownStudent.avatar} name={drilldownStudent.name} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {drilldownStudent.name}
                    </h3>
                    <span className="text-xs font-mono text-slate-500">
                      · {drilldownStudent.rollNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {drilldownStudent.email} · Parent: {drilldownStudent.parentEmail || 'Not configured'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const stuStats = calculateStudentAttendanceStats(drilldownStudent, sessions, records);
              return (
                <div className="mt-4 grid grid-cols-4 divide-x divide-slate-200 border border-slate-200 rounded-lg text-center tabular-nums">
                  <div className="p-3">
                    <span className="text-[11px] text-slate-500 font-medium block">Rate</span>
                    <span className="text-lg font-bold text-slate-900">{stuStats.attendancePercentage}%</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[11px] text-emerald-700 font-medium block">Present</span>
                    <span className="text-lg font-bold text-emerald-700">{stuStats.present}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[11px] text-rose-600 font-medium block">Absent</span>
                    <span className="text-lg font-bold text-rose-600">{stuStats.absent}</span>
                  </div>
                  <div className="p-3">
                    <span className="text-[11px] text-amber-600 font-medium block">Late</span>
                    <span className="text-lg font-bold text-amber-600">{stuStats.late}</span>
                  </div>
                </div>
              );
            })()}

            <div className="mt-5">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Detailed Session Log
              </h4>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleSessions
                      .filter(s => records.some(r => r.sessionId === s.id && r.studentId === drilldownStudent.id))
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(session => {
                        const rec = records.find(
                          r => r.sessionId === session.id && r.studentId === drilldownStudent.id
                        );
                        const sub = visibleSubjects.find(s => s.id === session.subjectId) || subjects.find(s => s.id === session.subjectId);
                        const status = rec?.status || 'present';

                        return (
                          <tr key={session.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {session.date}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              <span className="font-mono">{sub?.code || 'Course'}</span>
                              <span
                                className={`ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  session.part === 'practical'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {session.part === 'practical' ? 'Practical' : 'Theory'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center text-[11px] font-semibold capitalize px-2 py-0.5 rounded ${
                                  status === 'present'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : status === 'absent'
                                    ? 'bg-rose-50 text-rose-700'
                                    : status === 'late'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-sky-50 text-sky-700'
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

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrilldownStudent(null)}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
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
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Dispatch Attendance Warning to Guardian
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Recipient: <strong className="text-slate-800">{parentNoticeStudent.parentEmail || parentNoticeStudent.parentContact || 'Registered Guardian'}</strong>
            </p>

            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 text-slate-700">
              <p className="font-semibold text-slate-900">
                Subject: Attendance Advisory Notice — {parentNoticeStudent.name}
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                Dear Guardian, {parentNoticeStudent.name} currently holds an attendance rate under the mandatory 75% BTEB examination threshold. Please contact the department office to address these absences.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setParentNoticeStudent(null)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendParentNotice(parentNoticeStudent)}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Dispatch Warning Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfModalSubject && (
        <DownloadRegisterModal
          isOpen={Boolean(pdfModalSubject)}
          onClose={() => setPdfModalSubject(null)}
          subject={pdfModalSubject.subject}
          classGroup={pdfModalSubject.classGroup}
          teacher={currentUser}
          students={visibleStudents}
          sessions={visibleSessions}
          records={records}
          defaultPart={selectedPartFilter === 'all' ? undefined : selectedPartFilter}
        />
      )}
    </div>
  );
};

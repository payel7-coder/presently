import React, { useMemo, useState, useEffect } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { AttendanceSession, Student } from '../types/attendance';
import { Avatar } from './Avatar';
import {
  buildStudentProfileDossier,
  validateStudentProfileUpdate,
} from '../utils/studentProfileLogic';
import { canEditAttendanceSession } from '../utils/attendanceLogic';
import { deriveSessionFromAdmissionYear } from '../utils/studentSessionLogic';
import { generateStudentDossierPDF } from '../utils/pdfStudentDossier';
import { formatResultStatusLabel } from '../utils/formFillupLogic';
import { EditAttendanceModal } from './EditAttendanceModal';
import {
  ArrowLeft,
  GraduationCap,
  Download,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ClipboardList,
  CalendarClock,
  Receipt,
  UserCheck,
  Mail,
  Phone,
  Shield,
  X,
  Save,
} from 'lucide-react';

interface StudentProfileViewProps {
  studentId: string;
  onBack: () => void;
  onSelectStudent: (studentId: string) => void;
}

type ProfileSectionTab = 'overview' | 'subjects' | 'coursework' | 'history';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  studentId,
  onBack,
  onSelectStudent,
}) => {
  const {
    currentUser,
    isAdmin,
    classes,
    subjects,
    assignments,
    users,
    students,
    sessions,
    records,
    courseworkAssignments,
    studentEvaluations,
    formFillupRecords,
    formFillupFeeConfigs,
    updateStudent,
  } = useAttendance();

  const student = useMemo(
    () => students.find(s => s.id === studentId),
    [students, studentId]
  );

  const [activeSection, setActiveSection] = useState<ProfileSectionTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<Student | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [editingAttendanceSession, setEditingAttendanceSession] = useState<AttendanceSession | null>(null);

  useEffect(() => {
    setSaveNotice(null);
    setEditError(null);
  }, [studentId]);

  const classPeers = useMemo(() => {
    if (!student) return [];
    return [...students]
      .filter(s => s.classId === student.classId)
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }, [students, student]);

  const dossier = useMemo(() => {
    if (!student) return null;
    return buildStudentProfileDossier({
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
    });
  }, [
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
  ]);

  if (!student || !dossier) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Student Record Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            This student profile may have been removed or belongs to another semester batch.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Student Directory</span>
          </button>
        </div>
      </div>
    );
  }

  const {
    classGroup,
    attendanceStats,
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
  } = dossier;

  const openEditModal = () => {
    setEditDraft({ ...student });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDraft) return;

    const validation = validateStudentProfileUpdate(editDraft, students);
    if (!validation.valid || !validation.normalized) {
      setEditError(validation.error || 'Please check the entered profile information.');
      return;
    }

    setIsSavingProfile(true);
    setEditError(null);
    try {
      await updateStudent(validation.normalized);
      setIsEditModalOpen(false);
      setSaveNotice(`Updated official student profile for ${validation.normalized.name}.`);
    } catch (err: any) {
      setEditError(err?.message || 'Unable to save student profile updates.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDownloadDossierPDF = () => {
    const pdf = generateStudentDossierPDF(dossier, currentUser);
    pdf.save(`Student_Profile_${student.rollNumber}_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  const attendedTotal =
    attendanceStats.present + attendanceStats.late + attendanceStats.excused;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb & Primary Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Directory</span>
          </button>

          <nav
            aria-label="Student Profile Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0"
          >
            <span className="truncate">{classGroup?.name || 'Semester Batch'}</span>
            <span aria-hidden="true">/</span>
            <span className="font-mono font-semibold text-slate-900 whitespace-nowrap">
              Roll {student.rollNumber}
            </span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {classPeers.length > 1 && (
            <select
              aria-label="Switch student profile in this batch"
              value={student.id}
              onChange={e => onSelectStudent(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 max-w-[240px]"
            >
              {classPeers.map(peer => (
                <option key={peer.id} value={peer.id}>
                  Roll {peer.rollNumber} — {peer.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleDownloadDossierPDF}
            className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Download Academic Dossier (PDF)</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={openEditModal}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>

      {saveNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{saveNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* University Registrar Identity Card */}
      <section
        aria-label="University Student Academic Profile Header"
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        {/* Institutional Banner Strip */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Bangladesh Technical Education Board · Diploma in{' '}
              {classGroup?.department || 'Computer Science & Technology'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 tabular-nums">
            Registrar ID: {student.registrationNumber || student.rollNumber}
          </div>
        </div>

        {/* Bio Header */}
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div className="shrink-0 p-1 rounded-xl border border-slate-200 bg-slate-50">
              <Avatar src={student.avatar} name={student.name} size="lg" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-emerald-700">
                  Roll {student.rollNumber}
                </span>
                <span aria-hidden="true">·</span>
                <span>{classGroup?.name || `${student.semester || 'Active'} Semester`}</span>
                <span aria-hidden="true">·</span>
                <span>{student.shift || classGroup?.section || 'Day Shift'}</span>
                {student.session && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Session {student.session}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 truncate">
                {student.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{student.email}</span>
                </span>
                {student.phone && (
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{student.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div
              className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 ${
                student.status === 'active'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {student.status === 'active' ? 'Active Enrollment' : 'Inactive Record'}
              </span>
            </div>

            {attendanceStats.totalSessions > 0 && (
              <div
                className={`px-3 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 ${
                  attendanceStats.isAtRisk
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                {attendanceStats.isAtRisk ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {attendanceStats.isAtRisk
                    ? 'Attendance Shortage (<75%)'
                    : 'Exam Eligible'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4-Column Tabular Academic KPI Strip */}
        <div className="border-t border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 tabular-nums">
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Overall Attendance
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {attendanceStats.attendancePercentage}%
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {attendedTotal} of {attendanceStats.totalSessions} sessions attended · Streak{' '}
              {attendanceStats.currentStreak}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              BTEB Eligibility Status
            </p>
            <p
              className={`text-lg font-bold mt-1.5 ${
                attendanceStats.isAtRisk ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {attendanceStats.totalSessions === 0
                ? 'Awaiting Roll Call'
                : attendanceStats.isAtRisk
                ? `Shortage (${attendanceStats.attendancePercentage}%)`
                : 'Eligible (>= 75%)'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {attendanceStats.isAtRisk
                ? `Needs ${attendanceStats.requiredForThreshold} consecutive class(es) for 75%`
                : `${eligibleSubjectsCount} eligible · ${atRiskSubjectsCount} subject warning(s)`}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Coursework Performance
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {courseworkSummary.averagePercentage !== null
                ? `${courseworkSummary.averagePercentage}%`
                : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {courseworkSummary.gradedCount} of {courseworkSummary.totalAssignments}{' '}
              assignment(s) graded · {courseworkSummary.standing}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Semester Form Fill-up
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {formFillupRecord
                ? `৳ ${formFillupRecord.calculatedAmountTk.toLocaleString()}`
                : '—'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {formFillupRecord
                ? `${formatResultStatusLabel(formFillupRecord.resultStatus)} · ${
                    formFillupRecord.paymentStatus
                  }`
                : 'No form fill-up calculation yet'}
            </p>
          </div>
        </div>
      </section>

      {/* Section Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div
          role="tablist"
          aria-label="Student Profile Sections"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
        >
          {[
            { id: 'overview' as const, label: 'Overview & Registrar', icon: Shield },
            {
              id: 'subjects' as const,
              label: `Subjects & Attendance (${subjectRows.length})`,
              icon: BookOpen,
            },
            {
              id: 'coursework' as const,
              label: `Coursework (${courseworkHistory.length})`,
              icon: ClipboardList,
            },
            {
              id: 'history' as const,
              label: 'Timeline & Form Fill-up',
              icon: CalendarClock,
            },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveSection(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500 tabular-nums">
          Total Semester Credits: <strong className="text-slate-800">{totalCreditsEnrolled}</strong>
        </span>
      </div>

      {/* TAB 1: Overview & Registrar Information */}
      {activeSection === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Official Registrar & Personal Information */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Official Registrar &amp; Student Particulars
                </h2>
                <p className="text-xs text-slate-500">
                  Permanent academic registration and institutional identity details
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Update</span>
                </button>
              )}
            </div>

            <dl className="divide-y divide-slate-100 text-xs">
              {[
                { label: 'Full Legal Name', value: student.name, strong: true },
                { label: 'Board / Class Roll', value: student.rollNumber, mono: true },
                {
                  label: 'BTEB Registration No.',
                  value: student.registrationNumber || 'Not Assigned',
                  mono: true,
                },
                {
                  label: 'Technology / Program',
                  value: classGroup?.technology || 'Computer Science & Technology (85)',
                },
                {
                  label: 'Semester & Shift',
                  value: `${classGroup?.semester || student.semester || '—'} Semester · ${
                    student.shift || classGroup?.section || 'Day Shift'
                  }`,
                },
                {
                  label: 'Academic Session',
                  value: student.session || classGroup?.academicYear || '2022–2023',
                  mono: true,
                },
                {
                  label: 'Admission Year',
                  value: student.admissionYear || '—',
                  mono: true,
                },
                {
                  label: 'Academic Standing',
                  value: student.academicStanding || 'Regular Standing',
                },
                { label: 'Gender', value: student.gender },
                { label: 'Date of Birth', value: student.dateOfBirth || '—', mono: true },
                { label: 'Blood Group', value: student.bloodGroup || '—', mono: true },
                { label: 'Institutional Email', value: student.email },
                { label: 'Mobile Phone', value: student.phone || '—', mono: true },
                { label: 'Present Address', value: student.presentAddress || '—' },
                { label: 'Permanent Address', value: student.permanentAddress || '—' },
              ].map(row => (
                <div
                  key={row.label}
                  className="px-5 py-3 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4"
                >
                  <dt className="sm:col-span-5 text-slate-500 font-medium">{row.label}</dt>
                  <dd
                    className={`sm:col-span-7 text-slate-900 ${
                      row.strong ? 'font-semibold' : ''
                    } ${row.mono ? 'font-mono' : ''}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: Guardian & Semester Academic Snapshot */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">
                  Guardian &amp; Emergency Contact
                </h2>
                <p className="text-xs text-slate-500">
                  Authorized parent / guardian contact for attendance &amp; academic notices
                </p>
              </div>
              <dl className="divide-y divide-slate-100 text-xs">
                <div className="px-5 py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 font-medium">Father Name</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {student.fatherName || '—'}
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 font-medium">Mother Name</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {student.motherName || '—'}
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 font-medium">Guardian Name</dt>
                  <dd className="font-semibold text-slate-900 text-right">
                    {student.guardianName || 'Not Recorded'}
                  </dd>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500 font-medium">Guardian Phone</dt>
                  <dd className="font-mono text-slate-900 text-right">
                    {student.parentContact || '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">
                  Attendance &amp; Advisor Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Classroom roll call breakdown across all recorded sessions
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                  {[
                    { label: 'Present', count: attendanceStats.present, cls: 'text-emerald-700' },
                    { label: 'Late', count: attendanceStats.late, cls: 'text-amber-700' },
                    { label: 'Excused', count: attendanceStats.excused, cls: 'text-slate-700' },
                    { label: 'Absent', count: attendanceStats.absent, cls: 'text-rose-700' },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                    >
                      <p className={`text-lg font-bold font-mono ${stat.cls}`}>{stat.count}</p>
                      <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Registrar / Advisor Remarks
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {student.remarks ||
                      'No institutional remarks recorded for this student yet.'}
                  </p>
                </div>

                {student.semesterHistory && student.semesterHistory.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Semester Progression History
                    </p>
                    <div className="space-y-1.5">
                      {student.semesterHistory.map((entry, idx) => (
                        <div
                          key={`${entry.semester}-${idx}`}
                          className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200/70"
                        >
                          <span className="font-semibold text-slate-800">
                            {entry.semester} Semester
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {entry.session ? `Session ${entry.session}` : ''}
                            {entry.promotedAt ? ` · ${entry.promotedAt.slice(0, 10)}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Subject-wise Attendance & Coursework Table */}
      {activeSection === 'subjects' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Enrolled Courses &amp; Subject-wise Standing
              </h2>
              <p className="text-xs text-slate-500">
                Theory and Practical session attendance alongside graded coursework averages
              </p>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              BTEB Minimum Eligibility Threshold: 75%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Course Title &amp; Faculty</th>
                  <th className="py-3 px-3 text-center">Cr</th>
                  <th className="py-3 px-3 text-center">Theory Att.</th>
                  <th className="py-3 px-3 text-center">Practical Att.</th>
                  <th className="py-3 px-3 text-right">Combined %</th>
                  <th className="py-3 px-3 text-right">Coursework</th>
                  <th className="py-3 px-4 text-right">Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      No curriculum subjects configured for this semester batch yet.
                    </td>
                  </tr>
                ) : (
                  subjectRows.map(row => (
                    <tr key={row.subject.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {row.subject.code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{row.subject.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Theory: {row.theoryTeacherName} · Practical: {row.practicalTeacherName}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {row.subject.credits}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {row.theoryPercentage !== null
                          ? `${row.theoryAttended}/${row.theorySessions} (${row.theoryPercentage}%)`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {row.practicalPercentage !== null
                          ? `${row.practicalAttended}/${row.practicalSessions} (${row.practicalPercentage}%)`
                          : '—'}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono font-bold ${
                          row.combinedSessions === 0
                            ? 'text-slate-400'
                            : row.isAtRisk
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {row.combinedSessions > 0 ? `${row.combinedPercentage}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {row.courseworkAveragePct !== null
                          ? `${row.courseworkAveragePct}% (${row.gradedAssignmentsCount}/${row.assignmentsCount})`
                          : row.assignmentsCount > 0
                          ? `0/${row.assignmentsCount} graded`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {row.combinedSessions === 0 ? (
                          <span className="text-slate-400">No Sessions</span>
                        ) : row.isAtRisk ? (
                          <span className="text-rose-700">Below 75%</span>
                        ) : (
                          <span className="text-emerald-700">Eligible</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Coursework & Evaluations */}
      {activeSection === 'coursework' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Coursework Assignments &amp; Teacher Evaluations
              </h2>
              <p className="text-xs text-slate-500">
                Submission records, marks awarded, and faculty feedback across enrolled subjects
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700">
              Total Marks: {courseworkSummary.totalMarksObtained} /{' '}
              {courseworkSummary.totalMaxMarks}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Assignment Title</th>
                  <th className="py-3 px-3">Due Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Score</th>
                  <th className="py-3 px-4">Teacher Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courseworkHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No coursework assignments have been issued for this semester batch yet.
                    </td>
                  </tr>
                ) : (
                  courseworkHistory.map(item => {
                    const status = item.evaluation?.status || 'pending';
                    return (
                      <tr key={item.assignment.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-slate-900">
                            {item.subjectCode}
                          </span>
                          <span className="text-slate-500 block text-[11px]">
                            {item.assignment.part === 'practical' ? 'Practical' : 'Theory'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {item.assignment.title}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {item.assignment.dueDate}
                        </td>
                        <td className="py-3 px-3 font-semibold capitalize">
                          <span
                            className={
                              status === 'graded'
                                ? 'text-emerald-700'
                                : status === 'missing'
                                ? 'text-rose-700'
                                : status === 'late'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {typeof item.evaluation?.marksObtained === 'number'
                            ? `${item.evaluation.marksObtained} / ${item.assignment.maxMarks}`
                            : `— / ${item.assignment.maxMarks}`}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs">
                          {item.evaluation?.feedback || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Attendance Timeline & Form Fill-up Fee Summary */}
      {activeSection === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Chronological Attendance Ledger */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                Recent Attendance Log ({attendanceHistory.length})
              </h2>
              <p className="text-xs text-slate-500">
                Session-by-session Theory &amp; Practical roll call entries (newest first)
              </p>
            </div>

            {attendanceHistory.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No classroom attendance sessions recorded for this student yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                {attendanceHistory.slice(0, 40).map(entry => {
                  const matchedSession = sessions.find(s => s.id === entry.sessionId);
                  const canEdit = canEditAttendanceSession(currentUser, matchedSession, assignments);
                  return (
                    <div
                      key={entry.recordId}
                      className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-900">
                            {entry.date}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-slate-600">{entry.subjectCode}</span>
                          <span className="text-slate-700 font-medium truncate">
                            {entry.subjectName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {entry.part === 'practical' ? 'Practical' : 'Theory'}
                          {entry.topic ? ` · Topic: ${entry.topic}` : ''}
                          {entry.remarks ? ` · Note: ${entry.remarks}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span
                          className={`font-semibold capitalize ${
                            entry.status === 'present'
                              ? 'text-emerald-700'
                              : entry.status === 'absent'
                              ? 'text-rose-700'
                              : entry.status === 'late'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {entry.status}
                        </span>
                        {canEdit && matchedSession && (
                          <button
                            type="button"
                            onClick={() => setEditingAttendanceSession(matchedSession)}
                            className="h-7 px-2 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1"
                            aria-label={`Edit attendance on ${entry.date} for ${entry.subjectCode}`}
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Semester Form Fill-up Fee Breakdown */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Semester Examination &amp; Form Fill-up Record
                </h2>
                <p className="text-xs text-slate-500">
                  Result classification and 9-metric BTEB examination fee assessment
                </p>
              </div>
              <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>

            {!formFillupRecord || !formFillupBreakdown || !formFillupFeeConfig ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No examination form fill-up calculation has been saved for this student yet.
              </div>
            ) : (
              <div className="p-5 space-y-3 text-xs tabular-nums">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatResultStatusLabel(formFillupRecord.resultStatus)}
                    </p>
                    {formFillupRecord.resultSummaryNote && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formFillupRecord.resultSummaryNote}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold capitalize text-emerald-700">
                    {formFillupRecord.paymentStatus}
                  </span>
                </div>

                {[
                  { label: '1. Exam Fee', amount: formFillupBreakdown.examFeeAmount },
                  { label: '2. Referred Exam Fee', amount: formFillupBreakdown.referredExamFeeAmount },
                  { label: '3. Marksheet Fee (Regular)', amount: formFillupBreakdown.marksheetRegularAmount },
                  { label: '4. Marksheet Fee (Referred)', amount: formFillupBreakdown.marksheetReferredAmount },
                  { label: '5. Center Fee (Regular)', amount: formFillupBreakdown.centerRegularAmount },
                  { label: '6. Center Fee (Referred)', amount: formFillupBreakdown.centerReferredAmount },
                  { label: '7. Practical Fee', amount: formFillupBreakdown.practicalFeeAmount },
                  { label: '8. Question Fee', amount: formFillupBreakdown.questionFeeAmount },
                  { label: '9. Delay Fee', amount: formFillupBreakdown.delayFeeAmount },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-slate-600">{item.label}</span>
                    <span
                      className={`font-mono ${
                        item.amount > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      ৳ {item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Total Form Fill-up Fee</span>
                  <span className="text-base font-bold font-mono text-emerald-700">
                    ৳ {formFillupBreakdown.totalAmountTk.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Only: Edit Official Student Profile Modal */}
      {isEditModalOpen && editDraft && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-student-profile-title"
            className="bg-white rounded-xl max-w-2xl w-full p-5 sm:p-6 shadow-xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
              <div>
                <h2
                  id="edit-student-profile-title"
                  className="text-base font-bold text-slate-900"
                >
                  Edit Official Student Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update university registrar details, guardian contacts, and academic standing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                aria-label="Close edit student profile modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDraft.name}
                    onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Board / Class Roll *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDraft.rollNumber}
                    onChange={e => setEditDraft({ ...editDraft, rollNumber: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    BTEB Registration No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1502189401"
                    value={editDraft.registrationNumber || ''}
                    onChange={e =>
                      setEditDraft({ ...editDraft, registrationNumber: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Admission Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2022"
                    value={editDraft.admissionYear || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const derived = deriveSessionFromAdmissionYear(val);
                      const prevDerived = deriveSessionFromAdmissionYear(editDraft.admissionYear);
                      setEditDraft({
                        ...editDraft,
                        admissionYear: val,
                        session:
                          derived && (!editDraft.session || editDraft.session === prevDerived)
                            ? derived
                            : editDraft.session,
                      });
                    }}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2022-23"
                    value={editDraft.session || ''}
                    onChange={e => setEditDraft({ ...editDraft, session: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Shift / Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1st Shift (Morning)"
                    value={editDraft.shift || ''}
                    onChange={e => setEditDraft({ ...editDraft, shift: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editDraft.gender}
                    onChange={e => setEditDraft({ ...editDraft, gender: e.target.value as any })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={editDraft.bloodGroup || ''}
                    onChange={e => setEditDraft({ ...editDraft, bloodGroup: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="">Select...</option>
                    {BLOOD_GROUPS.filter(Boolean).map(bg => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editDraft.dateOfBirth || ''}
                    onChange={e => setEditDraft({ ...editDraft, dateOfBirth: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Student Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editDraft.email}
                    onChange={e => setEditDraft({ ...editDraft, email: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Student Mobile
                  </label>
                  <input
                    type="text"
                    placeholder="+8801XXXXXXXXX"
                    value={editDraft.phone || ''}
                    onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Academic Standing
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Regular / Honors"
                    value={editDraft.academicStanding || ''}
                    onChange={e =>
                      setEditDraft({ ...editDraft, academicStanding: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Father Name</label>
                  <input
                    type="text"
                    placeholder="Father's full name"
                    value={editDraft.fatherName || ''}
                    onChange={e => setEditDraft({ ...editDraft, fatherName: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mother Name</label>
                  <input
                    type="text"
                    placeholder="Mother's full name"
                    value={editDraft.motherName || ''}
                    onChange={e => setEditDraft({ ...editDraft, motherName: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guardian Name</label>
                  <input
                    type="text"
                    placeholder="Father / Mother / Guardian"
                    value={editDraft.guardianName || ''}
                    onChange={e => setEditDraft({ ...editDraft, guardianName: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Guardian Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+8801XXXXXXXXX"
                    value={editDraft.parentContact || ''}
                    onChange={e =>
                      setEditDraft({ ...editDraft, parentContact: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Present Address
                  </label>
                  <input
                    type="text"
                    placeholder="Residential address"
                    value={editDraft.presentAddress || ''}
                    onChange={e =>
                      setEditDraft({ ...editDraft, presentAddress: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Permanent Address
                  </label>
                  <input
                    type="text"
                    placeholder="Home / Permanent address"
                    value={editDraft.permanentAddress || ''}
                    onChange={e =>
                      setEditDraft({ ...editDraft, permanentAddress: e.target.value })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Registrar / Advisor Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Scholarship, conduct, or academic notes..."
                    value={editDraft.remarks || ''}
                    onChange={e => setEditDraft({ ...editDraft, remarks: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Enrollment Status
                  </label>
                  <select
                    value={editDraft.status}
                    onChange={e =>
                      setEditDraft({
                        ...editDraft,
                        status: e.target.value as 'active' | 'inactive',
                      })
                    }
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Student Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAttendanceSession && (
        <EditAttendanceModal
          isOpen={Boolean(editingAttendanceSession)}
          session={editingAttendanceSession}
          highlightStudentId={student.id}
          onClose={() => setEditingAttendanceSession(null)}
          onSaved={updated => {
            setSaveNotice(
              `Updated attendance record on ${updated.date} (${updated.presentCount}/${updated.totalStudents} Present).`
            );
          }}
        />
      )}
    </div>
  );
};

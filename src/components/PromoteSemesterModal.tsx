import React, { useEffect, useMemo, useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  X,
  Users,
} from 'lucide-react';
import {
  getDistinctStudentSessions,
  getNextSemesterClass,
  normalizeStudentSessionFields,
  PromotionPlanResult,
} from '../utils/studentSessionLogic';

interface PromoteSemesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceClassId: string;
}

export const PromoteSemesterModal: React.FC<PromoteSemesterModalProps> = ({
  isOpen,
  onClose,
  sourceClassId,
}) => {
  const { classes, students, promoteStudents, isAdmin } = useAttendance();

  const sourceClass = useMemo(
    () => classes.find(c => c.id === sourceClassId) || null,
    [classes, sourceClassId]
  );

  const nextResolution = useMemo(
    () => (sourceClass ? getNextSemesterClass(sourceClass, classes) : null),
    [sourceClass, classes]
  );

  const [targetClassId, setTargetClassId] = useState<string>('');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<PromotionPlanResult | null>(null);

  const classStudents = useMemo(
    () =>
      students
        .filter(s => s.classId === sourceClassId)
        .sort((a, b) =>
          a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
        ),
    [students, sourceClassId]
  );

  const availableSessions = useMemo(
    () => getDistinctStudentSessions(classStudents),
    [classStudents]
  );

  const filteredStudents = useMemo(() => {
    if (sessionFilter === 'all') return classStudents;
    return classStudents.filter(stu => {
      const { session } = normalizeStudentSessionFields({
        session: stu.session,
        admissionYear: stu.admissionYear,
      });
      return session === sessionFilter;
    });
  }, [classStudents, sessionFilter]);

  useEffect(() => {
    if (!isOpen) return;
    setResultSummary(null);
    setErrorMsg(null);
    setSessionFilter('all');

    const resolvedNext = sourceClass ? getNextSemesterClass(sourceClass, classes) : null;
    if (resolvedNext) {
      setTargetClassId(
        resolvedNext.isFinalSemester
          ? '__GRADUATE__'
          : resolvedNext.nextClass?.id || '__GRADUATE__'
      );
    }

    const activeIds = students
      .filter(s => s.classId === sourceClassId && s.status !== 'inactive')
      .map(s => s.id);
    setSelectedIds(new Set(activeIds));
    // Intentionally reset only when modal opens or sourceClassId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sourceClassId]);

  if (!isOpen || !sourceClass || !isAdmin) return null;

  const isGraduationMode = targetClassId === '__GRADUATE__';
  const targetClass = isGraduationMode
    ? null
    : classes.find(c => c.id === targetClassId) || null;

  const visibleSelectedCount = filteredStudents.filter(s =>
    selectedIds.has(s.id)
  ).length;
  const allVisibleSelected =
    filteredStudents.length > 0 && visibleSelectedCount === filteredStudents.length;

  const handleToggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredStudents.forEach(s => next.delete(s.id));
      } else {
        filteredStudents.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const handleToggleStudent = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmPromote = async () => {
    const idsToPromote = filteredStudents
      .filter(s => selectedIds.has(s.id))
      .map(s => s.id);

    if (idsToPromote.length === 0) {
      setErrorMsg('Select at least one student to promote.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const plan = await promoteStudents(
        sourceClass.id,
        idsToPromote,
        isGraduationMode ? null : targetClassId
      );
      setResultSummary(plan);
      if (plan.promotedStudents.length > 0 && plan.skippedRollConflicts.length === 0) {
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to complete semester promotion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-semester-modal-title"
        className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 my-8"
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="promote-semester-modal-title"
                className="text-lg font-bold text-slate-900 tracking-tight"
              >
                Promote Students to Next Semester
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Move passed students from {sourceClass.name} while keeping each student&apos;s admission session fixed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            aria-label="Close promote semester modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {resultSummary && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {resultSummary.isGraduation
                  ? `Marked ${resultSummary.promotedStudents.length} student(s) as Graduated from ${resultSummary.fromSemester} Semester`
                  : `Promoted ${resultSummary.promotedStudents.length} student(s) from ${resultSummary.fromSemester} to ${resultSummary.toSemester} Semester`}
              </span>
            </div>
            <p className="text-emerald-700">
              Permanent admission sessions were preserved intact across the transition.
            </p>
            {resultSummary.skippedRollConflicts.length > 0 && (
              <div className="mt-2 p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
                <p className="font-semibold">
                  {resultSummary.skippedRollConflicts.length} student(s) skipped due to duplicate Board Roll in destination batch:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {resultSummary.skippedRollConflicts.map(c => (
                    <li key={c.student.id}>
                      Roll {c.student.rollNumber} ({c.student.name}) conflicts with {c.conflictStudentName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Source -> Target Semester Selector */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="md:col-span-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Current Batch
            </span>
            <div className="h-9 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs font-semibold text-slate-900">
              <span className="truncate">{sourceClass.name}</span>
              <span className="text-[11px] font-mono text-slate-500 ml-1.5 shrink-0">
                {classStudents.length}
              </span>
            </div>
          </div>

          <div className="hidden md:flex md:col-span-1 items-center justify-center h-9 text-emerald-600">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="md:col-span-5">
            <label
              htmlFor="promote-target-class"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Promote To Destination
            </label>
            <select
              id="promote-target-class"
              value={targetClassId}
              onChange={e => setTargetClassId(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            >
              {classes
                .filter(c => c.id !== sourceClass.id)
                .map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.section}
                  </option>
                ))}
              <option value="__GRADUATE__">
                8th Semester Completed (Graduated)
              </option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="promote-session-filter"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1"
            >
              Filter by Session
            </label>
            <select
              id="promote-session-filter"
              value={sessionFilter}
              onChange={e => setSessionFilter(e.target.value)}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            >
              <option value="all">All Sessions ({classStudents.length})</option>
              {availableSessions.map(sess => (
                <option key={sess} value={sess}>
                  Session {sess}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Student Checklist Table */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-700">
              Select Passed Students ({visibleSelectedCount} of {filteredStudents.length} selected)
            </p>
            <span className="text-[11px] text-emerald-700 font-medium">
              Admission Session stays unchanged on promotion
            </span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center border border-slate-200 rounded-xl bg-slate-50/50">
              <Users className="w-7 h-7 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No students match this session filter</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 text-[10px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleToggleAllVisible}
                        aria-label="Select all visible students for promotion"
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                      />
                    </th>
                    <th className="py-2.5 px-3">Board Roll</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission Session (Fixed)</th>
                    <th className="py-2.5 px-3">Semester Transition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(stu => {
                    const isChecked = selectedIds.has(stu.id);
                    const { session, admissionYear } = normalizeStudentSessionFields({
                      session: stu.session,
                      admissionYear: stu.admissionYear,
                    });
                    return (
                      <tr
                        key={stu.id}
                        onClick={() => handleToggleStudent(stu.id)}
                        className={`cursor-pointer transition-colors ${
                          isChecked ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStudent(stu.id)}
                            aria-label={`Select ${stu.name} for promotion`}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                          {stu.rollNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {stu.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {session ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-800 font-semibold">
                              <span>{session}</span>
                              {admissionYear && (
                                <span className="text-[11px] font-normal text-slate-400">
                                  (Adm. {admissionYear})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">Not recorded</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {isGraduationMode ? (
                            <span>
                              {sourceClass.semester} →{' '}
                              <strong className="text-emerald-700">Graduated</strong>
                            </span>
                          ) : (
                            <span>
                              {sourceClass.semester} →{' '}
                              <strong className="text-emerald-700">
                                {targetClass?.semester} Semester
                              </strong>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Unselected students remain in <strong className="text-slate-700">{sourceClass.name}</strong>.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || visibleSelectedCount === 0}
              onClick={handleConfirmPromote}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Promoting...'
                  : isGraduationMode
                  ? `Mark ${visibleSelectedCount} Graduated`
                  : `Promote ${visibleSelectedCount} to ${targetClass?.semester || 'Next'} Semester`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

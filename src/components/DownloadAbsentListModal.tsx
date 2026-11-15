import React, { useState, useEffect, useMemo } from 'react';
import {
  UserX,
  Download,
  Printer,
  X,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceSession,
  ClassGroup,
  Student,
  Subject,
  SubjectPart,
  User,
} from '../types/attendance';
import { buildSubjectDateAbsentList } from '../utils/attendanceLogic';
import { downloadAbsentListPDF, generateAbsentListPDF } from '../utils/pdfAbsentList';

interface DownloadAbsentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  classes: ClassGroup[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  teachers?: User[];
  requestedBy?: User | null;
  defaultSubjectId?: string;
  defaultPart?: 'all' | SubjectPart;
  defaultClassId?: string;
  defaultDate?: string;
  isAdmin?: boolean;
}

export const DownloadAbsentListModal: React.FC<DownloadAbsentListModalProps> = ({
  isOpen,
  onClose,
  subjects,
  classes,
  students,
  sessions,
  records,
  teachers = [],
  requestedBy,
  defaultSubjectId = 'all',
  defaultPart = 'all',
  defaultClassId = 'all',
  defaultDate,
  isAdmin = false,
}) => {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(defaultSubjectId || 'all');
  const [selectedPart, setSelectedPart] = useState<'all' | SubjectPart>(defaultPart || 'all');
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'all'>('single');
  const [specificDate, setSpecificDate] = useState<string>(defaultDate || today);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  useEffect(() => {
    if (!isOpen) {
      setPreviewBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const initSubId = defaultSubjectId || 'all';
    const initPart = defaultPart || 'all';
    setSelectedSubjectId(initSubId);
    setSelectedPart(initPart);
    setPreviewBlobUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (defaultDate) {
      setDateMode('single');
      setSpecificDate(defaultDate);
      setStartDate(defaultDate);
      setEndDate(defaultDate);
    } else {
      const matchingDates = sessions
        .filter(s => {
          const matchSub = initSubId === 'all' || s.subjectId === initSubId;
          const matchPart = initPart === 'all' || (s.part || 'theory') === initPart;
          const matchClass = defaultClassId === 'all' || s.classId === defaultClassId;
          return matchSub && matchPart && matchClass;
        })
        .map(s => s.date)
        .sort((a, b) => b.localeCompare(a));

      const hasToday = matchingDates.includes(today);
      const initialDate = hasToday ? today : matchingDates[0] || today;
      setDateMode('single');
      setSpecificDate(initialDate);
      setStartDate(matchingDates[matchingDates.length - 1] || initialDate);
      setEndDate(initialDate);
    }
    setDownloadSuccess(false);
  }, [isOpen, defaultSubjectId, defaultPart, defaultClassId, defaultDate, today, sessions]);

  // Recent recorded session dates matching selected subject/part for quick 1-click selection
  const recentRecordedDates = useMemo(() => {
    const dates = new Set<string>();
    sessions.forEach(s => {
      const matchSub = selectedSubjectId === 'all' || s.subjectId === selectedSubjectId;
      const matchPart = selectedPart === 'all' || (s.part || 'theory') === selectedPart;
      const matchClass = defaultClassId === 'all' || s.classId === defaultClassId;
      if (matchSub && matchPart && matchClass) {
        dates.add(s.date);
      }
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a)).slice(0, 6);
  }, [sessions, selectedSubjectId, selectedPart, defaultClassId]);

  const activeFilters = useMemo(() => {
    return {
      subjectId: selectedSubjectId,
      part: selectedPart,
      classId: defaultClassId,
      date: dateMode === 'single' ? specificDate : undefined,
      startDate: dateMode === 'range' ? startDate : undefined,
      endDate: dateMode === 'range' ? endDate : undefined,
    };
  }, [selectedSubjectId, selectedPart, defaultClassId, dateMode, specificDate, startDate, endDate]);

  const absentResult = useMemo(() => {
    return buildSubjectDateAbsentList({
      subjects,
      classes,
      students,
      sessions,
      records,
      teachers,
      filters: activeFilters,
    });
  }, [subjects, classes, students, sessions, records, teachers, activeFilters]);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        downloadAbsentListPDF({
          subjects,
          classes,
          students,
          sessions,
          records,
          teachers,
          requestedBy,
          filters: activeFilters,
        });
        setIsGenerating(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      } catch (err) {
        console.error('Absent list PDF generation error:', err);
        setIsGenerating(false);
      }
    }, 120);
  };

  const handleTogglePreview = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
      return;
    }
    try {
      const doc = generateAbsentListPDF({
        subjects,
        classes,
        students,
        sessions,
        records,
        teachers,
        requestedBy,
        filters: activeFilters,
      });
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err) {
      console.error('Absent list PDF preview error:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="absent-list-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-rose-400">BTEB Probidhan 2022</span>
                  <span>·</span>
                  <span>Subject &amp; Date-Wise Export</span>
                </div>
                <h2
                  id="absent-list-modal-title"
                  className="text-lg font-bold tracking-tight text-white mt-0.5"
                >
                  Download Student Absent List PDF
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Filter absences by subject, course part (Theory/Practical), and date or date range.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close absent list modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Live Summary Strip */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/50 text-center tabular-nums">
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">
                Matching Sessions
              </span>
              <span className="text-base font-bold text-slate-900">
                {absentResult.totalMatchingSessions}
              </span>
            </div>
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">
                Absent Marks
              </span>
              <span className="text-base font-bold text-rose-600">
                {absentResult.totalAbsentMarks}
              </span>
            </div>
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">
                Unique Students
              </span>
              <span className="text-base font-bold text-slate-900">
                {absentResult.uniqueAbsentStudents}
              </span>
            </div>
          </div>

          {downloadSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3.5 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Absent List PDF downloaded</p>
                <p className="text-[11px] text-emerald-700">
                  Saved printable subject &amp; date-wise absent report to your Downloads folder.
                </p>
              </div>
            </div>
          )}

          {previewBlobUrl ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">
                  PDF Document Preview ({absentResult.dateScopeLabel})
                </span>
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Back to Filters
                </button>
              </div>
              <iframe
                title="Absent List PDF Preview"
                src={previewBlobUrl}
                className="w-full h-96 rounded-lg border border-slate-200 bg-slate-100"
              />
            </div>
          ) : (
            <>
          {/* Subject & Part Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label
                htmlFor="absent-subject-select"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                1. Subject
              </label>
              <select
                id="absent-subject-select"
                value={selectedSubjectId}
                onChange={e => setSelectedSubjectId(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600 truncate"
              >
                <option value="all">
                  {isAdmin
                    ? `All Subjects (${subjects.length})`
                    : `All Assigned Subjects (${subjects.length})`}
                </option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="absent-part-select"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                2. Course Part
              </label>
              <select
                id="absent-part-select"
                value={selectedPart}
                onChange={e => setSelectedPart(e.target.value as 'all' | SubjectPart)}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
              >
                <option value="all">All Parts (Theory &amp; Practical)</option>
                <option value="theory">Theory Part Only</option>
                <option value="practical">Practical Part Only</option>
              </select>
            </div>
          </div>

          {/* Date Scope Controls */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-800">
              3. Date Scope
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDateMode('single')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  dateMode === 'single'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Specific Date
              </button>
              <button
                type="button"
                onClick={() => setDateMode('range')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  dateMode === 'range'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => setDateMode('all')}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  dateMode === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Recorded Dates
              </button>
            </div>

            {dateMode === 'single' && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative sm:w-56">
                    <input
                      type="date"
                      aria-label="Absent list date"
                      value={specificDate}
                      onChange={e => setSpecificDate(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                    />
                  </div>
                  {recentRecordedDates.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Recorded:
                      </span>
                      {recentRecordedDates.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSpecificDate(d)}
                          className={`h-7 px-2 rounded-md text-[11px] font-mono transition-colors ${
                            specificDate === d
                              ? 'bg-rose-600 text-white font-semibold'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {dateMode === 'range' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    aria-label="Absent list start date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    aria-label="Absent list end date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600/20 focus:border-rose-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Live Absent Students Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                4. Absent Students Preview ({absentResult.entries.length})
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {absentResult.dateScopeLabel}
              </span>
            </div>

            {absentResult.entries.length === 0 ? (
              <div
                data-testid="absent-preview-empty"
                className="p-5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center"
              >
                <p className="text-xs font-semibold text-slate-700">
                  {absentResult.totalMatchingSessions === 0
                    ? 'No attendance sessions recorded for this subject and date'
                    : 'No absent students recorded for this selection'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {absentResult.totalMatchingSessions === 0
                    ? 'Try choosing a recorded date chip above, switching to Date Range, or selecting All Recorded Dates.'
                    : 'You can still download an official zero-absence verification PDF.'}
                </p>
              </div>
            ) : (
              <div
                data-testid="absent-preview-table"
                className="max-h-52 overflow-y-auto rounded-lg border border-slate-200"
              >
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {absentResult.entries.map(entry => (
                      <tr key={entry.recordId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                          <span className="font-mono font-semibold">{entry.subjectCode}</span>
                          <span
                            className={`ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              entry.part === 'practical'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {entry.part === 'practical' ? 'Prac' : 'Theo'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-rose-600">
                          {entry.rollNumber}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {entry.studentName}
                        </td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-[140px]">
                          {entry.remarks || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Format: <strong className="text-slate-800">A4 Portrait · BTEB 2022</strong>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex-1 sm:flex-none whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTogglePreview}
              className="h-9 px-3.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{previewBlobUrl ? 'Hide Preview' : 'Preview'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating...' : 'Download Absent List PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

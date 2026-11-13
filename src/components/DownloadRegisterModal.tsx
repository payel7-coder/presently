import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Layers,
  Award,
} from 'lucide-react';
import { Subject, ClassGroup, Student, AttendanceSession, AttendanceRecord, User, SubjectPart } from '../types/attendance';
import { downloadAttendanceRegisterPDF, generateAttendanceRegisterPDF } from '../utils/pdfAttendanceRegister';

interface DownloadRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: Subject;
  classGroup?: ClassGroup;
  teacher?: User | null;
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  defaultPart?: SubjectPart;
}

export const DownloadRegisterModal: React.FC<DownloadRegisterModalProps> = ({
  isOpen,
  onClose,
  subject,
  classGroup,
  teacher,
  students,
  sessions,
  records,
  defaultPart,
}) => {
  const [registerType, setRegisterType] = useState<'recorded' | 'blank'>('recorded');
  const [selectedPart, setSelectedPart] = useState<'all' | SubjectPart>(defaultPart || 'all');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  useEffect(() => {
    setSelectedPart(defaultPart || 'all');
  }, [defaultPart, isOpen]);

  if (!isOpen || !subject || !classGroup) return null;

  const subjectSessions = sessions.filter(
    s => s.subjectId === subject.id && (selectedPart === 'all' || (s.part || 'theory') === selectedPart)
  );
  const classStudents = students.filter(s => s.classId === classGroup.id && s.status === 'active');

  let totalPresences = 0;
  let totalEntries = 0;
  const studentRateMap = new Map<string, number>();

  classStudents.forEach(stu => {
    let pres = 0;
    subjectSessions.forEach(sess => {
      const rec = records.find(r => r.sessionId === sess.id && r.studentId === stu.id);
      if (rec) {
        totalEntries++;
        if (rec.status === 'present' || rec.status === 'late') {
          pres++;
          totalPresences++;
        }
      }
    });
    const rate = subjectSessions.length > 0 ? Math.round((pres / subjectSessions.length) * 100) : 100;
    studentRateMap.set(stu.id, rate);
  });

  const avgAttendance = totalEntries > 0 ? Math.round((totalPresences / totalEntries) * 100) : 0;
  const eligibleCount = Array.from(studentRateMap.values()).filter(r => r >= 75).length;

  const handleDownload = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        let effStart = startDate;
        let effEnd = endDate;

        if (dateFilter === 'month') {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          effStart = `${y}-${m}-01`;
          effEnd = `${y}-${m}-31`;
        } else if (dateFilter === 'all') {
          effStart = '';
          effEnd = '';
        }

        downloadAttendanceRegisterPDF({
          subject,
          classGroup,
          teacher,
          students: classStudents,
          sessions,
          records,
          isBlankTemplate: registerType === 'blank',
          startDate: effStart || undefined,
          endDate: effEnd || undefined,
          part: selectedPart === 'all' ? undefined : selectedPart,
        });

        setIsGenerating(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 3500);
      } catch (err) {
        console.error('PDF generation error:', err);
        setIsGenerating(false);
      }
    }, 150);
  };

  const handlePrintPreview = () => {
    try {
      const doc = generateAttendanceRegisterPDF({
        subject,
        classGroup,
        teacher,
        students: classStudents,
        sessions,
        records,
        isBlankTemplate: registerType === 'blank',
        part: selectedPart === 'all' ? undefined : selectedPart,
      });
      const blobUrl = doc.output('bloburl');
      const printWindow = window.open(blobUrl, '_blank');
      if (!printWindow) {
        doc.save(`BTEB_${subject.code}_Register.pdf`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-emerald-400">BTEB Probidhan 2022</span>
                  <span>·</span>
                  <span className="font-mono">Code: {subject.code}</span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white mt-0.5">
                  Download Official Attendance Register
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {subject.name} · {classGroup.name} ({classGroup.section})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-4 divide-x divide-slate-200 border border-slate-200 rounded-lg bg-slate-50/50 text-center tabular-nums">
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Enrolled</span>
              <span className="text-base font-bold text-slate-900">{classStudents.length}</span>
            </div>
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Classes Held</span>
              <span className="text-base font-bold text-emerald-700">{subjectSessions.length}</span>
            </div>
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Avg Rate</span>
              <span className="text-base font-bold text-slate-900">{avgAttendance}%</span>
            </div>
            <div className="p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Eligible</span>
              <span className="text-base font-bold text-indigo-700">{eligibleCount}/{classStudents.length}</span>
            </div>
          </div>

          {downloadSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3.5 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold">PDF Attendance Register downloaded</p>
                <p className="text-[11px] text-emerald-700">Check your Downloads folder for the printable register.</p>
              </div>
            </div>
          )}

          {/* Register Format Type */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              1. Register Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  registerType === 'recorded'
                    ? 'border-emerald-600 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="registerType"
                  value="recorded"
                  checked={registerType === 'recorded'}
                  onChange={() => setRegisterType('recorded')}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Official Completed Ledger
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Includes all digital roll calls, P/A/L/E stamps, attendance percentages, and exam eligibility.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  registerType === 'blank'
                    ? 'border-emerald-600 bg-emerald-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="registerType"
                  value="blank"
                  checked={registerType === 'blank'}
                  onChange={() => setRegisterType('blank')}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Blank Classroom Grid
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Pre-filled student rolls and names with empty date columns (Slots 1–22) for manual use.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Subject Part Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              2. Subject Part
            </label>
            <div className="flex flex-wrap gap-2">
              {(['theory', 'practical', 'all'] as const).map(partOpt => (
                <button
                  key={partOpt}
                  type="button"
                  onClick={() => setSelectedPart(partOpt)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    selectedPart === partOpt
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {partOpt === 'theory'
                    ? 'Theory Part Only'
                    : partOpt === 'practical'
                    ? 'Practical Part Only'
                    : 'All Parts Combined'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Scope Filter */}
          {registerType === 'recorded' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                3. Session Date Scope
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    dateFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Recorded Classes ({subjectSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('month')}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    dateFilter === 'month' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Current Month Only
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('custom')}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    dateFilter === 'custom' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Custom Date Range
                </button>
              </div>

              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>BTEB Probidhan-2022 Standard A4 Landscape Format</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Includes Board Roll, Registration, Technology Code 85, Course Teacher Signature, HOD Seal, and Principal Endorsement.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Teacher: <strong className="text-slate-800">{teacher?.name || 'Faculty Member'}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex-1 sm:flex-none"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintPreview}
              className="h-9 px-3.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isGenerating ? 'Generating...' : 'Download PDF Register'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

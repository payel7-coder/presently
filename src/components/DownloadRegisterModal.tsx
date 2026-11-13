import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Users,
  BookOpen,
  Award,
  AlertCircle
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

  // Compute stats preview
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
  const atRiskCount = Array.from(studentRateMap.values()).filter(r => r < 75).length;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                    BTEB Probidhan 2022
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Code: {subject.code}
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white mt-1">
                  Download Official Attendance Register
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {subject.name} • {classGroup.name} ({classGroup.section})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Enrolled</span>
              <span className="text-base font-black text-slate-800">{classStudents.length}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Classes Held</span>
              <span className="text-base font-black text-emerald-700">{subjectSessions.length}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Rate</span>
              <span className="text-base font-black text-teal-700">{avgAttendance}%</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Exam Eligible</span>
              <span className="text-base font-black text-indigo-700">{eligibleCount}/{classStudents.length}</span>
            </div>
          </div>

          {/* Success Banner */}
          {downloadSuccess && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">PDF Attendance Register Downloaded!</p>
                <p className="text-[11px] text-emerald-700">Check your Downloads folder for the official printable ledger.</p>
              </div>
            </div>
          )}

          {/* Option 1: Register Format Type */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Choose Register Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  registerType === 'recorded'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="registerType"
                  value="recorded"
                  checked={registerType === 'recorded'}
                  onChange={() => setRegisterType('recorded')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Official Completed Ledger
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Includes all digital roll calls, P/A/L/E session stamps, computed attendance rates, and BTEB Exam eligibility verdicts.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  registerType === 'blank'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="registerType"
                  value="blank"
                  checked={registerType === 'blank'}
                  onChange={() => setRegisterType('blank')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-black text-slate-900 block flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Blank Classroom Log Grid
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Student rolls and names are pre-filled with empty class date columns (Slots 1-22) for physical classroom marking.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Subject Part Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Subject Part (Theory / Practical)
            </label>
            <div className="flex flex-wrap gap-2">
              {(['theory', 'practical', 'all'] as const).map(partOpt => (
                <button
                  key={partOpt}
                  type="button"
                  onClick={() => setSelectedPart(partOpt)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedPart === partOpt
                      ? 'bg-indigo-600 text-white shadow-xs'
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

          {/* Option 2: Date Range Filter (only for recorded ledger) */}
          {registerType === 'recorded' && (
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Session Date Scope
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Recorded Classes ({subjectSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('month')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === 'month'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Current Month Only
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('custom')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    dateFilter === 'custom'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Custom Date Range
                </button>
              </div>

              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Specifications callout */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Official BTEB Probidhan-2022 Format Compliant</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Standard A4 Landscape PDF with board-approved fields: Board Roll, Registration, Technology Code 85, Course Teacher Signature, Head of Department (HOD) Seal, and Principal Endorsement.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            <span>Course Teacher: </span>
            <strong className="text-slate-800">{teacher?.name || 'Faculty Member'}</strong>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex-1 sm:flex-none"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintPreview}
              className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
              title="Open print preview in new window"
            >
              <Printer className="w-4 h-4" />
              <span>Preview / Print</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Generating PDF...' : 'Download PDF Register'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

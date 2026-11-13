import React, { useState, useRef } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  Check,
  X,
  Lock,
  ShieldAlert,
  FileText
} from 'lucide-react';
import {
  parseStudentCSV,
  generateStudentCSVTemplate,
} from '../utils/attendanceLogic';
import { CSVParseResult } from '../types/attendance';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassId?: string;
  onOpenLoginModal?: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  defaultClassId,
  onOpenLoginModal,
}) => {
  const { classes, bulkImportStudents, canImportStudents, currentUser } = useAttendance();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    defaultClassId || (classes[3]?.id || classes[0]?.id || '')
  );
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<CSVParseResult | null>(null);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  if (!canImportStudents) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 text-center">
          <div className="w-12 h-12 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 mb-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Restricted Access
          </div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Administrator Privilege Required
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Student bulk import is restricted to institutional administrators. Signed in as {currentUser?.name || 'Faculty Member'}.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {onOpenLoginModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLoginModal();
                }}
                className="w-full h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Sign In as Administrator
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleTextChange = (text: string) => {
    setCsvRawText(text);
    setImportSuccessCount(null);
    setErrorMessage(null);
    if (text.trim()) {
      const parsed = parseStudentCSV(text, selectedClassId);
      setParseResult(parsed);
    } else {
      setParseResult(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = generateStudentCSVTemplate();
    setFileName('bteb_cst_sample_roster.csv');
    handleTextChange(sample);
  };

  const handleDownloadTemplate = () => {
    const template = generateStudentCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'bteb_probidhan2022_student_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.students.length === 0) return;

    try {
      const count = await bulkImportStudents(selectedClassId, parseResult.students);
      setImportSuccessCount(count);

      setTimeout(() => {
        onClose();
        setImportSuccessCount(null);
        setCsvRawText('');
        setParseResult(null);
        setFileName('');
      }, 2200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error importing students');
    }
  };

  const targetClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Bulk Import Students
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Import BTEB Probidhan 2022 student rolls and registration numbers into semester batches.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {importSuccessCount !== null && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Imported {importSuccessCount} students into {targetClass?.name}
              </p>
              <p className="text-xs text-emerald-700">
                Synchronized to Cloud Firestore.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Target BTEB Semester Class
            </label>
            <select
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                if (csvRawText) {
                  setParseResult(parseStudentCSV(csvRawText, e.target.value));
                }
              }}
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section} ({c.semester} Semester)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              CSV Template
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Template</span>
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Load Sample CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-xl p-6 text-center cursor-pointer transition-colors group"
          >
            <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition-colors" />
            <p className="text-xs font-semibold text-slate-700">
              {fileName ? (
                <span className="text-emerald-700 font-mono">Selected: {fileName}</span>
              ) : (
                'Click to upload BTEB student CSV file'
              )}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Columns: Roll Number, Registration Number, Name, Email, Gender, Phone, Parent Email
            </p>
          </div>
        </div>

        {parseResult && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
              <span className="text-slate-700">Preview:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {parseResult.validCount} valid students
              </span>
              {parseResult.errors.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  {parseResult.errors.length} issues
                </span>
              )}
            </div>

            {parseResult.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Row validation issues:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                  {parseResult.errors.map((err, i) => (
                    <li key={i}>
                      Line {err.line}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Board Roll</th>
                    <th className="py-2 px-3">Reg No</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Parent Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseResult.students.map((stu, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                        {stu.rollNumber}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {stu.registrationNumber || '—'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{stu.name}</td>
                      <td className="py-2 px-3 text-slate-500">{stu.email}</td>
                      <td className="py-2 px-3 text-slate-500">{stu.parentContact || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Target batch: <strong className="text-slate-800">{targetClass?.name} ({targetClass?.section})</strong>
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
              disabled={!parseResult || parseResult.validCount === 0}
              onClick={handleConfirmImport}
              className={`h-9 flex items-center gap-1.5 px-4 rounded-lg text-xs font-semibold transition-colors ${
                parseResult && parseResult.validCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Import {parseResult?.validCount || 0} Students</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

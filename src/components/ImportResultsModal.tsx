import React, { useState, useRef } from 'react';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupStudentRecord,
  Student,
} from '../types/attendance';
import {
  generateResultImportCSVTemplate,
  generateResultImportExcelBuffer,
  ImportedStudentResultRow,
  parseFormFillupResultSpreadsheet,
  ResultImportParseOutput,
} from '../utils/resultImportLogic';
import { formatResultStatusLabel } from '../utils/formFillupLogic';
import {
  FileSpreadsheet,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';

interface ImportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classGroup: ClassGroup;
  students: Student[];
  feeConfig: FormFillupFeeConfig;
  existingRecords: FormFillupStudentRecord[];
  onImportAndSave: (rows: ImportedStudentResultRow[]) => Promise<void>;
}

export const ImportResultsModal: React.FC<ImportResultsModalProps> = ({
  isOpen,
  onClose,
  classGroup,
  students,
  feeConfig,
  existingRecords,
  onImportAndSave,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ResultImportParseOutput | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setFileName(file.name);
    setErrorMessage(null);

    const lower = file.name.toLowerCase();
    const isTextCsv = lower.endsWith('.csv') || lower.endsWith('.txt');
    const reader = new FileReader();

    reader.onload = event => {
      try {
        const payload = event.target?.result;
        if (!payload) {
          setErrorMessage('The uploaded file appears to be empty.');
          setParseResult(null);
          return;
        }
        const parsed = parseFormFillupResultSpreadsheet({
          fileData: payload,
          classId: classGroup.id,
          students,
          feeConfig,
          existingRecords,
        });
        setParseResult(parsed);
      } catch (err: any) {
        setErrorMessage(
          err?.message || 'Unable to read this spreadsheet. Ensure it is a valid .xlsx, .xls, or .csv file.'
        );
        setParseResult(null);
      }
    };

    if (isTextCsv) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDownloadCSVTemplate = () => {
    const csv = generateResultImportCSVTemplate({
      students,
      classId: classGroup.id,
      existingRecords,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BTEB_${classGroup.semester}_Semester_Results_Template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelTemplate = () => {
    const bytes = generateResultImportExcelBuffer({
      classGroup,
      students,
      existingRecords,
    });
    const arrayCopy = new Uint8Array(bytes.byteLength);
    arrayCopy.set(bytes);
    const blob = new Blob([arrayCopy.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BTEB_${classGroup.semester}_Semester_Results_Template.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSample = () => {
    const activeStudents = students
      .filter(s => s.classId === classGroup.id && s.status === 'active')
      .sort((a, b) =>
        a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
      );

    if (activeStudents.length === 0) {
      setErrorMessage('Enroll students in this semester batch before loading sample results.');
      return;
    }

    const header =
      'Roll Number,Student Name,Result Status,Referred Subjects,Referred Semesters,Practical Subjects,Delay Fee,Result Note';
    const sampleLines = activeStudents.map((stu, idx) => {
      if (idx === 0) {
        return `"${stu.rollNumber}","${stu.name}",regular,0,0,3,No,"GPA 3.65"`;
      }
      if (idx === 1) {
        return `"${stu.rollNumber}","${stu.name}",regular_with_referred,2,1,3,Yes,"Ref: 28531, 28532"`;
      }
      return `"${stu.rollNumber}","${stu.name}",regular,0,0,3,No,"GPA 3.40"`;
    });

    const csvText = [header, ...sampleLines].join('\n');
    setFileName(`sample_${classGroup.semester}_sem_results.csv`);
    setErrorMessage(null);
    setParseResult(
      parseFormFillupResultSpreadsheet({
        fileData: csvText,
        classId: classGroup.id,
        students,
        feeConfig,
        existingRecords,
      })
    );
  };

  const handleConfirm = async () => {
    if (!parseResult || parseResult.matched.length === 0) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onImportAndSave(parseResult.matched);
      setFileName('');
      setParseResult(null);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to apply and save imported student results.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetAndClose = () => {
    setFileName('');
    setParseResult(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-results-modal-title"
        className="bg-white rounded-xl max-w-4xl w-full p-4 sm:p-6 shadow-xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="import-results-modal-title"
                className="text-lg font-bold text-slate-900 tracking-tight"
              >
                Import Student Results (Excel / CSV)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload .xlsx, .xls, or .csv results for {classGroup.name}. Payable Tk fees auto-calculate from the admin fee schedule.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            aria-label="Close import results modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Template Downloads Bar */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">
              Pre-filled Batch Result Templates
            </p>
            <p className="text-[11px] text-slate-500">
              Includes active students&apos; Roll Numbers and Names for {classGroup.name}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCSVTemplate}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV Template</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSample}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Load Sample</span>
            </button>
          </div>
        </div>

        {/* File Dropzone */}
        <div className="mt-4">
          <input
            type="file"
            ref={fileInputRef}
            aria-label="Upload Excel or CSV student results file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors group ${
              isDragging
                ? 'border-emerald-600 bg-emerald-50/40'
                : 'border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20'
            }`}
          >
            <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2 transition-colors" />
            <p className="text-xs font-semibold text-slate-700">
              {fileName ? (
                <span className="text-emerald-700 font-mono">Loaded: {fileName}</span>
              ) : (
                'Click or drag & drop an Excel (.xlsx / .xls) or CSV (.csv) result sheet'
              )}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports columns: Roll Number, Result Status / GPA (e.g. 3.65, Referred (28531, 28532)), Ref Sub, Ref Sem, Prac Sub, Delay Fee, Result Note
            </p>
          </div>
        </div>

        {/* Preview */}
        {parseResult && (
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold tabular-nums">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700">Import Preview:</span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {parseResult.matched.length} matched student(s)
                </span>
                {parseResult.errors.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {parseResult.errors.length} unmatched / skipped
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-900">
                Preview Total: ৳ {parseResult.totalCalculatedTk.toLocaleString()}
              </span>
            </div>

            {parseResult.errors.length > 0 && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Row matching notices:
                </p>
                <ul className="list-disc list-inside text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
                  {parseResult.errors.map((err, i) => (
                    <li key={i}>
                      Row {err.rowNumber}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {parseResult.matched.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="bg-slate-50 sticky top-0 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Result</th>
                      <th className="py-2 px-2 text-center">Ref Sub</th>
                      <th className="py-2 px-2 text-center">Ref Sem</th>
                      <th className="py-2 px-2 text-center">Prac</th>
                      <th className="py-2 px-2 text-center">Delay</th>
                      <th className="py-2 px-3">Note</th>
                      <th className="py-2 px-3 text-right">Auto Total (Tk)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parseResult.matched.map(row => (
                      <tr key={row.studentId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                          {row.rollNumber}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {row.studentName}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {formatResultStatusLabel(row.resultStatus)}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {row.referredSubjectsCount}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {row.referredSemestersCount}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">
                          {row.practicalSubjectsCount}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {row.applyDelayFee ? 'Yes' : 'No'}
                        </td>
                        <td className="py-2 px-3 text-slate-500 max-w-[140px] truncate">
                          {row.resultSummaryNote || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          ৳ {row.calculatedAmountTk.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Target semester: <strong className="text-slate-800">{classGroup.name}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAndClose}
              className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parseResult || parseResult.matched.length === 0 || isSaving}
              onClick={handleConfirm}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Importing & Saving...'
                  : `Import & Save ${parseResult?.matched.length || 0} Results`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

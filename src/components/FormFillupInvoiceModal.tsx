import React, { useEffect, useMemo, useState } from 'react';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';
import {
  buildFormFillupInvoiceSummary,
  DEFAULT_INVOICE_INSTITUTE_NAME,
  DelayFeeShareTarget,
  deriveTechnologyShortLabel,
  InvoiceLineMetric,
  InvoiceStudentScope,
} from '../utils/formFillupInvoiceLogic';
import {
  generateFormFillupInvoicePDF,
  getFormFillupInvoiceFileName,
} from '../utils/pdfFormFillupInvoice';
import { Download, FileCheck2, Loader2, X } from 'lucide-react';

interface FormFillupInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classGroup: ClassGroup;
  students: Student[];
  records: FormFillupStudentRecord[];
  feeConfig: FormFillupFeeConfig;
  coordinator?: User;
  generatedBy?: User | null;
}

const STORAGE_INSTITUTE_KEY = 'presently_invoice_institute_name';
const STORAGE_EXAM_SESSION_KEY = 'presently_invoice_exam_session';

function displayOptionalCountOrAmount(value: number): string {
  return value > 0 ? String(value) : '';
}

export const FormFillupInvoiceModal: React.FC<FormFillupInvoiceModalProps> = ({
  isOpen,
  onClose,
  classGroup,
  students,
  records,
  feeConfig,
  coordinator,
  generatedBy,
}) => {
  const defaultYear =
    classGroup.academicYear?.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const defaultSession = `Aug -${defaultYear} ইং`;

  const [instituteName, setInstituteName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_INSTITUTE_KEY) || DEFAULT_INVOICE_INSTITUTE_NAME;
    } catch {
      return DEFAULT_INVOICE_INSTITUTE_NAME;
    }
  });

  const [examSession, setExamSession] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXAM_SESSION_KEY);
      return saved || defaultSession;
    } catch {
      return defaultSession;
    }
  });

  const [technologyLabel, setTechnologyLabel] = useState<string>(() =>
    deriveTechnologyShortLabel(classGroup)
  );
  const [scope, setScope] = useState<InvoiceStudentScope>('all');
  const [delayFeeShare, setDelayFeeShare] = useState<DelayFeeShareTarget>('board');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setTechnologyLabel(deriveTechnologyShortLabel(classGroup));
  }, [classGroup]);

  const handleInstituteNameChange = (value: string) => {
    setInstituteName(value);
    try {
      localStorage.setItem(STORAGE_INSTITUTE_KEY, value);
    } catch {
      // ignore storage quota errors
    }
  };

  const handleExamSessionChange = (value: string) => {
    setExamSession(value);
    try {
      if (value.trim() && value.trim() !== defaultSession) {
        localStorage.setItem(STORAGE_EXAM_SESSION_KEY, value);
      } else {
        localStorage.removeItem(STORAGE_EXAM_SESSION_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  };

  const paidOrSubmittedCount = useMemo(() => {
    const activeIds = new Set(
      students.filter(s => s.classId === classGroup.id && s.status === 'active').map(s => s.id)
    );
    return records.filter(
      r =>
        r.classId === classGroup.id &&
        activeIds.has(r.studentId) &&
        (r.paymentStatus === 'paid' || r.paymentStatus === 'submitted')
    ).length;
  }, [students, records, classGroup.id]);

  const activeTotalCount = useMemo(
    () => students.filter(s => s.classId === classGroup.id && s.status === 'active').length,
    [students, classGroup.id]
  );

  const invoice = useMemo(
    () =>
      buildFormFillupInvoiceSummary({
        classGroup,
        students,
        records,
        feeConfig,
        options: {
          instituteName,
          examSession,
          technologyLabel,
          scope,
          delayFeeShare,
        },
      }),
    [
      classGroup,
      students,
      records,
      feeConfig,
      instituteName,
      examSession,
      technologyLabel,
      scope,
      delayFeeShare,
    ]
  );

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      const doc = await generateFormFillupInvoicePDF({
        invoice,
        coordinator,
        generatedBy,
        includeSignatures,
      });
      doc.save(getFormFillupInvoiceFileName(classGroup.semester));
    } catch (err: any) {
      setPdfError(err?.message || 'Unable to generate PDF invoice.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderMetricCells = (metric: InvoiceLineMetric) => (
    <>
      <td className="border border-slate-800 px-2.5 py-1.5 text-center font-medium text-slate-900 tabular-nums">
        {metric.rateDisplay}
      </td>
      <td className="border border-slate-800 px-2.5 py-1.5 text-center font-medium text-slate-900 tabular-nums">
        {displayOptionalCountOrAmount(metric.count)}
      </td>
      <td className="border border-slate-800 px-2.5 py-1.5 text-center font-medium text-slate-900 tabular-nums">
        {displayOptionalCountOrAmount(metric.totalTk)}
      </td>
      <td className="border border-slate-800 px-2.5 py-1.5 text-center font-medium text-slate-900 tabular-nums">
        {displayOptionalCountOrAmount(metric.boardShareTk)}
      </td>
      <td className="border border-slate-800 px-2.5 py-1.5 text-center font-medium text-slate-900 tabular-nums">
        {displayOptionalCountOrAmount(metric.instituteShareTk)}
      </td>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-fillup-invoice-title"
        className="bg-white rounded-xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col"
      >
        {/* Top Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2
              id="form-fillup-invoice-title"
              className="text-sm font-bold flex items-center gap-2 truncate"
            >
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Form Fill-up Fee Statement Invoice · {classGroup.semester} Semester</span>
            </h2>
            <p className="text-[11px] text-slate-300 mt-0.5 truncate">
              Official BTEB collection summary with Board Share vs Institute Share breakdown
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
            aria-label="Close invoice modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/70">
          {/* Controls Strip */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label
                  htmlFor="invoice-institute-name"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Institute Name & Code
                </label>
                <input
                  id="invoice-institute-name"
                  type="text"
                  value={instituteName}
                  onChange={e => handleInstituteNameChange(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="invoice-exam-session"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Exam Session / Month
                </label>
                <input
                  id="invoice-exam-session"
                  type="text"
                  value={examSession}
                  onChange={e => handleExamSessionChange(e.target.value)}
                  placeholder="e.g. Aug -2026 ইং"
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="invoice-tech-label"
                  className="block text-[11px] font-semibold text-slate-600 mb-1"
                >
                  Technology Label
                </label>
                <input
                  id="invoice-tech-label"
                  type="text"
                  value={technologyLabel}
                  onChange={e => setTechnologyLabel(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      scope === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Candidates ({activeTotalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('paid_submitted')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      scope === 'paid_submitted'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Paid / Submitted Only ({paidOrSubmittedCount})
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <label htmlFor="invoice-delay-share" className="text-slate-500 font-medium">
                    Delay Fee Share:
                  </label>
                  <select
                    id="invoice-delay-share"
                    value={delayFeeShare}
                    onChange={e => setDelayFeeShare(e.target.value as DelayFeeShareTarget)}
                    className="h-8 px-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    <option value="board">Board Share (বোর্ড)</option>
                    <option value="institute">Institute Share (প্রতিষ্ঠান)</option>
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSignatures}
                  onChange={e => setIncludeSignatures(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded border-slate-300"
                />
                <span>Include Signature Lines in PDF</span>
              </label>
            </div>
          </div>

          {pdfError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
            >
              {pdfError}
            </div>
          )}

          {/* Live Official Invoice Paper Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-8 shadow-xs">
            <div
              className="max-w-[760px] mx-auto text-slate-950"
              style={{
                fontFamily: "'Noto Sans Bengali', 'Plus Jakarta Sans', sans-serif",
              }}
            >
              {/* Official Document Header */}
              <div className="text-center space-y-1 mb-5">
                <p className="text-sm sm:text-base font-bold tracking-tight text-slate-800">
                  {invoice.instituteEnglishName}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  {invoice.departmentName}
                </p>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950 pt-1">
                  {invoice.instituteName}
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  {invoice.subtitleLine}
                </p>
                <p className="text-xs sm:text-[15px] font-bold text-slate-900">
                  {invoice.statementTitle}
                </p>
              </div>

              {/* 7-Column Official Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs sm:text-[13px] tabular-nums">
                  <thead>
                    <tr className="text-slate-950 font-bold">
                      <th className="border border-slate-800 px-2 py-2 text-center w-[16%]">
                        টেকনোলজি
                      </th>
                      <th className="border border-slate-800 px-2 py-2 text-center w-[11%]">
                        পর্ব
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-800 px-2 py-2 text-center w-[11.5%]"
                      >
                        রেট/দর
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-800 px-2 py-2 text-center w-[15%] leading-snug"
                      >
                        ছাত্র/ছাত্রীর
                        <br />
                        সংখ্যা
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-800 px-2 py-2 text-center w-[15.5%] leading-snug"
                      >
                        সর্বমোট
                        <br />
                        টাকা
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-800 px-2 py-2 text-center w-[15.5%] leading-snug"
                      >
                        বোর্ড
                        <br />
                        প্রাপ্ত
                        <br />
                        অংশ
                      </th>
                      <th
                        rowSpan={2}
                        className="border border-slate-800 px-2 py-2 text-center w-[15.5%] leading-snug"
                      >
                        প্রতিষ্ঠান
                        <br />
                        প্রাপ্ত
                        <br />
                        অংশ
                      </th>
                    </tr>
                    <tr className="text-slate-950 font-bold">
                      <th className="border border-slate-800 px-2 py-2 text-center font-mono">
                        {invoice.technologyLabel}
                      </th>
                      <th className="border border-slate-800 px-2 py-2 text-center font-mono">
                        {invoice.semester}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* 1. পরীক্ষার ফি */}
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900"
                      >
                        পরীক্ষার ফি
                      </td>
                      {renderMetricCells(invoice.rows.examFee)}
                    </tr>

                    {/* 2. নম্বরপত্র ফি (Two Parts: Regular & Referred) */}
                    <tr>
                      <td
                        colSpan={2}
                        rowSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900 align-middle"
                      >
                        <div>নম্বরপত্র ফি</div>
                        <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                          নিয়মিত / রেফার্ড
                        </div>
                      </td>
                      {renderMetricCells(invoice.rows.marksheetRegular)}
                    </tr>
                    <tr>{renderMetricCells(invoice.rows.marksheetReferred)}</tr>

                    {/* 3. প্রশ্ন পত্র বাবদ */}
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900"
                      >
                        প্রশ্ন পত্র বাবদ
                      </td>
                      {renderMetricCells(invoice.rows.questionFee)}
                    </tr>

                    {/* 4. রেফার্ড পরীক্ষার ফি */}
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900"
                      >
                        রেফার্ড পরীক্ষার ফি
                      </td>
                      {renderMetricCells(invoice.rows.referredExamFee)}
                    </tr>

                    {/* 5. বিলম্ব ফি */}
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900"
                      >
                        বিলম্ব ফি
                      </td>
                      {renderMetricCells(invoice.rows.delayFee)}
                    </tr>

                    {/* 6. কেন্দ্র ফি (Two Parts: Regular & Referred) */}
                    <tr>
                      <td
                        colSpan={2}
                        rowSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900 align-middle"
                      >
                        <div>কেন্দ্র ফি</div>
                        <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                          নিয়মিত / রেফার্ড
                        </div>
                      </td>
                      {renderMetricCells(invoice.rows.centerRegular)}
                    </tr>
                    <tr>{renderMetricCells(invoice.rows.centerReferred)}</tr>

                    {/* 7. ব্যবহারিক ফি */}
                    <tr>
                      <td
                        colSpan={2}
                        className="border border-slate-800 px-2.5 py-1.5 text-center font-semibold text-slate-900"
                      >
                        ব্যবহারিক ফি
                      </td>
                      {renderMetricCells(invoice.rows.practicalFee)}
                    </tr>
                  </tbody>

                  <tfoot>
                    <tr className="font-bold text-slate-950">
                      <td
                        colSpan={2}
                        className="px-2.5 py-3 text-center text-sm border-0"
                      >
                        সর্ব মোটঃ
                      </td>
                      <td className="border border-slate-800 px-2.5 py-3" />
                      <td className="border border-slate-800 px-2.5 py-3" />
                      <td className="border border-slate-800 px-2.5 py-3 text-center tabular-nums">
                        {invoice.grandTotalTk}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-3 text-center tabular-nums">
                        {invoice.boardTotalTk}
                      </td>
                      <td className="border border-slate-800 px-2.5 py-3 text-center tabular-nums">
                        {invoice.instituteTotalTk}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {includeSignatures && (
                <div className="mt-14 pt-2 grid grid-cols-2 gap-12 text-center text-xs text-slate-800">
                  <div>
                    <div className="border-t border-slate-700 pt-1.5 font-semibold">
                      দায়িত্বপ্রাপ্ত শিক্ষক / সমন্বয়ক
                    </div>
                    {(coordinator?.name || generatedBy?.name) && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {coordinator?.name || generatedBy?.name}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="border-t border-slate-700 pt-1.5 font-semibold">
                      অধ্যক্ষ / বিভাগীয় প্রধান
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 tabular-nums">
            Included: <strong className="text-slate-800">{invoice.includedStudentCount}</strong> candidate(s) ·{' '}
            Grand Total: <strong className="text-slate-900 font-mono">৳ {invoice.grandTotalTk.toLocaleString()}</strong>{' '}
            (Board <span className="font-mono font-semibold text-slate-700">৳{invoice.boardTotalTk.toLocaleString()}</span> + Institute{' '}
            <span className="font-mono font-semibold text-slate-700">৳{invoice.instituteTotalTk.toLocaleString()}</span>)
          </p>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Invoice PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

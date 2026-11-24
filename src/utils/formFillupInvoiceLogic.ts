import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupResponsibility,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';
import {
  calculateStudentFormFillupFee,
  normalizeResultInput,
  StudentResultInput,
} from './formFillupLogic';

export type InvoiceStudentScope = 'all' | 'paid_submitted';
export type DelayFeeShareTarget = 'board' | 'institute';

export interface FormFillupInvoiceOptions {
  instituteName?: string;
  examSession?: string;
  technologyLabel?: string;
  scope?: InvoiceStudentScope;
  delayFeeShare?: DelayFeeShareTarget;
  defaultPracticalCount?: number;
}

export interface InvoiceLineMetric {
  id:
    | 'examFee'
    | 'marksheetRegular'
    | 'marksheetReferred'
    | 'questionFee'
    | 'referredExamFee'
    | 'delayFee'
    | 'centerRegular'
    | 'centerReferred'
    | 'practicalFee';
  banglaLabel: string;
  subLabel?: string;
  rate: number;
  rateDisplay: string;
  count: number;
  totalTk: number;
  boardShareTk: number;
  instituteShareTk: number;
}

export interface FormFillupInvoiceData {
  instituteName: string;
  semester: string;
  examSession: string;
  subtitleLine: string;
  statementTitle: string;
  technologyLabel: string;
  scope: InvoiceStudentScope;
  delayFeeShare: DelayFeeShareTarget;
  includedStudentCount: number;
  regularCandidateCount: number;
  referredOnlyCandidateCount: number;
  rows: {
    examFee: InvoiceLineMetric;
    marksheetRegular: InvoiceLineMetric;
    marksheetReferred: InvoiceLineMetric;
    questionFee: InvoiceLineMetric;
    referredExamFee: InvoiceLineMetric;
    delayFee: InvoiceLineMetric;
    centerRegular: InvoiceLineMetric;
    centerReferred: InvoiceLineMetric;
    practicalFee: InvoiceLineMetric;
  };
  grandTotalTk: number;
  boardTotalTk: number;
  instituteTotalTk: number;
}

export const DEFAULT_INVOICE_INSTITUTE_NAME =
  'মডেল ইনস্টিটিউট অব সাইন্স এন্ড টেকনোলজি (53033)';

export const DEFAULT_INVOICE_STATEMENT_TITLE =
  'ছাত্র/ছাত্রীদের কাছ থেকে পরীক্ষার ফি বাবদ আদায়কৃত টাকার বিবরণী';

export function deriveTechnologyShortLabel(classGroup: ClassGroup): string {
  const deptRaw = (classGroup.department || classGroup.name || 'CST').trim();
  const parenMatch = classGroup.technology?.match(/\((\d+)\)/);
  if (/computer\s*science/i.test(deptRaw) || /\bCST\b/i.test(deptRaw)) {
    return `CST-${classGroup.semester}`;
  }
  const letters = deptRaw
    .split(/[\s&/-]+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 5);
  const code = letters || (parenMatch ? parenMatch[1] : 'TECH');
  return `${code}-${classGroup.semester}`;
}

export function canGenerateFormFillupInvoice(params: {
  currentUser: User | null;
  classGroup: ClassGroup | undefined;
  responsibilities: FormFillupResponsibility[];
}): boolean {
  const { currentUser, classGroup, responsibilities } = params;
  if (!currentUser || !classGroup) return false;
  if (currentUser.role === 'admin') return true;
  return responsibilities.some(
    r => r.classId === classGroup.id && r.teacherId === currentUser.id
  );
}

export function buildFormFillupInvoiceSummary(params: {
  classGroup: ClassGroup;
  students: Student[];
  records: FormFillupStudentRecord[];
  feeConfig: FormFillupFeeConfig;
  options?: FormFillupInvoiceOptions;
}): FormFillupInvoiceData {
  const { classGroup, students, records, feeConfig, options = {} } = params;

  const instituteName =
    options.instituteName?.trim() || DEFAULT_INVOICE_INSTITUTE_NAME;
  const defaultYear =
    classGroup.academicYear?.match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const examSession =
    options.examSession?.trim() || `Aug -${defaultYear} ইং`;
  const technologyLabel =
    options.technologyLabel?.trim() || deriveTechnologyShortLabel(classGroup);
  const scope: InvoiceStudentScope = options.scope || 'all';
  const delayFeeShare: DelayFeeShareTarget = options.delayFeeShare || 'board';
  const defaultPracticalCount = Math.max(0, Math.floor(options.defaultPracticalCount || 0));

  const activeStudents = students.filter(
    s => s.classId === classGroup.id && s.status === 'active'
  );

  const recordMap = new Map<string, FormFillupStudentRecord>();
  records.forEach(r => {
    if (r.classId === classGroup.id) {
      recordMap.set(r.studentId, r);
    }
  });

  const scopedStudents = activeStudents.filter(stu => {
    if (scope === 'all') return true;
    const rec = recordMap.get(stu.id);
    const status = rec?.paymentStatus || 'pending';
    return status === 'paid' || status === 'submitted';
  });

  let regularCandidateCount = 0;
  let referredOnlyCandidateCount = 0;
  let totalReferredSubjectsCount = 0;
  let totalReferredSemestersCount = 0;
  let totalPracticalSubjectsCount = 0;
  let delayFeeCount = 0;

  let examFeeTotal = 0;
  let marksheetRegularTotal = 0;
  let marksheetReferredTotal = 0;
  let questionFeeTotal = 0;
  let referredExamFeeTotal = 0;
  let delayFeeTotal = 0;
  let centerRegularTotal = 0;
  let centerReferredTotal = 0;
  let practicalFeeTotal = 0;

  const nonZeroPracticalCounts = new Set<number>();

  scopedStudents.forEach(stu => {
    const rec = recordMap.get(stu.id);
    const rawInput: StudentResultInput = rec
      ? {
          resultStatus: rec.resultStatus,
          referredSubjectsCount: rec.referredSubjectsCount,
          referredSemestersCount: rec.referredSemestersCount,
          practicalSubjectsCount: rec.practicalSubjectsCount,
          applyDelayFee: rec.applyDelayFee,
        }
      : {
          resultStatus: 'regular',
          referredSubjectsCount: 0,
          referredSemestersCount: 0,
          practicalSubjectsCount: defaultPracticalCount,
          applyDelayFee: false,
        };

    const normalized = normalizeResultInput(rawInput);
    const breakdown = calculateStudentFormFillupFee(feeConfig, normalized);

    if (
      normalized.resultStatus === 'regular' ||
      normalized.resultStatus === 'regular_with_referred'
    ) {
      regularCandidateCount += 1;
    } else {
      referredOnlyCandidateCount += 1;
    }

    totalReferredSubjectsCount += normalized.referredSubjectsCount;
    totalReferredSemestersCount += normalized.referredSemestersCount;
    totalPracticalSubjectsCount += normalized.practicalSubjectsCount;
    if (normalized.practicalSubjectsCount > 0) {
      nonZeroPracticalCounts.add(normalized.practicalSubjectsCount);
    }
    if (normalized.applyDelayFee) {
      delayFeeCount += 1;
    }

    examFeeTotal += breakdown.examFeeAmount;
    marksheetRegularTotal += breakdown.marksheetRegularAmount;
    marksheetReferredTotal += breakdown.marksheetReferredAmount;
    questionFeeTotal += breakdown.questionFeeAmount;
    referredExamFeeTotal += breakdown.referredExamFeeAmount;
    delayFeeTotal += breakdown.delayFeeAmount;
    centerRegularTotal += breakdown.centerRegularAmount;
    centerReferredTotal += breakdown.centerReferredAmount;
    practicalFeeTotal += breakdown.practicalFeeAmount;
  });

  const examRate = Math.max(0, Number(feeConfig.examFee) || 0);
  const marksheetRegRate = Math.max(0, Number(feeConfig.marksheetFeeRegular) || 0);
  const marksheetRefRate = Math.max(0, Number(feeConfig.marksheetFeeReferredPerSemester) || 0);
  const questionRate = Math.max(0, Number(feeConfig.questionFee) || 0);
  const refExamRate = Math.max(0, Number(feeConfig.referredExamFeePerSubject) || 0);
  const delayRate = Math.max(0, Number(feeConfig.delayFee) || 0);
  const centerRegRate = Math.max(0, Number(feeConfig.centerFeeRegular) || 0);
  const centerRefRate = Math.max(0, Number(feeConfig.centerFeeReferredPerSemester) || 0);
  const practicalRate = Math.max(0, Number(feeConfig.practicalFeePerSubject) || 0);

  const uniformPracticalCount =
    nonZeroPracticalCounts.size === 1 ? Array.from(nonZeroPracticalCounts)[0] : null;
  const practicalRateDisplay =
    uniformPracticalCount !== null && uniformPracticalCount > 1
      ? `${practicalRate}×${uniformPracticalCount}`
      : `${practicalRate}`;

  const delayBoardShare = delayFeeShare === 'board' ? delayFeeTotal : 0;
  const delayInstituteShare = delayFeeShare === 'institute' ? delayFeeTotal : 0;

  const rows: FormFillupInvoiceData['rows'] = {
    examFee: {
      id: 'examFee',
      banglaLabel: 'পরীক্ষার ফি',
      rate: examRate,
      rateDisplay: `${examRate}`,
      count: regularCandidateCount,
      totalTk: examFeeTotal,
      boardShareTk: examFeeTotal,
      instituteShareTk: 0,
    },
    marksheetRegular: {
      id: 'marksheetRegular',
      banglaLabel: 'নম্বরপত্র ফি',
      subLabel: 'নিয়মিত',
      rate: marksheetRegRate,
      rateDisplay: `${marksheetRegRate}`,
      count: regularCandidateCount,
      totalTk: marksheetRegularTotal,
      boardShareTk: marksheetRegularTotal,
      instituteShareTk: 0,
    },
    marksheetReferred: {
      id: 'marksheetReferred',
      banglaLabel: 'নম্বরপত্র ফি',
      subLabel: 'রেফার্ড',
      rate: marksheetRefRate,
      rateDisplay: `${marksheetRefRate}`,
      count: totalReferredSemestersCount,
      totalTk: marksheetReferredTotal,
      boardShareTk: marksheetReferredTotal,
      instituteShareTk: 0,
    },
    questionFee: {
      id: 'questionFee',
      banglaLabel: 'প্রশ্ন পত্র বাবদ',
      rate: questionRate,
      rateDisplay: `${questionRate}`,
      count: scopedStudents.length,
      totalTk: questionFeeTotal,
      boardShareTk: 0,
      instituteShareTk: questionFeeTotal,
    },
    referredExamFee: {
      id: 'referredExamFee',
      banglaLabel: 'রেফার্ড পরীক্ষার ফি',
      rate: refExamRate,
      rateDisplay: `${refExamRate}`,
      count: totalReferredSubjectsCount,
      totalTk: referredExamFeeTotal,
      boardShareTk: referredExamFeeTotal,
      instituteShareTk: 0,
    },
    delayFee: {
      id: 'delayFee',
      banglaLabel: 'বিলম্ব ফি',
      rate: delayRate,
      rateDisplay: `${delayRate}`,
      count: delayFeeCount,
      totalTk: delayFeeTotal,
      boardShareTk: delayBoardShare,
      instituteShareTk: delayInstituteShare,
    },
    centerRegular: {
      id: 'centerRegular',
      banglaLabel: 'কেন্দ্র ফি',
      subLabel: 'নিয়মিত',
      rate: centerRegRate,
      rateDisplay: `${centerRegRate}`,
      count: regularCandidateCount,
      totalTk: centerRegularTotal,
      boardShareTk: 0,
      instituteShareTk: centerRegularTotal,
    },
    centerReferred: {
      id: 'centerReferred',
      banglaLabel: 'কেন্দ্র ফি',
      subLabel: 'রেফার্ড',
      rate: centerRefRate,
      rateDisplay: `${centerRefRate}`,
      count: totalReferredSemestersCount,
      totalTk: centerReferredTotal,
      boardShareTk: 0,
      instituteShareTk: centerReferredTotal,
    },
    practicalFee: {
      id: 'practicalFee',
      banglaLabel: 'ব্যবহারিক ফি',
      rate: practicalRate,
      rateDisplay: practicalRateDisplay,
      count: totalPracticalSubjectsCount,
      totalTk: practicalFeeTotal,
      boardShareTk: 0,
      instituteShareTk: practicalFeeTotal,
    },
  };

  const orderedRows = [
    rows.examFee,
    rows.marksheetRegular,
    rows.marksheetReferred,
    rows.questionFee,
    rows.referredExamFee,
    rows.delayFee,
    rows.centerRegular,
    rows.centerReferred,
    rows.practicalFee,
  ];

  const grandTotalTk = orderedRows.reduce((sum, r) => sum + r.totalTk, 0);
  const boardTotalTk = orderedRows.reduce((sum, r) => sum + r.boardShareTk, 0);
  const instituteTotalTk = orderedRows.reduce((sum, r) => sum + r.instituteShareTk, 0);

  return {
    instituteName,
    semester: classGroup.semester,
    examSession,
    subtitleLine: `${classGroup.semester} পর্বের, পর্ব সমাপনী পরীক্ষা ${examSession}`,
    statementTitle: DEFAULT_INVOICE_STATEMENT_TITLE,
    technologyLabel,
    scope,
    delayFeeShare,
    includedStudentCount: scopedStudents.length,
    regularCandidateCount,
    referredOnlyCandidateCount,
    rows,
    grandTotalTk,
    boardTotalTk,
    instituteTotalTk,
  };
}

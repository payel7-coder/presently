import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupPaymentStatus,
  FormFillupResponsibility,
  FormFillupResultStatus,
  FormFillupStudentRecord,
  Student,
  User,
} from '../types/attendance';

export interface FeeBreakdown {
  examFeeAmount: number;
  referredExamFeeAmount: number;
  marksheetRegularAmount: number;
  marksheetReferredAmount: number;
  centerRegularAmount: number;
  centerReferredAmount: number;
  practicalFeeAmount: number;
  questionFeeAmount: number;
  delayFeeAmount: number;
  totalAmountTk: number;
}

export interface StudentResultInput {
  resultStatus: FormFillupResultStatus;
  referredSubjectsCount: number;
  referredSemestersCount: number;
  practicalSubjectsCount: number;
  applyDelayFee: boolean;
}

export const DEFAULT_BTEB_FORM_FILLUP_RATES: Omit<
  FormFillupFeeConfig,
  'id' | 'semester' | 'classId' | 'updatedAt' | 'updatedBy'
> = {
  examFee: 400,
  referredExamFeePerSubject: 150,
  marksheetFeeRegular: 150,
  marksheetFeeReferredPerSemester: 150,
  centerFeeRegular: 250,
  centerFeeReferredPerSemester: 100,
  practicalFeePerSubject: 100,
  questionFee: 100,
  delayFee: 200,
};

export function createDefaultFeeConfig(
  semester: string,
  classId: string,
  updatedBy?: string
): FormFillupFeeConfig {
  return {
    id: `ff-fee-${classId}`,
    semester,
    classId,
    ...DEFAULT_BTEB_FORM_FILLUP_RATES,
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  };
}

export interface FeeValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFeeConfig(
  config: Partial<FormFillupFeeConfig>
): FeeValidationResult {
  const fields: Array<{ key: keyof typeof DEFAULT_BTEB_FORM_FILLUP_RATES; label: string }> = [
    { key: 'examFee', label: 'Exam Fee' },
    { key: 'referredExamFeePerSubject', label: 'Referred Exam Fee (Per Subject)' },
    { key: 'marksheetFeeRegular', label: 'Marksheet Fee (Regular)' },
    { key: 'marksheetFeeReferredPerSemester', label: 'Marksheet Fee (Referred / Semester)' },
    { key: 'centerFeeRegular', label: 'Center Fee (Regular)' },
    { key: 'centerFeeReferredPerSemester', label: 'Center Fee (Referred / Semester)' },
    { key: 'practicalFeePerSubject', label: 'Practical Fee (Per Subject)' },
    { key: 'questionFee', label: 'Question Fee' },
    { key: 'delayFee', label: 'Delay Fee' },
  ];

  for (const field of fields) {
    const val = Number(config[field.key]);
    if (!Number.isFinite(val) || val < 0 || val > 100000) {
      return {
        valid: false,
        error: `${field.label} must be a valid amount between 0 and 100,000 Tk.`,
      };
    }
  }

  return { valid: true };
}

export function clampWholeCount(value: number, max = 30): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(max, Math.floor(num));
}

export function normalizeResultInput(input: StudentResultInput): StudentResultInput {
  let resultStatus = input.resultStatus;
  let referredSubjectsCount = clampWholeCount(input.referredSubjectsCount, 30);
  let referredSemestersCount = clampWholeCount(input.referredSemestersCount, 12);
  const practicalSubjectsCount = clampWholeCount(input.practicalSubjectsCount, 20);
  const applyDelayFee = Boolean(input.applyDelayFee);

  if (resultStatus === 'regular') {
    if (referredSubjectsCount > 0 || referredSemestersCount > 0) {
      resultStatus = 'regular_with_referred';
    }
  }

  if (resultStatus === 'regular') {
    referredSubjectsCount = 0;
    referredSemestersCount = 0;
  } else {
    if (referredSubjectsCount > 0 && referredSemestersCount === 0) {
      referredSemestersCount = 1;
    }
  }

  return {
    resultStatus,
    referredSubjectsCount,
    referredSemestersCount,
    practicalSubjectsCount,
    applyDelayFee,
  };
}

/**
 * Computes all 9 BTEB Form Fill-up fee components in BDT (Tk) from a semester's
 * fee schedule and a student's examination result input.
 */
export function calculateStudentFormFillupFee(
  config: FormFillupFeeConfig,
  rawInput: StudentResultInput
): FeeBreakdown {
  const input = normalizeResultInput(rawInput);
  const includesRegular =
    input.resultStatus === 'regular' || input.resultStatus === 'regular_with_referred';
  const includesReferred =
    input.resultStatus === 'regular_with_referred' || input.resultStatus === 'referred_only';

  const examFeeAmount = includesRegular ? Math.max(0, Number(config.examFee) || 0) : 0;
  const referredExamFeeAmount = includesReferred
    ? input.referredSubjectsCount * Math.max(0, Number(config.referredExamFeePerSubject) || 0)
    : 0;
  const marksheetRegularAmount = includesRegular
    ? Math.max(0, Number(config.marksheetFeeRegular) || 0)
    : 0;
  const marksheetReferredAmount = includesReferred
    ? input.referredSemestersCount *
      Math.max(0, Number(config.marksheetFeeReferredPerSemester) || 0)
    : 0;
  const centerRegularAmount = includesRegular
    ? Math.max(0, Number(config.centerFeeRegular) || 0)
    : 0;
  const centerReferredAmount = includesReferred
    ? input.referredSemestersCount *
      Math.max(0, Number(config.centerFeeReferredPerSemester) || 0)
    : 0;
  const practicalFeeAmount =
    input.practicalSubjectsCount * Math.max(0, Number(config.practicalFeePerSubject) || 0);
  const questionFeeAmount = Math.max(0, Number(config.questionFee) || 0);
  const delayFeeAmount = input.applyDelayFee ? Math.max(0, Number(config.delayFee) || 0) : 0;

  const totalAmountTk = Math.round(
    examFeeAmount +
      referredExamFeeAmount +
      marksheetRegularAmount +
      marksheetReferredAmount +
      centerRegularAmount +
      centerReferredAmount +
      practicalFeeAmount +
      questionFeeAmount +
      delayFeeAmount
  );

  return {
    examFeeAmount,
    referredExamFeeAmount,
    marksheetRegularAmount,
    marksheetReferredAmount,
    centerRegularAmount,
    centerReferredAmount,
    practicalFeeAmount,
    questionFeeAmount,
    delayFeeAmount,
    totalAmountTk,
  };
}

/**
 * Only Institutional Administrators are permitted to modify Form Fill-up examination fee rates.
 */
export function canEditFormFillupFeeConfig(currentUser: User | null): boolean {
  return Boolean(currentUser && currentUser.role === 'admin');
}

/**
 * Returns semester class batches accessible for Form Fill-up management:
 * - Admin sees all semester class batches
 * - Teacher sees only semester batches assigned to them via FormFillupResponsibility
 */
export function filterVisibleFormFillupClasses(params: {
  currentUser: User | null;
  classes: ClassGroup[];
  responsibilities: FormFillupResponsibility[];
}): ClassGroup[] {
  const { currentUser, classes, responsibilities } = params;
  if (!currentUser) return [];

  if (currentUser.role === 'admin') {
    return [...classes].sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));
  }

  const assignedClassIds = new Set(
    responsibilities
      .filter(r => r.teacherId === currentUser.id)
      .map(r => r.classId)
  );

  return classes
    .filter(c => assignedClassIds.has(c.id))
    .sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));
}

export interface FormFillupBatchSummary {
  totalStudents: number;
  regularCount: number;
  referredCount: number;
  delayFeeCount: number;
  paidOrSubmittedCount: number;
  totalCollectibleTk: number;
  totalCollectedTk: number;
}

export function calculateFormFillupBatchTotals(params: {
  students: Student[];
  records: FormFillupStudentRecord[];
  feeConfig: FormFillupFeeConfig;
  defaultPracticalCount?: number;
}): FormFillupBatchSummary {
  const { students, records, feeConfig, defaultPracticalCount = 0 } = params;
  const activeStudents = students.filter(
    s => s.classId === feeConfig.classId && s.status === 'active'
  );
  const recordByStudent = new Map<string, FormFillupStudentRecord>();
  records.forEach(rec => {
    if (rec.classId === feeConfig.classId) {
      recordByStudent.set(rec.studentId, rec);
    }
  });

  let regularCount = 0;
  let referredCount = 0;
  let delayFeeCount = 0;
  let paidOrSubmittedCount = 0;
  let totalCollectibleTk = 0;
  let totalCollectedTk = 0;

  activeStudents.forEach(stu => {
    const rec = recordByStudent.get(stu.id);
    const input: StudentResultInput = rec
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

    const breakdown = calculateStudentFormFillupFee(feeConfig, input);
    const amount = breakdown.totalAmountTk;
    totalCollectibleTk += amount;

    if (input.resultStatus === 'regular') {
      regularCount++;
    } else {
      referredCount++;
    }

    if (input.applyDelayFee) {
      delayFeeCount++;
    }

    const paymentStatus: FormFillupPaymentStatus = rec?.paymentStatus || 'pending';
    if (paymentStatus === 'paid' || paymentStatus === 'submitted') {
      paidOrSubmittedCount++;
      totalCollectedTk += amount;
    }
  });

  return {
    totalStudents: activeStudents.length,
    regularCount,
    referredCount,
    delayFeeCount,
    paidOrSubmittedCount,
    totalCollectibleTk,
    totalCollectedTk,
  };
}

export function formatResultStatusLabel(status: FormFillupResultStatus): string {
  switch (status) {
    case 'regular':
      return 'Regular (All Passed)';
    case 'regular_with_referred':
      return 'Regular + Referred';
    case 'referred_only':
      return 'Referred Only';
  }
}

export function exportFormFillupToCSV(params: {
  classGroup: ClassGroup;
  students: Student[];
  records: FormFillupStudentRecord[];
  feeConfig: FormFillupFeeConfig;
  defaultPracticalCount?: number;
  coordinator?: User;
}): string {
  const {
    classGroup,
    students,
    records,
    feeConfig,
    defaultPracticalCount = 0,
    coordinator,
  } = params;

  const activeStudents = [...students]
    .filter(s => s.classId === classGroup.id && s.status === 'active')
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  const recordMap = new Map<string, FormFillupStudentRecord>();
  records.forEach(r => {
    if (r.classId === classGroup.id) recordMap.set(r.studentId, r);
  });

  const rows: string[] = [];
  rows.push(`# BTEB Semester Final Form Fill-up Fee Ledger: ${classGroup.name} (${classGroup.semester} Semester)`);
  rows.push(
    `# Coordinator: ${coordinator ? `${coordinator.name} (${coordinator.email})` : 'Assigned Faculty'} | Exam Fee: ${feeConfig.examFee} | Ref Exam/Sub: ${feeConfig.referredExamFeePerSubject} | Practical/Sub: ${feeConfig.practicalFeePerSubject} | Question: ${feeConfig.questionFee} | Delay: ${feeConfig.delayFee}`
  );
  rows.push(
    'Roll Number,Student Name,Result Status,Ref Subjects,Ref Semesters,Practical Subjects,Delay Fee,Exam Fee (Tk),Ref Exam (Tk),Marksheet Reg (Tk),Marksheet Ref (Tk),Center Reg (Tk),Center Ref (Tk),Practical (Tk),Question (Tk),Delay (Tk),Total Tk,Payment Status,Result Notes'
  );

  activeStudents.forEach(stu => {
    const rec = recordMap.get(stu.id);
    const input: StudentResultInput = rec
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
    const breakdown = calculateStudentFormFillupFee(feeConfig, input);
    const paymentStatus = rec?.paymentStatus || 'pending';
    const note = (rec?.resultSummaryNote || '').replace(/"/g, '""');

    rows.push(
      [
        `"${stu.rollNumber}"`,
        `"${stu.name.replace(/"/g, '""')}"`,
        `"${formatResultStatusLabel(input.resultStatus)}"`,
        input.referredSubjectsCount,
        input.referredSemestersCount,
        input.practicalSubjectsCount,
        input.applyDelayFee ? '"Yes"' : '"No"',
        breakdown.examFeeAmount,
        breakdown.referredExamFeeAmount,
        breakdown.marksheetRegularAmount,
        breakdown.marksheetReferredAmount,
        breakdown.centerRegularAmount,
        breakdown.centerReferredAmount,
        breakdown.practicalFeeAmount,
        breakdown.questionFeeAmount,
        breakdown.delayFeeAmount,
        breakdown.totalAmountTk,
        `"${paymentStatus.toUpperCase()}"`,
        `"${note}"`,
      ].join(',')
    );
  });

  return rows.join('\n');
}

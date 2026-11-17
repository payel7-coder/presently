import * as XLSX from 'xlsx';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupPaymentStatus,
  FormFillupResultStatus,
  FormFillupStudentRecord,
  Student,
} from '../types/attendance';
import {
  calculateStudentFormFillupFee,
  clampWholeCount,
  normalizeResultInput,
} from './formFillupLogic';

export interface ImportedStudentResultRow {
  studentId: string;
  rollNumber: string;
  studentName: string;
  resultStatus: FormFillupResultStatus;
  referredSubjectsCount: number;
  referredSemestersCount: number;
  practicalSubjectsCount: number;
  applyDelayFee: boolean;
  resultSummaryNote: string;
  paymentStatus: FormFillupPaymentStatus;
  calculatedAmountTk: number;
}

export interface ResultImportParseOutput {
  matched: ImportedStudentResultRow[];
  errors: { rowNumber: number; message: string }[];
  totalRowsScanned: number;
  totalCalculatedTk: number;
}

function normalizeHeaderKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const ROLL_HEADER_KEYS = new Set([
  'roll',
  'rollnumber',
  'rollno',
  'boardroll',
  'studentroll',
  'btebroll',
]);

const REG_HEADER_KEYS = new Set([
  'regno',
  'regnumber',
  'registration',
  'registrationnumber',
  'registrationno',
]);

function parseDelayFlag(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw > 0;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return ['yes', 'y', 'true', '1', 'late', 'delay', 'applied'].includes(s);
}

function parsePaymentStatus(
  raw: unknown,
  fallback: FormFillupPaymentStatus = 'pending'
): FormFillupPaymentStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'paid' || s === 'verified' || s === 'submitted' || s === 'pending') {
    return s;
  }
  return fallback;
}

/**
 * Interprets a student's raw Result Status / GPA / Remarks cell and explicit counts
 * into normalized FormFillupResultStatus + referred subject counts + note.
 */
export function interpretResultRowFields(params: {
  rawStatus?: unknown;
  rawGpa?: unknown;
  rawRefSub?: unknown;
  rawRefSem?: unknown;
  rawPracSub?: unknown;
  rawDelay?: unknown;
  rawNote?: unknown;
  rawPayment?: unknown;
  existingPaymentStatus?: FormFillupPaymentStatus;
}): {
  resultStatus: FormFillupResultStatus;
  referredSubjectsCount: number;
  referredSemestersCount: number;
  practicalSubjectsCount: number;
  applyDelayFee: boolean;
  resultSummaryNote: string;
  paymentStatus: FormFillupPaymentStatus;
} {
  const statusStr = String(params.rawStatus ?? '').trim();
  const statusLower = statusStr.toLowerCase();
  const gpaStr = String(params.rawGpa ?? '').trim();
  const noteStr = String(params.rawNote ?? '').trim();

  let refSubCount =
    params.rawRefSub !== undefined && String(params.rawRefSub).trim() !== ''
      ? clampWholeCount(Number(params.rawRefSub), 30)
      : 0;
  let refSemCount =
    params.rawRefSem !== undefined && String(params.rawRefSem).trim() !== ''
      ? clampWholeCount(Number(params.rawRefSem), 12)
      : 0;
  const pracSubCount =
    params.rawPracSub !== undefined && String(params.rawPracSub).trim() !== ''
      ? clampWholeCount(Number(params.rawPracSub), 20)
      : 0;
  const applyDelayFee = parseDelayFlag(params.rawDelay);
  const paymentStatus = parsePaymentStatus(
    params.rawPayment,
    params.existingPaymentStatus || 'pending'
  );

  // Extract subject codes if BTEB sheet lists e.g. "Referred (28531, 28532)"
  const extractedSubjectCodes = statusStr.match(/\b\d{5}\b/g) || [];

  let resultStatus: FormFillupResultStatus = 'regular';
  let autoNote = noteStr;

  if (
    statusLower.includes('referred only') ||
    statusLower.includes('referred_only') ||
    statusLower.includes('irregular') ||
    statusLower === 'ref only'
  ) {
    resultStatus = 'referred_only';
    if (refSubCount === 0 && extractedSubjectCodes.length > 0) {
      refSubCount = extractedSubjectCodes.length;
    }
    if (refSubCount === 0) {
      refSubCount = 1;
    }
    if (!autoNote && statusStr && !statusLower.startsWith('referred')) {
      autoNote = statusStr;
    } else if (!autoNote && extractedSubjectCodes.length > 0) {
      autoNote = `Ref: ${extractedSubjectCodes.join(', ')}`;
    }
  } else if (
    statusLower.includes('referred') ||
    statusLower.includes('regular_with_referred') ||
    statusLower.startsWith('ref') ||
    statusLower === 'r' ||
    refSubCount > 0 ||
    refSemCount > 0
  ) {
    resultStatus = 'regular_with_referred';
    if (refSubCount === 0 && extractedSubjectCodes.length > 0) {
      refSubCount = extractedSubjectCodes.length;
    }
    if (refSubCount === 0) {
      refSubCount = 1;
    }
    if (!autoNote && extractedSubjectCodes.length > 0) {
      autoNote = `Ref: ${extractedSubjectCodes.join(', ')}`;
    }
  } else {
    resultStatus = 'regular';
    // Check if status cell itself contains numeric GPA like "3.45" or "GPA 3.45"
    if (!autoNote) {
      if (gpaStr) {
        autoNote = /^gpa/i.test(gpaStr) ? gpaStr : `GPA ${gpaStr}`;
      } else if (/^(gpa\s*)?\d(\.\d{1,2})?$/i.test(statusStr)) {
        autoNote = /^gpa/i.test(statusStr) ? statusStr : `GPA ${statusStr}`;
      }
    }
  }

  const normalized = normalizeResultInput({
    resultStatus,
    referredSubjectsCount: refSubCount,
    referredSemestersCount: refSemCount,
    practicalSubjectsCount: pracSubCount,
    applyDelayFee,
  });

  return {
    ...normalized,
    resultSummaryNote: autoNote,
    paymentStatus,
  };
}

/**
 * Extracts a 2D array from either an Excel Workbook buffer (.xlsx/.xls) or CSV text,
 * automatically locating the header row (skipping banner/comment rows like '# BTEB ...').
 */
export function extractRowsFromSpreadsheet(
  input: ArrayBuffer | Uint8Array | string
): unknown[][] {
  let workbook: XLSX.WorkBook;
  if (typeof input === 'string') {
    const cleanedLines = input
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('"#');
      });
    if (cleanedLines.length === 0) return [];
    workbook = XLSX.read(cleanedLines.join('\n'), { type: 'string' });
  } else {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    workbook = XLSX.read(bytes, { type: 'array' });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });
}

/**
 * Parses uploaded Excel (.xlsx/.xls) or CSV student examination results and computes
 * each matched student's exact Tk fee using the official semester FeeConfig.
 */
export function parseFormFillupResultSpreadsheet(params: {
  fileData: ArrayBuffer | Uint8Array | string;
  classId: string;
  students: Student[];
  feeConfig: FormFillupFeeConfig;
  existingRecords?: FormFillupStudentRecord[];
}): ResultImportParseOutput {
  const { fileData, classId, students, feeConfig, existingRecords = [] } = params;
  const rows2D = extractRowsFromSpreadsheet(fileData);

  if (rows2D.length < 2) {
    return {
      matched: [],
      errors: [
        {
          rowNumber: 1,
          message:
            'File must include a column header row and at least one student result row.',
        },
      ],
      totalRowsScanned: 0,
      totalCalculatedTk: 0,
    };
  }

  // Locate header row in the first 10 rows (supports files with institutional banners)
  let headerRowIdx = -1;
  const searchLimit = Math.min(rows2D.length, 10);
  for (let i = 0; i < searchLimit; i++) {
    const normalizedCells = rows2D[i].map(normalizeHeaderKey);
    if (
      normalizedCells.some(k => ROLL_HEADER_KEYS.has(k) || REG_HEADER_KEYS.has(k))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      matched: [],
      errors: [
        {
          rowNumber: 1,
          message:
            'Missing required Roll Number column (e.g., "Roll", "Roll Number", or "Board Roll").',
        },
      ],
      totalRowsScanned: 0,
      totalCalculatedTk: 0,
    };
  }

  const headers = rows2D[headerRowIdx].map(normalizeHeaderKey);
  const findCol = (aliases: string[]): number => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const rollCol = findCol(Array.from(ROLL_HEADER_KEYS));
  const regCol = findCol(Array.from(REG_HEADER_KEYS));
  const statusCol = findCol([
    'resultstatus',
    'result',
    'gparesult',
    'resultgpa',
    'examresult',
    'statuscategory',
    'eligibility',
  ]);
  const gpaCol = findCol(['gpa', 'cgpa', 'sgpa']);
  const refSubCol = findCol([
    'refsubjects',
    'referredsubjects',
    'refsub',
    'referredsubjectscount',
    'refcount',
    'referredcount',
    'referred',
  ]);
  const refSemCol = findCol([
    'refsemesters',
    'referredsemesters',
    'refsem',
    'referredsemesterscount',
  ]);
  const pracSubCol = findCol([
    'practicalsubjects',
    'pracsubjects',
    'pracsub',
    'practical',
    'practicalsubjectscount',
  ]);
  const delayCol = findCol([
    'delayfee',
    'delay',
    'applydelayfee',
    'late',
    'latefee',
  ]);
  const noteCol = findCol([
    'resultnote',
    'resultnotes',
    'resultsummarynote',
    'note',
    'notes',
    'remark',
    'remarks',
    'details',
  ]);
  const paymentCol = findCol([
    'paymentstatus',
    'payment',
    'feestatus',
  ]);

  const activeStudents = students.filter(
    s => s.classId === classId && s.status === 'active'
  );
  const byRoll = new Map<string, Student>();
  const byReg = new Map<string, Student>();
  activeStudents.forEach(s => {
    byRoll.set(s.rollNumber.trim().toLowerCase(), s);
    if (s.registrationNumber?.trim()) {
      byReg.set(s.registrationNumber.trim().toLowerCase(), s);
    }
  });

  const existingByStudent = new Map<string, FormFillupStudentRecord>();
  existingRecords.forEach(r => {
    if (r.classId === classId) existingByStudent.set(r.studentId, r);
  });

  const matched: ImportedStudentResultRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];
  const seenStudentIds = new Set<string>();
  let totalRowsScanned = 0;

  for (let r = headerRowIdx + 1; r < rows2D.length; r++) {
    const row = rows2D[r];
    if (!row || row.every(cell => String(cell ?? '').trim() === '')) {
      continue;
    }
    totalRowsScanned++;
    const humanRowNum = r + 1;

    const rawRoll = rollCol !== -1 ? String(row[rollCol] ?? '').trim() : '';
    const rawReg = regCol !== -1 ? String(row[regCol] ?? '').trim() : '';

    if (!rawRoll && !rawReg) {
      errors.push({
        rowNumber: humanRowNum,
        message: 'Row is missing Roll Number / Registration Number.',
      });
      continue;
    }

    const matchedStudent =
      (rawRoll ? byRoll.get(rawRoll.toLowerCase()) : undefined) ||
      (rawReg ? byReg.get(rawReg.toLowerCase()) : undefined);

    if (!matchedStudent) {
      errors.push({
        rowNumber: humanRowNum,
        message: `Roll "${rawRoll || rawReg}" does not match any active student in this semester.`,
      });
      continue;
    }

    if (seenStudentIds.has(matchedStudent.id)) {
      errors.push({
        rowNumber: humanRowNum,
        message: `Duplicate entry for Roll "${matchedStudent.rollNumber}" (${matchedStudent.name}) skipped.`,
      });
      continue;
    }
    seenStudentIds.add(matchedStudent.id);

    const existingRec = existingByStudent.get(matchedStudent.id);
    const interpreted = interpretResultRowFields({
      rawStatus: statusCol !== -1 ? row[statusCol] : undefined,
      rawGpa: gpaCol !== -1 ? row[gpaCol] : undefined,
      rawRefSub: refSubCol !== -1 ? row[refSubCol] : undefined,
      rawRefSem: refSemCol !== -1 ? row[refSemCol] : undefined,
      rawPracSub: pracSubCol !== -1 ? row[pracSubCol] : undefined,
      rawDelay: delayCol !== -1 ? row[delayCol] : undefined,
      rawNote: noteCol !== -1 ? row[noteCol] : undefined,
      rawPayment: paymentCol !== -1 ? row[paymentCol] : undefined,
      existingPaymentStatus: existingRec?.paymentStatus,
    });

    const breakdown = calculateStudentFormFillupFee(feeConfig, interpreted);

    matched.push({
      studentId: matchedStudent.id,
      rollNumber: matchedStudent.rollNumber,
      studentName: matchedStudent.name,
      ...interpreted,
      calculatedAmountTk: breakdown.totalAmountTk,
    });
  }

  const totalCalculatedTk = matched.reduce(
    (sum, item) => sum + item.calculatedAmountTk,
    0
  );

  return {
    matched,
    errors,
    totalRowsScanned,
    totalCalculatedTk,
  };
}

export function buildResultTemplateRows(params: {
  students: Student[];
  classId: string;
  existingRecords?: FormFillupStudentRecord[];
}): Array<Record<string, string | number>> {
  const { students, classId, existingRecords = [] } = params;
  const active = [...students]
    .filter(s => s.classId === classId && s.status === 'active')
    .sort((a, b) =>
      a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
    );

  const recMap = new Map<string, FormFillupStudentRecord>();
  existingRecords.forEach(r => {
    if (r.classId === classId) recMap.set(r.studentId, r);
  });

  if (active.length === 0) {
    return [
      {
        'Roll Number': '621001',
        'Student Name': 'Sample Regular Student',
        'Result Status': 'regular',
        'Referred Subjects': 0,
        'Referred Semesters': 0,
        'Practical Subjects': 3,
        'Delay Fee': 'No',
        'Result Note': 'GPA 3.65',
        'Payment Status': 'pending',
      },
      {
        'Roll Number': '621002',
        'Student Name': 'Sample Referred Student',
        'Result Status': 'regular_with_referred',
        'Referred Subjects': 2,
        'Referred Semesters': 1,
        'Practical Subjects': 3,
        'Delay Fee': 'Yes',
        'Result Note': 'Ref: 28531, 28532',
        'Payment Status': 'pending',
      },
    ];
  }

  return active.map(stu => {
    const rec = recMap.get(stu.id);
    return {
      'Roll Number': stu.rollNumber,
      'Student Name': stu.name,
      'Result Status': rec?.resultStatus || 'regular',
      'Referred Subjects': rec?.referredSubjectsCount ?? 0,
      'Referred Semesters': rec?.referredSemestersCount ?? 0,
      'Practical Subjects': rec?.practicalSubjectsCount ?? 0,
      'Delay Fee': rec?.applyDelayFee ? 'Yes' : 'No',
      'Result Note': rec?.resultSummaryNote || '',
      'Payment Status': rec?.paymentStatus || 'pending',
    };
  });
}

export function generateResultImportCSVTemplate(params: {
  students: Student[];
  classId: string;
  existingRecords?: FormFillupStudentRecord[];
}): string {
  const rows = buildResultTemplateRows(params);
  const sheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(sheet);
}

export function generateResultImportExcelBuffer(params: {
  classGroup: ClassGroup;
  students: Student[];
  existingRecords?: FormFillupStudentRecord[];
}): Uint8Array {
  const rows = buildResultTemplateRows({
    students: params.students,
    classId: params.classGroup.id,
    existingRecords: params.existingRecords,
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `${params.classGroup.semester} Sem Results`);
  const rawOutput = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array | number[];
  return rawOutput instanceof Uint8Array ? rawOutput : new Uint8Array(rawOutput);
}

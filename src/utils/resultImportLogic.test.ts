import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildResultTemplateRows,
  generateResultImportCSVTemplate,
  generateResultImportExcelBuffer,
  interpretResultRowFields,
  parseFormFillupResultSpreadsheet,
} from './resultImportLogic';
import { ClassGroup, FormFillupFeeConfig, Student } from '../types/attendance';

const feeConfig: FormFillupFeeConfig = {
  id: 'ff-fee-cls-4',
  semester: '4th',
  classId: 'cls-4',
  examFee: 400,
  referredExamFeePerSubject: 150,
  marksheetFeeRegular: 150,
  marksheetFeeReferredPerSemester: 150,
  centerFeeRegular: 250,
  centerFeeReferredPerSemester: 100,
  practicalFeePerSubject: 100,
  questionFee: 100,
  delayFee: 200,
  updatedAt: '2026-11-17T00:00:00Z',
};

const classGroup: ClassGroup = {
  id: 'cls-4',
  name: 'CST 4th Semester',
  section: 'Shift-1',
  department: 'CST',
  semester: '4th',
  academicYear: '2026',
  roomNumber: '401',
  technology: '85',
};

const sampleStudents: Student[] = [
  {
    id: 'stu-621001',
    rollNumber: '621001',
    registrationNumber: '1502189401',
    name: 'Arif Rahman',
    email: 'arif@bteb.edu.bd',
    gender: 'Male',
    classId: 'cls-4',
    status: 'active',
  },
  {
    id: 'stu-621002',
    rollNumber: '621002',
    registrationNumber: '1502189402',
    name: 'Nadia Islam',
    email: 'nadia@bteb.edu.bd',
    gender: 'Female',
    classId: 'cls-4',
    status: 'active',
  },
  {
    id: 'stu-621003',
    rollNumber: '621003',
    name: 'Tanvir Ahmed',
    email: 'tanvir@bteb.edu.bd',
    gender: 'Male',
    classId: 'cls-4',
    status: 'active',
  },
];

test('parseFormFillupResultSpreadsheet parses CSV with comment headers and calculates Tk fees accurately', () => {
  const csv = [
    '# BTEB Semester Final Result Sheet',
    'Roll Number,Result Status,Referred Subjects,Referred Semesters,Practical Subjects,Delay Fee,Result Note,Payment Status',
    '621001,regular,0,0,4,No,GPA 3.75,paid',
    '621002,regular_with_referred,2,1,3,Yes,"Ref: 28531, 28532",pending',
    '999999,regular,0,0,2,No,Unknown student,pending',
  ].join('\n');

  const result = parseFormFillupResultSpreadsheet({
    fileData: csv,
    classId: 'cls-4',
    students: sampleStudents,
    feeConfig,
  });

  assert.equal(result.matched.length, 2);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /999999/);

  // Student 1: 400 + 150 + 250 + 400 + 100 = 1300
  assert.equal(result.matched[0].studentId, 'stu-621001');
  assert.equal(result.matched[0].resultStatus, 'regular');
  assert.equal(result.matched[0].calculatedAmountTk, 1300);
  assert.equal(result.matched[0].paymentStatus, 'paid');

  // Student 2: 400 + 300 + 150 + 150 + 250 + 100 + 300 + 100 + 200 = 1950
  assert.equal(result.matched[1].studentId, 'stu-621002');
  assert.equal(result.matched[1].resultStatus, 'regular_with_referred');
  assert.equal(result.matched[1].referredSubjectsCount, 2);
  assert.equal(result.matched[1].applyDelayFee, true);
  assert.equal(result.matched[1].calculatedAmountTk, 1950);
  assert.equal(result.totalCalculatedTk, 3250);
});

test('parseFormFillupResultSpreadsheet parses Excel (.xlsx) buffer with banner row and BTEB GPA/Referred strings', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Bangladesh Technical Education Board - 4th Semester Results'],
    ['Roll', 'GPA / Result', 'Prac Sub', 'Delay'],
    [621001, '3.55', 4, 'No'],
    [621002, 'Referred (28531, 28541)', 3, 'Yes'],
    [621003, 'Referred Only', 1, 'No'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  const xlsxBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const result = parseFormFillupResultSpreadsheet({
    fileData: xlsxBuf,
    classId: 'cls-4',
    students: sampleStudents,
    feeConfig,
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.matched.length, 3);

  // Regular GPA 3.55
  assert.equal(result.matched[0].resultStatus, 'regular');
  assert.equal(result.matched[0].resultSummaryNote, 'GPA 3.55');
  assert.equal(result.matched[0].calculatedAmountTk, 1300);

  // Extracted 2 referred subjects (28531, 28541) -> 1950 Tk
  assert.equal(result.matched[1].resultStatus, 'regular_with_referred');
  assert.equal(result.matched[1].referredSubjectsCount, 2);
  assert.equal(result.matched[1].referredSemestersCount, 1);
  assert.equal(result.matched[1].calculatedAmountTk, 1950);

  // Referred Only default 1 ref sub, 1 ref sem, 1 prac -> 150 + 150 + 100 + 100 + 100 = 600
  assert.equal(result.matched[2].resultStatus, 'referred_only');
  assert.equal(result.matched[2].calculatedAmountTk, 600);
});

test('interpretResultRowFields detects duplicate prevention & round-trips Excel/CSV templates cleanly', () => {
  const rows = buildResultTemplateRows({ students: sampleStudents, classId: 'cls-4' });
  assert.equal(rows.length, 3);

  const csvTemplate = generateResultImportCSVTemplate({
    students: sampleStudents,
    classId: 'cls-4',
  });
  const roundTripCsv = parseFormFillupResultSpreadsheet({
    fileData: csvTemplate,
    classId: 'cls-4',
    students: sampleStudents,
    feeConfig,
  });
  assert.equal(roundTripCsv.matched.length, 3);
  assert.equal(roundTripCsv.errors.length, 0);

  const excelBytes = generateResultImportExcelBuffer({
    classGroup,
    students: sampleStudents,
  });
  const roundTripXlsx = parseFormFillupResultSpreadsheet({
    fileData: excelBytes,
    classId: 'cls-4',
    students: sampleStudents,
    feeConfig,
  });
  assert.equal(roundTripXlsx.matched.length, 3);
  assert.equal(roundTripXlsx.errors.length, 0);

  const gpaParsed = interpretResultRowFields({ rawStatus: '3.88', rawPracSub: 2 });
  assert.equal(gpaParsed.resultStatus, 'regular');
  assert.equal(gpaParsed.resultSummaryNote, 'GPA 3.88');
  assert.equal(gpaParsed.practicalSubjectsCount, 2);
});

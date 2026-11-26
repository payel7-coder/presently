import React, { useState, useEffect, useMemo } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  ClassGroup,
  FormFillupFeeConfig,
  FormFillupPaymentStatus,
  FormFillupResultStatus,
  Student,
} from '../types/attendance';
import {
  calculateFormFillupBatchTotals,
  calculateStudentFormFillupFee,
  canEditFormFillupFeeConfig,
  clampWholeCount,
  createDefaultFeeConfig,
  DEFAULT_BTEB_FORM_FILLUP_RATES,
  exportFormFillupToCSV,
  FeeBreakdown,
  filterVisibleFormFillupClasses,
  formatResultStatusLabel,
  normalizeResultInput,
  validateFeeConfig,
} from '../utils/formFillupLogic';
import { generateFormFillupPDF } from '../utils/pdfFormFillup';
import { ImportResultsModal } from './ImportResultsModal';
import { FormFillupInvoiceModal } from './FormFillupInvoiceModal';
import { canGenerateFormFillupInvoice } from '../utils/formFillupInvoiceLogic';
import { ImportedStudentResultRow } from '../utils/resultImportLogic';
import {
  Receipt,
  FileCheck2,
  UserCog,
  Save,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  FileText,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Users,
  Wallet,
  Eye,
  X,
  Trash2,
  UserCheck,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface StudentDraftRow {
  studentId: string;
  resultStatus: FormFillupResultStatus;
  referredSubjectsCount: number;
  referredSemestersCount: number;
  practicalSubjectsCount: number;
  applyDelayFee: boolean;
  resultSummaryNote: string;
  paymentStatus: FormFillupPaymentStatus;
}

const FEE_METRIC_FIELDS: Array<{
  key: keyof typeof DEFAULT_BTEB_FORM_FILLUP_RATES;
  label: string;
  unit: string;
}> = [
  { key: 'examFee', label: '1. Exam Fee', unit: 'Flat / Student' },
  { key: 'referredExamFeePerSubject', label: '2. Referred Exam Fee', unit: 'Per Ref Subject' },
  { key: 'marksheetFeeRegular', label: '3. Marksheet Fee (Regular)', unit: 'Flat / Student' },
  { key: 'marksheetFeeReferredPerSemester', label: '4. Marksheet Fee (Referred)', unit: 'Per Ref Semester' },
  { key: 'centerFeeRegular', label: '5. Center Fee (Regular)', unit: 'Flat / Student' },
  { key: 'centerFeeReferredPerSemester', label: '6. Center Fee (Referred)', unit: 'Per Ref Semester' },
  { key: 'practicalFeePerSubject', label: '7. Practical Fee', unit: 'Per Practical Subject' },
  { key: 'questionFee', label: '8. Question Fee', unit: 'Flat / Student' },
  { key: 'delayFee', label: '9. Delay Fee', unit: 'Flat Late Fine' },
];

export const FormFillupManager: React.FC<{ initialClassId?: string }> = ({ initialClassId }) => {
  const {
    currentUser,
    isAdmin,
    classes,
    teachers,
    users,
    students,
    formFillupResponsibilities,
    formFillupFeeConfigs,
    formFillupRecords,
    assignFormFillupCoordinator,
    unassignFormFillupCoordinator,
    saveFormFillupFeeConfig,
    saveFormFillupRecords,
  } = useAttendance();

  const visibleClasses = useMemo(
    () =>
      filterVisibleFormFillupClasses({
        currentUser,
        classes,
        responsibilities: formFillupResponsibilities,
      }),
    [currentUser, classes, formFillupResponsibilities]
  );

  const sortedAllClasses = useMemo(
    () =>
      [...classes].sort((a, b) =>
        a.semester.localeCompare(b.semester, undefined, { numeric: true })
      ),
    [classes]
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (initialClassId && visibleClasses.some(c => c.id === initialClassId)) {
      return initialClassId;
    }
    return visibleClasses[0]?.id || '';
  });

  useEffect(() => {
    if (initialClassId && visibleClasses.some(c => c.id === initialClassId)) {
      setSelectedClassId(initialClassId);
      return;
    }
    if (!visibleClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(visibleClasses[0]?.id || '');
    }
  }, [initialClassId, visibleClasses, selectedClassId]);

  const selectedClass: ClassGroup | undefined = useMemo(
    () => visibleClasses.find(c => c.id === selectedClassId) || visibleClasses[0],
    [visibleClasses, selectedClassId]
  );

  // Admin coordinator assignment controls
  const [showCoordinatorPanel, setShowCoordinatorPanel] = useState<boolean>(isAdmin);
  const [coordinatorSelections, setCoordinatorSelections] = useState<Record<string, string>>({});
  const [pendingRemoveRespId, setPendingRemoveRespId] = useState<string | null>(null);
  const [busyRespClassId, setBusyRespClassId] = useState<string | null>(null);

  // Sync coordinator dropdown defaults with persisted responsibilities
  useEffect(() => {
    const nextMap: Record<string, string> = {};
    sortedAllClasses.forEach(cls => {
      const existing = formFillupResponsibilities.find(r => r.classId === cls.id);
      nextMap[cls.id] = existing?.teacherId || '';
    });
    setCoordinatorSelections(nextMap);
  }, [sortedAllClasses, formFillupResponsibilities]);

  // Saved or default fee config for selected semester
  const persistedFeeConfig: FormFillupFeeConfig | undefined = useMemo(() => {
    if (!selectedClass) return undefined;
    return (
      formFillupFeeConfigs.find(c => c.classId === selectedClass.id) ||
      createDefaultFeeConfig(selectedClass.semester, selectedClass.id)
    );
  }, [selectedClass, formFillupFeeConfigs]);

  const [feeConfigDraft, setFeeConfigDraft] = useState<FormFillupFeeConfig | null>(null);
  const [isFeePanelOpen, setIsFeePanelOpen] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  useEffect(() => {
    if (persistedFeeConfig) {
      setFeeConfigDraft({ ...persistedFeeConfig });
    } else {
      setFeeConfigDraft(null);
    }
  }, [persistedFeeConfig]);

  // Student draft map for active semester
  const activeClassStudents: Student[] = useMemo(() => {
    if (!selectedClass) return [];
    return [...students]
      .filter(s => s.classId === selectedClass.id && s.status === 'active')
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }, [selectedClass, students]);

  const [studentDrafts, setStudentDrafts] = useState<Record<string, StudentDraftRow>>({});
  const [hasUnsavedRecords, setHasUnsavedRecords] = useState<boolean>(false);
  const [isSavingRecords, setIsSavingRecords] = useState<boolean>(false);

  // Sync student drafts when semester or Firestore records update
  useEffect(() => {
    if (!selectedClass) {
      setStudentDrafts({});
      setHasUnsavedRecords(false);
      return;
    }
    const nextDrafts: Record<string, StudentDraftRow> = {};
    activeClassStudents.forEach(stu => {
      const existing = formFillupRecords.find(
        r => r.classId === selectedClass.id && r.studentId === stu.id
      );
      if (existing) {
        nextDrafts[stu.id] = {
          studentId: stu.id,
          resultStatus: existing.resultStatus,
          referredSubjectsCount: existing.referredSubjectsCount,
          referredSemestersCount: existing.referredSemestersCount,
          practicalSubjectsCount: existing.practicalSubjectsCount,
          applyDelayFee: existing.applyDelayFee,
          resultSummaryNote: existing.resultSummaryNote || '',
          paymentStatus: existing.paymentStatus,
        };
      } else {
        nextDrafts[stu.id] = {
          studentId: stu.id,
          resultStatus: 'regular',
          referredSubjectsCount: 0,
          referredSemestersCount: 0,
          practicalSubjectsCount: 0,
          applyDelayFee: false,
          resultSummaryNote: '',
          paymentStatus: 'pending',
        };
      }
    });
    setStudentDrafts(nextDrafts);
    setHasUnsavedRecords(false);
  }, [selectedClass, activeClassStudents, formFillupRecords]);

  // Filters & search & breakdown modal
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState<
    'all' | 'regular' | 'referred' | 'delay' | 'paid' | 'pending'
  >('all');
  const [bulkPracticalInput, setBulkPracticalInput] = useState<string>('3');
  const [breakdownModalStudent, setBreakdownModalStudent] = useState<{
    student: Student;
    draft: StudentDraftRow;
    breakdown: FeeBreakdown;
  } | null>(null);
  const [isImportResultsModalOpen, setIsImportResultsModalOpen] = useState<boolean>(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!currentUser) return null;

  const canEditFeeSchedule = canEditFormFillupFeeConfig(currentUser);
  const canGenerateInvoice = canGenerateFormFillupInvoice({
    currentUser,
    classGroup: selectedClass,
    responsibilities: formFillupResponsibilities,
  });

  const activeCoordinator = selectedClass
    ? (() => {
        const resp = formFillupResponsibilities.find(r => r.classId === selectedClass.id);
        return resp ? users.find(u => u.id === resp.teacherId) : undefined;
      })()
    : undefined;

  const effectiveFeeConfig: FormFillupFeeConfig | undefined =
    canEditFeeSchedule ? (feeConfigDraft || persistedFeeConfig) : persistedFeeConfig;

  // Build synthetic FormFillupStudentRecord array from live drafts for live KPI + PDF/CSV parity
  const liveDraftRecords = useMemo(() => {
    if (!selectedClass || !effectiveFeeConfig) return [];
    return activeClassStudents.map(stu => {
      const draft = studentDrafts[stu.id] || {
        studentId: stu.id,
        resultStatus: 'regular' as FormFillupResultStatus,
        referredSubjectsCount: 0,
        referredSemestersCount: 0,
        practicalSubjectsCount: 0,
        applyDelayFee: false,
        resultSummaryNote: '',
        paymentStatus: 'pending' as FormFillupPaymentStatus,
      };
      const normalized = normalizeResultInput(draft);
      const breakdown = calculateStudentFormFillupFee(effectiveFeeConfig, normalized);
      return {
        id: `ff-rec-${selectedClass.id}-${stu.id}`,
        semester: selectedClass.semester,
        classId: selectedClass.id,
        studentId: stu.id,
        resultStatus: normalized.resultStatus,
        referredSubjectsCount: normalized.referredSubjectsCount,
        referredSemestersCount: normalized.referredSemestersCount,
        practicalSubjectsCount: normalized.practicalSubjectsCount,
        applyDelayFee: normalized.applyDelayFee,
        ...(draft.resultSummaryNote.trim()
          ? { resultSummaryNote: draft.resultSummaryNote.trim() }
          : {}),
        calculatedAmountTk: breakdown.totalAmountTk,
        paymentStatus: draft.paymentStatus,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [selectedClass, effectiveFeeConfig, activeClassStudents, studentDrafts]);

  const batchSummary = useMemo(() => {
    if (!effectiveFeeConfig) {
      return {
        totalStudents: 0,
        regularCount: 0,
        referredCount: 0,
        delayFeeCount: 0,
        paidOrSubmittedCount: 0,
        totalCollectibleTk: 0,
        totalCollectedTk: 0,
      };
    }
    return calculateFormFillupBatchTotals({
      students: activeClassStudents,
      records: liveDraftRecords,
      feeConfig: effectiveFeeConfig,
    });
  }, [activeClassStudents, liveDraftRecords, effectiveFeeConfig]);

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return activeClassStudents.filter(stu => {
      const draft = studentDrafts[stu.id];
      const matchesSearch =
        !q ||
        stu.name.toLowerCase().includes(q) ||
        stu.rollNumber.toLowerCase().includes(q) ||
        (stu.registrationNumber && stu.registrationNumber.toLowerCase().includes(q));
      if (!matchesSearch) return false;
      if (!draft || resultFilter === 'all') return true;
      if (resultFilter === 'regular') return draft.resultStatus === 'regular';
      if (resultFilter === 'referred') {
        return (
          draft.resultStatus === 'regular_with_referred' ||
          draft.resultStatus === 'referred_only'
        );
      }
      if (resultFilter === 'delay') return draft.applyDelayFee;
      if (resultFilter === 'paid') {
        return draft.paymentStatus === 'paid' || draft.paymentStatus === 'submitted';
      }
      if (resultFilter === 'pending') {
        return draft.paymentStatus === 'pending' || draft.paymentStatus === 'verified';
      }
      return true;
    });
  }, [activeClassStudents, studentDrafts, searchTerm, resultFilter]);

  const updateFeeField = (
    key: keyof typeof DEFAULT_BTEB_FORM_FILLUP_RATES,
    rawVal: string
  ) => {
    if (!canEditFeeSchedule || !feeConfigDraft) return;
    const numeric = rawVal === '' ? 0 : Math.max(0, Number(rawVal));
    setFeeConfigDraft({
      ...feeConfigDraft,
      [key]: Number.isFinite(numeric) ? numeric : 0,
    });
  };

  const handleSaveFeeSchedule = async () => {
    if (!selectedClass || !feeConfigDraft || !canEditFeeSchedule) return;
    const check = validateFeeConfig(feeConfigDraft);
    if (!check.valid) {
      setStatusMessage({
        type: 'error',
        text: check.error || 'Please enter valid non-negative Tk amounts for all 9 metrics.',
      });
      return;
    }

    setIsSavingConfig(true);
    setStatusMessage(null);
    try {
      const saved = await saveFormFillupFeeConfig({
        semester: selectedClass.semester,
        classId: selectedClass.id,
        examFee: feeConfigDraft.examFee,
        referredExamFeePerSubject: feeConfigDraft.referredExamFeePerSubject,
        marksheetFeeRegular: feeConfigDraft.marksheetFeeRegular,
        marksheetFeeReferredPerSemester: feeConfigDraft.marksheetFeeReferredPerSemester,
        centerFeeRegular: feeConfigDraft.centerFeeRegular,
        centerFeeReferredPerSemester: feeConfigDraft.centerFeeReferredPerSemester,
        practicalFeePerSubject: feeConfigDraft.practicalFeePerSubject,
        questionFee: feeConfigDraft.questionFee,
        delayFee: feeConfigDraft.delayFee,
      });
      setFeeConfigDraft(saved);
      setStatusMessage({
        type: 'success',
        text: `Saved 9-metric Form Fill-up fee schedule for ${selectedClass.name}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to save fee configuration.',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetDefaultRates = () => {
    if (!selectedClass || !canEditFeeSchedule) return;
    setFeeConfigDraft(createDefaultFeeConfig(selectedClass.semester, selectedClass.id));
    setStatusMessage({
      type: 'success',
      text: 'Loaded default BTEB Form Fill-up fee rates into editor. Click Save Fee Schedule to persist.',
    });
  };

  const updateStudentDraft = (
    studentId: string,
    patch: Partial<StudentDraftRow>
  ) => {
    setStudentDrafts(prev => {
      const current = prev[studentId] || {
        studentId,
        resultStatus: 'regular' as FormFillupResultStatus,
        referredSubjectsCount: 0,
        referredSemestersCount: 0,
        practicalSubjectsCount: 0,
        applyDelayFee: false,
        resultSummaryNote: '',
        paymentStatus: 'pending' as FormFillupPaymentStatus,
      };

      const merged: StudentDraftRow = {
        ...current,
        ...patch,
      };

      // UX ergonomics: when switching to a referred status with 0 counts, initialize to 1/1
      if (
        patch.resultStatus &&
        patch.resultStatus !== 'regular' &&
        merged.referredSubjectsCount === 0
      ) {
        merged.referredSubjectsCount = 1;
        if (merged.referredSemestersCount === 0) {
          merged.referredSemestersCount = 1;
        }
      }

      const normalized = normalizeResultInput({
        resultStatus: merged.resultStatus,
        referredSubjectsCount: merged.referredSubjectsCount,
        referredSemestersCount: merged.referredSemestersCount,
        practicalSubjectsCount: merged.practicalSubjectsCount,
        applyDelayFee: merged.applyDelayFee,
      });

      return {
        ...prev,
        [studentId]: {
          ...merged,
          ...normalized,
        },
      };
    });
    setHasUnsavedRecords(true);
  };

  const handleApplyBulkPracticalCount = () => {
    const count = clampWholeCount(Number(bulkPracticalInput), 20);
    setStudentDrafts(prev => {
      const next = { ...prev };
      activeClassStudents.forEach(stu => {
        const cur = next[stu.id] || {
          studentId: stu.id,
          resultStatus: 'regular' as FormFillupResultStatus,
          referredSubjectsCount: 0,
          referredSemestersCount: 0,
          practicalSubjectsCount: 0,
          applyDelayFee: false,
          resultSummaryNote: '',
          paymentStatus: 'pending' as FormFillupPaymentStatus,
        };
        next[stu.id] = {
          ...cur,
          practicalSubjectsCount: count,
        };
      });
      return next;
    });
    setHasUnsavedRecords(true);
    setStatusMessage({
      type: 'success',
      text: `Applied ${count} practical subject(s) across ${activeClassStudents.length} students. Click Save Form Fill-up Records to persist.`,
    });
  };

  const handleSaveStudentRecords = async () => {
    if (!selectedClass || !effectiveFeeConfig) return;
    setIsSavingRecords(true);
    setStatusMessage(null);
    try {
      let persistedConfig: FormFillupFeeConfig | undefined;
      if (canEditFeeSchedule) {
        const check = validateFeeConfig(effectiveFeeConfig);
        if (!check.valid) {
          throw new Error(check.error || 'Please fix invalid fee rate inputs before saving records.');
        }

        persistedConfig = await saveFormFillupFeeConfig({
          semester: selectedClass.semester,
          classId: selectedClass.id,
          examFee: effectiveFeeConfig.examFee,
          referredExamFeePerSubject: effectiveFeeConfig.referredExamFeePerSubject,
          marksheetFeeRegular: effectiveFeeConfig.marksheetFeeRegular,
          marksheetFeeReferredPerSemester: effectiveFeeConfig.marksheetFeeReferredPerSemester,
          centerFeeRegular: effectiveFeeConfig.centerFeeRegular,
          centerFeeReferredPerSemester: effectiveFeeConfig.centerFeeReferredPerSemester,
          practicalFeePerSubject: effectiveFeeConfig.practicalFeePerSubject,
          questionFee: effectiveFeeConfig.questionFee,
          delayFee: effectiveFeeConfig.delayFee,
        });
      }

      const entries = activeClassStudents.map(stu => {
        const draft = studentDrafts[stu.id] || {
          studentId: stu.id,
          resultStatus: 'regular' as FormFillupResultStatus,
          referredSubjectsCount: 0,
          referredSemestersCount: 0,
          practicalSubjectsCount: 0,
          applyDelayFee: false,
          resultSummaryNote: '',
          paymentStatus: 'pending' as FormFillupPaymentStatus,
        };
        return {
          studentId: stu.id,
          resultStatus: draft.resultStatus,
          referredSubjectsCount: draft.referredSubjectsCount,
          referredSemestersCount: draft.referredSemestersCount,
          practicalSubjectsCount: draft.practicalSubjectsCount,
          applyDelayFee: draft.applyDelayFee,
          resultSummaryNote: draft.resultSummaryNote,
          paymentStatus: draft.paymentStatus,
        };
      });

      await saveFormFillupRecords(
        selectedClass.semester,
        selectedClass.id,
        entries,
        persistedConfig
      );
      setHasUnsavedRecords(false);
      setStatusMessage({
        type: 'success',
        text: `Saved form fill-up results and auto-calculated Tk totals for ${entries.length} students in ${selectedClass.name}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Unable to save form fill-up student records.',
      });
    } finally {
      setIsSavingRecords(false);
    }
  };

  const handleImportAndSaveResults = async (importedRows: ImportedStudentResultRow[]) => {
    if (!selectedClass || !effectiveFeeConfig || importedRows.length === 0) return;
    setStatusMessage(null);

    let persistedConfig: FormFillupFeeConfig | undefined;
    if (canEditFeeSchedule) {
      const check = validateFeeConfig(effectiveFeeConfig);
      if (!check.valid) {
        throw new Error(check.error || 'Please fix invalid fee rate inputs before importing results.');
      }
      persistedConfig = await saveFormFillupFeeConfig({
        semester: selectedClass.semester,
        classId: selectedClass.id,
        examFee: effectiveFeeConfig.examFee,
        referredExamFeePerSubject: effectiveFeeConfig.referredExamFeePerSubject,
        marksheetFeeRegular: effectiveFeeConfig.marksheetFeeRegular,
        marksheetFeeReferredPerSemester: effectiveFeeConfig.marksheetFeeReferredPerSemester,
        centerFeeRegular: effectiveFeeConfig.centerFeeRegular,
        centerFeeReferredPerSemester: effectiveFeeConfig.centerFeeReferredPerSemester,
        practicalFeePerSubject: effectiveFeeConfig.practicalFeePerSubject,
        questionFee: effectiveFeeConfig.questionFee,
        delayFee: effectiveFeeConfig.delayFee,
      });
    }

    const importedByStudentId = new Map<string, ImportedStudentResultRow>(
      importedRows.map(row => [row.studentId, row])
    );

    const mergedDrafts: Record<string, StudentDraftRow> = {};
    const entries = activeClassStudents.map(stu => {
      const matched = importedByStudentId.get(stu.id);
      const existingDraft = studentDrafts[stu.id] || {
        studentId: stu.id,
        resultStatus: 'regular' as FormFillupResultStatus,
        referredSubjectsCount: 0,
        referredSemestersCount: 0,
        practicalSubjectsCount: 0,
        applyDelayFee: false,
        resultSummaryNote: '',
        paymentStatus: 'pending' as FormFillupPaymentStatus,
      };
      const mergedRow: StudentDraftRow = matched
        ? {
            studentId: stu.id,
            resultStatus: matched.resultStatus,
            referredSubjectsCount: matched.referredSubjectsCount,
            referredSemestersCount: matched.referredSemestersCount,
            practicalSubjectsCount: matched.practicalSubjectsCount,
            applyDelayFee: matched.applyDelayFee,
            resultSummaryNote: matched.resultSummaryNote,
            paymentStatus: matched.paymentStatus,
          }
        : existingDraft;
      mergedDrafts[stu.id] = mergedRow;
      return mergedRow;
    });

    await saveFormFillupRecords(
      selectedClass.semester,
      selectedClass.id,
      entries,
      persistedConfig
    );

    setStudentDrafts(mergedDrafts);
    setHasUnsavedRecords(false);
    setStatusMessage({
      type: 'success',
      text: `Imported ${importedRows.length} student result(s) from Excel/CSV and saved auto-calculated Tk totals for ${selectedClass.name}.`,
    });
  };

  const handleExportCSV = () => {
    if (!selectedClass || !effectiveFeeConfig) return;
    const csv = exportFormFillupToCSV({
      classGroup: selectedClass,
      students: activeClassStudents,
      records: liveDraftRecords,
      feeConfig: effectiveFeeConfig,
      coordinator: activeCoordinator,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BTEB_Form_Fillup_${selectedClass.semester}_Semester_${new Date()
      .toISOString()
      .split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    if (!selectedClass || !effectiveFeeConfig) return;
    const pdf = generateFormFillupPDF({
      classGroup: selectedClass,
      students: activeClassStudents,
      records: liveDraftRecords,
      feeConfig: effectiveFeeConfig,
      coordinator: activeCoordinator,
      generatedBy: currentUser,
    });
    pdf.save(
      `BTEB_Form_Fillup_${selectedClass.semester}_Semester_${new Date()
        .toISOString()
        .split('T')[0]}.pdf`
    );
  };

  const handleAssignCoordinator = async (cls: ClassGroup) => {
    const teacherId = coordinatorSelections[cls.id];
    if (!teacherId) {
      setStatusMessage({
        type: 'error',
        text: `Select an approved teacher before assigning ${cls.name}.`,
      });
      return;
    }
    setBusyRespClassId(cls.id);
    setStatusMessage(null);
    try {
      await assignFormFillupCoordinator(cls.semester, cls.id, teacherId);
      const assignedTeacher = teachers.find(t => t.id === teacherId);
      setStatusMessage({
        type: 'success',
        text: `Assigned ${assignedTeacher?.name || 'Teacher'} as Form Fill-up Coordinator for ${cls.name}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to assign form fill-up coordinator.',
      });
    } finally {
      setBusyRespClassId(null);
    }
  };

  const handleUnassignCoordinator = async (respId: string, clsName: string) => {
    setBusyRespClassId(respId);
    setStatusMessage(null);
    try {
      await unassignFormFillupCoordinator(respId);
      setPendingRemoveRespId(null);
      setStatusMessage({
        type: 'success',
        text: `Removed Form Fill-up Coordinator assignment for ${clsName}.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to remove coordinator assignment.',
      });
    } finally {
      setBusyRespClassId(null);
    }
  };

  const getPaymentSelectStyles = (status: FormFillupPaymentStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'submitted':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'verified':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="pb-5 sm:pb-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700 inline-flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5" />
              Semester Final Form Fill-up
            </span>
            <span>·</span>
            <span>BTEB Diploma Examination Fee Calculator</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Form Fill-up Fee Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {canEditFeeSchedule
              ? 'Configure all 9 examination fee metrics per semester, assign coordinators, and review student payable BDT amounts.'
              : 'Enter each student\u0027s examination result details and auto-calculate payable BDT amounts using the official admin-configured fee schedule.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCoordinatorPanel(!showCoordinatorPanel)}
              className="h-10 sm:h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <UserCog className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Coordinators</span>
              {showCoordinatorPanel ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>
          )}
          {selectedClass && (
            <>
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={activeClassStudents.length === 0}
                className="h-10 sm:h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={activeClassStudents.length === 0}
                className="h-10 sm:h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                <span>Ledger PDF</span>
              </button>
              {canGenerateInvoice && (
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(true)}
                  disabled={activeClassStudents.length === 0}
                  className="h-10 sm:h-9 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Generate Invoice</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMessage && (
        <div
          role={statusMessage.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
            statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-500 hover:text-slate-800 p-1 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Only: Semester Coordinator Responsibility Allocation */}
      {isAdmin && showCoordinatorPanel && (
        <section
          aria-label="Semester Form Fill-up Coordinator Allocation"
          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Assign Semester Form Fill-up Responsibility</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign one faculty coordinator per semester batch. Assigned teachers can enter results and manage fees exclusively for their assigned semester.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
              {formFillupResponsibilities.length} / {sortedAllClasses.length} Assigned
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {sortedAllClasses.map(cls => {
              const existingResp = formFillupResponsibilities.find(r => r.classId === cls.id);
              const assignedTeacher = existingResp
                ? teachers.find(t => t.id === existingResp.teacherId) ||
                  users.find(u => u.id === existingResp.teacherId)
                : undefined;
              const selectedTeacherId = coordinatorSelections[cls.id] || '';
              const isConfirmingRemove =
                existingResp && pendingRemoveRespId === existingResp.id;

              return (
                <div
                  key={cls.id}
                  className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    selectedClass?.id === cls.id
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {cls.semester} Semester
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          assignedTeacher
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {assignedTeacher ? 'Assigned' : 'Unassigned'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {assignedTeacher
                        ? `${assignedTeacher.name}`
                        : 'No coordinator assigned'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <select
                      aria-label={`Select coordinator for ${cls.name}`}
                      value={selectedTeacherId}
                      onChange={e =>
                        setCoordinatorSelections(prev => ({
                          ...prev,
                          [cls.id]: e.target.value,
                        }))
                      }
                      className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    >
                      <option value="">Select Teacher...</option>
                      {teachers.map(tch => (
                        <option key={tch.id} value={tch.id}>
                          {tch.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!selectedTeacherId || busyRespClassId === cls.id}
                        onClick={() => handleAssignCoordinator(cls)}
                        className="flex-1 h-8 px-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                      >
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>{existingResp ? 'Update' : 'Assign'}</span>
                      </button>

                      {existingResp &&
                        (isConfirmingRemove ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleUnassignCoordinator(existingResp.id, cls.name)
                              }
                              className="h-8 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-semibold whitespace-nowrap"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingRemoveRespId(null)}
                              className="h-8 px-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingRemoveRespId(existingResp.id)}
                            className="h-8 w-8 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg inline-flex items-center justify-center shrink-0"
                            title={`Remove coordinator from ${cls.name}`}
                            aria-label={`Remove coordinator from ${cls.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Teacher Scoped Empty State */}
      {visibleClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">
            No Semester Form Fill-up Responsibility Assigned
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Semester Final Examination form fill-up responsibility is assigned per semester by your department administrator. Once a semester is assigned to your faculty profile, it will appear here automatically.
          </p>
        </div>
      ) : (
        selectedClass &&
        effectiveFeeConfig && (
          <>
            {/* Semester Selector Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center sm:flex-wrap gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
                {visibleClasses.map(cls => {
                  const isActive = cls.id === selectedClass.id;
                  const resp = formFillupResponsibilities.find(r => r.classId === cls.id);
                  const coord = resp ? users.find(u => u.id === resp.teacherId) : undefined;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`h-8 sm:h-auto px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cls.semester} Sem</span>
                      {coord && isAdmin && (
                        <span
                          className={`ml-1.5 text-[10px] font-normal ${
                            isActive ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          · {coord.name.split(' ')[0]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
                <span className="text-slate-400">Coordinator:</span>
                <span className="font-semibold text-slate-900">
                  {activeCoordinator ? activeCoordinator.name : 'Administration (Unassigned)'}
                </span>
              </div>
            </div>

            {/* 4-Card Batch KPI Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 tabular-nums">
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                    Candidates
                  </span>
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                  {batchSummary.totalStudents}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedClass.name}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                    Result Mix
                  </span>
                  <Receipt className="w-4 h-4 text-indigo-500 shrink-0" />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-2 whitespace-nowrap">
                  {batchSummary.regularCount} Reg · {batchSummary.referredCount} Ref
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {batchSummary.delayFeeCount} with delay fee
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                    Total Collectible
                  </span>
                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
                  ৳ {batchSummary.totalCollectibleTk.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Auto-computed from 9 metrics
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                    Collected / Paid
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2 font-mono">
                  ৳ {batchSummary.totalCollectedTk.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {batchSummary.paidOrSubmittedCount} / {batchSummary.totalStudents} paid or submitted
                </p>
              </div>
            </div>

            {/* 9-Metric Configurable Fee Structure (Editable by Admin Only) */}
            <section
              aria-label="9-Metric Form Fill-up Fee Schedule"
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="p-4 sm:px-5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsFeePanelOpen(!isFeePanelOpen)}
                  className="flex items-center gap-2 text-left"
                >
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      9-Metric Examination Fee Rates (BDT / Tk) — {selectedClass.semester} Semester
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      {canEditFeeSchedule
                        ? 'Admin Fee Controls: Adjust any metric below; student payable totals recalculate automatically in real time.'
                        : 'Set by administration (read-only). Payable totals below are calculated automatically from these official rates.'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {canEditFeeSchedule ? (
                    <>
                      <button
                        type="button"
                        onClick={handleResetDefaultRates}
                        className="h-8 px-2.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Default Rates</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveFeeSchedule}
                        disabled={isSavingConfig}
                        className="h-8 px-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isSavingConfig ? 'Saving...' : 'Save Fee Schedule'}</span>
                      </button>
                    </>
                  ) : (
                    <span
                      className="h-8 px-3 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                      title="Only Administrators can change examination fee rates"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Admin-Only Rates</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsFeePanelOpen(!isFeePanelOpen)}
                    className="h-8 w-8 bg-white border border-slate-200 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-slate-900"
                    aria-label={isFeePanelOpen ? 'Collapse fee schedule' : 'Expand fee schedule'}
                  >
                    {isFeePanelOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {isFeePanelOpen && (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 tabular-nums">
                  {FEE_METRIC_FIELDS.map(field => {
                    const inputId = `fee-metric-${field.key}`;
                    return (
                      <div
                        key={field.key}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 flex items-center justify-between gap-3"
                      >
                        <label htmlFor={inputId} className="min-w-0">
                          <span className="text-xs font-semibold text-slate-900 block truncate">
                            {field.label}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            {field.unit}
                          </span>
                        </label>
                        <div className="relative w-28 shrink-0">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                            ৳
                          </span>
                          <input
                            id={inputId}
                            type="number"
                            min={0}
                            max={100000}
                            disabled={!canEditFeeSchedule}
                            readOnly={!canEditFeeSchedule}
                            aria-readonly={!canEditFeeSchedule}
                            value={effectiveFeeConfig[field.key]}
                            onChange={e => updateFeeField(field.key, e.target.value)}
                            className={`w-full h-9 pl-7 pr-2.5 text-right font-mono text-xs font-bold rounded-lg border focus:outline-none ${
                              canEditFeeSchedule
                                ? 'text-slate-900 bg-white border-slate-200 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600'
                                : 'text-slate-600 bg-slate-100 border-slate-200 cursor-not-allowed'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Student Result Input & Auto Calculation Ledger */}
            <section
              aria-label="Student Result Input and Form Fill-up Fee Calculation"
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Toolbar */}
              <div className="p-4 sm:px-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Search roll or student name..."
                      aria-label="Search students by roll or name"
                      className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                    />
                  </div>

                  <select
                    aria-label="Filter students by result or payment status"
                    value={resultFilter}
                    onChange={e => setResultFilter(e.target.value as any)}
                    className="h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  >
                    <option value="all">All Students ({activeClassStudents.length})</option>
                    <option value="regular">Regular Only ({batchSummary.regularCount})</option>
                    <option value="referred">Referred ({batchSummary.referredCount})</option>
                    <option value="delay">With Delay Fee ({batchSummary.delayFeeCount})</option>
                    <option value="paid">Paid / Submitted ({batchSummary.paidOrSubmittedCount})</option>
                    <option value="pending">Pending / Verified</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Batch Practical Subject Helper */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                    <label
                      htmlFor="bulk-practical-input"
                      className="text-[11px] font-medium text-slate-600 whitespace-nowrap"
                    >
                      Prac Subjects:
                    </label>
                    <input
                      id="bulk-practical-input"
                      type="number"
                      min={0}
                      max={20}
                      value={bulkPracticalInput}
                      onChange={e => setBulkPracticalInput(e.target.value)}
                      className="w-12 h-7 px-1.5 text-center font-mono text-xs font-semibold bg-white border border-slate-200 rounded"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkPracticalCount}
                      disabled={activeClassStudents.length === 0}
                      className="h-7 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-semibold whitespace-nowrap"
                    >
                      Apply to All
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsImportResultsModalOpen(true)}
                    disabled={activeClassStudents.length === 0}
                    className="h-9 px-3 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Import Excel / CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveStudentRecords}
                    disabled={isSavingRecords || activeClassStudents.length === 0}
                    className={`h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      hasUnsavedRecords
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    } disabled:opacity-50`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {isSavingRecords
                        ? 'Saving...'
                        : hasUnsavedRecords
                        ? 'Save Form Fill-up Records *'
                        : 'Save Form Fill-up Records'}
                    </span>
                  </button>
                </div>
              </div>

              {activeClassStudents.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    No Active Students in {selectedClass.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Administration needs to enroll students into this semester batch before computing form fill-up fees.
                  </p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  No students match the current search or filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1020px] tabular-nums">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Roll</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-3">Result Input</th>
                        <th className="py-3 px-2 text-center">Ref Sub</th>
                        <th className="py-3 px-2 text-center">Ref Sem</th>
                        <th className="py-3 px-2 text-center">Prac Sub</th>
                        <th className="py-3 px-2 text-center">Delay</th>
                        <th className="py-3 px-3">Result Note</th>
                        <th className="py-3 px-4 text-right">Auto Total (Tk)</th>
                        <th className="py-3 px-4">Payment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredStudents.map(stu => {
                        const draft = studentDrafts[stu.id] || {
                          studentId: stu.id,
                          resultStatus: 'regular' as FormFillupResultStatus,
                          referredSubjectsCount: 0,
                          referredSemestersCount: 0,
                          practicalSubjectsCount: 0,
                          applyDelayFee: false,
                          resultSummaryNote: '',
                          paymentStatus: 'pending' as FormFillupPaymentStatus,
                        };
                        const breakdown = calculateStudentFormFillupFee(effectiveFeeConfig, draft);
                        const isRegularOnly = draft.resultStatus === 'regular';

                        return (
                          <tr key={stu.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-semibold text-slate-800 whitespace-nowrap">
                              {stu.rollNumber}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar src={stu.avatar} name={stu.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate max-w-[170px]">
                                    {stu.name}
                                  </p>
                                  {stu.registrationNumber && (
                                    <p className="text-[11px] font-mono text-slate-400">
                                      Reg: {stu.registrationNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                aria-label={`Result status for ${stu.name}`}
                                value={draft.resultStatus}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    resultStatus: e.target.value as FormFillupResultStatus,
                                  })
                                }
                                className="h-8 px-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              >
                                <option value="regular">Regular (All Passed)</option>
                                <option value="regular_with_referred">Regular + Referred</option>
                                <option value="referred_only">Referred Only</option>
                              </select>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={30}
                                disabled={isRegularOnly}
                                aria-label={`Referred subjects for ${stu.name}`}
                                value={draft.referredSubjectsCount}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    referredSubjectsCount: Number(e.target.value),
                                  })
                                }
                                className="w-14 h-8 px-1.5 text-center font-mono text-xs font-semibold bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={12}
                                disabled={isRegularOnly}
                                aria-label={`Referred semesters for ${stu.name}`}
                                value={draft.referredSemestersCount}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    referredSemestersCount: Number(e.target.value),
                                  })
                                }
                                className="w-14 h-8 px-1.5 text-center font-mono text-xs font-semibold bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                aria-label={`Practical subjects for ${stu.name}`}
                                value={draft.practicalSubjectsCount}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    practicalSubjectsCount: Number(e.target.value),
                                  })
                                }
                                className="w-14 h-8 px-1.5 text-center font-mono text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              />
                            </td>
                            <td className="py-3 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={draft.applyDelayFee}
                                aria-label={`Apply delay fee for ${stu.name}`}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    applyDelayFee: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 accent-emerald-600 rounded border-slate-300 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                value={draft.resultSummaryNote}
                                placeholder="e.g. GPA 3.50 / Ref 28531"
                                aria-label={`Result note for ${stu.name}`}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    resultSummaryNote: e.target.value,
                                  })
                                }
                                className="w-36 h-8 px-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              />
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  ৳ {breakdown.totalAmountTk.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBreakdownModalStudent({
                                      student: stu,
                                      draft,
                                      breakdown,
                                    })
                                  }
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                                  title="View 9-item fee breakdown"
                                  aria-label={`View 9-item fee breakdown for ${stu.name}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                aria-label={`Payment status for ${stu.name}`}
                                value={draft.paymentStatus}
                                onChange={e =>
                                  updateStudentDraft(stu.id, {
                                    paymentStatus: e.target.value as FormFillupPaymentStatus,
                                  })
                                }
                                className={`h-8 px-2 text-xs font-semibold rounded-lg border focus:outline-none ${getPaymentSelectStyles(
                                  draft.paymentStatus
                                )}`}
                              >
                                <option value="pending">Pending</option>
                                <option value="verified">Verified</option>
                                <option value="paid">Paid</option>
                                <option value="submitted">Submitted</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}

      {/* 9-Item Fee Breakdown Modal */}
      {breakdownModalStudent && effectiveFeeConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fee-breakdown-modal-title"
            className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 id="fee-breakdown-modal-title" className="text-sm font-bold">
                  9-Metric Fee Breakdown · {breakdownModalStudent.student.name}
                </h3>
                <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                  Roll: {breakdownModalStudent.student.rollNumber} ·{' '}
                  {formatResultStatusLabel(breakdownModalStudent.draft.resultStatus)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBreakdownModalStudent(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                aria-label="Close fee breakdown modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 divide-y divide-slate-100 text-xs tabular-nums">
              {[
                {
                  name: '1. Exam Fee (Regular)',
                  detail:
                    breakdownModalStudent.breakdown.examFeeAmount > 0
                      ? 'Flat regular fee'
                      : 'Not applicable (Referred-only)',
                  amount: breakdownModalStudent.breakdown.examFeeAmount,
                },
                {
                  name: '2. Referred Exam Fee',
                  detail: `${breakdownModalStudent.draft.referredSubjectsCount} subject(s) × ৳${effectiveFeeConfig.referredExamFeePerSubject}`,
                  amount: breakdownModalStudent.breakdown.referredExamFeeAmount,
                },
                {
                  name: '3. Marksheet Fee (Regular)',
                  detail:
                    breakdownModalStudent.breakdown.marksheetRegularAmount > 0
                      ? 'Flat regular marksheet'
                      : 'Not applicable (Referred-only)',
                  amount: breakdownModalStudent.breakdown.marksheetRegularAmount,
                },
                {
                  name: '4. Marksheet Fee (Referred)',
                  detail: `${breakdownModalStudent.draft.referredSemestersCount} semester(s) × ৳${effectiveFeeConfig.marksheetFeeReferredPerSemester}`,
                  amount: breakdownModalStudent.breakdown.marksheetReferredAmount,
                },
                {
                  name: '5. Center Fee (Regular)',
                  detail:
                    breakdownModalStudent.breakdown.centerRegularAmount > 0
                      ? 'Flat regular center fee'
                      : 'Not applicable (Referred-only)',
                  amount: breakdownModalStudent.breakdown.centerRegularAmount,
                },
                {
                  name: '6. Center Fee (Referred)',
                  detail: `${breakdownModalStudent.draft.referredSemestersCount} semester(s) × ৳${effectiveFeeConfig.centerFeeReferredPerSemester}`,
                  amount: breakdownModalStudent.breakdown.centerReferredAmount,
                },
                {
                  name: '7. Practical Fee',
                  detail: `${breakdownModalStudent.draft.practicalSubjectsCount} subject(s) × ৳${effectiveFeeConfig.practicalFeePerSubject}`,
                  amount: breakdownModalStudent.breakdown.practicalFeeAmount,
                },
                {
                  name: '8. Question Fee',
                  detail: 'Flat per candidate',
                  amount: breakdownModalStudent.breakdown.questionFeeAmount,
                },
                {
                  name: '9. Delay Fee',
                  detail: breakdownModalStudent.draft.applyDelayFee
                    ? 'Applied (late submission)'
                    : 'Not applied',
                  amount: breakdownModalStudent.breakdown.delayFeeAmount,
                },
              ].map(item => (
                <div
                  key={item.name}
                  className="py-2.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{item.name}</p>
                    <p className="text-[11px] text-slate-500">{item.detail}</p>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      item.amount > 0 ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    ৳ {item.amount.toLocaleString()}
                  </span>
                </div>
              ))}

              <div className="pt-3.5 mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Total Form Fill-up Fee
                </span>
                <span className="text-lg font-bold font-mono text-emerald-700">
                  ৳ {breakdownModalStudent.breakdown.totalAmountTk.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setBreakdownModalStudent(null)}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedClass && effectiveFeeConfig && (
        <>
          <ImportResultsModal
            isOpen={isImportResultsModalOpen}
            onClose={() => setIsImportResultsModalOpen(false)}
            classGroup={selectedClass}
            students={activeClassStudents}
            feeConfig={effectiveFeeConfig}
            existingRecords={liveDraftRecords}
            onImportAndSave={handleImportAndSaveResults}
          />
          <FormFillupInvoiceModal
            isOpen={isInvoiceModalOpen}
            onClose={() => setIsInvoiceModalOpen(false)}
            classGroup={selectedClass}
            students={activeClassStudents}
            records={liveDraftRecords}
            feeConfig={effectiveFeeConfig}
            coordinator={activeCoordinator}
            generatedBy={currentUser}
          />
        </>
      )}
    </div>
  );
};

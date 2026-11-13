import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { SubjectPart } from '../types/attendance';
import { validateSubjectPartAssignment } from '../utils/attendanceLogic';
import {
  School,
  Plus,
  Trash2,
  CheckCircle2,
  Layers,
  UserPlus,
  Users,
  BookOpen,
  FlaskConical,
  AlertCircle,
  Search,
} from 'lucide-react';

interface AdminAssignmentsProps {
  onSwitchToTeacher?: (teacherId: string) => void;
}

export const AdminAssignments: React.FC<AdminAssignmentsProps> = () => {
  const {
    teachers,
    subjects,
    classes,
    assignments,
    addTeacher,
    deleteTeacher,
    assignSubjectToTeacher,
    unassignSubject,
    createSubject,
    getClassStudents,
    clearAllDemoData,
  } = useAttendance();

  // Filters & View Mode
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'faculty'>('matrix');

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState(subjects[0]?.classId || classes[0]?.id || '');
  const [selectedPart, setSelectedPart] = useState<SubjectPart>('theory');
  const [assignError, setAssignError] = useState<string | null>(null);

  // Add Teacher Modal
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherDept, setTeacherDept] = useState('Computer Science & Technology');
  const [teacherEmpId, setTeacherEmpId] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('Instructor (Computer Technology)');
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // Delete Teacher Confirmation
  const [confirmDeleteTeacherId, setConfirmDeleteTeacherId] = useState<string | null>(null);

  // Clear Database Confirmation
  const [showFreshDbConfirm, setShowFreshDbConfirm] = useState(false);

  // Add Subject Modal
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [newSubCredits, setNewSubCredits] = useState(3);
  const [newSubSemester, setNewSubSemester] = useState('4th');
  const [newSubClassId, setNewSubClassId] = useState(classes[0]?.id || '');

  // Notifications
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const semesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => {
      setSuccessBanner(null);
    }, 4500);
  };

  const filteredSubjects = subjects.filter(s => {
    const matchSem = selectedSemesterFilter === 'all' || s.semester === selectedSemesterFilter;
    const q = subjectSearch.trim().toLowerCase();
    const matchSearch =
      !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    return matchSem && matchSearch;
  });

  const openAssignModal = (opts?: {
    subjectId?: string;
    classId?: string;
    part?: SubjectPart;
    teacherId?: string;
  }) => {
    const targetSub = subjects.find(s => s.id === opts?.subjectId) || subjects[0];
    const resolvedSubId = opts?.subjectId || targetSub?.id || '';
    const resolvedClassId = opts?.classId || targetSub?.classId || classes[0]?.id || '';
    const resolvedPart: SubjectPart = opts?.part || 'theory';

    // Prefer picking a teacher not already assigned to the opposite part
    const oppositePart: SubjectPart = resolvedPart === 'theory' ? 'practical' : 'theory';
    const oppositeAsg = assignments.find(
      a => a.subjectId === resolvedSubId && a.classId === resolvedClassId && (a.part || 'theory') === oppositePart
    );
    const defaultTeacher =
      opts?.teacherId ||
      teachers.find(t => t.id !== oppositeAsg?.teacherId)?.id ||
      teachers[0]?.id ||
      '';

    setSelectedSubjectId(resolvedSubId);
    setSelectedClassId(resolvedClassId);
    setSelectedPart(resolvedPart);
    setSelectedTeacherId(defaultTeacher);
    setAssignError(null);
    setShowAssignModal(true);
  };

  const oppositePart: SubjectPart = selectedPart === 'theory' ? 'practical' : 'theory';
  const currentOppositeAssignment = assignments.find(
    a => a.subjectId === selectedSubjectId && a.classId === selectedClassId && (a.part || 'theory') === oppositePart
  );
  const currentOppositeTeacher = currentOppositeAssignment
    ? teachers.find(t => t.id === currentOppositeAssignment.teacherId)
    : undefined;

  const livePartValidation = selectedTeacherId
    ? validateSubjectPartAssignment(assignments, selectedSubjectId, selectedClassId, selectedPart, selectedTeacherId)
    : { valid: true };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError(null);

    if (!selectedTeacherId || !selectedSubjectId || !selectedClassId) {
      setAssignError('Please select a faculty member, course, and class group.');
      return;
    }

    try {
      await assignSubjectToTeacher(selectedSubjectId, selectedTeacherId, selectedClassId, selectedPart);
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      const subject = subjects.find(s => s.id === selectedSubjectId);
      const partLabel = selectedPart === 'practical' ? 'Practical' : 'Theory';
      showSuccess(`Assigned ${partLabel} part of "${subject?.code} - ${subject?.name}" to ${teacher?.name}!`);
      setShowAssignModal(false);
    } catch (err: any) {
      setAssignError(err?.message || 'Unable to assign subject part.');
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    try {
      const created = await addTeacher({
        name: teacherName,
        email: teacherEmail,
        department: teacherDept,
        employeeId: teacherEmpId || undefined,
        title: teacherTitle,
      });
      showSuccess(`Added faculty teacher "${created.name}" (${created.email}).`);
      setShowAddTeacherModal(false);
      setTeacherName('');
      setTeacherEmail('');
      setTeacherEmpId('');
    } catch (err: any) {
      setTeacherError(err?.message || 'Unable to add faculty member.');
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const t = teachers.find(item => item.id === teacherId);
    await deleteTeacher(teacherId);
    setConfirmDeleteTeacherId(null);
    showSuccess(`Removed faculty profile "${t?.name || 'Teacher'}" and cleared their course allocations.`);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCode || !newSubName) return;

    const created = await createSubject({
      code: newSubCode.trim(),
      name: newSubName.trim(),
      description: newSubDesc.trim() || 'BTEB Probidhan 2022 Curriculum Course',
      color: 'emerald',
      classId: newSubClassId,
      credits: Number(newSubCredits) || 3,
      semester: newSubSemester,
      curriculum: 'BTEB Probidhan 2022',
      technology: 'Computer Science and Technology (85)',
    });

    showSuccess(`Created BTEB course "${created.code} - ${created.name}"!`);
    setShowAddSubjectModal(false);
    setNewSubCode('');
    setNewSubName('');
    setNewSubDesc('');
  };

  const handleConfirmClearDemoData = async () => {
    await clearAllDemoData();
    setShowFreshDbConfirm(false);
    showSuccess('All sessions, records, students, and assignments have been cleared. Database is fresh!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              BTEB Academic Director Portal
            </span>
            <span className="text-xs text-slate-500">
              Theory & Practical Faculty Allocation
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Faculty & Subject Part Allocations (BTEB Curricula 2022)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Each subject has separate <strong>Theory</strong> and <strong>Practical</strong> parts. Assign different teachers or let the same teacher take both parts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowFreshDbConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors shadow-2xs"
            title="Wipe sessions, records, students, and assignments"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Fresh Database</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTeacherError(null);
              setShowAddTeacherModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Teacher</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddSubjectModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Course</span>
          </button>
          <button
            type="button"
            onClick={() => openAssignModal()}
            disabled={teachers.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <School className="w-4 h-4" />
            <span>Assign Subject Part</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Empty Faculty Onboarding Callout */}
      {teachers.length === 0 && (
        <div className="bg-gradient-to-r from-indigo-50 via-white to-emerald-50 border border-indigo-200/80 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                No Teachers Added Yet (Clean Institutional Database)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                Add faculty teachers to assign <strong>Theory</strong> and <strong>Practical</strong> parts of each BTEB subject independently (the same teacher may take both parts, or you may assign separate instructors). Teachers can also self-register from the sign-in page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTeacherError(null);
              setShowAddTeacherModal(true);
            }}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Teacher</span>
          </button>
        </div>
      )}

      {/* View Mode & Semester Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Course Theory & Practical Matrix ({filteredSubjects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('faculty')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'faculty'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Faculty Directory & Workload ({teachers.length})</span>
            </button>
          </div>

          {viewMode === 'matrix' && (
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search subject code or name..."
                value={subjectSearch}
                onChange={e => setSubjectSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* BTEB Semester Filter Ribbon */}
        {viewMode === 'matrix' && (
          <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 shrink-0">
              <Layers className="w-4 h-4 text-slate-600" />
              Semesters:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSemesterFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                selectedSemesterFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({subjects.length})
            </button>
            {semesters.map(sem => {
              const count = subjects.filter(s => s.semester === sem).length;
              const isSelected = selectedSemesterFilter === sem;
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSelectedSemesterFilter(sem)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sem} Sem ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* VIEW 1: Course Theory & Practical Matrix */}
      {viewMode === 'matrix' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSubjects.map(subject => {
            const classGroup = classes.find(c => c.id === subject.classId);
            const theoryAsg = assignments.find(
              a => a.subjectId === subject.id && a.classId === subject.classId && (a.part || 'theory') === 'theory'
            );
            const practicalAsg = assignments.find(
              a => a.subjectId === subject.id && a.classId === subject.classId && a.part === 'practical'
            );
            const theoryTeacher = theoryAsg ? teachers.find(t => t.id === theoryAsg.teacherId) : undefined;
            const practicalTeacher = practicalAsg ? teachers.find(t => t.id === practicalAsg.teacherId) : undefined;

            return (
              <div
                key={subject.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-md bg-slate-900 text-white">
                        {subject.code}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800">
                        {subject.semester} Sem
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {classGroup?.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {subject.credits || 3} Credits
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 mt-2 leading-snug">
                    {subject.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                    {subject.description}
                  </p>
                </div>

                {/* Theory & Practical Two-Part Slots */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  {/* Theory Part Slot */}
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/70 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-800">
                        <BookOpen className="w-3 h-3" /> Theory Part
                      </span>
                      {theoryAsg && (
                        <button
                          type="button"
                          onClick={() => unassignSubject(theoryAsg.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                          title="Unassign Theory Teacher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {theoryTeacher ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 truncate">{theoryTeacher.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{theoryTeacher.email}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Unassigned</p>
                    )}

                    <button
                      type="button"
                      disabled={teachers.length === 0}
                      onClick={() =>
                        openAssignModal({
                          subjectId: subject.id,
                          classId: subject.classId,
                          part: 'theory',
                          teacherId: theoryTeacher?.id,
                        })
                      }
                      className="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {theoryTeacher ? 'Change Theory Teacher' : '+ Assign Theory Teacher'}
                    </button>
                  </div>

                  {/* Practical Part Slot */}
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 flex flex-col justify-between gap-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                        <FlaskConical className="w-3 h-3" /> Practical Part
                      </span>
                      {practicalAsg && (
                        <button
                          type="button"
                          onClick={() => unassignSubject(practicalAsg.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                          title="Unassign Practical Teacher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {practicalTeacher ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 truncate">{practicalTeacher.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{practicalTeacher.email}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Unassigned</p>
                    )}

                    <button
                      type="button"
                      disabled={teachers.length === 0}
                      onClick={() =>
                        openAssignModal({
                          subjectId: subject.id,
                          classId: subject.classId,
                          part: 'practical',
                          teacherId: practicalTeacher?.id,
                        })
                      }
                      className="w-full py-1.5 px-2 rounded-lg text-[11px] font-bold bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {practicalTeacher ? 'Change Practical Teacher' : '+ Assign Practical Teacher'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: Faculty Directory & Workload Cards */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {teachers.map(teacher => {
            const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);
            const totalAssignedStudents = teacherAssignments.reduce((acc, curr) => {
              return acc + getClassStudents(curr.classId).length;
            }, 0);

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Teacher Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={teacher.avatar}
                        alt={teacher.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/20 shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{teacher.department}</p>
                        <span className="text-[10px] text-indigo-700 font-mono font-semibold">
                          {teacher.employeeId}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTeacherId(teacher.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title={`Remove ${teacher.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Workload Metric Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Assigned Parts
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {teacherAssignments.length} {teacherAssignments.length === 1 ? 'Part' : 'Parts'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Student Load
                      </span>
                      <span className="font-extrabold text-indigo-700 text-sm">
                        {totalAssignedStudents} Students
                      </span>
                    </div>
                  </div>

                  {/* List of assigned BTEB subjects & parts */}
                  <div className="mt-4">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Assigned Subject Parts
                    </p>
                    {teacherAssignments.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                        <p className="text-xs text-slate-400">No Theory or Practical parts assigned.</p>
                        <button
                          type="button"
                          onClick={() => openAssignModal({ teacherId: teacher.id })}
                          className="mt-1 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          + Assign a subject part
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teacherAssignments.map(asg => {
                          const subject = subjects.find(s => s.id === asg.subjectId);
                          const classGroup = classes.find(c => c.id === asg.classId);
                          const part = asg.part || 'theory';
                          const studentCount = classGroup ? getClassStudents(classGroup.id).length : 0;

                          if (!subject || !classGroup) return null;

                          return (
                            <div
                              key={asg.id}
                              className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold font-mono px-1.5 py-0.5 rounded bg-slate-900 text-white">
                                    {subject.code}
                                  </span>
                                  <span
                                    className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                      part === 'practical'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-indigo-100 text-indigo-800'
                                    }`}
                                  >
                                    {part === 'practical' ? 'Practical' : 'Theory'}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {classGroup.name}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-slate-800 truncate mt-1">
                                  {subject.name}
                                </p>
                                <span className="text-[10px] text-slate-500">
                                  {studentCount} Enrolled Students • {subject.semester} Sem
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => unassignSubject(asg.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Unassign Subject Part"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Faculty Meta */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[11px] text-slate-400 truncate">{teacher.email}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    {teacherAssignments.length} Assigned
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Subject Part Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Assign Course Part (Theory / Practical)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssign} className="mt-5 space-y-4">
              {/* 1. Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Select BTEB Curricula 2022 Course
                </label>
                <select
                  aria-label="Select Course"
                  value={selectedSubjectId}
                  onChange={e => {
                    const nextSubId = e.target.value;
                    const nextSub = subjects.find(s => s.id === nextSubId);
                    setSelectedSubjectId(nextSubId);
                    if (nextSub?.classId) {
                      setSelectedClassId(nextSub.classId);
                    }
                    setAssignError(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.semester} Sem] {s.code}: {s.name} ({s.credits} Credits)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Class Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Select Semester Class Group
                </label>
                <select
                  aria-label="Select Class Group"
                  value={selectedClassId}
                  onChange={e => {
                    setSelectedClassId(e.target.value);
                    setAssignError(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {classes.map(c => {
                    const count = getClassStudents(c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.section} ({count} Enrolled)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Subject Part Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Select Subject Part (Theory &amp; Practical Tracked Separately)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPart('theory');
                      setAssignError(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPart === 'theory'
                        ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Theory Part</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Classroom lectures & concepts
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPart('practical');
                      setAssignError(null);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPart === 'practical'
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Practical Part</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Lab experiments & sessional work
                    </p>
                  </button>
                </div>
                {currentOppositeTeacher && (
                  <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                    <strong>{oppositePart === 'theory' ? 'Theory' : 'Practical'}</strong> is currently taught by{' '}
                    <strong className="text-slate-900">{currentOppositeTeacher.name}</strong>. You may choose another teacher or assign the same teacher to both parts separately.
                  </p>
                )}
              </div>

              {/* 4. Select Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  4. Select Faculty Member
                </label>
                <select
                  aria-label="Select Faculty Member"
                  value={selectedTeacherId}
                  onChange={e => {
                    setSelectedTeacherId(e.target.value);
                    setAssignError(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose a teacher --</option>
                  {teachers.map(t => {
                    const isSameAsOther = currentOppositeAssignment?.teacherId === t.id;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email}) {isSameAsOther ? `[Also takes ${oppositePart === 'theory' ? 'Theory' : 'Practical'}]` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Validation Error / Warning */}
              {(assignError || !livePartValidation.valid) && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-semibold leading-relaxed">
                    {assignError || livePartValidation.error}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  Confirm {selectedPart === 'practical' ? 'Practical' : 'Theory'} Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Real Faculty Teacher Modal */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add Faculty Teacher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="mt-5 space-y-4">
              {teacherError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teacherError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Mahmudul Hasan"
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Institutional Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. mahmudul@polytechnic.edu.bd"
                  value={teacherEmail}
                  onChange={e => setTeacherEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BTEB-TCH-201"
                    value={teacherEmpId}
                    onChange={e => setTeacherEmpId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={teacherDept}
                    onChange={e => setTeacherDept(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={teacherTitle}
                  onChange={e => setTeacherTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  Save Faculty Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Teacher Modal */}
      {confirmDeleteTeacherId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Remove Faculty Teacher?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              This will remove{' '}
              <strong className="text-slate-800">
                {teachers.find(t => t.id === confirmDeleteTeacherId)?.name}
              </strong>{' '}
              and unassign all their Theory/Practical course allocations.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTeacherId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTeacher(confirmDeleteTeacherId)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Fresh Database Modal */}
      {showFreshDbConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Clear All Database Records?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to clear all attendance sessions, records, student lists, and subject assignments to start with a fresh database?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFreshDbConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearDemoData}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Clear Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add BTEB Probidhan 2022 Course
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 28545"
                    value={newSubCode}
                    onChange={e => setNewSubCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Semester
                  </label>
                  <select
                    value={newSubSemester}
                    onChange={e => {
                      const sem = e.target.value;
                      setNewSubSemester(sem);
                      const matchingCls = classes.find(c => c.semester === sem);
                      if (matchingCls) setNewSubClassId(matchingCls.id);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {semesters.map(s => (
                      <option key={s} value={s}>{s} Sem</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Credits
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newSubCredits}
                    onChange={e => setNewSubCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description / Syllabus
                </label>
                <textarea
                  rows={3}
                  placeholder="Course content, practical experiments, and BTEB assessment criteria..."
                  value={newSubDesc}
                  onChange={e => setNewSubDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  Save BTEB Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

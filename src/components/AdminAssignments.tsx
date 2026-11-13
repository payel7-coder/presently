import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { SubjectPart } from '../types/attendance';
import { validateSubjectPartAssignment } from '../utils/attendanceLogic';
import { Avatar } from './Avatar';
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
  X
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

  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'faculty'>('matrix');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState(subjects[0]?.classId || classes[0]?.id || '');
  const [selectedPart, setSelectedPart] = useState<SubjectPart>('theory');
  const [assignError, setAssignError] = useState<string | null>(null);

  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherDept, setTeacherDept] = useState('Computer Science & Technology');
  const [teacherEmpId, setTeacherEmpId] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('Instructor (Computer Technology)');
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const [confirmDeleteTeacherId, setConfirmDeleteTeacherId] = useState<string | null>(null);
  const [showFreshDbConfirm, setShowFreshDbConfirm] = useState(false);

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [newSubCredits, setNewSubCredits] = useState(3);
  const [newSubSemester, setNewSubSemester] = useState('4th');
  const [newSubClassId, setNewSubClassId] = useState(classes[0]?.id || '');

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-indigo-700">Academic Director Portal</span>
            <span>·</span>
            <span>BTEB Probidhan 2022</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Faculty &amp; Subject Part Allocations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Each subject has independent <strong className="font-semibold text-slate-700">Theory</strong> and <strong className="font-semibold text-slate-700">Practical</strong> parts. Assign separate instructors or the same instructor to both.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowFreshDbConfirm(true)}
            className="h-9 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            title="Wipe sessions, records, students, and assignments"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Fresh Database</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddSubjectModal(true)}
            className="h-9 inline-flex items-center gap-1.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Add Course</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTeacherError(null);
              setShowAddTeacherModal(true);
            }}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Teacher</span>
          </button>
          <button
            type="button"
            onClick={() => openAssignModal()}
            disabled={teachers.length === 0}
            className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <School className="w-3.5 h-3.5" />
            <span>Assign Subject Part</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Empty Faculty Onboarding Callout */}
      {teachers.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                No faculty members added yet
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Add faculty teachers to allocate Theory and Practical parts for each BTEB course independently. Teachers can also self-register from the sign-in page.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTeacherError(null);
              setShowAddTeacherModal(true);
            }}
            className="shrink-0 h-9 inline-flex items-center gap-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add First Teacher</span>
          </button>
        </div>
      )}

      {/* View Mode & Semester Filter Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start tabular-nums">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'matrix'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Course Theory &amp; Practical Matrix ({filteredSubjects.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('faculty')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                viewMode === 'faculty'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Faculty Directory &amp; Workload ({teachers.length})</span>
            </button>
          </div>

          {viewMode === 'matrix' && (
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search subject code or name..."
                value={subjectSearch}
                onChange={e => setSubjectSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
              />
            </div>
          )}
        </div>

        {viewMode === 'matrix' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 border-t border-slate-100 tabular-nums">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5 shrink-0 mr-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Semesters:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSemesterFilter('all')}
              className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
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
                  className={`h-7 px-2.5 rounded-md text-xs font-semibold transition-colors shrink-0 ${
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
                className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="font-mono font-semibold text-slate-900">
                        {subject.code}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-indigo-700">
                        {subject.semester} Sem
                      </span>
                      <span>·</span>
                      <span>{classGroup?.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {subject.credits || 3} Cr
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                    {subject.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {subject.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  {/* Theory Part */}
                  <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
                        <BookOpen className="w-3.5 h-3.5" /> Theory Part
                      </span>
                      {theoryAsg && (
                        <button
                          type="button"
                          onClick={() => unassignSubject(theoryAsg.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                          title="Unassign Theory Teacher"
                          aria-label="Unassign Theory Teacher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {theoryTeacher ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-900 truncate">{theoryTeacher.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{theoryTeacher.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Unassigned</p>
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
                      className="w-full h-8 px-2.5 rounded-md text-xs font-semibold bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {theoryTeacher ? 'Change Theory Teacher' : '+ Assign Theory Teacher'}
                    </button>
                  </div>

                  {/* Practical Part */}
                  <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-200 flex flex-col justify-between gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                        <FlaskConical className="w-3.5 h-3.5" /> Practical Part
                      </span>
                      {practicalAsg && (
                        <button
                          type="button"
                          onClick={() => unassignSubject(practicalAsg.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                          title="Unassign Practical Teacher"
                          aria-label="Unassign Practical Teacher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {practicalTeacher ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-900 truncate">{practicalTeacher.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{practicalTeacher.email}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Unassigned</p>
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
                      className="w-full h-8 px-2.5 rounded-md text-xs font-semibold bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        /* VIEW 2: Faculty Directory & Workload */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {teachers.map(teacher => {
            const teacherAssignments = assignments.filter(a => a.teacherId === teacher.id);
            const totalAssignedStudents = teacherAssignments.reduce((acc, curr) => {
              return acc + getClassStudents(curr.classId).length;
            }, 0);

            return (
              <div
                key={teacher.id}
                className="bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={teacher.avatar} name={teacher.name} size="lg" />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{teacher.department}</p>
                        <span className="text-[11px] text-indigo-700 font-mono font-medium">
                          {teacher.employeeId}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteTeacherId(teacher.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title={`Remove ${teacher.name}`}
                      aria-label={`Remove ${teacher.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs tabular-nums">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Assigned Parts</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {teacherAssignments.length} {teacherAssignments.length === 1 ? 'Part' : 'Parts'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Student Load</span>
                      <span className="font-semibold text-indigo-700 mt-0.5 block">
                        {totalAssignedStudents} Students
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Assigned Subject Parts
                    </p>
                    {teacherAssignments.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">
                        <p className="text-xs text-slate-400">No parts assigned yet.</p>
                        <button
                          type="button"
                          onClick={() => openAssignModal({ teacherId: teacher.id })}
                          className="mt-1 text-xs font-semibold text-indigo-600 hover:underline"
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
                              className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="font-mono font-semibold text-slate-800">
                                    {subject.code}
                                  </span>
                                  <span
                                    className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                                      part === 'practical'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                                    }`}
                                  >
                                    {part === 'practical' ? 'Practical' : 'Theory'}
                                  </span>
                                  <span className="text-slate-500">{classGroup.name}</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-900 truncate mt-0.5">
                                  {subject.name}
                                </p>
                                <span className="text-[11px] text-slate-500 tabular-nums">
                                  {studentCount} students · {subject.semester} Sem
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => unassignSubject(asg.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                                title="Unassign Subject Part"
                                aria-label="Unassign Subject Part"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-[11px] text-slate-400 truncate">{teacher.email}</span>
                  <span className="text-[11px] font-medium text-slate-500 shrink-0 tabular-nums">
                    {teacherAssignments.length} assigned
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Subject Part Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Assign Course Part (Theory / Practical)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.semester} Sem] {s.code}: {s.name} ({s.credits} Credits)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  2. Select Semester Class Group
                </label>
                <select
                  aria-label="Select Class Group"
                  value={selectedClassId}
                  onChange={e => {
                    setSelectedClassId(e.target.value);
                    setAssignError(null);
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  3. Select Subject Part (Theory &amp; Practical Tracked Separately)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPart('theory');
                      setAssignError(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPart === 'theory'
                        ? 'bg-indigo-50/70 border-indigo-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Theory Part</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Classroom lectures &amp; concepts
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPart('practical');
                      setAssignError(null);
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPart === 'practical'
                        ? 'bg-emerald-50/70 border-emerald-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                      <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Practical Part</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Lab experiments &amp; sessional work
                    </p>
                  </button>
                </div>
                {currentOppositeTeacher && (
                  <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <strong>{oppositePart === 'theory' ? 'Theory' : 'Practical'}</strong> is currently taught by{' '}
                    <strong className="text-slate-900">{currentOppositeTeacher.name}</strong>. You may choose another teacher or assign the same teacher to both parts separately.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  4. Select Faculty Member
                </label>
                <select
                  aria-label="Select Faculty Member"
                  value={selectedTeacherId}
                  onChange={e => {
                    setSelectedTeacherId(e.target.value);
                    setAssignError(null);
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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

              {(assignError || !livePartValidation.valid) && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="font-medium leading-relaxed">
                    {assignError || livePartValidation.error}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Confirm {selectedPart === 'practical' ? 'Practical' : 'Theory'} Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Teacher Modal */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add Faculty Teacher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTeacher} className="mt-5 space-y-4">
              {teacherError && (
                <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teacherError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Mahmudul Hasan"
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Institutional Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. mahmudul@polytechnic.edu.bd"
                  value={teacherEmail}
                  onChange={e => setTeacherEmail(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BTEB-TCH-201"
                    value={teacherEmpId}
                    onChange={e => setTeacherEmpId(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={teacherDept}
                    onChange={e => setTeacherDept(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={teacherTitle}
                  onChange={e => setTeacherTitle(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
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
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTeacher(confirmDeleteTeacherId)}
                className="h-9 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Fresh Database Modal */}
      {showFreshDbConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Clear All Database Records?</h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Are you sure you want to clear all attendance sessions, records, student lists, and subject assignments to start with a fresh database?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFreshDbConfirm(false)}
                className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearDemoData}
                className="h-9 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Clear Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add BTEB Probidhan 2022 Course
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubjectModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 28545"
                    value={newSubCode}
                    onChange={e => setNewSubCode(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    {semesters.map(s => (
                      <option key={s} value={s}>{s} Sem</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Credits
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newSubCredits}
                    onChange={e => setNewSubCredits(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence & Machine Learning"
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Description / Syllabus
                </label>
                <textarea
                  rows={3}
                  placeholder="Course content, practical experiments, and BTEB assessment criteria..."
                  value={newSubDesc}
                  onChange={e => setNewSubDesc(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
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

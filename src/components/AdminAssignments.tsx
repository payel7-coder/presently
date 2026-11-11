import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Subject } from '../types/attendance';
import {
  School,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';

interface AdminAssignmentsProps {
  onSwitchToTeacher: (teacherId: string) => void;
}

export const AdminAssignments: React.FC<AdminAssignmentsProps> = ({ onSwitchToTeacher }) => {
  const {
    teachers,
    subjects,
    classes,
    assignments,
    assignSubjectToTeacher,
    unassignSubject,
    createSubject,
    getClassStudents,
    clearAllDemoData,
  } = useAttendance();

  // Semester Filter
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>('all');

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState(teachers[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');

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

  const filteredSubjects = selectedSemesterFilter === 'all'
    ? subjects
    : subjects.filter(s => s.semester === selectedSemesterFilter);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedSubjectId || !selectedClassId) return;

    await assignSubjectToTeacher(selectedSubjectId, selectedTeacherId, selectedClassId);

    const teacher = teachers.find(t => t.id === selectedTeacherId);
    const subject = subjects.find(s => s.id === selectedSubjectId);
    setSuccessBanner(`Assigned "${subject?.code} - ${subject?.name}" to ${teacher?.name}!`);
    setShowAssignModal(false);

    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
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

    setSuccessBanner(`Created BTEB course "${created.code} - ${created.name}"!`);
    setShowAddSubjectModal(false);
    setNewSubCode('');
    setNewSubName('');
    setNewSubDesc('');

    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
  };

  const handleClearDemoData = async () => {
    if (!window.confirm('Are you sure you want to clear all demo sessions, records, and student lists to start with a fresh database?')) {
      return;
    }
    await clearAllDemoData();
    setSuccessBanner('All demo sessions, attendance records, and student lists have been cleared. Database is fresh!');
    setTimeout(() => {
      setSuccessBanner(null);
    }, 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              BTEB Academic Director Portal
            </span>
            <span className="text-xs text-slate-500">
              Probidhan-2022 Course Allocations
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Faculty Subject Assignments (BTEB Curricula 2022)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Allocate official Bangladesh Technical Education Board (BTEB) Diploma subjects across 1st to 8th semester to teachers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleClearDemoData}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors shadow-2xs"
            title="Wipe demo records and start with a completely fresh database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Fresh Database</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddSubjectModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom BTEB Course</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <School className="w-4 h-4" />
            <span>Assign Course to Teacher</span>
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

      {/* BTEB Semester Filter Ribbon */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-600" />
            BTEB Semesters:
          </span>
          <button
            type="button"
            onClick={() => setSelectedSemesterFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedSemesterFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Semesters ({subjects.length})
          </button>
          {semesters.map(sem => {
            const count = subjects.filter(s => s.semester === sem).length;
            const isSelected = selectedSemesterFilter === sem;
            return (
              <button
                key={sem}
                type="button"
                onClick={() => setSelectedSemesterFilter(sem)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
      </div>

      {/* Teacher Cards Grid */}
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
                  <div className="flex items-center gap-3">
                    <img
                      src={teacher.avatar}
                      alt={teacher.name}
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/20"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {teacher.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{teacher.department}</p>
                      <span className="text-[10px] text-indigo-700 font-mono font-semibold">
                        {teacher.employeeId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workload Metric Bar */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Assigned Subjects
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {teacherAssignments.length} Courses
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

                {/* List of assigned BTEB subjects */}
                <div className="mt-4">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Current BTEB Probidhan 2022 Courses
                  </p>
                  {teacherAssignments.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                      <p className="text-xs text-slate-400">No BTEB subjects assigned.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeacherId(teacher.id);
                          setShowAssignModal(true);
                        }}
                        className="mt-1 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + Assign a course
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teacherAssignments.map(asg => {
                        const subject = subjects.find(s => s.id === asg.subjectId);
                        const classGroup = classes.find(c => c.id === asg.classId);
                        const studentCount = classGroup ? getClassStudents(classGroup.id).length : 0;

                        if (!subject || !classGroup) return null;

                        return (
                          <div
                            key={asg.id}
                            className="p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                  {subject.code}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {subject.semester} Sem
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {classGroup.name}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-800 truncate mt-1">
                                {subject.name}
                              </p>
                              <span className="text-[10px] text-slate-500">
                                {studentCount} Enrolled Students • {subject.credits} Credits
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => unassignSubject(asg.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Unassign Subject"
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

              {/* Bottom Switch button */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onSwitchToTeacher(teacher.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                >
                  <span>Switch to {teacher.name.split(' ')[1] || teacher.name}'s Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Assign Subject Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Assign BTEB Subject to Teacher
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
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Select Faculty Member
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={e => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Select BTEB Curricula 2022 Course
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={e => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.semester} Sem] {s.code}: {s.name} ({s.credits} Credits)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Select Semester Class Group
                </label>
                <select
                  value={selectedClassId}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {classes.map(c => {
                    const count = getClassStudents(c.id).length;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.section} ({count} Enrolled, {c.roomNumber})
                      </option>
                    );
                  })}
                </select>
              </div>

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
                  Confirm BTEB Assignment
                </button>
              </div>
            </form>
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
                    onChange={e => setNewSubSemester(e.target.value)}
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

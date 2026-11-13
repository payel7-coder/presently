import React, { useEffect, useMemo, useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { getRoleBasedVisibilityScope } from '../utils/attendanceLogic';
import { Avatar } from './Avatar';
import {
  Users,
  Search,
  Plus,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  Shield,
  X
} from 'lucide-react';

interface ClassRosterViewProps {
  onOpenBulkImport: (classId?: string) => void;
}

export const ClassRosterView: React.FC<ClassRosterViewProps> = ({ onOpenBulkImport }) => {
  const { classes, subjects, assignments, sessions, students, addStudent, deleteStudent, currentUser, isAdmin } = useAttendance();

  const visibleClasses = useMemo(
    () =>
      getRoleBasedVisibilityScope({
        currentUser,
        subjects,
        classes,
        assignments,
        sessions,
        students,
      }).visibleClasses,
    [currentUser, subjects, classes, assignments, sessions, students]
  );

  const [selectedClassId, setSelectedClassId] = useState<string>(visibleClasses[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visibleClasses.length === 0) {
      if (selectedClassId !== '') setSelectedClassId('');
      return;
    }
    if (!visibleClasses.some(c => c.id === selectedClassId)) {
      setSelectedClassId(visibleClasses[0].id);
    }
  }, [visibleClasses, selectedClassId]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoll, setNewRoll] = useState('');
  const [newRegNo, setNewRegNo] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');

  const currentClass = visibleClasses.find(c => c.id === selectedClassId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  const filteredStudents = classStudents.filter(s => {
    return (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoll.trim() || !newName.trim()) return;

    addStudent({
      rollNumber: newRoll.trim(),
      registrationNumber: newRegNo.trim() || undefined,
      name: newName.trim(),
      email: newEmail.trim() || `${newRoll.trim().toLowerCase()}@student.bteb.edu.bd`,
      gender: newGender,
      classId: selectedClassId,
      phone: newPhone.trim() || undefined,
      parentEmail: newParentEmail.trim() || undefined,
      status: 'active',
      avatar: '',
    });

    setShowAddModal(false);
    setNewRoll('');
    setNewRegNo('');
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewParentEmail('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Editorial Header */}
      <div className="pb-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700">Student Directory</span>
            <span>·</span>
            <span>Official Class Enrollment</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Class Rosters &amp; Student Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage semester batch enrollments, BTEB board roll numbers, and guardian contacts.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {currentUser?.role === 'admin' ? (
            <>
              <button
                type="button"
                onClick={() => onOpenBulkImport(selectedClassId)}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bulk CSV Import</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Single Student</span>
              </button>
            </>
          ) : (
            <div className="h-9 inline-flex items-center gap-2 px-3 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Student registration managed by administration</span>
            </div>
          )}
        </div>
      </div>

      {/* Class Group Selector */}
      {!isAdmin && visibleClasses.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200">
          <Users className="w-8 h-8 text-slate-400 mx-auto mb-2.5" />
          <h3 className="text-sm font-semibold text-slate-900">No Assigned Subject Batches Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Once the administrator assigns BTEB subjects to your account, the corresponding semester student rosters will appear here.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 tabular-nums">
          {visibleClasses.map(c => {
            const isSelected = c.id === selectedClassId;
            const count = students.filter(s => s.classId === c.id).length;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClassId(c.id)}
                className={`px-3.5 py-2 rounded-lg text-left border transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold tracking-tight">{c.name}</span>
                  <span
                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                      isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <p className={`text-[11px] truncate max-w-[160px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                  {c.section}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search & Table */}
      {(isAdmin || visibleClasses.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, roll number, or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />
            </div>

            <span className="text-xs font-medium text-slate-500 tabular-nums">
              {filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'} in {currentClass?.name} ({currentClass?.section})
            </span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-slate-700">No students found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {isAdmin
                  ? 'Use "Bulk CSV Import" to load a class list or click "Add Single Student".'
                  : 'No students have been enrolled in this class batch yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Board Roll</th>
                    <th className="py-3 px-4">Reg No</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Parent / Guardian</th>
                    <th className="py-3 px-4">Status</th>
                    {currentUser?.role === 'admin' && (
                      <th className="py-3 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {student.rollNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {student.registrationNumber || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={student.avatar} name={student.name} size="sm" />
                          <div>
                            <span className="font-semibold text-slate-900 block">{student.name}</span>
                            <span className="text-[11px] text-slate-400">{student.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{student.gender}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {student.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-700 block">
                          {student.parentEmail || '—'}
                        </span>
                        {student.parentContact && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {student.parentContact}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      </td>
                      {currentUser?.role === 'admin' && (
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteStudent(student.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete student"
                            aria-label={`Delete ${student.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Enroll Student in {currentClass?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Board Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 612034"
                    value={newRoll}
                    onChange={e => setNewRoll(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1502187391"
                    value={newRegNo}
                    onChange={e => setNewRegNo(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Naimur Rahman"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value as any)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Email
                  </label>
                  <input
                    type="email"
                    placeholder="student@academy.edu"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+8801XXXXXXXXX"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parent / Guardian Email (For Attendance Alerts)
                </label>
                <input
                  type="email"
                  placeholder="guardian@example.com"
                  value={newParentEmail}
                  onChange={e => setNewParentEmail(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

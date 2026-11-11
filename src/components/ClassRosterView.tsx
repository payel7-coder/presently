import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Student } from '../types/attendance';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
  GraduationCap
} from 'lucide-react';

interface ClassRosterViewProps {
  onOpenBulkImport: (classId?: string) => void;
}

export const ClassRosterView: React.FC<ClassRosterViewProps> = ({ onOpenBulkImport }) => {
  const { classes, students, addStudent, deleteStudent, currentUser } = useAttendance();

  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoll, setNewRoll] = useState('');
  const [newRegNo, setNewRegNo] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');

  const currentClass = classes.find(c => c.id === selectedClassId);

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
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Student Directory
            </span>
            <span className="text-xs text-slate-500">Official Class Enrollment</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Class Rosters & Student Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage student registrations, parent emergency contacts, and bulk import via CSV files.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {currentUser?.role === 'admin' ? (
            <>
              <button
                type="button"
                onClick={() => onOpenBulkImport(selectedClassId)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Bulk CSV Import</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Single Student</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold border border-slate-200/60">
              <Shield className="w-3.5 h-3.5 text-slate-500" />
              <span>Student Import & Registration (Admin Only)</span>
            </div>
          )}
        </div>
      </div>

      {/* Class Group Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {classes.map(c => {
          const isSelected = c.id === selectedClassId;
          const count = students.filter(s => s.classId === c.id).length;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedClassId(c.id)}
              className={`px-4 py-2.5 rounded-xl text-left border transition-all shrink-0 ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/10'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold tracking-tight">{c.name}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count} Students
                </span>
              </div>
              <p className="text-[11px] opacity-80 truncate max-w-[160px] mt-0.5">
                {c.section}
              </p>
            </button>
          );
        })}
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, roll number, or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <span className="text-xs font-bold text-slate-500">
            {filteredStudents.length} Students in {currentClass?.name} ({currentClass?.section})
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No students found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Use "Bulk CSV Import" to load a complete class list or click "Add Single Student".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Board Roll</th>
                  <th className="py-3 px-4">Reg No</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Student Contact</th>
                  <th className="py-3 px-4">Parent Guardian</th>
                  <th className="py-3 px-4">Status</th>
                  {currentUser?.role === 'admin' && (
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {student.rollNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {student.registrationNumber || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{student.name}</span>
                          <span className="text-[10px] text-slate-500">{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{student.gender}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {student.phone || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700 font-medium block">
                        {student.parentEmail || '—'}
                      </span>
                      {student.parentContact && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {student.parentContact}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    </td>
                    {currentUser?.role === 'admin' && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => deleteStudent(student.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete student"
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

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Enroll Student in {currentClass?.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Board Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 612034"
                    value={newRoll}
                    onChange={e => setNewRoll(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono uppercase font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registration Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1502187391"
                    value={newRegNo}
                    onChange={e => setNewRegNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Naimur Rahman"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={newGender}
                    onChange={e => setNewGender(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Email
                  </label>
                  <input
                    type="email"
                    placeholder="student@academy.edu"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Student Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Parent / Guardian Email (For Attendance Alerts)
                </label>
                <input
                  type="email"
                  placeholder="parent.anderson@gmail.com"
                  value={newParentEmail}
                  onChange={e => setNewParentEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  calculateUserTeachingSummary,
  UserProfileEditableInput,
} from '../utils/userProfileLogic';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Mail,
  Receipt,
  RotateCcw,
  Save,
  Trash2,
  User as UserIcon,
  AlertCircle,
  X,
} from 'lucide-react';

interface UserProfileViewProps {
  onBack: () => void;
}

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const DESIGNATION_SUGGESTIONS = [
  'Instructor (Computer Technology)',
  'Junior Instructor (Computer Technology)',
  'Chief Instructor (Computer Technology)',
  'Head of Department (CST)',
  'Senior Lecturer',
  'Academic Director & BTEB Coordinator',
  'Institutional Administrator',
];

function createDraftFromUser(user: NonNullable<ReturnType<typeof useAttendance>['currentUser']>): UserProfileEditableInput {
  return {
    name: user.name || '',
    department: user.department || 'Computer Science & Technology',
    employeeId: user.employeeId || '',
    title: user.title || '',
    phone: user.phone || '',
    qualification: user.qualification || '',
    specialization: user.specialization || '',
    officeRoom: user.officeRoom || '',
    officeHours: user.officeHours || '',
    joiningDate: user.joiningDate || '',
    bloodGroup: user.bloodGroup || '',
    bio: user.bio || '',
    dailyClassTarget: user.dailyClassTarget || 4,
    avatar: user.avatar && !user.avatar.includes('images.unsplash.com') ? user.avatar : '',
  };
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onBack }) => {
  const {
    currentUser,
    assignments,
    subjects,
    classes,
    sessions,
    courseworkAssignments,
    formFillupResponsibilities,
    updateCurrentUserProfile,
  } = useAttendance();

  const [draft, setDraft] = useState<UserProfileEditableInput>(() =>
    currentUser
      ? createDraftFromUser(currentUser)
      : { name: '', department: '', employeeId: '', dailyClassTarget: 4 }
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser && !hasUnsavedChanges) {
      setDraft(createDraftFromUser(currentUser));
    }
  }, [currentUser, hasUnsavedChanges]);

  const portfolio = useMemo(() => {
    if (!currentUser) return null;
    return calculateUserTeachingSummary({
      user: {
        ...currentUser,
        ...draft,
        dailyClassTarget: draft.dailyClassTarget || currentUser.dailyClassTarget || 4,
      },
      assignments,
      subjects,
      classes,
      sessions,
      courseworkAssignments,
      formFillupResponsibilities,
    });
  }, [
    currentUser,
    draft,
    assignments,
    subjects,
    classes,
    sessions,
    courseworkAssignments,
    formFillupResponsibilities,
  ]);

  if (!currentUser || !portfolio) return null;

  const updateField = <K extends keyof UserProfileEditableInput>(
    key: K,
    value: UserProfileEditableInput[K]
  ) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid PNG, JPG, or WebP image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setErrorMessage('Unable to process image in this browser.');
          return;
        }
        // Center-crop square portrait
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        updateField('avatar', compressedDataUrl);
      };
      img.onerror = () => {
        setErrorMessage('Unable to read the selected image file.');
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReset = () => {
    setDraft(createDraftFromUser(currentUser));
    setHasUnsavedChanges(false);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSaving(true);
    try {
      const saved = await updateCurrentUserProfile(draft);
      setDraft(createDraftFromUser(saved));
      setHasUnsavedChanges(false);
      setStatusMessage(
        `Profile updated and saved to Cloud Firestore for ${saved.name}.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Breadcrumb & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspace</span>
          </button>

          <nav
            aria-label="User Profile Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-slate-500"
          >
            <span>{currentUser.role === 'admin' ? 'Administration' : 'Faculty Portal'}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900">My Profile &amp; Settings</span>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Discard Changes</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving Profile...' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5"
            aria-label="Dismiss status alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Faculty Profile Header Dossier Card */}
      <section
        aria-label="Faculty Member Profile Header"
        className="bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Bangladesh Technical Education Board ·{' '}
              {currentUser.role === 'admin'
                ? 'Institutional Administrator Profile'
                : 'Faculty & Instructor Academic Profile'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300 tabular-nums">
            Employee ID: {draft.employeeId || currentUser.employeeId}
          </div>
        </div>

        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
            <div className="relative shrink-0 self-start">
              <div className="p-1 rounded-xl border border-slate-200 bg-slate-50">
                <Avatar
                  src={draft.avatar}
                  name={draft.name || currentUser.name}
                  size="xl"
                  className="w-16 h-16 text-lg"
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                aria-label="Upload profile photo"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-emerald-700">
                  {currentUser.role === 'admin' ? 'Administrator' : 'Faculty Member'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{draft.department || currentUser.department}</span>
                {draft.officeRoom && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{draft.officeRoom}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 truncate">
                {draft.name || currentUser.name}
              </h1>

              <p className="text-xs text-slate-600 mt-1">
                {draft.title || 'BTEB Academic Instructor'}
                {draft.qualification ? ` · ${draft.qualification}` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{draft.avatar ? 'Change Photo' : 'Upload Photo'}</span>
                </button>
                {draft.avatar && (
                  <button
                    type="button"
                    onClick={() => updateField('avatar', '')}
                    className="h-8 px-3 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Use Initials</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 text-xs text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {currentUser.email}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <Lock className="w-3 h-3 text-slate-400" />
              Role ({currentUser.role}) &amp; institutional email managed by admin
            </span>
          </div>
        </div>

        {/* 4-Column Tabular Academic Portfolio KPI Strip */}
        <div className="border-t border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 tabular-nums">
          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Assigned Course Parts
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {portfolio.allocations.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Across {portfolio.distinctCoursesCount} BTEB curriculum subject(s)
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Sessions Conducted
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {portfolio.sessionsConductedCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {portfolio.assignmentsCreatedCount} coursework assignment(s) published
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Form Fill-up Duties
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {portfolio.coordinatorSemesters.length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {portfolio.coordinatorSemesters.length > 0
                ? portfolio.coordinatorSemesters.join(', ')
                : 'No coordinator duty assigned'}
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Daily Class Target
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
              {draft.dailyClassTarget || 4} / day
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Profile completion: {portfolio.completenessPercent}%
            </p>
          </div>
        </div>
      </section>

      {/* Main 2-Column Faculty Profile Form & Live Teaching Portfolio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Editable Faculty Profile Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Faculty &amp; Academic Profile Information
              </h2>
              <p className="text-xs text-slate-500">
                Set your academic title, department credentials, office hours, and teaching preferences.
              </p>
            </div>
            {hasUnsavedChanges && (
              <span className="text-[11px] font-semibold text-amber-700">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5 text-xs">
            {/* Section 1: Core Institutional Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="user-profile-name"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="user-profile-name"
                  type="text"
                  required
                  value={draft.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g. Engr. Mahmudul Hasan"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-employee-id"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Employee / Faculty ID <span className="text-rose-500">*</span>
                </label>
                <input
                  id="user-profile-employee-id"
                  type="text"
                  required
                  value={draft.employeeId}
                  onChange={e => updateField('employeeId', e.target.value)}
                  placeholder="e.g. BTEB-TCH-104"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="user-profile-title"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Designation / Academic Title
                </label>
                <input
                  id="user-profile-title"
                  type="text"
                  list="faculty-designations"
                  value={draft.title || ''}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder="e.g. Instructor (Computer Technology)"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
                <datalist id="faculty-designations">
                  {DESIGNATION_SUGGESTIONS.map(item => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="user-profile-department"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Department <span className="text-rose-500">*</span>
                </label>
                <input
                  id="user-profile-department"
                  type="text"
                  required
                  value={draft.department}
                  onChange={e => updateField('department', e.target.value)}
                  placeholder="Computer Science & Technology"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Section 2: Academic Credentials & Specialization */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="user-profile-qualification"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Highest Academic Qualification
                </label>
                <input
                  id="user-profile-qualification"
                  type="text"
                  value={draft.qualification || ''}
                  onChange={e => updateField('qualification', e.target.value)}
                  placeholder="e.g. B.Sc. in CSE (DUET)"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-specialization"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Subject Specialization / Research Area
                </label>
                <input
                  id="user-profile-specialization"
                  type="text"
                  value={draft.specialization || ''}
                  onChange={e => updateField('specialization', e.target.value)}
                  placeholder="e.g. Database Systems, IoT & Embedded Tech"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Section 3: Office Hours, Room & Teaching Target */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="user-profile-office-room"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Office Room / Faculty Desk
                </label>
                <input
                  id="user-profile-office-room"
                  type="text"
                  value={draft.officeRoom || ''}
                  onChange={e => updateField('officeRoom', e.target.value)}
                  placeholder="e.g. Bhaban-2, Room 304"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-office-hours"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Counseling / Office Hours
                </label>
                <input
                  id="user-profile-office-hours"
                  type="text"
                  value={draft.officeHours || ''}
                  onChange={e => updateField('officeHours', e.target.value)}
                  placeholder="e.g. Sun–Thu, 11 AM – 1 PM"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-daily-target"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Daily Class Target (1–20)
                </label>
                <input
                  id="user-profile-daily-target"
                  type="number"
                  min={1}
                  max={20}
                  value={draft.dailyClassTarget ?? 4}
                  onChange={e =>
                    updateField(
                      'dailyClassTarget',
                      Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10) || 1))
                    )
                  }
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Section 4: Contact, Joining Date & Blood Group */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="user-profile-phone"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Contact Phone
                </label>
                <input
                  id="user-profile-phone"
                  type="text"
                  value={draft.phone || ''}
                  onChange={e => updateField('phone', e.target.value)}
                  placeholder="+8801XXXXXXXXX"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-joining-date"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Joining Date
                </label>
                <input
                  id="user-profile-joining-date"
                  type="date"
                  value={draft.joiningDate || ''}
                  onChange={e => updateField('joiningDate', e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="user-profile-blood-group"
                  className="block font-semibold text-slate-700 mb-1.5"
                >
                  Blood Group
                </label>
                <select
                  id="user-profile-blood-group"
                  value={draft.bloodGroup || ''}
                  onChange={e => updateField('bloodGroup', e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                >
                  <option value="">Select...</option>
                  {BLOOD_GROUPS.filter(Boolean).map(bg => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Faculty Bio */}
            <div>
              <label
                htmlFor="user-profile-bio"
                className="block font-semibold text-slate-700 mb-1.5"
              >
                Academic Biography &amp; Teaching Focus
              </label>
              <textarea
                id="user-profile-bio"
                rows={3}
                maxLength={600}
                value={draft.bio || ''}
                onChange={e => updateField('bio', e.target.value)}
                placeholder="Brief summary of courses taught, lab supervision, and academic advisory role..."
                className="w-full p-3 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 resize-y"
              />
            </div>
          </div>

          <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              {currentUser.profileUpdatedAt
                ? `Last updated: ${currentUser.profileUpdatedAt.split('T')[0]}`
                : 'Complete your faculty profile for institutional registers and headers'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasUnsavedChanges || isSaving}
                className="h-9 px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 disabled:opacity-40 rounded-lg transition-colors"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Right: Teaching Allocations & Profile Completeness */}
        <div className="lg:col-span-4 space-y-6">
          {/* Profile Completeness */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-600" />
                <span>Profile Completeness</span>
              </h3>
              <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                {portfolio.completenessPercent}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${portfolio.completenessPercent}%` }}
              />
            </div>
            {portfolio.missingFields.length > 0 ? (
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                Remaining optional details:{' '}
                <span className="text-slate-700 font-medium">
                  {portfolio.missingFields.join(', ')}
                </span>
                .
              </p>
            ) : (
              <p className="mt-3 text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>All faculty profile fields are filled out.</span>
              </p>
            )}
          </div>

          {/* Assigned Course Parts */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Allocated Courses
                </h3>
                <p className="text-xs text-slate-500">
                  Admin-assigned Theory &amp; Practical parts
                </p>
              </div>
              <BookOpen className="w-4 h-4 text-slate-400" />
            </div>

            {portfolio.allocations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No courses assigned yet by administration.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {portfolio.allocations.map(item => (
                  <div
                    key={item.assignmentId}
                    className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-slate-900">
                          {item.subjectCode}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {item.subjectName}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {item.semesterName} · {item.credits} Credits
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        item.part === 'practical' ? 'text-indigo-700' : 'text-emerald-700'
                      }`}
                    >
                      {item.part === 'practical' ? 'Practical' : 'Theory'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coordinator Responsibilities */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Coordinator Responsibilities</span>
            </h3>
            {portfolio.coordinatorSemesters.length === 0 ? (
              <p className="text-xs text-slate-500 mt-2">
                Not currently assigned as a Semester Form Fill-up Coordinator.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                {portfolio.coordinatorSemesters.map(sem => (
                  <li key={sem} className="flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">{sem} Form Fill-up Desk</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
              <ClipboardCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                Course allocations and coordinator duties are managed by the department administrator.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

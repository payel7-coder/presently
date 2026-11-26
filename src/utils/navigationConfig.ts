export type NavIconKey =
  | 'book-open'
  | 'user-check'
  | 'clipboard-list'
  | 'receipt'
  | 'bar-chart-3'
  | 'users'
  | 'school';

export interface NavMenuItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: NavIconKey;
}

export const TEACHER_NAV_ITEMS: NavMenuItem[] = [
  {
    id: 'my-subjects',
    label: 'My Subjects',
    shortLabel: 'Subjects',
    description: 'Assigned theory & practical courses',
    icon: 'book-open',
  },
  {
    id: 'take-attendance',
    label: 'Attendance',
    shortLabel: 'Roll Call',
    description: 'Record & edit daily class roll call',
    icon: 'user-check',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    shortLabel: 'Tasks',
    description: 'Coursework tracker & grading',
    icon: 'clipboard-list',
  },
  {
    id: 'form-fillup',
    label: 'Form Fill-up',
    shortLabel: 'Fill-up',
    description: 'Semester exam eligibility & fee ledger',
    icon: 'receipt',
  },
  {
    id: 'reports',
    label: 'Reports',
    shortLabel: 'Reports',
    description: 'Attendance ledgers & PDF exports',
    icon: 'bar-chart-3',
  },
  {
    id: 'roster',
    label: 'Students',
    shortLabel: 'Students',
    description: 'Class rosters & student profiles',
    icon: 'users',
  },
];

export const ADMIN_NAV_ITEMS: NavMenuItem[] = [
  {
    id: 'admin-assignments',
    label: 'Subject Allocation',
    shortLabel: 'Allocate',
    description: 'Faculty assignments & user approvals',
    icon: 'school',
  },
  {
    id: 'admin-classes',
    label: 'Batches & Students',
    shortLabel: 'Students',
    description: 'Semester batches & student directory',
    icon: 'users',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    shortLabel: 'Tasks',
    description: 'Coursework tracker & grading',
    icon: 'clipboard-list',
  },
  {
    id: 'form-fillup',
    label: 'Form Fill-up',
    shortLabel: 'Fill-up',
    description: 'Exam fees, invoices & BTEB sheets',
    icon: 'receipt',
  },
  {
    id: 'reports',
    label: 'Reports',
    shortLabel: 'Reports',
    description: 'Attendance ledgers & PDF exports',
    icon: 'bar-chart-3',
  },
];

export function getNavItemsForRole(role: 'admin' | 'teacher'): NavMenuItem[] {
  return role === 'teacher' ? TEACHER_NAV_ITEMS : ADMIN_NAV_ITEMS;
}

export function getActiveNavLabel(role: 'admin' | 'teacher', activeTab: string): string {
  const match = getNavItemsForRole(role).find(item => item.id === activeTab);
  if (match) return match.shortLabel;
  if (activeTab === 'user-profile') return 'Profile';
  if (activeTab === 'student-profile') return 'Student';
  return '';
}

export function formatAttendanceTopbarContext(
  subjectCode?: string | null,
  date?: string | null
): string {
  const parts = [subjectCode?.trim(), date?.trim()].filter((v): v is string => Boolean(v));
  return parts.join(' · ');
}

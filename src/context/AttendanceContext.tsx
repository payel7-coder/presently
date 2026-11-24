import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  AssignmentSubmissionStatus,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  ClassGroup,
  CourseworkAssignment,
  FormFillupFeeConfig,
  FormFillupPaymentStatus,
  FormFillupResponsibility,
  FormFillupResultStatus,
  FormFillupStudentRecord,
  Student,
  StudentAssignmentEvaluation,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
} from '../types/attendance';
import {
  BTEB_CLASSES,
  BTEB_CURRICULUM_2022_SUBJECTS,
} from '../data/btebCurriculum';
import {
  validateSubjectPartAssignment,
  resolveUserApprovalStatus,
  evaluateLoginAccess,
  getPendingUsers,
  getApprovedTeachers,
  isPrimaryAdminEmail,
  resolveRollCallForSave,
  RollCallDraftEntry,
} from '../utils/attendanceLogic';
import {
  validateCourseworkInput,
  validateEvaluationScore,
} from '../utils/courseworkLogic';
import {
  calculateStudentFormFillupFee,
  canEditFormFillupFeeConfig,
  createDefaultFeeConfig,
  normalizeResultInput,
  validateFeeConfig,
} from '../utils/formFillupLogic';
import {
  buildUserProfileUpdatePayload,
  UserProfileEditableInput,
} from '../utils/userProfileLogic';
import { db, auth } from '../firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';

interface NewTeacherInput {
  name: string;
  email: string;
  department?: string;
  employeeId?: string;
  title?: string;
  dailyClassTarget?: number;
}

export interface RegisterResult {
  user: User;
  requiresApproval: boolean;
}

interface AttendanceContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  accessToken: string | null;
  users: User[];
  teachers: User[];
  pendingUsers: User[];
  classes: ClassGroup[];
  subjects: Subject[];
  assignments: SubjectAssignment[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  courseworkAssignments: CourseworkAssignment[];
  studentEvaluations: StudentAssignmentEvaluation[];
  formFillupResponsibilities: FormFillupResponsibility[];
  formFillupFeeConfigs: FormFillupFeeConfig[];
  formFillupRecords: FormFillupStudentRecord[];

  // Permissions & Auth
  isAuthenticated: boolean;
  isAdmin: boolean;
  canImportStudents: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  registerWithEmail: (email: string, pass: string, name: string, role: 'admin' | 'teacher') => Promise<RegisterResult>;
  requestPasswordReset: (email: string) => Promise<string>;
  verifyActiveSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  isFirebaseLive: boolean;

  // Teacher helpers
  getTeacherSubjects: (teacherId: string) => { subject: Subject; classGroup: ClassGroup; assignment: SubjectAssignment }[];
  getClassStudents: (classId: string) => Student[];
  getSubjectsBySemester: (semester: string) => Subject[];
  setDailyClassTarget: (target: number) => Promise<void>;
  updateCurrentUserProfile: (input: UserProfileEditableInput) => Promise<User>;

  // Admin actions (Restricted)
  addTeacher: (teacher: NewTeacherInput) => Promise<User>;
  deleteTeacher: (teacherId: string) => Promise<void>;
  approveUserRegistration: (userId: string) => Promise<void>;
  rejectUserRegistration: (userId: string, removeRecord?: boolean) => Promise<void>;
  assignSubjectToTeacher: (subjectId: string, teacherId: string, classId: string, part: SubjectPart) => Promise<void>;
  unassignSubject: (assignmentId: string) => Promise<void>;
  createSubject: (subject: Omit<Subject, 'id'>) => Promise<Subject>;
  bulkImportStudents: (classId: string, newStudents: Omit<Student, 'id'>[]) => Promise<number>;
  addStudent: (student: Omit<Student, 'id'>) => Promise<Student>;
  updateStudent: (student: Student) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;

  // Attendance actions
  saveAttendanceSession: (
    sessionDetails: {
      id?: string;
      subjectId: string;
      classId: string;
      teacherId: string;
      part?: SubjectPart;
      date: string;
      timeSlot?: string;
      topic?: string;
    },
    studentStatuses: Record<string, RollCallDraftEntry>
  ) => Promise<AttendanceSession>;

  getSessionByDate: (subjectId: string, date: string, part?: SubjectPart) => AttendanceSession | undefined;
  getSessionRecords: (sessionId: string) => AttendanceRecord[];

  // Coursework & Student Evaluation actions
  createCourseworkAssignment: (input: {
    title: string;
    description?: string;
    subjectId: string;
    classId: string;
    part: SubjectPart;
    assignedDate: string;
    dueDate: string;
    maxMarks: number;
  }) => Promise<CourseworkAssignment>;
  deleteCourseworkAssignment: (courseworkId: string) => Promise<void>;
  saveStudentEvaluations: (
    courseworkId: string,
    entries: Array<{
      studentId: string;
      status: AssignmentSubmissionStatus;
      marksObtained?: number | null;
      feedback?: string;
    }>
  ) => Promise<void>;

  // Form Fill-up Coordinator & Fee Calculation actions
  assignFormFillupCoordinator: (semester: string, classId: string, teacherId: string) => Promise<void>;
  unassignFormFillupCoordinator: (responsibilityId: string) => Promise<void>;
  saveFormFillupFeeConfig: (
    config: Omit<FormFillupFeeConfig, 'id' | 'updatedAt' | 'updatedBy'>
  ) => Promise<FormFillupFeeConfig>;
  saveFormFillupRecords: (
    semester: string,
    classId: string,
    entries: Array<{
      studentId: string;
      resultStatus: FormFillupResultStatus;
      referredSubjectsCount: number;
      referredSemestersCount: number;
      practicalSubjectsCount: number;
      applyDelayFee: boolean;
      resultSummaryNote?: string;
      paymentStatus: FormFillupPaymentStatus;
    }>,
    feeConfigOverride?: FormFillupFeeConfig
  ) => Promise<void>;

  resetToDefaultBTEBData: () => Promise<void>;
  clearAllDemoData: () => Promise<void>;
}

const DEMO_USER_IDS = new Set([
  'teacher-tanvir',
  'teacher-nusrat',
  'teacher-hasan',
  'admin-principal',
]);

const STATIC_SESSION_TOKEN = 'firebase-static-session';
const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE_URL || '').replace(/\/+$/, '');
const resolveAuthApiUrl = (path: string) => `${AUTH_API_BASE}${path}`;

const isKnownStaticHosting = () =>
  !AUTH_API_BASE &&
  typeof window !== 'undefined' &&
  (window.location.hostname.endsWith('.github.io') || window.location.protocol === 'file:');

const isStaticHostMissingApi = (response: Response) => {
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  return !ct.includes('application/json') && [404, 405, 501].includes(response.status);
};

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Active session is held strictly in JS/React memory when backed by Express; static GitHub Pages restores local session
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    if (!isKnownStaticHosting()) return null;
    try {
      const saved = localStorage.getItem('presently_active_user');
      return saved ? (JSON.parse(saved) as User) : null;
    } catch {
      return null;
    }
  });
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    if (!isKnownStaticHosting()) return null;
    try {
      return localStorage.getItem('presently_active_user') ? STATIC_SESSION_TOKEN : null;
    } catch {
      return null;
    }
  });
  const accessTokenRef = useRef<string | null>(accessToken);

  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>(BTEB_CLASSES);
  const [subjects, setSubjects] = useState<Subject[]>(BTEB_CURRICULUM_2022_SUBJECTS);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [courseworkAssignments, setCourseworkAssignments] = useState<CourseworkAssignment[]>([]);
  const [studentEvaluations, setStudentEvaluations] = useState<StudentAssignmentEvaluation[]>([]);
  const [formFillupResponsibilities, setFormFillupResponsibilities] = useState<FormFillupResponsibility[]>([]);
  const [formFillupFeeConfigs, setFormFillupFeeConfigs] = useState<FormFillupFeeConfig[]>([]);
  const [formFillupRecords, setFormFillupRecords] = useState<FormFillupStudentRecord[]>([]);
  const [isFirebaseLive, setIsFirebaseLive] = useState(false);

  // Clear legacy localStorage auth state on boot when Express server auth is active
  useEffect(() => {
    if (isKnownStaticHosting()) return;
    try {
      localStorage.removeItem('presently_active_user');
    } catch {
      // Ignore storage access restrictions
    }
  }, []);

  // Helper to initialize Firestore with BTEB 2022 classes & subjects only (no demo faculty/students)
  const seedInitialFirestore = async () => {
    try {
      const snap = await getDocs(collection(db, 'classes'));
      if (snap.empty) {
        const batch = writeBatch(db);

        BTEB_CLASSES.forEach(c => {
          batch.set(doc(db, 'classes', c.id), c);
        });

        BTEB_CURRICULUM_2022_SUBJECTS.forEach(s => {
          batch.set(doc(db, 'subjects', s.id), s);
        });

        await batch.commit();
        setIsFirebaseLive(true);
      }
    } catch (e) {
      console.warn('Seeding initial Firestore skipped or handled locally:', e);
    }
  };

  // Real-time Firestore Listeners (Firestore is the single source of truth, including empty states)
  useEffect(() => {
    let unsubClasses: () => void;
    let unsubSubjects: () => void;
    let unsubAssignments: () => void;
    let unsubStudents: () => void;
    let unsubSessions: () => void;
    let unsubRecords: () => void;
    let unsubUsers: () => void;
    let unsubCoursework: () => void;
    let unsubEvaluations: () => void;
    let unsubFormResp: () => void;
    let unsubFormFeeConfigs: () => void;
    let unsubFormRecords: () => void;

    try {
      // 1. Classes listener
      unsubClasses = onSnapshot(collection(db, 'classes'), snapshot => {
        if (!snapshot.empty) {
          const list: ClassGroup[] = [];
          snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
          setClasses(list);
          setIsFirebaseLive(true);
        } else {
          seedInitialFirestore();
        }
      }, err => console.warn('Classes listener fallback:', err));

      // 2. Subjects listener (BTEB Curricula 2022)
      unsubSubjects = onSnapshot(collection(db, 'subjects'), snapshot => {
        if (!snapshot.empty) {
          const list: Subject[] = [];
          snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
          setSubjects(list);
          setIsFirebaseLive(true);
        }
      }, err => console.warn('Subjects listener fallback:', err));

      // 3. Assignments listener
      unsubAssignments = onSnapshot(collection(db, 'assignments'), snapshot => {
        const list: SubjectAssignment[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            ...data,
            part: data.part === 'practical' ? 'practical' : 'theory',
          });
        });
        setAssignments(list);
      }, err => console.warn('Assignments listener fallback:', err));

      // 4. Students listener
      unsubStudents = onSnapshot(collection(db, 'students'), snapshot => {
        const list: Student[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setStudents(list);
      }, err => console.warn('Students listener fallback:', err));

      // 5. Sessions listener
      unsubSessions = onSnapshot(collection(db, 'sessions'), snapshot => {
        const list: AttendanceSession[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setSessions(list);
      }, err => console.warn('Sessions listener fallback:', err));

      // 6. Records listener
      unsubRecords = onSnapshot(collection(db, 'records'), snapshot => {
        const list: AttendanceRecord[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setRecords(list);
      }, err => console.warn('Records listener fallback:', err));

      // 7. Users listener (no hardcoded demo teachers merged)
      unsubUsers = onSnapshot(collection(db, 'users'), snapshot => {
        const list: User[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setUsers(list);
      }, err => console.warn('Users listener fallback:', err));

      // 8. Coursework assignments listener
      unsubCoursework = onSnapshot(collection(db, 'courseworkAssignments'), snapshot => {
        const list: CourseworkAssignment[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            ...data,
            part: data.part === 'practical' ? 'practical' : 'theory',
          });
        });
        setCourseworkAssignments(list);
      }, err => console.warn('Coursework listener fallback:', err));

      // 9. Student evaluations listener
      unsubEvaluations = onSnapshot(collection(db, 'studentEvaluations'), snapshot => {
        const list: StudentAssignmentEvaluation[] = [];
        snapshot.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            ...data,
            part: data.part === 'practical' ? 'practical' : 'theory',
          });
        });
        setStudentEvaluations(list);
      }, err => console.warn('Evaluations listener fallback:', err));

      // 10. Form Fill-up responsibilities listener
      unsubFormResp = onSnapshot(collection(db, 'formFillupResponsibilities'), snapshot => {
        const list: FormFillupResponsibility[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setFormFillupResponsibilities(list);
      }, err => console.warn('Form fill-up responsibilities listener fallback:', err));

      // 11. Form Fill-up fee configs listener
      unsubFormFeeConfigs = onSnapshot(collection(db, 'formFillupFeeConfigs'), snapshot => {
        const list: FormFillupFeeConfig[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setFormFillupFeeConfigs(list);
      }, err => console.warn('Form fill-up fee configs listener fallback:', err));

      // 12. Form Fill-up student records listener
      unsubFormRecords = onSnapshot(collection(db, 'formFillupRecords'), snapshot => {
        const list: FormFillupStudentRecord[] = [];
        snapshot.forEach(d => list.push({ id: d.id, ...(d.data() as any) }));
        setFormFillupRecords(list);
      }, err => console.warn('Form fill-up records listener fallback:', err));

    } catch (e) {
      console.error('Error mounting Firestore real-time listeners:', e);
    }

    return () => {
      unsubClasses?.();
      unsubSubjects?.();
      unsubAssignments?.();
      unsubStudents?.();
      unsubSessions?.();
      unsubRecords?.();
      unsubUsers?.();
      unsubCoursework?.();
      unsubEvaluations?.();
      unsubFormResp?.();
      unsubFormFeeConfigs?.();
      unsubFormRecords?.();
    };
  }, []);

  const setAccessToken = (token: string | null) => {
    accessTokenRef.current = token;
    setAccessTokenState(token);
  };

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    if (!user) {
      setAccessToken(null);
    }
  };

  const verifyActiveSession = useCallback(async (): Promise<boolean> => {
    const token = accessTokenRef.current;
    if (!token) return false;
    if (token === STATIC_SESSION_TOKEN || isKnownStaticHosting()) return true;
    try {
      const res = await fetch(resolveAuthApiUrl('/api/auth/me'), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (isStaticHostMissingApi(res)) {
        return true;
      }
      if (!res.ok) {
        setAccessToken(null);
        setCurrentUserState(null);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }, []);

  // Re-verify active JWT against server on window focus / periodic check so password resets sign out active tabs immediately
  useEffect(() => {
    if (!accessToken || !currentUser) return;
    const onFocus = () => {
      verifyActiveSession();
    };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      verifyActiveSession();
    }, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [accessToken, currentUser, verifyActiveSession]);

  // Guard active session against live approval revocation or rejection
  useEffect(() => {
    if (!currentUser || isPrimaryAdminEmail(currentUser.email)) return;
    const syncedUser = users.find(
      u => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase()
    );
    if (syncedUser && !evaluateLoginAccess(syncedUser).allowed) {
      setAccessToken(null);
      setCurrentUserState(null);
      signOut(auth).catch(() => {});
    }
  }, [users, currentUser]);

  const isAuthenticated = Boolean(currentUser && accessToken);
  const isAdmin = currentUser?.role === 'admin';
  const canImportStudents = Boolean(isAdmin);

  const teachers = getApprovedTeachers(users);
  const pendingUsers = getPendingUsers(users);

  const getTeacherSubjects = (teacherId: string) => {
    const teacherAssignments = assignments.filter(a => a.teacherId === teacherId);
    return teacherAssignments
      .map(assignment => {
        const subject = subjects.find(s => s.id === assignment.subjectId);
        const classGroup = classes.find(c => c.id === assignment.classId);
        if (subject && classGroup) {
          return {
            subject,
            classGroup,
            assignment: {
              ...assignment,
              part: assignment.part || 'theory',
            },
          };
        }
        return null;
      })
      .filter((item): item is { subject: Subject; classGroup: ClassGroup; assignment: SubjectAssignment } => item !== null)
      .sort((a, b) => {
        const codeCmp = a.subject.code.localeCompare(b.subject.code);
        if (codeCmp !== 0) return codeCmp;
        const partOrder = (p: SubjectPart) => (p === 'theory' ? 0 : 1);
        return partOrder(a.assignment.part) - partOrder(b.assignment.part);
      });
  };

  const getClassStudents = (classId: string) => {
    return students.filter(s => s.classId === classId && s.status === 'active');
  };

  const getSubjectsBySemester = (semester: string) => {
    return subjects.filter(s => s.semester === semester);
  };

  const setDailyClassTarget = async (target: number) => {
    const validTarget = Math.max(1, Math.min(20, Math.round(target || 1)));
    if (!currentUser) return;

    const updatedUser: User = {
      ...currentUser,
      dailyClassTarget: validTarget,
    };

    setCurrentUserState(updatedUser);
    localStorage.setItem(`presently_daily_target_${currentUser.id}`, validTarget.toString());

    setUsers(prev => prev.map(u => (u.id === currentUser.id ? updatedUser : u)));

    try {
      const cleanUser: any = { ...updatedUser };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', currentUser.id), cleanUser, { merge: true });
    } catch (e) {
      console.warn('Syncing dailyClassTarget to Firestore:', e);
    }
  };

  const updateCurrentUserProfile = async (input: UserProfileEditableInput): Promise<User> => {
    if (!currentUser) {
      throw new Error('You must be signed in to update your profile.');
    }

    const validation = buildUserProfileUpdatePayload(currentUser, input);
    if (!validation.valid || !validation.updatedUser) {
      throw new Error(validation.error || 'Please check your profile details and try again.');
    }

    const updatedUser = validation.updatedUser;

    setCurrentUserState(updatedUser);
    if (typeof updatedUser.dailyClassTarget === 'number') {
      localStorage.setItem(
        `presently_daily_target_${updatedUser.id}`,
        updatedUser.dailyClassTarget.toString()
      );
    }
    setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));

    try {
      const cleanUser: any = { ...updatedUser };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', updatedUser.id), cleanUser);
    } catch (e) {
      console.warn('Syncing updated user profile to Firestore:', e);
      throw new Error('Profile saved locally, but Cloud Firestore sync failed. Please retry.');
    }

    return updatedUser;
  };

  const syncUsersDirectoryToServer = useCallback(async (userList: User[], tokenOverride?: string | null) => {
    const token = tokenOverride ?? accessTokenRef.current;
    if (!token || token === STATIC_SESSION_TOKEN || isKnownStaticHosting() || userList.length === 0) return;
    try {
      await fetch(resolveAuthApiUrl('/api/auth/admin/sync-users'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          users: userList.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            approvalStatus: resolveUserApprovalStatus(u),
          })),
        }),
      });
    } catch (e) {
      console.warn('Auth directory sync skipped:', e);
    }
  }, []);

  // Automatically sync Firestore faculty directory into server auth DB when Admin is authenticated
  useEffect(() => {
    if (isAdmin && accessToken && users.length > 0) {
      syncUsersDirectoryToServer(users, accessToken);
    }
  }, [isAdmin, accessToken, users, syncUsersDirectoryToServer]);

  const buildInstitutionalProfile = (cleanEmail: string, uid: string): User => {
    const isDesignatedAdmin =
      cleanEmail === 'payelahmed70@gmail.com' ||
      cleanEmail.includes('admin') ||
      cleanEmail.includes('principal');
    const role: 'admin' | 'teacher' = isDesignatedAdmin ? 'admin' : 'teacher';

    if (cleanEmail === 'payelahmed70@gmail.com') {
      return {
        id: uid,
        name: 'Engr. Payel Ahmed',
        email: cleanEmail,
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        department: 'Polytechnic Administration & Academic Affairs',
        employeeId: 'BTEB-DIR-70',
        title: 'Academic Director & BTEB Coordinator',
      };
    }

    return {
      id: uid,
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      role,
      avatar: role === 'admin'
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      department: 'Computer Science & Technology',
      employeeId: role === 'admin' ? `BTEB-ADM-${uid.slice(-4)}` : `BTEB-TCH-${uid.slice(-4)}`,
      title: role === 'admin' ? 'Institutional Administrator' : 'Instructor (Computer Technology)',
      dailyClassTarget: 4,
    };
  };

  const findUserByEmailWithFirestore = async (cleanEmail: string): Promise<User | undefined> => {
    const localMatch = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (localMatch) return localMatch;
    try {
      const snap = await getDocs(collection(db, 'users'));
      let remoteMatch: User | undefined;
      snap.forEach(d => {
        const data = d.data() as any;
        if (typeof data.email === 'string' && data.email.toLowerCase() === cleanEmail) {
          remoteMatch = { id: d.id, ...data };
        }
      });
      return remoteMatch;
    } catch {
      return undefined;
    }
  };

  const loginWithFirebaseFallback = async (cleanEmail: string, pass: string): Promise<User> => {
    const matched = await findUserByEmailWithFirestore(cleanEmail);
    if (matched) {
      const access = evaluateLoginAccess(matched);
      if (!access.allowed) {
        await signOut(auth).catch(() => {});
        throw new Error(access.reason);
      }
    }

    const persistStaticUser = async (profile: User) => {
      const customTarget = localStorage.getItem(`presently_daily_target_${profile.id}`);
      const hydrated = customTarget
        ? { ...profile, dailyClassTarget: parseInt(customTarget, 10) }
        : profile.dailyClassTarget === undefined
          ? { ...profile, dailyClassTarget: 4 }
          : profile;
      setAccessToken(STATIC_SESSION_TOKEN);
      setCurrentUserState(hydrated);
      try {
        localStorage.setItem('presently_active_user', JSON.stringify(hydrated));
      } catch {
        // Ignore storage restrictions
      }
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), hydrated]);
      try {
        const cleanUser: any = { ...hydrated };
        Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
        await setDoc(doc(db, 'users', hydrated.id), cleanUser, { merge: true });
      } catch (err) {
        console.warn('Firestore user profile sync error:', err);
      }
      return hydrated;
    };

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const userProfile: User = matched
        ? { ...matched, id: res.user.uid || matched.id }
        : {
            ...buildInstitutionalProfile(cleanEmail, res.user.uid),
            approvalStatus: 'approved',
          };
      const access = evaluateLoginAccess(userProfile);
      if (!access.allowed) {
        await signOut(auth).catch(() => {});
        throw new Error(access.reason);
      }
      return await persistStaticUser(userProfile);
    } catch (firebaseErr: any) {
      if (
        firebaseErr?.message &&
        (firebaseErr.message.includes('pending administrator approval') ||
          firebaseErr.message.includes('declined by the administrator'))
      ) {
        throw firebaseErr;
      }
      if (matched) {
        const access = evaluateLoginAccess(matched);
        if (!access.allowed) {
          throw new Error(access.reason);
        }
        return await persistStaticUser(matched);
      }
      if (!isPrimaryAdminEmail(cleanEmail)) {
        throw new Error(
          'No approved account found for this email. Please switch to Register to submit a registration request for administrator approval.'
        );
      }
      const fallbackAdmin: User = {
        ...buildInstitutionalProfile(cleanEmail, 'admin-payel'),
        approvalStatus: 'approved',
      };
      return await persistStaticUser(fallbackAdmin);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isKnownStaticHosting()) {
      return loginWithFirebaseFallback(cleanEmail, pass);
    }

    let response: Response;
    try {
      response = await fetch(resolveAuthApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email: cleanEmail, password: pass }),
      });
    } catch {
      return loginWithFirebaseFallback(cleanEmail, pass);
    }

    if (isStaticHostMissingApi(response)) {
      return loginWithFirebaseFallback(cleanEmail, pass);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed. Please check your credentials.');
    }

    const serverUser = data.user as {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'teacher';
      approvalStatus: 'approved' | 'pending' | 'rejected';
    };
    const token = data.accessToken as string;

    const existingProfile = await findUserByEmailWithFirestore(cleanEmail);
    const customTarget = localStorage.getItem(`presently_daily_target_${serverUser.id}`);
    const baseProfile = existingProfile
      ? {
          ...existingProfile,
          id: existingProfile.id || serverUser.id,
          email: serverUser.email,
          role: serverUser.role,
          approvalStatus: serverUser.approvalStatus,
        }
      : {
          ...buildInstitutionalProfile(cleanEmail, serverUser.id),
          name: serverUser.name,
          role: serverUser.role,
          approvalStatus: serverUser.approvalStatus,
        };

    if (customTarget) {
      baseProfile.dailyClassTarget = parseInt(customTarget, 10);
    } else if (baseProfile.dailyClassTarget === undefined) {
      baseProfile.dailyClassTarget = 4;
    }

    setAccessToken(token);
    setCurrentUserState(baseProfile);
    setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), baseProfile]);

    try {
      const cleanUser: any = { ...baseProfile };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', baseProfile.id), cleanUser, { merge: true });
    } catch (err) {
      console.warn('Firestore user profile sync error:', err);
    }

    return baseProfile;
  };

  const registerWithFirebaseFallback = async (
    cleanEmail: string,
    pass: string,
    name: string,
    role: 'admin' | 'teacher'
  ): Promise<RegisterResult> => {
    const existing = await findUserByEmailWithFirestore(cleanEmail);
    if (existing) {
      const existingStatus = resolveUserApprovalStatus(existing);
      if (existingStatus === 'pending') {
        throw new Error(
          'An account with this email is already registered and awaiting administrator approval.'
        );
      }
      if (existingStatus === 'rejected') {
        throw new Error(
          'A previous registration request for this email was declined. Please contact an administrator.'
        );
      }
      throw new Error('An approved account with this email already exists. Please use Sign In instead.');
    }

    const isPrimary = isPrimaryAdminEmail(cleanEmail);
    const approvalStatus = isPrimary ? 'approved' : 'pending';
    const registeredAt = new Date().toISOString();
    const buildRegisteredUser = (uid: string): User => ({
      id: uid,
      name: name.trim(),
      email: cleanEmail,
      role: isPrimary ? 'admin' : role,
      avatar:
        isPrimary || role === 'admin'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      department: 'Computer Science & Technology',
      employeeId:
        isPrimary || role === 'admin'
          ? `ADM-${Date.now().toString().slice(-4)}`
          : `BTEB-${Date.now().toString().slice(-4)}`,
      title:
        isPrimary || role === 'admin'
          ? 'Institutional Administrator'
          : 'Instructor (Computer Technology)',
      dailyClassTarget: 4,
      approvalStatus,
      registeredAt,
      ...(isPrimary ? { approvedAt: registeredAt, approvedBy: cleanEmail } : {}),
    });

    let newUser: User;
    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      newUser = buildRegisteredUser(res.user.uid);
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use') {
        throw new Error(
          'An account with this email already exists in authentication. Please sign in or contact an administrator.'
        );
      }
      newUser = buildRegisteredUser(isPrimary ? 'admin-payel' : `user-${Date.now()}`);
    }

    setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser]);
    try {
      const cleanUser: any = { ...newUser };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', newUser.id), cleanUser, { merge: true });
    } catch (err) {
      console.warn('Firestore user write error:', err);
    }

    if (approvalStatus === 'pending') {
      await signOut(auth).catch(() => {});
      return { user: newUser, requiresApproval: true };
    }

    setAccessToken(STATIC_SESSION_TOKEN);
    setCurrentUserState(newUser);
    try {
      localStorage.setItem('presently_active_user', JSON.stringify(newUser));
    } catch {
      // Ignore storage restrictions
    }
    return { user: newUser, requiresApproval: false };
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    role: 'admin' | 'teacher'
  ): Promise<RegisterResult> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isKnownStaticHosting()) {
      return registerWithFirebaseFallback(cleanEmail, pass, name, role);
    }

    const isPrimary = isPrimaryAdminEmail(cleanEmail);
    const registeredAt = new Date().toISOString();
    const suggestedId = isPrimary ? 'admin-payel' : `user-${Date.now()}`;

    let response: Response;
    try {
      response = await fetch(resolveAuthApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          id: suggestedId,
          email: cleanEmail,
          password: pass,
          name: name.trim(),
          role,
        }),
      });
    } catch {
      return registerWithFirebaseFallback(cleanEmail, pass, name, role);
    }

    if (isStaticHostMissingApi(response)) {
      return registerWithFirebaseFallback(cleanEmail, pass, name, role);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Unable to register account. Please review your details.');
    }

    const serverUser = data.user as {
      id: string;
      email: string;
      name: string;
      role: 'admin' | 'teacher';
      approvalStatus: 'approved' | 'pending' | 'rejected';
    };
    const requiresApproval = Boolean(data.requiresApproval);

    const existingProfile = await findUserByEmailWithFirestore(cleanEmail);
    const newUser: User = existingProfile
      ? {
          ...existingProfile,
          name: serverUser.name,
          role: serverUser.role,
          approvalStatus: serverUser.approvalStatus,
        }
      : {
          id: serverUser.id,
          name: serverUser.name,
          email: serverUser.email,
          role: serverUser.role,
          avatar:
            serverUser.role === 'admin'
              ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          department: 'Computer Science & Technology',
          employeeId:
            serverUser.role === 'admin'
              ? `ADM-${Date.now().toString().slice(-4)}`
              : `BTEB-${Date.now().toString().slice(-4)}`,
          title:
            serverUser.role === 'admin'
              ? 'Institutional Administrator'
              : 'Instructor (Computer Technology)',
          dailyClassTarget: 4,
          approvalStatus: serverUser.approvalStatus,
          registeredAt,
          ...(isPrimary ? { approvedAt: registeredAt, approvedBy: cleanEmail } : {}),
        };

    setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser]);

    try {
      const cleanUser: any = { ...newUser };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', newUser.id), cleanUser, { merge: true });
    } catch (err) {
      console.warn('Firestore user write error:', err);
    }

    if (requiresApproval || !data.accessToken) {
      return { user: newUser, requiresApproval: true };
    }

    setAccessToken(data.accessToken);
    setCurrentUserState(newUser);
    return { user: newUser, requiresApproval: false };
  };

  const requestPasswordReset = async (email: string): Promise<string> => {
    const cleanEmail = email.trim().toLowerCase();
    const genericMsg = 'If an account with that email exists, a password reset link has been sent.';

    const sendFirebaseResetFallback = async (): Promise<string> => {
      // Detect when Firebase Email/Password auth is disabled in the Firebase project so we don't silently report success
      const apiKey = auth.app.options.apiKey;
      if (apiKey) {
        try {
          const probeRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: 'provider-probe@invalid.local',
                password: 'ProbePassword#123',
                returnSecureToken: true,
              }),
            }
          );
          const probeData = await probeRes.json().catch(() => ({}));
          const probeErr = probeData?.error?.message;
          if (probeErr === 'PASSWORD_LOGIN_DISABLED' || probeErr === 'OPERATION_NOT_ALLOWED') {
            throw new Error(
              'Password reset email cannot be sent from static GitHub Pages because Firebase Email/Password sign-in is disabled for this project and no backend server is running here. Enable Email/Password in Firebase Console (Authentication → Sign-in method) or use the full-stack app URL.'
            );
          }
        } catch (probeErr: any) {
          if (probeErr?.message?.includes('Firebase Email/Password sign-in is disabled')) {
            throw probeErr;
          }
        }
      }

      const appBasePath =
        import.meta.env.BASE_URL && import.meta.env.BASE_URL !== './'
          ? import.meta.env.BASE_URL
          : '/presently/';
      const continueUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${appBasePath}` : undefined;

      try {
        if (continueUrl) {
          await sendPasswordResetEmail(auth, cleanEmail, {
            url: continueUrl,
            handleCodeInApp: true,
          });
        } else {
          await sendPasswordResetEmail(auth, cleanEmail);
        }
      } catch (err: any) {
        if (
          err?.code === 'auth/unauthorized-continue-uri' ||
          err?.code === 'auth/invalid-continue-uri'
        ) {
          await sendPasswordResetEmail(auth, cleanEmail);
        } else if (err?.code === 'auth/operation-not-allowed') {
          throw new Error(
            'Password reset email cannot be sent because Firebase Email/Password sign-in is disabled for this project.'
          );
        } else if (err?.code && !['auth/user-not-found', 'auth/invalid-email'].includes(err.code)) {
          throw new Error(err?.message || 'Unable to send Firebase password reset email.');
        }
      }
      return genericMsg;
    };

    if (isKnownStaticHosting()) {
      return sendFirebaseResetFallback();
    }

    let response: Response;
    try {
      response = await fetch(resolveAuthApiUrl('/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email: cleanEmail }),
      });
    } catch {
      return sendFirebaseResetFallback();
    }

    if (isStaticHostMissingApi(response)) {
      return sendFirebaseResetFallback();
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Unable to process password reset request.');
    }
    return data.message || genericMsg;
  };

  const logout = async () => {
    const token = accessTokenRef.current;
    setAccessToken(null);
    setCurrentUserState(null);
    try {
      localStorage.removeItem('presently_active_user');
    } catch {
      // Ignore storage restrictions
    }
    if (token && token !== STATIC_SESSION_TOKEN && !isKnownStaticHosting()) {
      try {
        await fetch(resolveAuthApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network failure during logout cleanup
      }
    }
    try {
      await signOut(auth);
    } catch {
      // Ignore Firebase Auth cleanup error
    }
  };

  // Admin: Add / Remove Real Faculty Teachers
  const addTeacher = async (teacherInput: NewTeacherInput): Promise<User> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can add faculty members.');
    }

    const cleanEmail = teacherInput.email.trim().toLowerCase();
    const cleanName = teacherInput.name.trim();
    if (!cleanName || !cleanEmail) {
      throw new Error('Teacher full name and institutional email are required.');
    }

    const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`A faculty account with email "${cleanEmail}" already exists.`);
    }

    const now = new Date().toISOString();
    const newTeacher: User = {
      id: `tch-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      name: cleanName,
      email: cleanEmail,
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      department: teacherInput.department?.trim() || 'Computer Science & Technology',
      employeeId: teacherInput.employeeId?.trim() || `BTEB-TCH-${Date.now().toString().slice(-4)}`,
      title: teacherInput.title?.trim() || 'Instructor (Computer Technology)',
      dailyClassTarget: teacherInput.dailyClassTarget || 4,
      approvalStatus: 'approved',
      registeredAt: now,
      approvedAt: now,
      approvedBy: currentUser?.email || currentUser?.name || 'Admin',
    };

    setUsers(prev => [...prev, newTeacher]);
    await syncUsersDirectoryToServer([newTeacher]);

    try {
      const cleanUser: any = { ...newTeacher };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', newTeacher.id), cleanUser);
    } catch (e) {
      console.warn('Firestore addTeacher error:', e);
    }

    return newTeacher;
  };

  const deleteTeacher = async (teacherId: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can remove faculty members.');
    }

    const teacherAssignments = assignments.filter(a => a.teacherId === teacherId);
    setUsers(prev => prev.filter(u => u.id !== teacherId));
    setAssignments(prev => prev.filter(a => a.teacherId !== teacherId));

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', teacherId));
      teacherAssignments.forEach(a => {
        batch.delete(doc(db, 'assignments', a.id));
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore deleteTeacher error:', e);
    }
  };

  const approveUserRegistration = async (userId: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can approve registrations.');
    }

    const approvedAt = new Date().toISOString();
    const approvedBy = currentUser?.email || currentUser?.name || 'Admin';

    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, approvalStatus: 'approved', approvedAt, approvedBy }
          : u
      )
    );

    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          approvalStatus: 'approved',
          approvedAt,
          approvedBy,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore approveUserRegistration error:', e);
    }
  };

  const rejectUserRegistration = async (userId: string, removeRecord = false): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can decline registrations.');
    }

    if (removeRecord) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (e) {
        console.warn('Firestore delete rejected user error:', e);
      }
      return;
    }

    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, approvalStatus: 'rejected' }
          : u
      )
    );

    try {
      await setDoc(
        doc(db, 'users', userId),
        { approvalStatus: 'rejected' },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore rejectUserRegistration error:', e);
    }
  };

  // Admin: Assign Subject Part (Theory or Practical) to Teacher — Theory & Practical are tracked separately (can share or use different teachers)
  const assignSubjectToTeacher = async (
    subjectId: string,
    teacherId: string,
    classId: string,
    part: SubjectPart = 'theory'
  ) => {
    const validation = validateSubjectPartAssignment(assignments, subjectId, classId, part, teacherId);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid subject part assignment.');
    }

    const deterministicId = `bteb-asg-${subjectId}-${classId}-${part}`;
    const newAsg: SubjectAssignment = {
      id: deterministicId,
      subjectId,
      teacherId,
      classId,
      part,
      academicYear: '2026-2027',
      assignedAt: new Date().toISOString().split('T')[0],
    };

    const replacedAssignments = assignments.filter(
      a => a.subjectId === subjectId && a.classId === classId && (a.part || 'theory') === part && a.id !== deterministicId
    );

    setAssignments(prev => {
      const filtered = prev.filter(
        a => !(a.subjectId === subjectId && a.classId === classId && (a.part || 'theory') === part)
      );
      return [...filtered, newAsg];
    });

    try {
      const batch = writeBatch(db);
      replacedAssignments.forEach(oldAsg => {
        batch.delete(doc(db, 'assignments', oldAsg.id));
      });
      batch.set(doc(db, 'assignments', newAsg.id), newAsg);
      await batch.commit();
    } catch (e) {
      console.warn('Firestore assignment sync error:', e);
    }
  };

  const unassignSubject = async (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    try {
      await deleteDoc(doc(db, 'assignments', assignmentId));
    } catch (e) {
      console.warn('Firestore unassign sync error:', e);
    }
  };

  const createSubject = async (newSub: Omit<Subject, 'id'>) => {
    const subject: Subject = {
      ...newSub,
      id: `bteb-${newSub.code}`,
      curriculum: 'BTEB Probidhan 2022',
      technology: 'Computer Science and Technology (85)',
    };

    setSubjects(prev => [...prev, subject]);

    try {
      await setDoc(doc(db, 'subjects', subject.id), subject);
    } catch (e) {
      console.warn('Firestore subject write:', e);
    }
    return subject;
  };

  // Admin ONLY: Bulk Import Students
  const bulkImportStudents = async (classId: string, newStudents: Omit<Student, 'id'>[]) => {
    if (!canImportStudents) {
      throw new Error('Access Denied: Student bulk import is restricted to Administrator role.');
    }

    const timestamp = Date.now();
    const createdList: Student[] = newStudents.map((s, idx) => ({
      ...s,
      id: `stu-${s.rollNumber || timestamp + '-' + idx}`,
      classId,
      status: 'active',
      avatar: s.avatar || `https://images.unsplash.com/photo-${1500000000000 + (idx % 10) * 1000000}?w=150&auto=format&fit=crop&q=80`,
    }));

    setStudents(prev => {
      const newRolls = new Set(createdList.map(item => item.rollNumber.toLowerCase()));
      const filtered = prev.filter(existing => !(existing.classId === classId && newRolls.has(existing.rollNumber.toLowerCase())));
      return [...filtered, ...createdList];
    });

    try {
      const batch = writeBatch(db);
      createdList.forEach(stu => {
        const cleanStu: any = { ...stu };
        Object.keys(cleanStu).forEach(k => cleanStu[k] === undefined && delete cleanStu[k]);
        batch.set(doc(db, 'students', stu.id), cleanStu);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore batch student import:', e);
    }

    return createdList.length;
  };

  const addStudent = async (stu: Omit<Student, 'id'>) => {
    if (!canImportStudents) {
      throw new Error('Access Denied: Only Admin can enroll students.');
    }

    const newStudent: Student = {
      ...stu,
      id: `stu-${stu.rollNumber || Date.now()}`,
      status: 'active',
    };

    setStudents(prev => [...prev, newStudent]);

    try {
      const cleanStu: any = { ...newStudent };
      Object.keys(cleanStu).forEach(k => cleanStu[k] === undefined && delete cleanStu[k]);
      await setDoc(doc(db, 'students', newStudent.id), cleanStu);
    } catch (e) {
      console.warn('Firestore add student:', e);
    }
    return newStudent;
  };

  const updateStudent = async (stu: Student) => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrators can update official student profile records.');
    }
    const cleanStu: any = { ...stu };
    Object.keys(cleanStu).forEach(k => cleanStu[k] === undefined && delete cleanStu[k]);
    setStudents(prev => prev.map(s => (s.id === stu.id ? stu : s)));
    try {
      await setDoc(doc(db, 'students', stu.id), cleanStu, { merge: true });
    } catch (e) {
      console.warn('Firestore update student:', e);
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Admin can delete students.');
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (e) {
      console.warn(e);
    }
  };

  // Teacher / Admin: 1-Click Roll Call save
  const saveAttendanceSession = async (
    sessionDetails: {
      id?: string;
      subjectId: string;
      classId: string;
      teacherId: string;
      part?: SubjectPart;
      date: string;
      timeSlot?: string;
      topic?: string;
    },
    studentStatuses: Record<string, RollCallDraftEntry>
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (sessionDetails.date > todayStr) {
      throw new Error(`Validation Error: Attendance cannot be taken for tomorrow or future dates (${sessionDetails.date}). Please select today (${todayStr}) or a previous class date.`);
    }

    const resolvedPart: SubjectPart = sessionDetails.part || 'theory';
    const classStudents = getClassStudents(sessionDetails.classId);
    const resolved = resolveRollCallForSave(classStudents, studentStatuses);
    const studentIds = Object.keys(resolved.resolvedStatuses);

    const sessionId = sessionDetails.id || `bteb-sess-${resolvedPart}-${Date.now()}`;
    const partLabel = resolvedPart === 'practical' ? 'Practical' : 'Theory';
    const newSession: AttendanceSession = {
      id: sessionId,
      subjectId: sessionDetails.subjectId,
      classId: sessionDetails.classId,
      teacherId: sessionDetails.teacherId,
      part: resolvedPart,
      date: sessionDetails.date,
      timeSlot: sessionDetails.timeSlot || `${partLabel} Session`,
      topic: sessionDetails.topic || `BTEB ${partLabel} Class`,
      totalStudents: resolved.totalStudents,
      presentCount: resolved.presentCount,
      absentCount: resolved.absentCount,
      lateCount: resolved.lateCount,
      excusedCount: resolved.excusedCount,
      createdAt: new Date().toISOString(),
      isSubmitted: true,
    };

    const newRecords: AttendanceRecord[] = studentIds.map(studentId => {
      const data = resolved.resolvedStatuses[studentId];
      const rec: AttendanceRecord = {
        id: `rec-${sessionId}-${studentId}`,
        sessionId,
        studentId,
        status: data.status,
        markedAt: new Date().toISOString(),
      };
      if (data.remarks) {
        rec.remarks = data.remarks;
      }
      return rec;
    });

    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== sessionId);
      return [newSession, ...filtered];
    });

    setRecords(prev => {
      const filtered = prev.filter(r => r.sessionId !== sessionId);
      return [...filtered, ...newRecords];
    });

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'sessions', newSession.id), newSession);
      newRecords.forEach(r => {
        const cleanRec: any = { ...r };
        Object.keys(cleanRec).forEach(k => cleanRec[k] === undefined && delete cleanRec[k]);
        batch.set(doc(db, 'records', r.id), cleanRec);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore attendance commit:', e);
    }

    return newSession;
  };

  const getSessionByDate = (subjectId: string, date: string, part?: SubjectPart) => {
    if (part) {
      return sessions.find(
        s => s.subjectId === subjectId && s.date === date && (s.part || 'theory') === part
      );
    }
    return sessions.find(s => s.subjectId === subjectId && s.date === date);
  };

  const getSessionRecords = (sessionId: string) => {
    return records.filter(r => r.sessionId === sessionId);
  };

  // Coursework & Student Evaluation actions
  const createCourseworkAssignment = async (input: {
    title: string;
    description?: string;
    subjectId: string;
    classId: string;
    part: SubjectPart;
    assignedDate: string;
    dueDate: string;
    maxMarks: number;
  }): Promise<CourseworkAssignment> => {
    if (!currentUser) {
      throw new Error('Authentication required to create coursework assignments.');
    }

    if (!isAdmin) {
      const hasAssignment = assignments.some(
        a =>
          a.teacherId === currentUser.id &&
          a.subjectId === input.subjectId &&
          a.classId === input.classId &&
          (a.part || 'theory') === input.part
      );
      if (!hasAssignment) {
        throw new Error('Access Denied: You can only create assignments for your assigned subject parts.');
      }
    }

    const validation = validateCourseworkInput(input);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid coursework assignment details.');
    }

    const newCoursework: CourseworkAssignment = {
      id: `cw-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      title: input.title.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      subjectId: input.subjectId,
      classId: input.classId,
      part: input.part,
      teacherId: currentUser.id,
      assignedDate: input.assignedDate,
      dueDate: input.dueDate,
      maxMarks: Number(input.maxMarks),
      createdAt: new Date().toISOString(),
    };

    setCourseworkAssignments(prev => [newCoursework, ...prev]);

    try {
      const cleanDoc: Record<string, unknown> = { ...newCoursework };
      Object.keys(cleanDoc).forEach(k => cleanDoc[k] === undefined && delete cleanDoc[k]);
      await setDoc(doc(db, 'courseworkAssignments', newCoursework.id), cleanDoc);
    } catch (e) {
      console.warn('Firestore createCourseworkAssignment sync:', e);
    }

    return newCoursework;
  };

  const deleteCourseworkAssignment = async (courseworkId: string): Promise<void> => {
    if (!currentUser) {
      throw new Error('Authentication required.');
    }

    const target = courseworkAssignments.find(cw => cw.id === courseworkId);
    if (!target) return;

    if (!isAdmin) {
      const hasAccess =
        target.teacherId === currentUser.id ||
        assignments.some(
          a =>
            a.teacherId === currentUser.id &&
            a.subjectId === target.subjectId &&
            (a.part || 'theory') === target.part
        );
      if (!hasAccess) {
        throw new Error('Access Denied: You cannot delete an assignment from an unassigned course.');
      }
    }

    const matchingEvaluations = studentEvaluations.filter(ev => ev.courseworkId === courseworkId);
    setCourseworkAssignments(prev => prev.filter(cw => cw.id !== courseworkId));
    setStudentEvaluations(prev => prev.filter(ev => ev.courseworkId !== courseworkId));

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'courseworkAssignments', courseworkId));
      matchingEvaluations.forEach(ev => {
        batch.delete(doc(db, 'studentEvaluations', ev.id));
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore deleteCourseworkAssignment sync:', e);
    }
  };

  const saveStudentEvaluations = async (
    courseworkId: string,
    entries: Array<{
      studentId: string;
      status: AssignmentSubmissionStatus;
      marksObtained?: number | null;
      feedback?: string;
    }>
  ): Promise<void> => {
    if (!currentUser) {
      throw new Error('Authentication required to evaluate students.');
    }

    const coursework = courseworkAssignments.find(cw => cw.id === courseworkId);
    if (!coursework) {
      throw new Error('Selected assignment no longer exists.');
    }

    if (!isAdmin) {
      const hasAccess =
        coursework.teacherId === currentUser.id ||
        assignments.some(
          a =>
            a.teacherId === currentUser.id &&
            a.subjectId === coursework.subjectId &&
            (a.part || 'theory') === coursework.part
        );
      if (!hasAccess) {
        throw new Error('Access Denied: You can only evaluate students in your assigned courses.');
      }
    }

    for (const entry of entries) {
      const check = validateEvaluationScore(entry.marksObtained, coursework.maxMarks);
      if (!check.valid) {
        throw new Error(check.error || 'Invalid evaluation marks.');
      }
    }

    const nowIso = new Date().toISOString();
    const updatedEvaluations: StudentAssignmentEvaluation[] = entries.map(entry => {
      const evalId = `eval-${courseworkId}-${entry.studentId}`;
      const existingEval = studentEvaluations.find(ev => ev.id === evalId);
      const hasNumericMark =
        entry.marksObtained !== null &&
        entry.marksObtained !== undefined &&
        Number.isFinite(Number(entry.marksObtained));
      const trimmedFeedback = entry.feedback?.trim();

      const resolvedSubmittedAt =
        entry.status === 'submitted' || entry.status === 'late' || entry.status === 'graded'
          ? existingEval?.submittedAt || nowIso
          : undefined;

      const docObj: StudentAssignmentEvaluation = {
        id: evalId,
        courseworkId,
        studentId: entry.studentId,
        subjectId: coursework.subjectId,
        classId: coursework.classId,
        part: coursework.part,
        status: entry.status,
        marksObtained: hasNumericMark ? Number(entry.marksObtained) : null,
        evaluatedBy: currentUser.email || currentUser.name,
        evaluatedAt: nowIso,
      };
      if (resolvedSubmittedAt) {
        docObj.submittedAt = resolvedSubmittedAt;
      }
      if (trimmedFeedback) {
        docObj.feedback = trimmedFeedback;
      }
      return docObj;
    });

    const updatedIds = new Set(updatedEvaluations.map(ev => ev.id));
    setStudentEvaluations(prev => [
      ...prev.filter(ev => !updatedIds.has(ev.id)),
      ...updatedEvaluations,
    ]);

    try {
      for (let i = 0; i < updatedEvaluations.length; i += 400) {
        const chunk = updatedEvaluations.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(ev => {
          const cleanEv: Record<string, unknown> = { ...ev };
          Object.keys(cleanEv).forEach(k => cleanEv[k] === undefined && delete cleanEv[k]);
          batch.set(doc(db, 'studentEvaluations', ev.id), cleanEv);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Firestore saveStudentEvaluations sync:', e);
    }
  };

  // Form Fill-up Coordinator & Fee Calculation actions
  const assignFormFillupCoordinator = async (
    semester: string,
    classId: string,
    teacherId: string
  ): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can assign semester form fill-up responsibility.');
    }
    if (!teacherId) {
      throw new Error('Please select a teacher to assign form fill-up responsibility.');
    }

    const respId = `ff-resp-${classId}`;
    const newResp: FormFillupResponsibility = {
      id: respId,
      semester,
      classId,
      teacherId,
      academicYear: '2026-2027',
      assignedAt: new Date().toISOString().split('T')[0],
      assignedBy: currentUser?.email || currentUser?.name || 'Admin',
    };

    const replaced = formFillupResponsibilities.filter(
      r => (r.classId === classId || r.semester === semester) && r.id !== respId
    );

    setFormFillupResponsibilities(prev => [
      ...prev.filter(r => r.classId !== classId && r.id !== respId),
      newResp,
    ]);

    try {
      const batch = writeBatch(db);
      replaced.forEach(oldItem => batch.delete(doc(db, 'formFillupResponsibilities', oldItem.id)));
      batch.set(doc(db, 'formFillupResponsibilities', newResp.id), newResp);
      await batch.commit();
    } catch (e) {
      console.warn('Firestore assignFormFillupCoordinator sync:', e);
    }
  };

  const unassignFormFillupCoordinator = async (responsibilityId: string): Promise<void> => {
    if (!isAdmin) {
      throw new Error('Access Denied: Only Administrator can remove form fill-up coordinator allocation.');
    }

    setFormFillupResponsibilities(prev => prev.filter(r => r.id !== responsibilityId));
    try {
      await deleteDoc(doc(db, 'formFillupResponsibilities', responsibilityId));
    } catch (e) {
      console.warn('Firestore unassignFormFillupCoordinator sync:', e);
    }
  };

  const canManageFormFillupForClass = (classId: string): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true;
    return formFillupResponsibilities.some(
      r => r.classId === classId && r.teacherId === currentUser.id
    );
  };

  const saveFormFillupFeeConfig = async (
    configInput: Omit<FormFillupFeeConfig, 'id' | 'updatedAt' | 'updatedBy'>
  ): Promise<FormFillupFeeConfig> => {
    if (!canEditFormFillupFeeConfig(currentUser)) {
      throw new Error('Access Denied: Only Administrators can modify examination fee rates.');
    }

    const validation = validateFeeConfig(configInput);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid form fill-up fee schedule.');
    }

    const nowIso = new Date().toISOString();
    const updatedBy = currentUser?.email || currentUser?.name || 'Admin';
    const savedConfig: FormFillupFeeConfig = {
      id: `ff-fee-${configInput.classId}`,
      semester: configInput.semester,
      classId: configInput.classId,
      examFee: Number(configInput.examFee) || 0,
      referredExamFeePerSubject: Number(configInput.referredExamFeePerSubject) || 0,
      marksheetFeeRegular: Number(configInput.marksheetFeeRegular) || 0,
      marksheetFeeReferredPerSemester: Number(configInput.marksheetFeeReferredPerSemester) || 0,
      centerFeeRegular: Number(configInput.centerFeeRegular) || 0,
      centerFeeReferredPerSemester: Number(configInput.centerFeeReferredPerSemester) || 0,
      practicalFeePerSubject: Number(configInput.practicalFeePerSubject) || 0,
      questionFee: Number(configInput.questionFee) || 0,
      delayFee: Number(configInput.delayFee) || 0,
      updatedAt: nowIso,
      updatedBy,
    };

    const classRecordsToRecalculate = formFillupRecords
      .filter(r => r.classId === savedConfig.classId)
      .map(rec => {
        const breakdown = calculateStudentFormFillupFee(savedConfig, {
          resultStatus: rec.resultStatus,
          referredSubjectsCount: rec.referredSubjectsCount,
          referredSemestersCount: rec.referredSemestersCount,
          practicalSubjectsCount: rec.practicalSubjectsCount,
          applyDelayFee: rec.applyDelayFee,
        });
        return {
          ...rec,
          calculatedAmountTk: breakdown.totalAmountTk,
          updatedAt: nowIso,
          updatedBy,
        };
      });

    setFormFillupFeeConfigs(prev => [
      ...prev.filter(c => c.classId !== savedConfig.classId && c.id !== savedConfig.id),
      savedConfig,
    ]);

    if (classRecordsToRecalculate.length > 0) {
      const updatedRecordIds = new Set(classRecordsToRecalculate.map(r => r.id));
      setFormFillupRecords(prev => [
        ...prev.filter(r => !updatedRecordIds.has(r.id)),
        ...classRecordsToRecalculate,
      ]);
    }

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'formFillupFeeConfigs', savedConfig.id), savedConfig);
      classRecordsToRecalculate.forEach(rec => {
        const cleanRec: Record<string, unknown> = { ...rec };
        Object.keys(cleanRec).forEach(k => cleanRec[k] === undefined && delete cleanRec[k]);
        batch.set(doc(db, 'formFillupRecords', rec.id), cleanRec);
      });
      await batch.commit();
    } catch (e) {
      console.warn('Firestore saveFormFillupFeeConfig sync:', e);
    }

    return savedConfig;
  };

  const saveFormFillupRecords = async (
    semester: string,
    classId: string,
    entries: Array<{
      studentId: string;
      resultStatus: FormFillupResultStatus;
      referredSubjectsCount: number;
      referredSemestersCount: number;
      practicalSubjectsCount: number;
      applyDelayFee: boolean;
      resultSummaryNote?: string;
      paymentStatus: FormFillupPaymentStatus;
    }>,
    feeConfigOverride?: FormFillupFeeConfig
  ): Promise<void> => {
    if (!canManageFormFillupForClass(classId)) {
      throw new Error('Access Denied: You are not assigned as the form fill-up coordinator for this semester.');
    }

    // Only administrators may supply an unsaved fee config override; teachers always compute from official admin-saved rates.
    const effectiveConfig =
      (canEditFormFillupFeeConfig(currentUser) ? feeConfigOverride : undefined) ||
      formFillupFeeConfigs.find(c => c.classId === classId) ||
      createDefaultFeeConfig(semester, classId);

    const nowIso = new Date().toISOString();
    const updatedRecords: FormFillupStudentRecord[] = entries.map(entry => {
      const normalized = normalizeResultInput({
        resultStatus: entry.resultStatus,
        referredSubjectsCount: entry.referredSubjectsCount,
        referredSemestersCount: entry.referredSemestersCount,
        practicalSubjectsCount: entry.practicalSubjectsCount,
        applyDelayFee: entry.applyDelayFee,
      });

      const breakdown = calculateStudentFormFillupFee(effectiveConfig, normalized);
      const trimmedNote = entry.resultSummaryNote?.trim();

      const recordObj: FormFillupStudentRecord = {
        id: `ff-rec-${classId}-${entry.studentId}`,
        semester,
        classId,
        studentId: entry.studentId,
        resultStatus: normalized.resultStatus,
        referredSubjectsCount: normalized.referredSubjectsCount,
        referredSemestersCount: normalized.referredSemestersCount,
        practicalSubjectsCount: normalized.practicalSubjectsCount,
        applyDelayFee: normalized.applyDelayFee,
        calculatedAmountTk: breakdown.totalAmountTk,
        paymentStatus: entry.paymentStatus,
        updatedAt: nowIso,
        updatedBy: currentUser?.email || currentUser?.name || 'Coordinator',
      };
      if (trimmedNote) {
        recordObj.resultSummaryNote = trimmedNote;
      }
      return recordObj;
    });

    const updatedIds = new Set(updatedRecords.map(r => r.id));
    setFormFillupRecords(prev => [
      ...prev.filter(r => !updatedIds.has(r.id)),
      ...updatedRecords,
    ]);

    try {
      for (let i = 0; i < updatedRecords.length; i += 400) {
        const chunk = updatedRecords.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(rec => {
          const cleanRec: Record<string, unknown> = { ...rec };
          Object.keys(cleanRec).forEach(k => cleanRec[k] === undefined && delete cleanRec[k]);
          batch.set(doc(db, 'formFillupRecords', rec.id), cleanRec);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Firestore saveFormFillupRecords sync:', e);
    }
  };

  const resetToDefaultBTEBData = async () => {
    setSubjects(BTEB_CURRICULUM_2022_SUBJECTS);
    setClasses(BTEB_CLASSES);
    setAssignments([]);
    setStudents([]);
    setSessions([]);
    setRecords([]);
    setCourseworkAssignments([]);
    setStudentEvaluations([]);
    setFormFillupResponsibilities([]);
    setFormFillupFeeConfigs([]);
    setFormFillupRecords([]);
    await seedInitialFirestore();
  };

  const clearAllDemoData = async () => {
    setSessions([]);
    setRecords([]);
    setStudents([]);
    setAssignments([]);
    setCourseworkAssignments([]);
    setStudentEvaluations([]);
    setFormFillupResponsibilities([]);
    setFormFillupFeeConfigs([]);
    setFormFillupRecords([]);
    setUsers(prev => prev.filter(u => !DEMO_USER_IDS.has(u.id)));

    try {
      const collectionsToWipe = [
        'sessions',
        'records',
        'students',
        'assignments',
        'courseworkAssignments',
        'studentEvaluations',
        'formFillupResponsibilities',
        'formFillupFeeConfigs',
        'formFillupRecords',
      ];
      for (const col of collectionsToWipe) {
        const snap = await getDocs(collection(db, col));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(d => batch.delete(doc(db, col, d.id)));
          await batch.commit();
        }
      }

      const userSnap = await getDocs(collection(db, 'users'));
      if (!userSnap.empty) {
        const batch = writeBatch(db);
        let hasDemoUser = false;
        userSnap.forEach(d => {
          if (DEMO_USER_IDS.has(d.id)) {
            batch.delete(doc(db, 'users', d.id));
            hasDemoUser = true;
          }
        });
        if (hasDemoUser) {
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn('Clearing Firestore demo collections:', e);
    }
  };

  return (
    <AttendanceContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        accessToken,
        users,
        teachers,
        pendingUsers,
        classes,
        subjects,
        assignments,
        students,
        sessions,
        records,
        courseworkAssignments,
        studentEvaluations,
        formFillupResponsibilities,
        formFillupFeeConfigs,
        formFillupRecords,
        isAuthenticated,
        isAdmin,
        canImportStudents,
        loginWithEmail,
        registerWithEmail,
        requestPasswordReset,
        verifyActiveSession,
        logout,
        isFirebaseLive,
        getTeacherSubjects,
        getClassStudents,
        getSubjectsBySemester,
        setDailyClassTarget,
        updateCurrentUserProfile,
        addTeacher,
        deleteTeacher,
        approveUserRegistration,
        rejectUserRegistration,
        assignSubjectToTeacher,
        unassignSubject,
        createSubject,
        bulkImportStudents,
        addStudent,
        updateStudent,
        deleteStudent,
        saveAttendanceSession,
        getSessionByDate,
        getSessionRecords,
        createCourseworkAssignment,
        deleteCourseworkAssignment,
        saveStudentEvaluations,
        assignFormFillupCoordinator,
        unassignFormFillupCoordinator,
        saveFormFillupFeeConfig,
        saveFormFillupRecords,
        resetToDefaultBTEBData,
        clearAllDemoData,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};

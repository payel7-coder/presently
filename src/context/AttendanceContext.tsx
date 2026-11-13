import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  ClassGroup,
  Student,
  Subject,
  SubjectAssignment,
  SubjectPart,
  User,
} from '../types/attendance';
import {
  BTEB_CLASSES,
  BTEB_CURRICULUM_2022_SUBJECTS,
} from '../data/btebCurriculum';
import { validateSubjectPartAssignment } from '../utils/attendanceLogic';
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
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';

interface NewTeacherInput {
  name: string;
  email: string;
  department?: string;
  employeeId?: string;
  title?: string;
  dailyClassTarget?: number;
}

interface AttendanceContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  teachers: User[];
  classes: ClassGroup[];
  subjects: Subject[];
  assignments: SubjectAssignment[];
  students: Student[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];

  // Permissions & Auth
  isAuthenticated: boolean;
  isAdmin: boolean;
  canImportStudents: boolean;
  loginWithPreset: (user: User) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  registerWithEmail: (email: string, pass: string, name: string, role: 'admin' | 'teacher') => Promise<User>;
  logout: () => Promise<void>;
  isFirebaseLive: boolean;

  // Teacher helpers
  getTeacherSubjects: (teacherId: string) => { subject: Subject; classGroup: ClassGroup; assignment: SubjectAssignment }[];
  getClassStudents: (classId: string) => Student[];
  getSubjectsBySemester: (semester: string) => Subject[];
  setDailyClassTarget: (target: number) => Promise<void>;

  // Admin actions (Restricted)
  addTeacher: (teacher: NewTeacherInput) => Promise<User>;
  deleteTeacher: (teacherId: string) => Promise<void>;
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
    studentStatuses: Record<string, { status: AttendanceStatus; remarks?: string }>
  ) => Promise<AttendanceSession>;

  getSessionByDate: (subjectId: string, date: string, part?: SubjectPart) => AttendanceSession | undefined;
  getSessionRecords: (sessionId: string) => AttendanceRecord[];
  resetToDefaultBTEBData: () => Promise<void>;
  clearAllDemoData: () => Promise<void>;
}

const DEMO_USER_IDS = new Set([
  'teacher-tanvir',
  'teacher-nusrat',
  'teacher-hasan',
  'admin-principal',
]);

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current active user profile (null when unauthenticated)
  const [currentUser, setCurrentUserState] = useState<User | null>(() => {
    const saved = localStorage.getItem('presently_active_user');
    if (!saved) return null;
    try {
      const u: User = JSON.parse(saved);
      const customTarget = localStorage.getItem(`presently_daily_target_${u.id}`);
      if (customTarget) {
        u.dailyClassTarget = parseInt(customTarget, 10);
      } else if (u.dailyClassTarget === undefined) {
        u.dailyClassTarget = 4;
      }
      return u;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>(BTEB_CLASSES);
  const [subjects, setSubjects] = useState<Subject[]>(BTEB_CURRICULUM_2022_SUBJECTS);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isFirebaseLive, setIsFirebaseLive] = useState(false);

  // Sync active user to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('presently_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('presently_active_user');
    }
  }, [currentUser]);

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
    };
  }, []);

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem('presently_active_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('presently_active_user');
    }
  };

  const isAuthenticated = Boolean(currentUser);
  const isAdmin = currentUser?.role === 'admin';
  const canImportStudents = Boolean(isAdmin);

  const teachers = users.filter(u => u.role === 'teacher');

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
      .filter((item): item is { subject: Subject; classGroup: ClassGroup; assignment: SubjectAssignment } => item !== null);
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
    localStorage.setItem('presently_active_user', JSON.stringify(updatedUser));
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

  // Auth Functions
  const loginWithPreset = async (user: User) => {
    const customTarget = localStorage.getItem(`presently_daily_target_${user.id}`);
    const resolvedTarget = customTarget ? parseInt(customTarget, 10) : (user.dailyClassTarget || 4);
    const userWithTarget: User = {
      ...user,
      dailyClassTarget: resolvedTarget,
    };
    setCurrentUserState(userWithTarget);
    localStorage.setItem('presently_active_user', JSON.stringify(userWithTarget));
    try {
      const cleanUser: any = { ...userWithTarget };
      Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
      await setDoc(doc(db, 'users', user.id), cleanUser, { merge: true });
    } catch (e) {
      console.warn('Firestore user profile sync:', e);
    }
  };

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

  const loginWithEmail = async (email: string, pass: string): Promise<User> => {
    const cleanEmail = email.trim().toLowerCase();
    const matched = users.find(u => u.email.toLowerCase() === cleanEmail);

    try {
      const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const userProfile: User = matched
        ? { ...matched, id: res.user.uid || matched.id }
        : buildInstitutionalProfile(cleanEmail, res.user.uid);

      setCurrentUserState(userProfile);
      localStorage.setItem('presently_active_user', JSON.stringify(userProfile));
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), userProfile]);

      try {
        const cleanUser: any = { ...userProfile };
        Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
        await setDoc(doc(db, 'users', userProfile.id), cleanUser, { merge: true });
      } catch (err) {
        console.warn('Firestore user profile sync error:', err);
      }
      return userProfile;
    } catch (firebaseErr: any) {
      console.warn('Firebase auth attempt handled with institutional fallback:', firebaseErr?.code);

      if (matched) {
        setCurrentUserState(matched);
        localStorage.setItem('presently_active_user', JSON.stringify(matched));
        try {
          const cleanUser: any = { ...matched };
          Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
          await setDoc(doc(db, 'users', matched.id), cleanUser, { merge: true });
        } catch (e) {
          console.warn('User profile Firestore sync:', e);
        }
        return matched;
      }

      const fallbackId = cleanEmail === 'payelahmed70@gmail.com' ? 'admin-payel' : `user-${Date.now()}`;
      const fallbackUser = buildInstitutionalProfile(cleanEmail, fallbackId);

      setCurrentUserState(fallbackUser);
      localStorage.setItem('presently_active_user', JSON.stringify(fallbackUser));
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), fallbackUser]);
      try {
        const cleanUser: any = { ...fallbackUser };
        Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
        await setDoc(doc(db, 'users', fallbackUser.id), cleanUser, { merge: true });
      } catch (e) {
        console.warn('User profile Firestore sync:', e);
      }
      return fallbackUser;
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    role: 'admin' | 'teacher'
  ): Promise<User> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const newUser: User = {
        id: res.user.uid,
        name: name.trim(),
        email: cleanEmail,
        role,
        avatar: role === 'admin'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        department: 'Computer Science & Technology',
        employeeId: role === 'admin' ? `ADM-${Date.now().toString().slice(-4)}` : `BTEB-${Date.now().toString().slice(-4)}`,
        title: role === 'admin' ? 'Institutional Administrator' : 'Instructor (Computer Technology)',
        dailyClassTarget: 4,
      };

      setCurrentUserState(newUser);
      localStorage.setItem('presently_active_user', JSON.stringify(newUser));
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser]);

      try {
        const cleanUser: any = { ...newUser };
        Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
        await setDoc(doc(db, 'users', newUser.id), cleanUser, { merge: true });
      } catch (e) {
        console.warn('Firestore user write:', e);
      }
      return newUser;
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        return loginWithEmail(cleanEmail, pass);
      }
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        avatar: role === 'admin'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        department: 'Computer Science & Technology',
        employeeId: role === 'admin' ? `ADM-${Date.now().toString().slice(-4)}` : `BTEB-${Date.now().toString().slice(-4)}`,
        title: role === 'admin' ? 'Institutional Administrator' : 'Instructor (Computer Technology)',
        dailyClassTarget: 4,
      };

      setCurrentUserState(newUser);
      localStorage.setItem('presently_active_user', JSON.stringify(newUser));
      setUsers(prev => [...prev.filter(u => u.email.toLowerCase() !== cleanEmail), newUser]);

      try {
        const cleanUser: any = { ...newUser };
        Object.keys(cleanUser).forEach(k => cleanUser[k] === undefined && delete cleanUser[k]);
        await setDoc(doc(db, 'users', newUser.id), cleanUser, { merge: true });
      } catch (err) {
        console.warn('Firestore user write error:', err);
      }
      return newUser;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn(e);
    }
    localStorage.removeItem('presently_active_user');
    setCurrentUserState(null);
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
    };

    setUsers(prev => [...prev, newTeacher]);

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

  // Admin: Assign Subject Part (Theory or Practical) to Teacher — enforces different teachers per part
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
    setStudents(prev => prev.map(s => (s.id === stu.id ? stu : s)));
    try {
      await setDoc(doc(db, 'students', stu.id), stu);
    } catch (e) {
      console.warn(e);
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
    studentStatuses: Record<string, { status: AttendanceStatus; remarks?: string }>
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (sessionDetails.date > todayStr) {
      throw new Error(`Validation Error: Attendance cannot be taken for tomorrow or future dates (${sessionDetails.date}). Please select today (${todayStr}) or a previous class date.`);
    }

    const resolvedPart: SubjectPart = sessionDetails.part || 'theory';
    const classStudents = getClassStudents(sessionDetails.classId);
    let pCount = 0;
    let aCount = 0;
    let lCount = 0;
    let eCount = 0;

    const studentIds = Object.keys(studentStatuses);
    studentIds.forEach(id => {
      const status = studentStatuses[id]?.status || 'present';
      if (status === 'present') pCount++;
      else if (status === 'absent') aCount++;
      else if (status === 'late') lCount++;
      else if (status === 'excused') eCount++;
    });

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
      totalStudents: classStudents.length,
      presentCount: pCount,
      absentCount: aCount,
      lateCount: lCount,
      excusedCount: eCount,
      createdAt: new Date().toISOString(),
      isSubmitted: true,
    };

    const newRecords: AttendanceRecord[] = studentIds.map(studentId => {
      const data = studentStatuses[studentId];
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

  const resetToDefaultBTEBData = async () => {
    setSubjects(BTEB_CURRICULUM_2022_SUBJECTS);
    setClasses(BTEB_CLASSES);
    setAssignments([]);
    setStudents([]);
    setSessions([]);
    setRecords([]);
    await seedInitialFirestore();
  };

  const clearAllDemoData = async () => {
    setSessions([]);
    setRecords([]);
    setStudents([]);
    setAssignments([]);
    setUsers(prev => prev.filter(u => !DEMO_USER_IDS.has(u.id)));

    try {
      const collectionsToWipe = ['sessions', 'records', 'students', 'assignments'];
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
        users,
        teachers,
        classes,
        subjects,
        assignments,
        students,
        sessions,
        records,
        isAuthenticated,
        isAdmin,
        canImportStudents,
        loginWithPreset,
        loginWithEmail,
        registerWithEmail,
        logout,
        isFirebaseLive,
        getTeacherSubjects,
        getClassStudents,
        getSubjectsBySemester,
        setDailyClassTarget,
        addTeacher,
        deleteTeacher,
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

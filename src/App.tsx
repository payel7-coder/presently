import React, { useState } from 'react';
import { AttendanceProvider, useAttendance } from './context/AttendanceContext';
import { Navbar } from './components/Navbar';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AttendanceStudio } from './components/AttendanceStudio';
import { AdminAssignments } from './components/AdminAssignments';
import { ReportsAndTrends } from './components/ReportsAndTrends';
import { ClassRosterView } from './components/ClassRosterView';
import { BulkImportModal } from './components/BulkImportModal';
import { LoginModal } from './components/LoginModal';
import { AuthScreen } from './components/AuthScreen';
import { StudentAssignmentsTracker } from './components/StudentAssignmentsTracker';
import { FormFillupManager } from './components/FormFillupManager';
import { StudentProfileView } from './components/StudentProfileView';
import { UserProfileView } from './components/UserProfileView';
import { ResetPasswordView } from './components/ResetPasswordView';
import { extractResetRouteFromLocation } from './utils/passwordResetLogic';
import { SubjectPart } from './types/attendance';

function AttendanceApp() {
  const { currentUser, logout } = useAttendance();

  const [resetRoute, setResetRoute] = useState(() =>
    extractResetRouteFromLocation(window.location.pathname, window.location.search)
  );

  React.useEffect(() => {
    const syncRoute = () => {
      setResetRoute(
        extractResetRouteFromLocation(window.location.pathname, window.location.search)
      );
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const navigateHomeToLogin = () => {
    window.history.pushState({}, '', '/');
    setResetRoute({ isResetRoute: false, token: '' });
  };

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return currentUser?.role === 'admin' ? 'admin-assignments' : 'my-subjects';
  });

  // Reset navigation tab and selected subject when user changes or logs out
  React.useEffect(() => {
    setActiveSubjectId(undefined);
    setActiveSubjectPart(undefined);
    setActiveFormFillupClassId(undefined);
    setActiveProfileStudentId(undefined);
    if (!currentUser) {
      setActiveTab('my-subjects');
      return;
    }
    setActiveTab(currentUser.role === 'admin' ? 'admin-assignments' : 'my-subjects');
  }, [currentUser?.id, currentUser?.role]);

  // Selected subject & part when transitioning into studio or reports
  const [activeSubjectId, setActiveSubjectId] = useState<string | undefined>(undefined);
  const [activeSubjectPart, setActiveSubjectPart] = useState<SubjectPart | undefined>(undefined);
  const [activeFormFillupClassId, setActiveFormFillupClassId] = useState<string | undefined>(undefined);
  const [activeProfileStudentId, setActiveProfileStudentId] = useState<string | undefined>(undefined);

  // Bulk import modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importTargetClassId, setImportTargetClassId] = useState<string | undefined>(undefined);

  // Login modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  if (resetRoute.isResetRoute) {
    return (
      <ResetPasswordView
        token={resetRoute.token}
        onNavigateToLogin={navigateHomeToLogin}
        onPasswordResetSuccess={() => {
          logout().catch(() => {});
        }}
      />
    );
  }

  // If unauthenticated, display the authorized login screen!
  if (!currentUser) {
    return <AuthScreen />;
  }

  const handleStartAttendance = (subjectId?: string, part?: SubjectPart) => {
    setActiveSubjectId(subjectId);
    setActiveSubjectPart(part);
    setActiveTab('take-attendance');
  };

  const handleViewReports = (subjectId?: string, part?: SubjectPart) => {
    setActiveSubjectId(subjectId);
    setActiveSubjectPart(part);
    setActiveTab('reports');
  };

  const handleOpenAssignments = (subjectId?: string, part?: SubjectPart) => {
    setActiveSubjectId(subjectId);
    setActiveSubjectPart(part);
    setActiveTab('assignments');
  };

  const handleOpenFormFillup = (classId?: string) => {
    setActiveFormFillupClassId(classId);
    setActiveTab('form-fillup');
  };

  const handleOpenBulkImport = (classId?: string) => {
    setImportTargetClassId(classId);
    setIsBulkImportOpen(true);
  };

  const handleOpenStudentProfile = (studentId: string) => {
    setActiveProfileStudentId(studentId);
    setActiveTab('student-profile');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBulkImport={() => handleOpenBulkImport()}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Main Body View */}
      <main className="flex-1 pb-16">
        {currentUser.role === 'teacher' ? (
          <>
            {activeTab === 'my-subjects' && (
              <TeacherDashboard
                onStartAttendance={handleStartAttendance}
                onViewReports={handleViewReports}
                onOpenAssignments={handleOpenAssignments}
                onOpenFormFillup={handleOpenFormFillup}
                onOpenUserProfile={() => setActiveTab('user-profile')}
                onOpenBulkImport={() => handleOpenBulkImport()}
              />
            )}
            {activeTab === 'take-attendance' && (
              <AttendanceStudio
                initialSubjectId={activeSubjectId}
                initialPart={activeSubjectPart}
                onNavigateToReports={handleViewReports}
              />
            )}
            {activeTab === 'assignments' && (
              <StudentAssignmentsTracker
                initialSubjectId={activeSubjectId}
                initialPart={activeSubjectPart}
              />
            )}
            {activeTab === 'form-fillup' && (
              <FormFillupManager initialClassId={activeFormFillupClassId} />
            )}
            {activeTab === 'reports' && (
              <ReportsAndTrends
                initialSubjectId={activeSubjectId}
                initialPart={activeSubjectPart}
                onOpenBulkImport={() => handleOpenBulkImport()}
              />
            )}
            {activeTab === 'roster' && (
              <ClassRosterView
                onOpenBulkImport={handleOpenBulkImport}
                onViewStudentProfile={handleOpenStudentProfile}
              />
            )}
            {activeTab === 'student-profile' && activeProfileStudentId && (
              <StudentProfileView
                studentId={activeProfileStudentId}
                onBack={() => setActiveTab('roster')}
                onSelectStudent={id => setActiveProfileStudentId(id)}
              />
            )}
            {activeTab === 'user-profile' && (
              <UserProfileView onBack={() => setActiveTab('my-subjects')} />
            )}
          </>
        ) : (
          /* Admin View */
          <>
            {activeTab === 'admin-assignments' && (
              <AdminAssignments />
            )}
            {activeTab === 'admin-classes' && (
              <ClassRosterView
                onOpenBulkImport={handleOpenBulkImport}
                onViewStudentProfile={handleOpenStudentProfile}
              />
            )}
            {activeTab === 'student-profile' && activeProfileStudentId && (
              <StudentProfileView
                studentId={activeProfileStudentId}
                onBack={() => setActiveTab('admin-classes')}
                onSelectStudent={id => setActiveProfileStudentId(id)}
              />
            )}
            {activeTab === 'user-profile' && (
              <UserProfileView onBack={() => setActiveTab('admin-assignments')} />
            )}
            {activeTab === 'assignments' && (
              <StudentAssignmentsTracker
                initialSubjectId={activeSubjectId}
                initialPart={activeSubjectPart}
              />
            )}
            {activeTab === 'form-fillup' && (
              <FormFillupManager initialClassId={activeFormFillupClassId} />
            )}
            {activeTab === 'reports' && (
              <ReportsAndTrends
                initialSubjectId={activeSubjectId}
                initialPart={activeSubjectPart}
                onOpenBulkImport={() => handleOpenBulkImport()}
              />
            )}
          </>
        )}
      </main>

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        defaultClassId={importTargetClassId}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Firebase Auth Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">Presently</span>
            <span className="text-slate-300">·</span>
            <span>BTEB Probidhan 2022</span>
            <span className="text-slate-300">·</span>
            <span>Diploma in Computer Science &amp; Technology (85)</span>
          </div>
          <span className="text-slate-400">
            Bangladesh Technical Education Board
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AttendanceProvider>
      <AttendanceApp />
    </AttendanceProvider>
  );
}

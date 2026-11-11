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

function AttendanceApp() {
  const { currentUser, setCurrentUser, users } = useAttendance();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return currentUser?.role === 'admin' ? 'admin-assignments' : 'my-subjects';
  });

  // Automatically switch tab if currentUser role changes
  React.useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
      if (activeTab === 'my-subjects' || activeTab === 'take-attendance' || activeTab === 'roster') {
        setActiveTab('admin-assignments');
      }
    } else {
      if (activeTab === 'admin-assignments' || activeTab === 'admin-classes') {
        setActiveTab('my-subjects');
      }
    }
  }, [currentUser?.role]);

  // Selected subject when transitioning into studio or reports
  const [activeSubjectId, setActiveSubjectId] = useState<string | undefined>(undefined);

  // Bulk import modal
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importTargetClassId, setImportTargetClassId] = useState<string | undefined>(undefined);

  // Login modal
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // If unauthenticated, display the authorized login screen!
  if (!currentUser) {
    return <AuthScreen />;
  }

  const handleStartAttendance = (subjectId?: string) => {
    setActiveSubjectId(subjectId);
    setActiveTab('take-attendance');
  };

  const handleViewReports = (subjectId?: string) => {
    setActiveSubjectId(subjectId);
    setActiveTab('reports');
  };

  const handleOpenBulkImport = (classId?: string) => {
    setImportTargetClassId(classId);
    setIsBulkImportOpen(true);
  };

  const handleSwitchToTeacher = (teacherId: string) => {
    const teacher = users.find(u => u.id === teacherId);
    if (teacher) {
      setCurrentUser(teacher);
      setActiveTab('my-subjects');
    }
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
                onOpenBulkImport={() => handleOpenBulkImport()}
              />
            )}
            {activeTab === 'take-attendance' && (
              <AttendanceStudio
                initialSubjectId={activeSubjectId}
                onNavigateToReports={handleViewReports}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsAndTrends
                initialSubjectId={activeSubjectId}
                onOpenBulkImport={() => handleOpenBulkImport()}
              />
            )}
            {activeTab === 'roster' && (
              <ClassRosterView onOpenBulkImport={handleOpenBulkImport} />
            )}
          </>
        ) : (
          /* Admin View */
          <>
            {activeTab === 'admin-assignments' && (
              <AdminAssignments onSwitchToTeacher={handleSwitchToTeacher} />
            )}
            {activeTab === 'admin-classes' && (
              <ClassRosterView onOpenBulkImport={handleOpenBulkImport} />
            )}
            {activeTab === 'reports' && (
              <ReportsAndTrends
                initialSubjectId={activeSubjectId}
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
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Presently Attendance System</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold">BTEB Curricula 2022 (Probidhan-22)</span>
            <span className="text-slate-300">•</span>
            <span>Realtime Firebase Firestore</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Bangladesh Technical Education Board • Diploma in Engineering</span>
          </div>
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

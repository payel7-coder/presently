# Presently — Smart Student Attendance & Performance Analytics

> **Institutional Roll Call & Academic Register System for Bangladesh Technical Education Board (BTEB) Diploma in Engineering (Probidhan 2022).**

Presently is a modern, high-speed educational platform built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Firebase Firestore**. It empowers teachers with single-click roll call, daily class target tracking with animated progress rings, official BTEB landscape PDF attendance register generation, and automated at-risk analytics (<75% threshold).

---

## ✨ Key Features

### 🎓 1. Institutional Teacher Workspace & Daily Goals
- **1-Click Roll Call**: Mark student attendance instantly across assigned BTEB courses with single-click badges (Present, Absent, Late, Excused) and bulk shortcuts.
- **Daily Class Target & Progress Ring**: Set daily class delivery goals (1–20 classes/day) with interactive steppers, presets (`[2]`, `[3]`, `[4]`, `[5]`, `[6]`), and an animated SVG progress ring tracking completed sessions in real-time.
- **Next Action Recommendation**: Directly highlights the next pending scheduled class with a 1-click **"Conduct Class"** trigger.
- **Strict Tomorrow & Future Date Safeguards**: Enforces institutional attendance rules by preventing attendance entry for tomorrow or any future date, backed by validation alerts, UI action locks, and core business logic guards.

### 📄 2. Official BTEB Landscape PDF Attendance Register
- Generates official BTEB-standard printable landscape PDF ledgers using `jspdf` and `jspdf-autotable`.
- Includes institutional headings, semester/technology headers (Computer Science & Technology - 85), student roll/registration numbers, session dates, present/absent breakdown, and official signature blocks.
- Supports both **Recorded Attendance Ledgers** and **Blank Classroom Log Sheets** with customizable date ranges.

### 🛡️ 3. Role-Based Access Control (RBAC) & Course Allocation
- **Admin Workspace**: Full curriculum management for BTEB Probidhan 2022 across 1st through 8th semesters.
- **Faculty Subject Assignment**: Admins assign specific semester subjects and class shifts (Shift-1 Day / Shift-2 Morning) to faculty members.
- **Strict Student Import Gating**: Bulk CSV student import and roster edits are strictly restricted to the Administrator role to safeguard academic records.

### 📊 4. Real-Time Analytics & CSV Export
- **Student Performance Matrix**: Track attendance rates, ongoing attendance streaks, and total hours attended.
- **At-Risk Warning System**: Automatic visual flags and alerts for students falling below the mandatory **75% BTEB board exam eligibility threshold**.
- **Data Export**: Export complete attendance matrices with session dates and status headers to CSV for spreadsheet analysis and institutional archival.

### ⚡ 5. Realtime Database & Persistence
- Integrated with **Firebase Firestore** with real-time snapshot synchronization across sessions.
- Seamless fallback and offline caching via `localStorage`.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Motion
- **Icons**: Lucide React
- **PDF Generation**: jsPDF & jsPDF-autotable
- **Backend / Database**: Firebase Firestore & Firebase Authentication
- **Test Framework**: Node.js Native Test Runner (`node:test` via `tsx`)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/presently-bteb-attendance.git
   cd presently-bteb-attendance
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional for local demo):
   ```bash
   cp .env.example .env
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality Checks

Run the automated test suite:
```bash
npm test
```

Run TypeScript compilation and lint verification:
```bash
npm run lint
```

Build for production:
```bash
npm run build
```

---

## 👥 Demo Credentials (1-Click Login)

The system includes pre-configured institutional faculty and administration accounts for testing:

| Role | Name | Email | Default Password |
|---|---|---|---|
| **Admin** | Engr. Payel Ahmed | `payelahmed70@gmail.com` | `Polytechnic@2022` |
| **Admin (Principal)** | Engr. Md. Rafiqul Islam | `principal@polytechnic.bteb.gov.bd` | `Polytechnic@2022` |
| **Teacher (HoD CST)** | Engr. Tanvir Ahmed | `tanvir.cst@polytechnic.bteb.gov.bd` | `Polytechnic@2022` |
| **Teacher (Instructor)** | Ms. Nusrat Jahan | `nusrat.cst@polytechnic.bteb.gov.bd` | `Polytechnic@2022` |
| **Teacher (Instructor)** | Engr. Kazi Hasan Mahmud | `hasan.cst@polytechnic.bteb.gov.bd` | `Polytechnic@2022` |

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── AttendanceStudio.tsx       # 1-click roll call & date validation
│   │   ├── TeacherDashboard.tsx       # Dashboard with daily target progress ring
│   │   ├── AdminAssignments.tsx      # Admin course allocation & faculty mapping
│   │   ├── BulkImportModal.tsx        # CSV student roster import (Admin only)
│   │   ├── DownloadRegisterModal.tsx  # Official BTEB PDF register configuration
│   │   ├── ReportsAndTrends.tsx       # Analytics, streaks, and risk monitoring
│   │   ├── ClassRosterView.tsx        # Student directory & contact cards
│   │   ├── AuthScreen.tsx             # Institutional sign in & register
│   │   └── Navbar.tsx                 # Header navigation & role indicator
│   ├── context/
│   │   └── AttendanceContext.tsx      # Global state, persistence & Firestore sync
│   ├── data/
│   │   └── btebCurriculum.ts          # BTEB 2022 1st–8th semester curriculum & faculty
│   ├── types/
│   │   └── attendance.ts              # TypeScript interfaces & domain models
│   ├── utils/
│   │   ├── attendanceLogic.ts         # Pure calculations, CSV parser & validation
│   │   ├── attendanceLogic.test.ts    # Unit tests for attendance & target logic
│   │   ├── pdfAttendanceRegister.ts   # Landscape BTEB PDF register engine
│   │   └── pdfAttendanceRegister.test.ts # Unit tests for PDF export
│   ├── firebase/
│   │   └── config.ts                  # Firebase initialization
│   ├── App.tsx                        # Main application view router
│   ├── main.tsx                       # React application entry point
│   └── index.css                      # Tailwind CSS entry
├── index.html                         # HTML entry with metadata
├── package.json                       # Dependencies & scripts
└── tsconfig.json                      # TypeScript configuration
```

---

## 📜 Curriculum Standard

Designed in compliance with the **Bangladesh Technical Education Board (BTEB) Diploma in Engineering Probidhan 2022** for the Department of **Computer Science & Technology (Technology Code: 85)**.

---

## 📄 License

This project is licensed under the Apache License 2.0.

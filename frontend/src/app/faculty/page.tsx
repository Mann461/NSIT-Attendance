"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode, Calendar, Clock, CheckCircle2, XCircle, RefreshCw, AlertTriangle,
  Play, StopCircle, Edit3, Download, Maximize2, LogOut, FileSpreadsheet, UserCheck, Search
} from "lucide-react";

export default function FacultyDashboard() {
  const router = useRouter();
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState<any>(null);
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form states
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduledStart, setRescheduledStart] = useState("");
  const [rescheduledEnd, setRescheduledEnd] = useState("");

  // Active Session & Realtime state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    const token = localStorage.getItem("smartattend_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/api/v1/timetable/schedule", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        throw new Error("Failed to load schedule");
      }
      const data = await res.json();
      setScheduleData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLecture = async (status: string) => {
    if (!selectedLecture) return;
    const token = localStorage.getItem("smartattend_token");

    try {
      const res = await fetch(`http://localhost:8000/api/v1/attendance/lecture/${selectedLecture.id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          cancel_reason: cancelReason,
          rescheduled_date: rescheduledDate,
          rescheduled_start: rescheduledStart,
          rescheduled_end: rescheduledEnd
        })
      });

      if (res.ok) {
        setShowConfirmModal(false);
        setShowCancelModal(false);
        setShowRescheduleModal(false);
        fetchSchedule();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartAttendance = async (lecture: any) => {
    const token = localStorage.getItem("smartattend_token");

    try {
      const res = await fetch(`http://localhost:8000/api/v1/attendance/lecture/${lecture.id}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ duration_minutes: 5 })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        fetchSessionDetails(data.session_id);
        setShowSessionModal(true);
        setupWebSocket(data.session_id);
        fetchSchedule();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSessionDetails = async (sessionIdOrToken: string | number) => {
    const token = localStorage.getItem("smartattend_token");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/attendance/session/${sessionIdOrToken}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const setupWebSocket = (sessionId: number) => {
    if (ws) ws.close();
    const socket = new WebSocket(`ws://localhost:8000/ws/attendance/${sessionId}`);

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "STUDENT_SCANNED" || msg.type === "ATTENDANCE_MODIFIED") {
        fetchSessionDetails(sessionId);
      } else if (msg.type === "SESSION_CLOSED") {
        fetchSessionDetails(sessionId);
      }
    };

    setWs(socket);
  };

  const handleCloseAttendance = async (sessionId: number) => {
    const token = localStorage.getItem("smartattend_token");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/attendance/session/${sessionId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSessionDetails(sessionId);
        fetchSchedule();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualEditStatus = async (sessionId: number, studentId: number, status: string) => {
    const token = localStorage.getItem("smartattend_token");
    try {
      await fetch(`http://localhost:8000/api/v1/attendance/session/${sessionId}/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ student_id: studentId, status, remarks: "Manual edit by faculty" })
      });
      fetchSessionDetails(sessionId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportExcel = (subjectId: int = 1) => {
    const token = localStorage.getItem("smartattend_token");
    window.open(`http://localhost:8000/api/v1/reports/export/excel?class_id=1&subject_id=${subjectId}`, "_blank");
  };

  const handleExportCSV = (subjectId: int = 1) => {
    const token = localStorage.getItem("smartattend_token");
    window.open(`http://localhost:8000/api/v1/reports/export/csv?class_id=1&subject_id=${subjectId}`, "_blank");
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-md shadow-blue-500/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">SmartAttend Faculty</h1>
            <p className="text-xs text-slate-400">Class Room 109 • Sem III</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExportExcel(1)}
            className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Sheet (.xlsx)
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        {/* Date & Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-md uppercase tracking-wider">
              {scheduleData?.day_name}'s Schedule
            </span>
            <h2 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" /> {scheduleData?.date}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Select a scheduled lecture below to confirm, conduct, or launch QR attendance.</p>
          </div>

          <button
            onClick={fetchSchedule}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Timetable
          </button>
        </div>

        {/* Schedule List */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" /> Today's Scheduled Lectures ({scheduleData?.lectures?.length || 0})
          </h3>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm bg-slate-900 border border-slate-800 rounded-2xl">
              Loading timetable schedule...
            </div>
          ) : scheduleData?.lectures?.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm bg-slate-900 border border-slate-800 rounded-2xl">
              No scheduled lectures for today.
            </div>
          ) : (
            scheduleData?.lectures?.map((lecture: any) => {
              const isConfirmed = lecture.status === "CONFIRMED";
              const isActive = lecture.status === "ACTIVE";
              const isCompleted = lecture.status === "COMPLETED";
              const isCancelled = lecture.status === "CANCELLED";
              const isRescheduled = lecture.status === "RESCHEDULED";

              return (
                <div
                  key={lecture.id}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive ? "border-blue-500 ring-1 ring-blue-500/30" : "border-slate-800"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-400 px-2.5 py-0.5 bg-blue-500/10 rounded-md">
                        {lecture.scheduled_start} - {lecture.scheduled_end}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Room {lecture.room}</span>
                      
                      {/* Status Badge */}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse-subtle" :
                        isConfirmed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                        isCompleted ? "bg-slate-800 text-slate-400 border border-slate-700" :
                        isCancelled ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                        isRescheduled ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                        "bg-slate-800 text-slate-300"
                      }`}>
                        {lecture.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-lg text-white">{lecture.subject_name}</h4>
                    <p className="text-xs text-slate-400">
                      Code: <span className="font-mono text-slate-300">{lecture.subject_code}</span> • Faculty: <span className="text-slate-300">{lecture.faculty_name}</span>
                    </p>

                    {isCancelled && (
                      <p className="text-xs text-red-400 font-medium pt-1">
                        Reason: {lecture.cancel_reason} (Excluded from attendance percentage)
                      </p>
                    )}

                    {isRescheduled && (
                      <p className="text-xs text-amber-400 font-medium pt-1">
                        Rescheduled to {lecture.rescheduled_date} ({lecture.rescheduled_start} - {lecture.rescheduled_end})
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {lecture.status === "SCHEDULED" && (
                      <button
                        onClick={() => {
                          setSelectedLecture(lecture);
                          setShowConfirmModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                      >
                        <UserCheck className="w-4 h-4" /> Confirm Lecture
                      </button>
                    )}

                    {(isConfirmed || isActive) && (
                      <button
                        onClick={() => {
                          if (isActive && lecture.active_session_token) {
                            fetchSessionDetails(lecture.active_session_token);
                            setShowSessionModal(true);
                            setupWebSocket(lecture.active_session_token);
                          } else {
                            handleStartAttendance(lecture);
                          }
                        }}
                        className={`px-4 py-2 font-semibold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 ${
                          isActive
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Play className="w-4 h-4" /> {isActive ? "View Active QR Session" : "Start Attendance"}
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => {
                          fetchSessionDetails(lecture.active_session_token || lecture.id);
                          setShowEditModal(true);
                        }}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> View / Edit Records
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* MODAL 1: Confirm Lecture Modal */}
      {showConfirmModal && selectedLecture && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div>
              <span className="text-xs font-mono font-bold text-blue-400 uppercase">Lecture Confirmation</span>
              <h3 className="text-xl font-bold text-white mt-1">Is this lecture being conducted?</h3>
              <p className="text-xs text-slate-400 mt-1">{selectedLecture.subject_name} • Room {selectedLecture.room}</p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => handleConfirmLecture("CONFIRMED")}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> 1. Lecture is being conducted
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowCancelModal(true);
                }}
                className="w-full py-3 bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> 2. Lecture cancelled / missed
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowRescheduleModal(true);
                }}
                className="w-full py-3 bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> 3. Lecture rescheduled
              </button>
            </div>

            <button
              onClick={() => setShowConfirmModal(false)}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Lecture Cancelled / Missed</h3>
            <p className="text-xs text-slate-400">Cancelled lectures will NOT count as an absent lecture for students.</p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-white focus:outline-none"
              >
                <option value="Faculty unavailable">Faculty unavailable</option>
                <option value="Institutional event">Institutional event</option>
                <option value="Holiday">Holiday</option>
                <option value="Timetable change">Timetable change</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-1/2 py-2.5 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => handleConfirmLecture("CANCELLED")}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Active QR Attendance Session Modal */}
      {showSessionModal && sessionDetails && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  ● Attendance Active
                </span>
                <h3 className="text-xl font-bold text-white">{sessionDetails.lecture?.subject_name}</h3>
                <p className="text-xs text-slate-400">Class Room {sessionDetails.lecture?.room} • {sessionDetails.lecture?.class_name}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/faculty/projector/${sessionDetails.session_id}`)}
                  className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Projector Mode
                </button>

                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* QR & Counter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* QR Display */}
              <div className="bg-white p-4 rounded-2xl shadow-inner flex flex-col items-center">
                <img
                  src={`http://localhost:8000/api/v1/attendance/qr-code/${sessionDetails.token}`}
                  alt="QR Code"
                  className="w-56 h-56 object-contain"
                />
                <p className="text-[11px] text-slate-500 font-mono mt-2 text-center break-all">
                  Token: {sessionDetails.token?.substring(0, 24)}...
                </p>
              </div>

              {/* Counter & Controls */}
              <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Attendance</p>
                  <p className="text-4xl font-extrabold text-emerald-400 mt-1">
                    {sessionDetails.stats?.present_count} / {sessionDetails.stats?.total_students}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{sessionDetails.stats?.percentage}% Present</p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Session Status:</span>
                  <span className="font-bold text-emerald-400 uppercase">{sessionDetails.status}</span>
                </div>

                {sessionDetails.status === "ACTIVE" && (
                  <button
                    onClick={() => handleCloseAttendance(sessionDetails.session_id)}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" /> Close Attendance
                  </button>
                )}
              </div>
            </div>

            {/* Student Scanned Feed */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Live Scanned Students</h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1.5">
                {sessionDetails.students?.filter((s: any) => s.status === "PRESENT").length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Waiting for students to scan QR code...</p>
                ) : (
                  sessionDetails.students?.filter((s: any) => s.status === "PRESENT").map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between text-xs py-1 px-2 bg-slate-900 rounded border border-slate-800">
                      <span className="font-mono text-slate-400">{st.roll_no} • {st.name}</span>
                      <span className="text-emerald-400 font-semibold">{st.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Records Modal */}
      {showEditModal && sessionDetails && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Attendance Records Editor</h3>
                <p className="text-xs text-slate-400">{sessionDetails.lecture?.subject_name} • {sessionDetails.lecture?.date}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white p-1">✕</button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search student name or roll number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500"
              />
            </div>

            <div className="max-h-80 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Roll</th>
                    <th className="p-2.5">Enrollment</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sessionDetails.students
                    ?.filter((s: any) => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.roll_no.includes(studentSearch))
                    .map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-850">
                        <td className="p-2.5 font-mono">{st.roll_no}</td>
                        <td className="p-2.5 font-mono">{st.enrollment_no}</td>
                        <td className="p-2.5 font-medium text-white">{st.name}</td>
                        <td className="p-2.5">
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${st.status === "PRESENT" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                            {st.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleManualEditStatus(sessionDetails.session_id, st.id, st.status === "PRESENT" ? "ABSENT" : "PRESENT")}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-blue-400 font-semibold rounded border border-slate-700"
                          >
                            Toggle to {st.status === "PRESENT" ? "ABSENT" : "PRESENT"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

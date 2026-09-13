"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode, Calendar, Clock, CheckCircle2, XCircle, RefreshCw, AlertTriangle,
  Play, StopCircle, Edit3, Download, Maximize2, LogOut, FileSpreadsheet,
  UserCheck, Search, X, ChevronRight, User, Sparkles
} from "lucide-react";

import { API_BASE_URL, getWsUrl } from "@/config";
import AttendanceQRCode from "@/components/AttendanceQRCode";

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
  const [cancelReason, setCancelReason] = useState("Faculty unavailable");
  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduledStart, setRescheduledStart] = useState("");
  const [rescheduledEnd, setRescheduledEnd] = useState("");

  // Active Session & Realtime state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const getLocalDateString = (dateObj: Date = new Date()) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    fetchSchedule(getLocalDateString());
  }, []);

  const fetchSchedule = async (dateStr?: string) => {
    setLoading(true);
    const token = localStorage.getItem("smartattend_token");
    if (!token) {
      router.push("/login");
      return;
    }

    const targetDate = dateStr || selectedDate || getLocalDateString();
    setSelectedDate(targetDate);

    try {
      const url = `${API_BASE_URL}/api/v1/timetable/schedule?date=${encodeURIComponent(targetDate)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        throw new Error("Failed to load schedule");
      }
      const data = await res.json();
      setScheduleData(data);
      if (data.date) {
        setSelectedDate(data.date);
      }
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
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/lecture/${selectedLecture.id}/confirm`, {
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
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/lecture/${lecture.id}/start`, {
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
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/session/${sessionIdOrToken}/details`, {
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
    const token = localStorage.getItem("smartattend_token") || "";
    const socket = new WebSocket(getWsUrl(sessionId, token));

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
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/session/${sessionId}/close`, {
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
      await fetch(`${API_BASE_URL}/api/v1/attendance/session/${sessionId}/edit`, {
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

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async (subjectId: number = 1) => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem("smartattend_token");
      const url = `${API_BASE_URL}/api/v1/reports/export/excel?class_id=1&subject_id=${subjectId}${token ? `&token=${encodeURIComponent(token)}` : ""}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        let errMsg = "Failed to export Excel sheet";
        try {
          const errData = await res.json();
          if (errData?.detail) errMsg = errData.detail;
        } catch {
          // ignore
        }
        alert(`Export failed: ${errMsg}`);
        return;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Lesson_Attendance_Sheet_Sub_${subjectId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export error:", err);
      alert(`Export failed: ${err.message || "Network error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col pb-safe">
      {/* Top Navbar */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900/95 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-md pt-safe">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 text-white">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm sm:text-base tracking-tight leading-tight">
                SmartAttend Faculty
              </h1>
              <p className="text-[11px] text-slate-400">Class Room 109 • Sem III</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportExcel(1)}
              disabled={isExporting}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 active:scale-95 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export Sheet"}</span>
              <span className="sm:hidden">{isExporting ? "..." : "Export"}</span>
            </button>
            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center gap-1"
            >
              <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        {/* Date & Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold rounded-md uppercase tracking-wider">
              {scheduleData?.day_name}&apos;s Schedule
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 mt-1">
              <Calendar className="w-5 h-5 text-blue-400" /> {scheduleData?.date}
            </h2>
            <p className="text-xs text-slate-400">
              Confirm lectures, start 5-min QR attendance, and review live scans.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  fetchSchedule(e.target.value);
                }
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              onClick={() => fetchSchedule()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center justify-center gap-2"
              title="Refresh / Reset to Today"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Today
            </button>
          </div>
        </div>

        {/* Schedule List */}
        <div className="space-y-3">
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>{scheduleData?.day_name}&apos;s Lectures ({scheduleData?.lectures?.length || 0})</span>
          </h3>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading timetable schedule...</span>
            </div>
          ) : scheduleData?.lectures?.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <p className="font-semibold text-slate-200 text-sm">
                No scheduled lectures for {scheduleData?.day_name} ({scheduleData?.date})
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Classes run Monday through Friday. On weekends (Saturday &amp; Sunday), no lectures are scheduled. Use the date selector above to browse any weekday timetable.
              </p>
              <button
                onClick={() => {
                  const d = new Date();
                  const day = d.getDay();
                  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                  d.setDate(diff);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  fetchSchedule(`${yyyy}-${mm}-${dd}`);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition"
              >
                <Calendar className="w-3.5 h-3.5" /> View Monday&apos;s Schedule
              </button>
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
                  className={`bg-slate-900/90 border rounded-2xl p-4 sm:p-5 shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isActive ? "border-blue-500 ring-1 ring-blue-500/30" : "border-slate-800"
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
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

                    <h4 className="font-bold text-base sm:text-lg text-white leading-snug">
                      {lecture.subject_name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Code: <span className="font-mono text-slate-300">{lecture.subject_code}</span> • Faculty: <span className="text-slate-300">{lecture.faculty_name}</span>
                    </p>

                    {isCancelled && (
                      <p className="text-xs text-red-400 font-medium pt-0.5">
                        Reason: {lecture.cancel_reason}
                      </p>
                    )}

                    {isRescheduled && (
                      <p className="text-xs text-amber-400 font-medium pt-0.5">
                        Rescheduled to {lecture.rescheduled_date} ({lecture.rescheduled_start} - {lecture.rescheduled_end})
                      </p>
                    )}
                  </div>

                  {/* Actions (Full width on mobile for thumb reach) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t border-slate-850 sm:border-0">
                    {lecture.status === "SCHEDULED" && (
                      <button
                        onClick={() => {
                          setSelectedLecture(lecture);
                          setShowConfirmModal(true);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-semibold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
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
                        className={`w-full sm:w-auto px-4 py-2.5 font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                          isActive
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Play className="w-4 h-4" /> {isActive ? "View Active Session" : "Start QR Attendance"}
                      </button>
                    )}

                    {isCompleted && (
                      <button
                        onClick={() => {
                          fetchSessionDetails(lecture.active_session_token || lecture.id);
                          setShowEditModal(true);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 pb-safe">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <div>
              <span className="text-[11px] font-mono font-bold text-blue-400 uppercase">Lecture Confirmation</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">Is this lecture being conducted?</h3>
              <p className="text-xs text-slate-400 mt-1">{selectedLecture.subject_name} • Room {selectedLecture.room}</p>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={() => handleConfirmLecture("CONFIRMED")}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> 1. Lecture is being conducted
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowCancelModal(true);
                }}
                className="w-full py-3.5 bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 active:scale-98 font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> 2. Lecture cancelled / missed
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowRescheduleModal(true);
                }}
                className="w-full py-3.5 bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600/30 active:scale-98 font-semibold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> 3. Lecture rescheduled
              </button>
            </div>

            <button
              onClick={() => setShowConfirmModal(false)}
              className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel Reason Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 pb-safe">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <h3 className="text-base sm:text-lg font-bold text-white">Lecture Cancelled / Missed</h3>
            <p className="text-xs text-slate-400">Cancelled lectures will NOT penalize student attendance records.</p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none"
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
                className="w-1/2 py-3 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => handleConfirmLecture("CANCELLED")}
                className="w-1/2 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2.5: Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 pb-safe">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <h3 className="text-base sm:text-lg font-bold text-white">Reschedule Lecture</h3>
            <p className="text-xs text-slate-400">Set the alternate date and time slot for this lecture.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduledDate}
                  onChange={(e) => setRescheduledDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={rescheduledStart}
                    onChange={(e) => setRescheduledStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    value={rescheduledEnd}
                    onChange={(e) => setRescheduledEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="w-1/2 py-3 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Back
              </button>
              <button
                onClick={() => handleConfirmLecture("RESCHEDULED")}
                className="w-1/2 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow"
              >
                Save Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Active QR Attendance Session Modal */}
      {showSessionModal && sessionDetails && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" /> Attendance Active
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
                  {sessionDetails.lecture?.subject_name}
                </h3>
                <p className="text-xs text-slate-400">Class Room {sessionDetails.lecture?.room}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/faculty/projector/${sessionDetails.session_id}`)}
                  className="px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Projector</span>
                </button>

                <button
                  onClick={() => setShowSessionModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* QR & Counter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              {/* QR Display */}
              <div className="max-w-[280px] mx-auto w-full">
                <AttendanceQRCode token={sessionDetails.token} size={180} />
              </div>

              {/* Counter & Controls */}
              <div className="space-y-3">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Present Count</p>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400 mt-1">
                    {sessionDetails.stats?.present_count} / {sessionDetails.stats?.total_students}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{sessionDetails.stats?.percentage}% Present</p>
                </div>

                {sessionDetails.status === "ACTIVE" && (
                  <button
                    onClick={() => handleCloseAttendance(sessionDetails.session_id)}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-98 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-600/20 transition flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" /> Close Attendance
                  </button>
                )}
              </div>
            </div>

            {/* Live Student Scanned Feed */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Live Scanned Students ({sessionDetails.students?.filter((s: any) => s.status === "PRESENT").length || 0})
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5">
                {sessionDetails.students?.filter((s: any) => s.status === "PRESENT").length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">Waiting for students to scan QR code...</p>
                ) : (
                  sessionDetails.students?.filter((s: any) => s.status === "PRESENT").map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="font-mono text-slate-300 font-medium">#{st.roll_no} • {st.name}</span>
                      <span className="text-emerald-400 font-mono text-[11px] font-semibold">{st.timestamp}</span>
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
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Attendance Records Editor</h3>
                <p className="text-xs text-slate-400">{sessionDetails.lecture?.subject_name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search student or roll..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* Responsive Card List on mobile, table on desktop */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {sessionDetails.students
                ?.filter((s: any) => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.roll_no.includes(studentSearch))
                .map((st: any) => (
                  <div key={st.id} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-blue-400">#{st.roll_no}</span>
                        <span className="font-medium text-white">{st.name}</span>
                      </div>
                      <span className={`inline-block mt-1 font-bold px-2 py-0.2 rounded text-[10px] ${
                        st.status === "PRESENT" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {st.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleManualEditStatus(sessionDetails.session_id, st.id, st.status === "PRESENT" ? "ABSENT" : "PRESENT")}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-blue-400 font-semibold rounded-lg border border-slate-700 whitespace-nowrap"
                    >
                      Make {st.status === "PRESENT" ? "Absent" : "Present"}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

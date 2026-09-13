"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Users, BookOpen, AlertTriangle, Activity, FileSpreadsheet,
  LogOut, Search, CheckCircle2, ChevronRight
} from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "low_attendance" | "audit">("overview");

  useEffect(() => {
    fetchAdminData();
    fetchAuditLogs();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    const token = localStorage.getItem("smartattend_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    const token = localStorage.getItem("smartattend_token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reports/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setAuditLogs(json);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [exportingSubjectId, setExportingSubjectId] = useState<number | null>(null);

  const handleExportExcel = async (subjectId: number = 1) => {
    try {
      setExportingSubjectId(subjectId);
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
      setExportingSubjectId(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col pb-safe">
      {/* Top Bar */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md pt-safe">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-md shadow-indigo-500/20 text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm sm:text-base tracking-tight leading-tight">
              SmartAttend Admin
            </h1>
            <p className="text-[11px] text-slate-400">Class Management • B.Tech Sem III</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportExcel(1)}
            disabled={exportingSubjectId !== null}
            className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 active:scale-95 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{exportingSubjectId === 1 ? "Exporting..." : "Export Class Sheet"}</span>
            <span className="sm:hidden">{exportingSubjectId === 1 ? "..." : "Export"}</span>
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
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        {/* Class Metrics: 2 columns on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-md">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Class & Room</p>
            <h3 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug">{data?.class_name || "CSE (CS)"}</h3>
            <p className="text-[11px] text-blue-400 font-semibold mt-0.5">Sem {data?.semester || "III"} • Room 109</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-md">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Enrolled</p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-white mt-1">{data?.total_students || 33} Students</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Roll 001 - 033</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-md">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Avg</p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-emerald-400 mt-1">{data?.overall_class_attendance}%</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Class aggregate</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-md">
            <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Attendance</p>
            <h3 className="text-lg sm:text-2xl font-extrabold text-red-400 mt-1">
              {data?.low_attendance_students?.length || 0} Students
            </h3>
            <p className="text-[11px] text-red-400/80 font-medium mt-0.5">&lt;75% threshold</p>
          </div>
        </div>

        {/* Tab Navigation: Horizontally swipeable on mobile */}
        <div className="flex border-b border-slate-800 gap-4 sm:gap-6 overflow-x-auto scrollbar-none pb-0.5">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === "overview" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Overview & Core Subjects
          </button>

          <button
            onClick={() => setActiveTab("low_attendance")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "low_attendance" ? "border-red-500 text-red-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Low Attendance ({data?.low_attendance_students?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "audit" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> System Audit Logs
          </button>
        </div>

        {/* TAB 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md">
              <h3 className="text-sm sm:text-base font-bold text-white mb-3">Configured Theory Subjects (6)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { code: "CTBT-BSC-301", name: "Engineering Mathematics III", faculty: "Dr. Akash Thakkar (AT)", credits: 4 },
                  { code: "CTBT-PCC-301", name: "Data Structures & Algorithms", faculty: "Dr. Minal Shah (MS)", credits: 3 },
                  { code: "CTBT-PCC-302", name: "Database Management Systems", faculty: "Prof. (Dr.) Sailesh Iyer (SI)", credits: 3 },
                  { code: "CTBT-PCC-303", name: "Computer Programming with Python", faculty: "Dr. Nikunj Tahilramani (NT)", credits: 2 },
                  { code: "CTBT-PCC-304", name: "Computer Organization & Microprocessors", faculty: "Dr. Vishali Sharma (VS)", credits: 3 },
                  { code: "CTBT-ESC-301", name: "Essentials of Cyber Security", faculty: "Ms. Hepi Suthar (HS)", credits: 3 },
                ].map((sub, i) => (
                  <div key={i} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                      {sub.code}
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm mt-1">{sub.name}</h4>
                    <p className="text-xs text-slate-400 truncate">Faculty: {sub.faculty}</p>
                    <div className="pt-2 text-[11px] text-slate-500 flex justify-between items-center border-t border-slate-850">
                      <span>Credits: {sub.credits}</span>
                      <button 
                        onClick={() => handleExportExcel(i + 1)} 
                        disabled={exportingSubjectId !== null}
                        className="text-blue-400 font-semibold hover:underline disabled:opacity-50"
                      >
                        {exportingSubjectId === (i + 1) ? "Exporting..." : "Export Sheet"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Low Attendance Warning */}
        {activeTab === "low_attendance" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" /> Students Below Mandatory 75% Threshold
              </h3>
              <p className="text-xs text-slate-400 mt-1">Shortage alert list. These students are at risk of exam debarment.</p>
            </div>

            {data?.low_attendance_students?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-slate-850">
                All 33 students are currently above the 75% attendance threshold.
              </div>
            ) : (
              <div className="space-y-2">
                {data?.low_attendance_students?.map((st: any) => (
                  <div key={st.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-400">#{st.roll_no}</span>
                        <span className="font-bold text-white text-sm">{st.name}</span>
                      </div>
                      <p className="font-mono text-slate-400 text-[11px] mt-0.5">{st.enrollment_no}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-red-400 block">{st.overall_percentage}%</span>
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">
                        WARNING
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Audit Logs */}
        {activeTab === "audit" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Security & Action Audit Trail
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 font-mono">{log.action}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{log.timestamp}</span>
                  </div>
                  <p className="text-slate-200">
                    <span className="font-semibold text-white">{log.user_name}</span> • {log.details}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

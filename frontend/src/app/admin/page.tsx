"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Users, BookOpen, AlertTriangle, Activity, FileSpreadsheet,
  LogOut, Search, CheckCircle2, ChevronRight
} from "lucide-react";

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
      const res = await fetch("http://localhost:8000/api/v1/dashboard/admin", {
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
      const res = await fetch("http://localhost:8000/api/v1/reports/audit-logs", {
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

  const handleExportExcel = (subjectId: number = 1) => {
    window.open(`http://localhost:8000/api/v1/reports/export/excel?class_id=1&subject_id=${subjectId}`, "_blank");
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">SmartAttend Administrator</h1>
            <p className="text-xs text-slate-400">Class Management • B.Tech Sem III</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleExportExcel(1)}
            className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Class Attendance Sheet
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
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        {/* Class Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Class & Room</p>
            <h3 className="text-lg font-bold text-white mt-1">{data?.class_name || "CSE (Cyber Security)"}</h3>
            <p className="text-xs text-blue-400 font-semibold mt-1">Sem {data?.semester || "III"} • Room 109</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Enrolled Students</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">{data?.total_students || 33} Students</h3>
            <p className="text-xs text-slate-400 mt-1">Roll 001 - 033</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Attendance</p>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{data?.overall_class_attendance}%</h3>
            <p className="text-xs text-slate-400 mt-1">Class Average across all subjects</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-md">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance Warning (&lt;75%)</p>
            <h3 className="text-2xl font-extrabold text-red-400 mt-1">
              {data?.low_attendance_students?.length || 0} Students
            </h3>
            <p className="text-xs text-red-400/80 font-medium mt-1">Shortage threshold alerts</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-bold border-b-2 transition ${
              activeTab === "overview" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Overview & Core Subjects
          </button>

          <button
            onClick={() => setActiveTab("low_attendance")}
            className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "low_attendance" ? "border-red-500 text-red-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Low Attendance Alerts (&lt;75%)
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "audit" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Activity className="w-4 h-4" /> System Audit Logs
          </button>
        </div>

        {/* TAB 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
              <h3 className="text-base font-bold text-white mb-4">Configured Theory Subjects (6)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { code: "CTBT-BSC-301", name: "Engineering Mathematics III", faculty: "Dr. Akash Thakkar (AT)", credits: 4 },
                  { code: "CTBT-PCC-301", name: "Data Structures & Algorithms", faculty: "Dr. Minal Shah (MS)", credits: 3 },
                  { code: "CTBT-PCC-302", name: "Database Management Systems", faculty: "Prof. (Dr.) Sailesh Iyer (SI)", credits: 3 },
                  { code: "CTBT-PCC-303", name: "Computer Programming with Python", faculty: "Dr. Nikunj Tahilramani (NT)", credits: 2 },
                  { code: "CTBT-PCC-304", name: "Computer Organization & Microprocessors", faculty: "Dr. Vishali Sharma (VS)", credits: 3 },
                  { code: "CTBT-ESC-301", name: "Essentials of Cyber Security", faculty: "Ms. Hepi Suthar (HS)", credits: 3 },
                ].map((sub, i) => (
                  <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                      {sub.code}
                    </span>
                    <h4 className="font-bold text-white text-sm mt-1">{sub.name}</h4>
                    <p className="text-xs text-slate-400">Faculty: {sub.faculty}</p>
                    <div className="pt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-850">
                      <span>Credits: {sub.credits}</span>
                      <button onClick={() => handleExportExcel(i + 1)} className="text-blue-400 font-semibold hover:underline">
                        Export Sheet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Low Attendance Warning Table */}
        {activeTab === "low_attendance" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" /> Students Below Mandatory 75% Threshold
              </h3>
              <p className="text-xs text-slate-400 mt-1">Automated shortage alert table. These students are at risk of term debarment.</p>
            </div>

            {data?.low_attendance_students?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-950 rounded-xl border border-slate-850">
                All 33 students are currently above the 75% attendance threshold.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Roll No</th>
                      <th className="p-3">Enrollment No</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Overall Attendance %</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data?.low_attendance_students?.map((st: any) => (
                      <tr key={st.id} className="hover:bg-slate-850">
                        <td className="p-3 font-mono">{st.roll_no}</td>
                        <td className="p-3 font-mono">{st.enrollment_no}</td>
                        <td className="p-3 font-bold text-white">{st.name}</td>
                        <td className="p-3 font-extrabold text-red-400">{st.overall_percentage}%</td>
                        <td className="p-3 text-right">
                          <span className="px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-md font-bold text-[10px]">
                            SHORTAGE WARNING
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Audit Logs */}
        {activeTab === "audit" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Security & Action Audit Trail
            </h3>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-850 font-mono">
                      <td className="p-3 text-slate-400">{log.timestamp}</td>
                      <td className="p-3 text-slate-200 font-sans">{log.user_name}</td>
                      <td className="p-3 font-bold text-blue-400">{log.action}</td>
                      <td className="p-3 text-slate-400">{log.entity}</td>
                      <td className="p-3 text-slate-300 font-sans">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

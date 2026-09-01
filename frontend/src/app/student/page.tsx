"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, LogOut, CheckCircle2, XCircle, BookOpen, User, Percent, AlertCircle, ChevronRight } from "lucide-react";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const token = localStorage.getItem("smartattend_token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:8000/api/v1/dashboard/student", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load dashboard data");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("smartattend_token");
    localStorage.removeItem("smartattend_user");
    await fetch("http://localhost:8000/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading student attendance portal...</p>
        </div>
      </div>
    );
  }

  const student = data?.student;
  const overallPct = data?.overall_percentage ?? 0.0;
  const isWarning = overallPct < 75.0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-md shadow-blue-500/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">SmartAttend Student</h1>
            <p className="text-xs text-slate-400">{student?.name} • Roll: {student?.roll_no}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        {/* Student Profile & Overall Attendance Summary Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold rounded-md">
                  {student?.branch}
                </span>
                <span className="text-xs text-slate-400">Sem {student?.semester} • Class 109</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">{student?.name}</h2>
              <p className="text-xs text-slate-400 mt-1">Enrollment: <span className="font-mono text-slate-200">{student?.enrollment_no}</span></p>
            </div>

            <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Attendance</p>
                <p className={`text-3xl font-black ${isWarning ? "text-red-400" : "text-emerald-400"}`}>
                  {overallPct}%
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {data?.total_present} / {data?.total_conducted} Conducted Lectures
                </p>
              </div>

              <div className={`p-3 rounded-full border ${isWarning ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                <Percent className="w-7 h-7" />
              </div>
            </div>
          </div>

          {isWarning && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Warning: Your attendance is below the mandatory 75% threshold!</span>
            </div>
          )}
        </div>

        {/* Subject Wise Cards */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              Subject-Wise Breakdown ({data?.subject_summaries?.length ?? 0} Subjects)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.subject_summaries?.map((sub: any) => {
              const subPct = sub.percentage;
              const isSubLow = subPct < 75.0;

              return (
                <div
                  key={sub.subject_id}
                  onClick={() => setSelectedSubject(sub)}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-md transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded">
                        {sub.subject_code}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSubLow ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {subPct}%
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-sm group-hover:text-blue-400 transition mb-1">
                      {sub.subject_name}
                    </h4>
                    <p className="text-xs text-slate-400">{sub.faculty_name}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <span>Attendance: <strong className="text-slate-200">{sub.present_count} / {sub.total_conducted}</strong> lectures</span>
                    <span className="flex items-center text-blue-400 font-semibold group-hover:translate-x-1 transition">
                      Details <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Subject Detail Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-blue-400">{selectedSubject.subject_code}</span>
                <h3 className="text-lg font-bold text-white">{selectedSubject.subject_name}</h3>
                <p className="text-xs text-slate-400">Faculty: {selectedSubject.faculty_name}</p>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400">Attended / Conducted</p>
                <p className="text-xl font-bold text-white mt-0.5">{selectedSubject.present_count} / {selectedSubject.total_conducted}</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400">Subject Attendance</p>
                <p className={`text-xl font-bold mt-0.5 ${selectedSubject.percentage < 75 ? "text-red-400" : "text-emerald-400"}`}>
                  {selectedSubject.percentage}%
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedSubject(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

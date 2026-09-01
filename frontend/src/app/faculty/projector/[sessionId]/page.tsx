"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { QrCode, ArrowLeft, StopCircle, CheckCircle2, Clock } from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function ProjectorModePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchSession = async () => {
    const token = localStorage.getItem("smartattend_token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/session/${sessionId}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    const token = localStorage.getItem("smartattend_token");
    try {
      await fetch(`${API_BASE_URL}/api/v1/attendance/session/${sessionId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchSession();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading classroom projector view...
      </div>
    );
  }

  const lecture = details?.lecture;
  const stats = details?.stats;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-8">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/faculty")}
            className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition"
          >
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{lecture?.subject_name}</h1>
            <p className="text-sm text-slate-400 font-medium">
              {lecture?.class_name} • Room {lecture?.room} • {lecture?.scheduled_start} - {lecture?.scheduled_end}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <span className="w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">
              {details?.status === "ACTIVE" ? "Attendance Active" : "Attendance Closed"}
            </span>
          </div>

          {details?.status === "ACTIVE" && (
            <button
              onClick={handleCloseSession}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-red-600/30 transition flex items-center gap-2"
            >
              <StopCircle className="w-5 h-5" /> Close Attendance
            </button>
          )}
        </div>
      </div>

      {/* Main Center Display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center my-auto py-8 max-w-6xl mx-auto w-full">
        {/* QR Code Presentation Box */}
        <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border-4 border-blue-500">
          <img
            src={`${API_BASE_URL}/api/v1/attendance/qr-code/${details?.token}`}
            alt="Class QR Code"
            className="w-80 h-80 object-contain"
          />
          <p className="text-xs text-slate-500 font-mono mt-4 font-bold tracking-widest uppercase">
            SCAN QR WITH YOUR PHONE CAMERA
          </p>
        </div>

        {/* Big Counter & Scanned Feed */}
        <div className="space-y-8">
          <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl text-center backdrop-blur-xl shadow-2xl">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">STUDENT ATTENDANCE COUNT</p>
            <p className="text-7xl font-black text-emerald-400 mt-2 tracking-tight">
              {stats?.present_count} <span className="text-4xl text-slate-500 font-normal">/ {stats?.total_students}</span>
            </p>
            <div className="w-full bg-slate-800 rounded-full h-3.5 mt-6 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-blue-500 h-full transition-all duration-500"
                style={{ width: `${stats?.percentage}%` }}
              />
            </div>
            <p className="text-sm font-semibold text-slate-400 mt-3">{stats?.percentage}% Recorded</p>
          </div>

          {/* Recent Realtime Scans */}
          <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Scanned Stream</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {details?.students?.filter((s: any) => s.status === "PRESENT").length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center py-4">Waiting for first student scan...</p>
              ) : (
                details?.students
                  ?.filter((s: any) => s.status === "PRESENT")
                  .map((st: any) => (
                    <div key={st.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                      <span className="font-bold text-white font-mono">{st.roll_no} • {st.name}</span>
                      <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {st.timestamp}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-500">
        <span>SmartAttend Classroom Projector Mode • Session ID: #{sessionId}</span>
        <span>Narnarayan Shastri Institute of Technology</span>
      </div>
    </div>
  );
}

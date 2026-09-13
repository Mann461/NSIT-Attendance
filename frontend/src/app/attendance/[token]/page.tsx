"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, QrCode, ArrowRight, ShieldAlert, Clock, Home, RefreshCw } from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function StudentAttendanceLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (token) {
      markAttendance();
    }
  }, [token]);

  const markAttendance = async () => {
    setLoading(true);
    setErrorStatus(null);
    setErrorMessage("");

    const authToken = localStorage.getItem("smartattend_token");
    if (!authToken) {
      // Redirect to login with return parameter
      router.push(`/login?redirect=/attendance/${token}`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ session_token: token })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorStatus("ERROR");
        setErrorMessage(data.detail || "Unable to mark attendance");
      } else {
        if (data.status === "ALREADY_RECORDED") {
          setErrorStatus("ALREADY_RECORDED");
          setResult(data);
        } else {
          setErrorStatus("SUCCESS");
          setResult(data);
        }
      }
    } catch (err: any) {
      setErrorStatus("ERROR");
      setErrorMessage("Network error connecting to attendance server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 pt-safe pb-safe">
      {/* Top Brand Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">SmartAttend</h2>
            <p className="text-[10px] text-slate-400">NSIT-IFSCS Class 109</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/student")}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 active:scale-95 text-xs text-slate-300 rounded-xl flex items-center gap-1 transition"
        >
          <Home className="w-3.5 h-3.5" /> Dashboard
        </button>
      </div>

      {/* Main Result Card */}
      <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center my-auto space-y-6">
        {loading ? (
          <div className="py-12 space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Validating QR Code...</h3>
              <p className="text-xs text-slate-400">Verifying session token and student device security</p>
            </div>
          </div>
        ) : errorStatus === "SUCCESS" ? (
          <div className="space-y-5">
            {/* Animated Checkmark */}
            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
                Attendance Recorded!
              </h2>
              <span className="mt-1 px-3 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full uppercase tracking-wider">
                ✓ PRESENT
              </span>
            </div>

            {/* Attendance Details Table */}
            <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-900">
                <span className="text-slate-400">Subject:</span>
                <span className="font-bold text-white text-right max-w-[200px] truncate">
                  {result?.record?.subject_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-900">
                <span className="text-slate-400">Subject Code:</span>
                <span className="font-mono text-blue-400 font-bold">{result?.record?.subject_code}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-900">
                <span className="text-slate-400">Student:</span>
                <span className="font-semibold text-slate-200">{result?.record?.student_name}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Recorded At:</span>
                <span className="font-mono text-emerald-400 font-semibold">{result?.record?.timestamp}</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              Open Student Portal <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : errorStatus === "ALREADY_RECORDED" ? (
          <div className="space-y-5">
            <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col items-center">
              <CheckCircle2 className="w-14 h-14 text-blue-400 mb-2" />
              <h2 className="text-lg sm:text-xl font-bold text-blue-300">
                Already Marked Present
              </h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Your attendance for this lecture session was already successfully recorded. Duplicate scans are ignored.
              </p>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white font-semibold text-sm rounded-xl transition"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center">
              <ShieldAlert className="w-14 h-14 text-red-400 mb-2" />
              <h2 className="text-lg font-bold text-red-400">Verification Failed</h2>
              <p className="text-xs text-red-300 mt-2 font-medium leading-relaxed">{errorMessage}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={markAttendance}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-semibold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
              </button>

              <button
                onClick={() => router.push("/student")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-semibold text-xs rounded-xl transition"
              >
                Return to Student Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      <p className="text-center text-[10px] text-slate-500 py-2">
        SmartAttend Security • 1 Device / 1 Scan Policy Enforced
      </p>
    </div>
  );
}

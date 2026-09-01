"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, QrCode, ArrowRight, ShieldAlert, Clock } from "lucide-react";

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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        {/* Top Header Logo */}
        <div className="flex justify-center mb-2">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
            <QrCode className="w-8 h-8 text-white" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">SmartAttend Verification</h1>
          <p className="text-xs text-slate-400 mt-1">B.Tech Sem III • Cyber Security</p>
        </div>

        {loading ? (
          <div className="py-12 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300">Validating QR token & device security...</p>
          </div>
        ) : errorStatus === "SUCCESS" ? (
          <div className="space-y-6">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col items-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-2" />
              <h2 className="text-2xl font-black text-emerald-400 tracking-tight">✓ Attendance Recorded</h2>
              <span className="mt-1 px-3 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full">
                PRESENT
              </span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Subject:</span>
                <span className="font-bold text-white">{result?.record?.subject_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Subject Code:</span>
                <span className="font-mono text-blue-400">{result?.record?.subject_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="font-semibold text-slate-200">{result?.record?.student_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="font-mono text-emerald-400">{result?.record?.timestamp}</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              Go to Student Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : errorStatus === "ALREADY_RECORDED" ? (
          <div className="space-y-6">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col items-center">
              <CheckCircle2 className="w-16 h-16 text-blue-400 mb-2" />
              <h2 className="text-xl font-bold text-blue-400">✓ Attendance Already Recorded</h2>
              <p className="text-xs text-slate-300 mt-2">
                You were already marked present for this lecture session.
              </p>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm rounded-xl transition"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center">
              <ShieldAlert className="w-16 h-16 text-red-400 mb-2" />
              <h2 className="text-lg font-bold text-red-400">Attendance Verification Failed</h2>
              <p className="text-xs text-red-300 mt-2 font-medium">{errorMessage}</p>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition"
            >
              Return to Student Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

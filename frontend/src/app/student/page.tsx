"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode, LogOut, CheckCircle2, XCircle, BookOpen, User, Percent,
  AlertCircle, ChevronRight, Camera, X, RefreshCw, Sparkles,
  TrendingUp, Award, Clock, ArrowRight, ShieldCheck, Flame
} from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  // Mobile navigation active tab: "overview" | "subjects"
  const [activeTab, setActiveTab] = useState<"overview" | "subjects">("overview");

  // Mobile Camera QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef<any>(null);

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
      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/student`, {
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
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: "POST" });
    } catch (e) {
      // ignore
    }
    router.push("/login");
  };

  // Start mobile in-app camera scanner
  const startScanner = async () => {
    setShowScanner(true);
    setScannerError("");
    setIsScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Allow DOM to render scanner div
      setTimeout(async () => {
        try {
          const scannerElement = document.getElementById("mobile-qr-reader");
          if (!scannerElement) return;

          if (qrScannerRef.current) {
            try {
              await qrScannerRef.current.stop();
            } catch (e) {
              // ignore
            }
          }

          const html5QrCode = new Html5Qrcode("mobile-qr-reader");
          qrScannerRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1.0,
            },
            (decodedText) => {
              // Extract token from QR
              handleScanSuccess(decodedText);
            },
            (errorMessage) => {
              // Continuous scanning log (ignore frames without QR)
            }
          );
        } catch (err: any) {
          console.error("Camera access error:", err);
          setScannerError(
            err?.message?.includes("NotAllowedError") || err?.name === "NotAllowedError"
              ? "Camera permission denied. Please enable camera access in your mobile browser settings."
              : "Unable to access camera on this device. You can also scan using your phone's native camera app."
          );
          setIsScanning(false);
        }
      }, 300);
    } catch (err) {
      setScannerError("QR Scanner module failed to load. Please try again.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      qrScannerRef.current = null;
    }
    setShowScanner(false);
    setIsScanning(false);
  };

  const handleScanSuccess = async (decodedText: string) => {
    await stopScanner();

    // Parse decoded text (either full URL or raw session token)
    let token = decodedText.trim();
    if (token.includes("/attendance/")) {
      const parts = token.split("/attendance/");
      token = parts[parts.length - 1].split("?")[0].split("/")[0];
    } else if (token.includes("token=")) {
      const urlParams = new URLSearchParams(token.split("?")[1]);
      token = urlParams.get("token") || token;
    }

    if (token) {
      router.push(`/attendance/${token}`);
    }
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        try {
          qrScannerRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400">Loading your attendance...</p>
        </div>
      </div>
    );
  }

  const student = data?.student;
  const overallPct = data?.overall_percentage ?? 0.0;
  const isWarning = overallPct < 75.0;
  const totalPresent = data?.total_present ?? 0;
  const totalConducted = data?.total_conducted ?? 0;

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col pb-safe-nav md:pb-8">
      {/* Mobile Top App Bar */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900/95 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-md pt-safe">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-sm">
              {student?.name?.charAt(0) || "S"}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight truncate max-w-[170px] sm:max-w-xs">
                  {student?.name}
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded font-semibold">
                  #{student?.roll_no}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {student?.branch} • Sem {student?.semester}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startScanner}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline">Scan QR</span>
            </button>

            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700/80 transition flex items-center gap-1"
            >
              <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full px-3.5 sm:px-6 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6">
        {/* Quick Tabs for Mobile */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition text-center ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Overview & Status
          </button>
          <button
            onClick={() => setActiveTab("subjects")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition text-center ${
              activeTab === "subjects"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Subjects ({data?.subject_summaries?.length || 0})
          </button>
        </div>

        {activeTab === "overview" && (
          <>
            {/* Overall Attendance Hero Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
              {/* Subtle background glow */}
              <div className={`absolute -right-8 -top-8 w-40 h-40 rounded-full blur-3xl pointer-events-none ${isWarning ? "bg-red-500/10" : "bg-emerald-500/10"}`} />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-bold rounded-md uppercase tracking-wider">
                      NSIT Room 109
                    </span>
                    <span className="text-[11px] text-slate-400">Class of 33</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                    Semester III Attendance
                  </h2>
                  <p className="text-xs text-slate-400">
                    Enrollment: <span className="font-mono text-slate-200">{student?.enrollment_no}</span>
                  </p>
                </div>

                {/* Percentage Display */}
                <div className="flex items-center gap-3.5 bg-slate-950/90 p-3.5 sm:p-4 rounded-xl border border-slate-800/90 self-stretch sm:self-auto justify-between sm:justify-start">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Overall Score
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl sm:text-4xl font-black tracking-tight ${isWarning ? "text-red-400" : "text-emerald-400"}`}>
                        {overallPct}%
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                      {totalPresent} of {totalConducted} Lectures
                    </span>
                  </div>

                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${
                    isWarning
                      ? "bg-red-500/15 border-red-500/30 text-red-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  }`}>
                    <Percent className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Current Attendance Rate</span>
                  <span className={isWarning ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                    {overallPct}% (75% min required)
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isWarning ? "bg-gradient-to-r from-red-500 to-amber-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, overallPct))}%` }}
                  />
                </div>
              </div>

              {/* Warning Alert or Safe Banner */}
              {isWarning ? (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="leading-snug">
                    Attendance is below 75%! Attend remaining lectures to avoid detention.
                  </span>
                </div>
              ) : (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="leading-snug">
                    Great job! You meet the university eligibility criteria (&ge;75%).
                  </span>
                </div>
              )}
            </div>

            {/* Mobile Scan Promotion Card */}
            <div className="bg-blue-600/15 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-600/40">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">In Class Right Now?</h3>
                  <p className="text-[11px] text-blue-300">Point your camera at the board QR code</p>
                </div>
              </div>

              <button
                onClick={startScanner}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/40 transition whitespace-nowrap flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" /> Scan Now
              </button>
            </div>
          </>
        )}

        {/* Subject Wise Cards Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Theory Subjects ({data?.subject_summaries?.length || 0})</span>
            </h3>
            <span className="text-[11px] text-slate-400">Tap for details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {data?.subject_summaries?.map((sub: any) => {
              const subPct = sub.percentage ?? 0;
              const isSubLow = subPct < 75.0;

              return (
                <div
                  key={sub.subject_id}
                  onClick={() => setSelectedSubject(sub)}
                  className="bg-slate-900/90 active:bg-slate-850 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 shadow-md transition cursor-pointer flex flex-col justify-between group touch-manipulation"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-mono font-bold text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-md">
                        {sub.subject_code}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isSubLow
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      }`}>
                        {subPct}%
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-sm leading-snug group-hover:text-blue-400 transition mb-1">
                      {sub.subject_name}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {sub.faculty_name}
                    </p>
                  </div>

                  {/* Progress Line */}
                  <div className="mt-3.5 space-y-1.5">
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSubLow ? "bg-red-400" : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, subPct))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Attended: <strong className="text-slate-200">{sub.present_count} / {sub.total_conducted}</strong></span>
                      <span className="flex items-center text-blue-400 font-semibold group-hover:translate-x-0.5 transition">
                        View <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 border-t border-slate-800/90 backdrop-blur-lg pb-safe md:hidden">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-around">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              activeTab === "overview" ? "text-blue-400 font-bold" : "text-slate-400"
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px]">Overview</span>
          </button>

          {/* Central Floating Scanner Button */}
          <button
            onClick={startScanner}
            className="flex flex-col items-center -mt-6 group active:scale-95 transition"
          >
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/50 border-4 border-slate-950 text-white">
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-blue-400 mt-0.5">Scan QR</span>
          </button>

          <button
            onClick={() => setActiveTab("subjects")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
              activeTab === "subjects" ? "text-blue-400 font-bold" : "text-slate-400"
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px]">Subjects</span>
          </button>
        </div>
      </nav>

      {/* MODAL: Mobile In-App QR Scanner */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-6">
          <div className="w-full max-w-md flex items-center justify-between pt-safe">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-base">Scan Attendance QR</h3>
            </div>
            <button
              onClick={stopScanner}
              className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="w-full max-w-sm flex flex-col items-center my-auto space-y-4">
            <div className="relative w-full aspect-square max-w-[300px] bg-black rounded-3xl overflow-hidden border-2 border-blue-500/80 shadow-2xl flex items-center justify-center">
              {/* html5-qrcode target container */}
              <div id="mobile-qr-reader" className="w-full h-full" />

              {/* Scanning crosshair guide overlay */}
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-400/40 rounded-2xl m-6 animate-pulse" />
            </div>

            {scannerError ? (
              <div className="p-3.5 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 text-xs text-center space-y-2">
                <p>{scannerError}</p>
                <button
                  onClick={startScanner}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold"
                >
                  Retry Camera
                </button>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-xs font-medium text-slate-300">
                  Align the classroom QR code inside the box
                </p>
                <p className="text-[11px] text-slate-500">
                  Attendance will record automatically once detected
                </p>
              </div>
            )}
          </div>

          <div className="w-full max-w-md pb-safe">
            <button
              onClick={stopScanner}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-semibold text-xs rounded-xl transition"
            >
              Close Camera
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Subject Detail Bottom-Sheet / Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto pb-safe">
            {/* Top drag bar for mobile feel */}
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />

            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-blue-400 uppercase">
                  {selectedSubject.subject_code}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
                  {selectedSubject.subject_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Faculty: {selectedSubject.faculty_name}</p>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">Attended / Total</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  {selectedSubject.present_count} / {selectedSubject.total_conducted}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Conducted Lectures</p>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
                <p className="text-[11px] text-slate-400">Subject Attendance</p>
                <p className={`text-xl font-black mt-0.5 ${selectedSubject.percentage < 75 ? "text-red-400" : "text-emerald-400"}`}>
                  {selectedSubject.percentage}%
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {selectedSubject.percentage >= 75 ? "Eligible" : "Attendance Low"}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedSubject(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-white font-semibold text-xs rounded-xl transition"
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

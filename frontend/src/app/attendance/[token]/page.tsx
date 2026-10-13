"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, AlertTriangle, QrCode, ArrowRight,
  ShieldAlert, ShieldCheck, Clock, Home, RefreshCw, Smartphone, KeyRound
} from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function StudentAttendanceLandingPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // View steps: "CHECKING" | "NEED_ENROLLMENT" | "DEVICE_MISMATCH" | "PRESENCE_INPUT" | "SUCCESS" | "ALREADY_RECORDED" | "ERROR"
  const [step, setStep] = useState<string>("CHECKING");
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [presenceCode, setPresenceCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (token) {
      initSessionAndDevice();
    }
  }, [token]);

  const initSessionAndDevice = async () => {
    setStep("CHECKING");
    setErrorMessage("");

    const authToken = localStorage.getItem("smartattend_token");
    if (!authToken) {
      router.push(`/login?redirect=/attendance/${token}`);
      return;
    }

    try {
      const storedToken = localStorage.getItem("smartattend_device_token");
      const storedSecret = localStorage.getItem("smartattend_device_secret");

      const headers: Record<string, string> = {
        Authorization: `Bearer ${authToken}`
      };
      if (storedToken) headers["X-Device-Token"] = storedToken;
      if (storedSecret) headers["X-Device-Secret"] = storedSecret;

      const res = await fetch(`${API_BASE_URL}/api/v1/devices/status`, {
        headers
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/attendance/${token}`);
          return;
        }
        throw new Error("Unable to verify device security status");
      }

      const statusData = await res.json();
      setDeviceStatus(statusData);

      if (!statusData.has_trusted_device) {
        // Needs first-time enrollment or replacement after faculty reset
        setStep("NEED_ENROLLMENT");
      } else if (!statusData.is_current_device_trusted) {
        // Active device registered, but NOT this phone
        setStep("DEVICE_MISMATCH");
      } else {
        // Current phone is trusted! Prompt for classroom presence code
        setStep("PRESENCE_INPUT");
      }
    } catch (err: any) {
      setStep("ERROR");
      setErrorMessage(err.message || "Network error checking device verification status.");
    }
  };

  const handleEnrollDevice = async () => {
    setLoading(true);
    setErrorMessage("");
    const authToken = localStorage.getItem("smartattend_token");

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/devices/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : ""
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Device registration failed");
      }

      // Store device credentials safely in localStorage
      if (data.device_token) localStorage.setItem("smartattend_device_token", data.device_token);
      if (data.device_secret) localStorage.setItem("smartattend_device_secret", data.device_secret);

      setStep("PRESENCE_INPUT");
    } catch (err: any) {
      setStep("ERROR");
      setErrorMessage(err.message || "Failed to register trusted device.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async () => {
    setLoading(true);
    setErrorMessage("");

    const authToken = localStorage.getItem("smartattend_token");
    const storedToken = localStorage.getItem("smartattend_device_token");
    const storedSecret = localStorage.getItem("smartattend_device_secret");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      };
      if (storedToken) headers["X-Device-Token"] = storedToken;
      if (storedSecret) headers["X-Device-Secret"] = storedSecret;
      if (presenceCode) headers["X-Presence-Code"] = presenceCode.trim();

      const res = await fetch(`${API_BASE_URL}/api/v1/attendance/mark`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_token: token,
          device_token: storedToken || undefined,
          device_secret: storedSecret || undefined,
          presence_code: presenceCode ? presenceCode.trim() : undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setStep("ERROR");
        setErrorMessage(data.detail || "Unable to mark attendance");
      } else {
        if (data.status === "ALREADY_RECORDED") {
          setStep("ALREADY_RECORDED");
          setResult(data);
        } else {
          setStep("SUCCESS");
          setResult(data);
        }
      }
    } catch (err: any) {
      setStep("ERROR");
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
            <p className="text-[10px] text-slate-400">NSIT-IFSCS Anti-Proxy Protection</p>
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
        {step === "CHECKING" ? (
          <div className="py-12 space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <QrCode className="w-6 h-6 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Verifying Device Security...</h3>
              <p className="text-xs text-slate-400">Checking 1-student/1-phone trusted binding</p>
            </div>
          </div>
        ) : step === "NEED_ENROLLMENT" ? (
          <div className="space-y-5">
            <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                <Smartphone className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-blue-300">
                {deviceStatus?.status === "REVOKED" ? "Register Replacement Phone" : "Register Trusted Phone"}
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                SmartAttend policy restricts attendance marking to <strong className="text-white">one registered phone per student</strong>.
                {deviceStatus?.status === "REVOKED"
                  ? " Your previous registration was reset by faculty. Register this phone to continue."
                  : " This phone will be bound to your student account."}
              </p>
            </div>

            <button
              onClick={handleEnrollDevice}
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Registering Phone...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Bind This Phone as Trusted Device
                </>
              )}
            </button>
          </div>
        ) : step === "DEVICE_MISMATCH" ? (
          <div className="space-y-5">
            <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col items-center">
              <ShieldAlert className="w-14 h-14 text-red-400 mb-2" />
              <h2 className="text-lg font-bold text-red-400">Untrusted Device Detected</h2>
              <p className="text-xs text-red-300 mt-2 leading-relaxed">
                Your student account is registered to another phone (<strong>{deviceStatus?.device_token || "different handset"}</strong>).
                Proxy attendance from unverified phones is strictly prohibited.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-200">How to resolve:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Mark attendance using your registered phone.</li>
                <li>If you changed or lost your phone, request a device reset from your faculty in class.</li>
              </ul>
            </div>

            <button
              onClick={() => router.push("/student")}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
            >
              Return to Student Dashboard
            </button>
          </div>
        ) : step === "PRESENCE_INPUT" ? (
          <div className="space-y-5">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-left">
              <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-emerald-300">Trusted Device Verified</h4>
                <p className="text-[11px] text-slate-400">This phone is authenticated for your account</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-left">
                Classroom Presence Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 4-digit classroom code"
                  value={presenceCode}
                  onChange={(e) => setPresenceCode(e.target.value.replace(/[^0-9a-zA-Z]/g, ""))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm font-mono tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center"
                />
              </div>
              <p className="text-[11px] text-slate-400 text-left">
                Enter the short code shown on the classroom projector display
              </p>
            </div>

            <button
              onClick={handleMarkAttendance}
              disabled={loading || presenceCode.trim().length === 0}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Attendance...
                </>
              ) : (
                <>
                  Confirm Attendance <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        ) : step === "SUCCESS" ? (
          <div className="space-y-5">
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
        ) : step === "ALREADY_RECORDED" ? (
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
                onClick={initSessionAndDevice}
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
        SmartAttend Security • 1 Registered Phone Per Student • Layered Presence Verification
      </p>
    </div>
  );
}

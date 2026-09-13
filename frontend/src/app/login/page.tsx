"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Lock, User, AlertCircle, Sparkles, CheckCircle2, Eye, EyeOff, ArrowRight } from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (overrideUser?: string, overridePass?: string) => {
    setLoading(true);
    setError("");

    const loginUser = overrideUser || username;
    const loginPass = overridePass || password;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_or_enrollment: loginUser, password: loginPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Login failed");
      }

      // Save token & user in localStorage for client state
      localStorage.setItem("smartattend_token", data.access_token);
      localStorage.setItem("smartattend_user", JSON.stringify(data.user));

      // Redirect after login
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get("redirect");

      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (data.user.role === "STUDENT") {
        router.push("/student");
      } else if (data.user.role === "FACULTY") {
        router.push("/faculty");
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role: "STUDENT" | "FACULTY" | "ADMIN") => {
    if (role === "STUDENT") {
      setUsername("251943004001");
      setPassword("Student@123");
      handleLogin("251943004001", "Student@123");
    } else if (role === "FACULTY") {
      setUsername("akash.thakkar@nsit.ac.in");
      setPassword("Faculty@123");
      handleLogin("akash.thakkar@nsit.ac.in", "Faculty@123");
    } else {
      setUsername("admin@nsit.ac.in");
      setPassword("Admin@123");
      handleLogin("admin@nsit.ac.in", "Admin@123");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden pt-safe pb-safe">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl shadow-2xl backdrop-blur-xl p-5 sm:p-8 z-10 space-y-6">
        {/* Header Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">SmartAttend</h1>
            <p className="text-xs text-slate-400 font-medium">NSIT-IFSCS • B.Tech Cyber Security</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Enrollment No. or Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 251943004001"
                autoComplete="username"
                autoCapitalize="none"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-3 text-sm sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-10 pr-11 py-3 text-sm sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 p-0.5 text-slate-400 hover:text-slate-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold mb-2.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Demo Login (One-Tap)</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => quickLogin("STUDENT")}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-750 active:scale-95 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/60 transition flex flex-col items-center justify-center text-center"
            >
              <span className="text-sm">🎓</span>
              <span className="font-bold text-white mt-0.5">Student</span>
              <span className="text-[10px] text-slate-400">Dhrumil</span>
            </button>

            <button
              onClick={() => quickLogin("FACULTY")}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-750 active:scale-95 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/60 transition flex flex-col items-center justify-center text-center"
            >
              <span className="text-sm">👨‍🏫</span>
              <span className="font-bold text-white mt-0.5">Faculty</span>
              <span className="text-[10px] text-slate-400">Dr. Akash</span>
            </button>

            <button
              onClick={() => quickLogin("ADMIN")}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-750 active:scale-95 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700/60 transition flex flex-col items-center justify-center text-center"
            >
              <span className="text-sm">⚙️</span>
              <span className="font-bold text-white mt-0.5">Admin</span>
              <span className="text-[10px] text-slate-400">Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

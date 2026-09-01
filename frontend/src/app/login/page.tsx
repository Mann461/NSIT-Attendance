"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Lock, User, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";

import { API_BASE_URL } from "@/config";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

      // Redirect based on role
      if (data.user.role === "STUDENT") {
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-8 z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
            <QrCode className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SmartAttend</h1>
            <p className="text-xs text-slate-400 font-medium">B.Tech Sem III • Cyber Security</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email or Enrollment No.
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="251943004001 or email"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 mt-2"
          >
            {loading ? "Signing in..." : "Sign In to Account"}
          </button>
        </form>

        {/* Quick Demo Login Preset Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-700/80">
          <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Prototype Demo Logins</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => quickLogin("STUDENT")}
              className="px-2.5 py-2 bg-slate-700/60 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-600/60 transition text-center"
            >
              🎓 Student
              <span className="block text-[10px] text-slate-400 mt-0.5">Dhrumil</span>
            </button>

            <button
              onClick={() => quickLogin("FACULTY")}
              className="px-2.5 py-2 bg-slate-700/60 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-600/60 transition text-center"
            >
              👨‍🏫 Faculty
              <span className="block text-[10px] text-slate-400 mt-0.5">Dr. Akash</span>
            </button>

            <button
              onClick={() => quickLogin("ADMIN")}
              className="px-2.5 py-2 bg-slate-700/60 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-600/60 transition text-center"
            >
              ⚙️ Admin
              <span className="block text-[10px] text-slate-400 mt-0.5">System Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

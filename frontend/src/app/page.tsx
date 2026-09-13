"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, GraduationCap, UserCheck, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950 text-white flex flex-col justify-between pt-safe pb-safe">
      {/* Top Navbar */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-white leading-tight">SmartAttend</h1>
            <p className="text-[10px] sm:text-xs text-blue-400 font-medium">B.Tech Sem III • Cyber Security</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
        >
          Sign In <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center flex flex-col items-center my-auto">
        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] font-semibold rounded-full uppercase tracking-wider mb-5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-blue-400" />
          Phase-1 Prototype • NSIT-IFSCS
        </span>

        <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 sm:mb-6 leading-tight">
          Timetable-Driven <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
            Smart QR Attendance
          </span>
        </h2>

        <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-2xl mb-8 sm:mb-10 leading-relaxed px-2">
          Digitalizing classroom attendance for <span className="text-blue-400 font-semibold">33 Students</span> & <span className="text-blue-400 font-semibold">6 Theory Subjects</span> in Room 109. Zero manual daily lecture setup, secure 1 device / 1 scan restriction, and live real-time reports.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-6 w-full max-w-3xl mb-8 sm:mb-12 text-left">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
            <UserCheck className="w-7 h-7 text-emerald-400 mb-2.5" />
            <h3 className="font-bold text-white text-sm sm:text-base mb-1">Faculty Confirmation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Timetable-first schedule. Conduct, cancel, or reschedule before attendance begins.</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
            <QrCode className="w-7 h-7 text-blue-400 mb-2.5" />
            <h3 className="font-bold text-white text-sm sm:text-base mb-1">Instant Mobile Scan</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Students scan classroom QR with in-app camera with automatic device validation.</p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
            <GraduationCap className="w-7 h-7 text-indigo-400 mb-2.5" />
            <h3 className="font-bold text-white text-sm sm:text-base mb-1">Live Analytics & Sheet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">Real-time WebSocket feed, low attendance alerts (&lt;75%), and Excel export.</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-98 text-white font-bold text-sm sm:text-base rounded-xl shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2.5"
        >
          <span>Launch SmartAttend Prototype</span>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </section>

      {/* Footer */}
      <footer className="px-4 py-3 text-center border-t border-slate-900 text-[11px] text-slate-500">
        NSIT Institute of Forensic Sciences & Cyber Security • A.Y. 2026-27
      </footer>
    </main>
  );
}

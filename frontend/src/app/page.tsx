"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, GraduationCap, UserCheck, ShieldCheck, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/30">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">SmartAttend</h1>
            <p className="text-xs text-blue-400 font-medium">B.Tech Sem III • Cyber Security</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg shadow-md transition flex items-center gap-2"
        >
          Sign In <ArrowRight className="w-4 h-4" />
        </button>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center flex flex-col items-center">
        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold rounded-full uppercase tracking-wider mb-6">
          Phase-1 Prototype • NSIT-IFSCS
        </span>

        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
          Timetable-Driven Smart QR Attendance
        </h2>

        <p className="text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed">
          Digitalizing classroom attendance for <span className="text-blue-400 font-semibold">33 Students</span> & <span className="text-blue-400 font-semibold">6 Theory Subjects</span> in Room 109. Zero manual daily lecture setup, secure device binding, and live real-time reporting.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mb-12 text-left">
          <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur">
            <UserCheck className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="font-bold text-white mb-1">Faculty Confirmation</h3>
            <p className="text-xs text-slate-400">Timetable-first schedule. Conduct, cancel, or reschedule before attendance begins.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur">
            <QrCode className="w-8 h-8 text-blue-400 mb-3" />
            <h3 className="font-bold text-white mb-1">Instant Scan & Mark</h3>
            <p className="text-xs text-slate-400">Students scan QR to automatically record attendance with 1 device / 1 scan restriction.</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/60 backdrop-blur">
            <GraduationCap className="w-8 h-8 text-indigo-400 mb-3" />
            <h3 className="font-bold text-white mb-1">Live Analytics & Sheet</h3>
            <p className="text-xs text-slate-400">Real-time WebSocket monitoring, low attendance alerts (&lt;75%), and Excel/CSV export.</p>
          </div>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base rounded-xl shadow-xl shadow-blue-600/30 transition flex items-center gap-3"
        >
          Launch SmartAttend Prototype <ArrowRight className="w-5 h-5" />
        </button>
      </section>

      {/* Footer */}
      <footer className="px-6 py-4 text-center border-t border-slate-800 text-xs text-slate-500">
        Narnarayan Shastri Institute of Technology - Institute of Forensic Sciences & Cyber Security (NSIT-IFSCS) • A.Y. 2026-27
      </footer>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, ExternalLink, QrCode as QrIcon } from "lucide-react";

interface AttendanceQRCodeProps {
  token?: string;
  size?: number;
  showLink?: boolean;
}

export default function AttendanceQRCode({
  token,
  size = 260,
  showLink = true,
}: AttendanceQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [scanUrl, setScanUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Strict origin resolution:
    // If running in browser on netlify or localhost, use current origin.
    // If backend host or port 3000 is detected anywhere, strictly fall back to Netlify production.
    let origin = "https://nsit-attendance.netlify.app";
    if (typeof window !== "undefined" && window.location.origin) {
      const loc = window.location.origin;
      if (!loc.includes("onrender.com") && !loc.includes(":3000")) {
        origin = loc;
      }
    }

    const targetUrl = `${origin}/attendance/${token}`;
    setScanUrl(targetUrl);

    // High error correction so students can scan from across Room 109
    QRCode.toDataURL(targetUrl, {
      width: size * 2, // 2x density for crystal-clear retina rendering
      margin: 2,
      color: {
        dark: "#090d16",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error("Error generating QR code:", err));
  }, [token, size]);

  const handleCopy = () => {
    if (!scanUrl) return;
    navigator.clipboard.writeText(scanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!token) {
    return (
      <div
        className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"
        style={{ width: size, height: size }}
      >
        <QrIcon className="w-12 h-12 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-xl border-2 border-slate-200 flex flex-col items-center justify-center">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Class Attendance QR Code"
            className="rounded-xl object-contain select-none"
            style={{ width: size, height: size }}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-slate-100 rounded-xl animate-pulse"
            style={{ width: size, height: size }}
          >
            <span className="text-xs font-mono text-slate-500 font-medium">Generating QR...</span>
          </div>
        )}
      </div>

      {showLink && scanUrl && (
        <div className="mt-3 w-full max-w-sm flex flex-col items-center space-y-1.5">
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
              title="Copy attendance URL"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Attendance Link</span>
                </>
              )}
            </button>

            <a
              href={scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:underline"
              title="Open attendance page directly"
            >
              <span>Open</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-[10px] text-slate-500 font-mono text-center truncate max-w-[280px]">
            {scanUrl}
          </p>
        </div>
      )}
    </div>
  );
}

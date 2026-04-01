import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-charcoal/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-charcoal rounded-full blur-3xl" />
      </div>

      {/* 404 image */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-2xl">
        <img
          src="/404.png"
          alt="404 Page Not Found"
          className="w-full max-w-lg mx-auto drop-shadow-[0_0_40px_rgba(6,182,212,0.3)]"
          onError={(e) => {
            // Fallback if image not present
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        {/* Fallback text when no image */}
        <div className="text-center">
          <p className="text-white/55 text-lg mb-8 max-w-md lonely-text">
            This page wandered off into the AI void. Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl border border-white/10 text-white/75 hover:border-white/12 hover:text-white/85 transition-all text-sm font-medium"
            >
              ← Go Back
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-white/28 to-white/14 text-white font-semibold text-sm hover:opacity-90 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
          <Link to="/help" className="mt-4 text-xs text-white/40 hover:text-white/65 transition-colors">
            Need help? Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

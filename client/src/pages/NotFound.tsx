import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";

export default function NotFound() {
  usePageMeta({
    title: 'Page Not Found',
    description: 'The page you requested could not be found.',
    noIndex: true,
  });
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="flex flex-col items-center gap-8 max-w-2xl">
        <img
          src="/404.png"
          alt="404 Page Not Found"
          className="w-full max-w-lg mx-auto drop-shadow-[0_0_40px_rgba(6,182,212,0.3)]"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
          <p className="text-white/55 text-lg mb-8 max-w-md">
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
          <Link to="/help" className="mt-4 inline-block text-xs text-white/40 hover:text-white/65 transition-colors">
            Need help? Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

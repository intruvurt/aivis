import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import changelog from "../data/changelog";

const STORAGE_KEY = "aivis_whats_new_seen";

function getLastSeen(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function markSeen(date: string) {
  try {
    localStorage.setItem(STORAGE_KEY, date);
  } catch {
    /* localStorage unavailable */
  }
}

export default function WhatsNewPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const lastSeen = getLastSeen();
  const latestDate = changelog[0]?.date ?? "";
  const hasUnseen = !lastSeen || lastSeen < latestDate;
  const unseenCount = lastSeen
    ? changelog.filter((e) => e.date > lastSeen).length
    : changelog.length;

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && hasUnseen) {
      markSeen(latestDate);
    }
  }

  const recentEntries = changelog.slice(0, 5);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-2 rounded-lg border border-white/10 bg-charcoal-light/50 text-white/80 hover:text-white hover:bg-charcoal-light transition-colors"
        aria-label="What's New"
        title={hasUnseen ? `${unseenCount} new updates` : "What's New"}
      >
        <Sparkles className="w-4 h-4" />
        {hasUnseen && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-semibold text-black flex items-center justify-center">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[26rem] bg-[#323a4c] border border-white/10 rounded-xl shadow-xl shadow-black/30 z-[220]">
          <div className="px-4 py-2.5 border-b border-white/10 bg-charcoal-light/30 flex items-center justify-between rounded-t-xl">
            <p className="text-sm font-medium text-white">What&apos;s New</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-2 pr-1">
            {recentEntries.length === 0 ? (
              <p className="px-3 py-5 text-sm text-white/60">No updates yet.</p>
            ) : (
              recentEntries.map((entry, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 rounded-lg hover:bg-charcoal-light transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold text-white leading-snug">
                      {entry.title}
                    </span>
                    <span className="text-[10px] text-white/45 shrink-0 mt-0.5">
                      {entry.date}
                    </span>
                  </div>
                  <p className="text-xs text-white/70 mt-1 leading-relaxed line-clamp-3">
                    {entry.description}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/changelog");
              }}
              className="w-full text-center text-xs px-3 py-2 rounded-lg border border-white/10 bg-charcoal-light text-cyan-200 hover:text-cyan-100"
            >
              View full changelog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

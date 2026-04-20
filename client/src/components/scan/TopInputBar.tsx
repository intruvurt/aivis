/**
 * TopInputBar.tsx
 *
 * Visible only in IDLE / INPUT_FOCUSED phases.
 * Single responsibility: capture a URL and fire START_SCAN.
 * No marketing artifacts. No layout variation.
 */

import { useState } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { useScan } from '../../context/ScanContext';

export function TopInputBar() {
  const { state, dispatch, startScan } = useScan();
  const [value, setValue] = useState('');

  // Strict visibility gate — unmount outside these two phases
  if (state.phase !== 'IDLE' && state.phase !== 'INPUT_FOCUSED') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    startScan(trimmed);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setValue(text.trim());
    } catch {
      // clipboard not available
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex gap-3">
      <div className="relative flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => dispatch({ type: 'FOCUS_INPUT' })}
          onBlur={() => dispatch({ type: 'BLUR_INPUT' })}
          placeholder="https://yoursite.com"
          autoComplete="off"
          spellCheck={false}
          className="w-full px-4 py-3.5 pr-10 rounded-xl bg-[#111827]/80 border border-white/15 text-white placeholder-white/30 text-base focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all"
        />
        <button
          type="button"
          onClick={handlePaste}
          title="Paste from clipboard"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
        >
          <ClipboardPaste className="w-4 h-4" />
        </button>
      </div>
      <button
        type="submit"
        disabled={!value.trim()}
        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-violet-600 text-white px-6 py-3.5 rounded-xl text-base font-semibold hover:from-cyan-400 hover:to-violet-500 transition-all shadow-lg shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        See Visibility
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </button>
    </form>
  );
}

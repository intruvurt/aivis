export default function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-white/15"
          style={{ borderTopColor: '#f97316' }}
        />
        <p className="text-xs text-white/40 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

export default function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <img src="/aivis-progress-spinner.png" alt="" className="h-8 w-8 animate-spin" />
        <p className="text-xs text-white/40 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

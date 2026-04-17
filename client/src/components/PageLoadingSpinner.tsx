import Spinner from './Spinner';

export default function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-xs text-white/40 tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

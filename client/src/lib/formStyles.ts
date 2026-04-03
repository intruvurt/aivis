export const appFieldSurfaceClass = [
  "border border-white/10",
  "bg-charcoal",
  "text-white",
  "shadow-sm",
  "transition-colors duration-150",
  "outline-none",
  "focus:border-orange-400/40",
  "focus:ring-2 focus:ring-orange-400/10",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

export const appInputSurfaceClass = [
  appFieldSurfaceClass,
  "placeholder:text-white/40",
].join(" ");

export const appSelectSurfaceClass = appFieldSurfaceClass;

export const appTextareaSurfaceClass = [
  appFieldSurfaceClass,
  "placeholder:text-white/40",
].join(" ");
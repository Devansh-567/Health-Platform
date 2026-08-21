import { useTheme } from "../context/ThemeContext";

// Animated sun/moon switch. A single knob slides across a sky-to-night track;
// the sun fades/rotates out and the moon fades/rotates in as it slides, and a
// few stars twinkle into view on the dark side.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={`group relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition-colors duration-500 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
        isDark
          ? "border-slate-700 bg-gradient-to-b from-slate-800 to-slate-950"
          : "border-sky-300 bg-gradient-to-b from-sky-300 to-sky-400"
      } ${className}`}
    >
      {/* Twinkling stars, only visible on the dark side of the track */}
      <span
        className={`absolute left-2.5 top-2 h-[3px] w-[3px] rounded-full bg-white transition-opacity duration-500 ${
          isDark ? "opacity-90" : "opacity-0"
        }`}
        style={{ transitionDelay: isDark ? "150ms" : "0ms" }}
      />
      <span
        className={`absolute left-4 top-[10px] h-[2px] w-[2px] rounded-full bg-white transition-opacity duration-500 ${
          isDark ? "opacity-70" : "opacity-0"
        }`}
        style={{ transitionDelay: isDark ? "250ms" : "0ms" }}
      />
      <span
        className={`absolute left-2 top-[18px] h-[2px] w-[2px] rounded-full bg-white transition-opacity duration-500 ${
          isDark ? "opacity-60" : "opacity-0"
        }`}
        style={{ transitionDelay: isDark ? "350ms" : "0ms" }}
      />

      {/* Sliding knob */}
      <span
        className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-500 ease-in-out ${
          isDark ? "translate-x-9" : "translate-x-1"
        }`}
      >
        {/* Sun */}
        <svg
          viewBox="0 0 24 24"
          className={`absolute h-4 w-4 text-amber-500 transition-all duration-500 ease-in-out ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
          <line x1="12" y1="1.5" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.5" y2="12" />
          <line x1="4.2" y1="4.2" x2="6" y2="6" />
          <line x1="18" y1="18" x2="19.8" y2="19.8" />
          <line x1="4.2" y1="19.8" x2="6" y2="18" />
          <line x1="18" y1="6" x2="19.8" y2="4.2" />
        </svg>

        {/* Moon */}
        <svg
          viewBox="0 0 24 24"
          className={`absolute h-4 w-4 text-slate-700 transition-all duration-500 ease-in-out ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`}
          fill="currentColor"
        >
          <path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5a.6.6 0 0 0-.75-.75A9.7 9.7 0 1 0 21.25 15.15a.6.6 0 0 0-.75-.75Z" />
        </svg>
      </span>
    </button>
  );
}

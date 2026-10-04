interface SpinnerProps {
  /** Tailwind size classes, e.g. `w-8 h-8`. */
  className?: string;
}

/** Generic circular loading indicator (decorative: pair it with a visible text). */
export function Spinner({ className = 'w-8 h-8' }: SpinnerProps) {
  return (
    <div
      aria-hidden="true"
      className={`${className} border-2 border-indigo-600 border-t-transparent rounded-full animate-spin`}
    />
  );
}

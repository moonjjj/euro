"use client";

import BlurSwap from "./BlurSwap";

// Each character swaps on its own with a short blur, so only the digits that
// actually change move (e.g. the seconds of a clock).
export default function Ticker({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={value}>
      {Array.from(value).map((char, i) => (
        <BlurSwap key={i} swapKey={char} enterDelay={40} render={(c) => <span aria-hidden>{c}</span>} />
      ))}
    </span>
  );
}

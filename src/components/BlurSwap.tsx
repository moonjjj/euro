"use client";

import { useState } from "react";

interface Layer<K> {
  id: number;
  key: K;
  exiting: boolean;
}

interface BlurSwapProps<K extends string | number> {
  /** Changing this swaps the content: the old layer blurs out, the new one blurs in. */
  swapKey: K;
  /** Renders the content for a key — also used to keep drawing the outgoing layer */
  render: (key: K) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Layout classes for each content layer (e.g. "flex items-center gap-2") */
  layerClassName?: string;
  /** Delay before the new content enters, so it never overlaps the exit */
  enterDelay?: number;
  /** Animate on first mount too */
  appear?: boolean;
}

// Old and new content share one grid cell, so nothing jumps while both are on screen.
export default function BlurSwap<K extends string | number>({
  swapKey,
  render,
  className = "",
  style,
  layerClassName = "",
  enterDelay = 70,
  appear = false,
}: BlurSwapProps<K>) {
  const [layers, setLayers] = useState<Layer<K>[]>(() => [{ id: 0, key: swapKey, exiting: false }]);
  const [lastKey, setLastKey] = useState(swapKey);
  const [animate, setAnimate] = useState(appear);

  if (swapKey !== lastKey) {
    setLastKey(swapKey);
    setAnimate(true);
    setLayers((prev) => [
      ...prev.filter((l) => !l.exiting && l.key !== swapKey).map((l) => ({ ...l, exiting: true })),
      { id: prev[prev.length - 1].id + 1, key: swapKey, exiting: false },
    ]);
  }

  return (
    <span className={`inline-grid ${className}`} style={style}>
      {layers.map((l) => (
        <span
          key={l.id}
          aria-hidden={l.exiting || undefined}
          className={`${layerClassName} ${l.exiting ? "blur-exit" : animate ? "blur-enter" : ""}`}
          style={{ gridArea: "1 / 1", minWidth: 0, ["--enter-delay" as string]: `${enterDelay}ms` }}
          onAnimationEnd={
            l.exiting
              ? (e) => {
                  if (e.target === e.currentTarget) setLayers((prev) => prev.filter((x) => x.id !== l.id));
                }
              : undefined
          }
        >
          {render(l.key)}
        </span>
      ))}
    </span>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DayInfo {
  id: number;
  label: string;
  date: string;
  flag: string;
}

interface IslandProps {
  days: DayInfo[];
  current: number;
  onSelect: (index: number) => void;
  slideDir: "left" | "right";
  todayIndex: number;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getWeekday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS[d.getDay()];
}

function FlagBadge({ flag, slideDir }: { flag: string; slideDir?: "left" | "right" }) {
  const cls = slideDir === "left" ? "animate-flag-slide-left" : slideDir === "right" ? "animate-flag-slide-right" : "";
  return (
    <span
      className={`text-2xl inline-flex items-center justify-center shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)] ${cls}`}
      style={{ filter: "contrast(1.1) saturate(1.2)" }}
    >
      {flag}
    </span>
  );
}

// Open:  collapsed → stretching → expanded
// Close: expanded → dropping → shrinking → collapsed
type Phase = "collapsed" | "stretching" | "expanded" | "dropping" | "shrinking";

export default function Island({ days, current, onSelect, slideDir, todayIndex }: IslandProps) {
  const [phase, setPhase] = useState<Phase>("collapsed");
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const currentDay = days[current];

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [phase, days.length]);

  const expand = useCallback(() => {
    setPhase("stretching");
    setTimeout(() => setPhase("expanded"), 400);
  }, []);

  const collapse = useCallback(() => {
    setPhase("dropping");
    setTimeout(() => setPhase("shrinking"), 300);
    setTimeout(() => setPhase("collapsed"), 850);
  }, []);

  const toggle = () => {
    if (phase === "collapsed") expand();
    else if (phase === "expanded") collapse();
  };

  const isWide = phase !== "collapsed" && phase !== "shrinking";
  const showContent = phase === "expanded" || phase === "dropping";

  // Close on outside tap
  useEffect(() => {
    if (phase !== "expanded") return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-island]")) collapse();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [phase, collapse]);

  const wide = "min(340px, calc(100vw - 40px))";
  const pill = "280px";
  const spring = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  const smooth = "cubic-bezier(0.4, 0, 0.2, 1)";

  const getStyle = (): React.CSSProperties => {
    switch (phase) {
      case "collapsed":
        return {
          width: pill,
          borderRadius: "40px",
          transform: "translateY(0) scale(1)",
          transition: `all 0.55s ${smooth}`,
        };
      case "stretching":
        return {
          width: wide,
          borderRadius: "26px",
          transform: "translateY(2px) scaleX(1.04) scaleY(0.96)",
          transition: `all 0.4s ${spring}`,
        };
      case "expanded":
        return {
          width: wide,
          borderRadius: "28px",
          transform: "translateY(-14px) scale(1)",
          transition: `all 0.5s ${spring}`,
        };
      case "dropping":
        return {
          width: wide,
          borderRadius: "28px",
          transform: "translateY(0) scaleX(1.01) scaleY(0.99)",
          transition: `all 0.35s ${smooth}`,
        };
      case "shrinking":
        return {
          width: pill,
          borderRadius: "40px",
          transform: "translateY(0) scale(1)",
          transition: `all 0.55s ${smooth}`,
        };
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-8 px-5 pointer-events-none">
      <div
        data-island
        className="pointer-events-auto overflow-hidden bg-[#1c1c1e]/70 border border-white/[0.06]"
        style={{
          ...getStyle(),
          WebkitBackdropFilter: "blur(50px) saturate(180%)",
          backdropFilter: "blur(50px) saturate(180%)",
          boxShadow: phase === "expanded"
            ? "0 20px 60px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.08)"
            : phase === "stretching" || phase === "dropping"
            ? "0 12px 40px rgba(0,0,0,0.75)"
            : "0 8px 28px rgba(0,0,0,0.5)",
          transformOrigin: "center bottom",
        }}
      >
        {/* Pill bar */}
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-6 py-4 w-full active:opacity-70 transition-opacity"
        >
          <FlagBadge key={current} flag={currentDay.flag} slideDir={slideDir} />
          <span className="text-white text-[13px] font-semibold tracking-tight">
            {currentDay.label}
          </span>
          <span className="text-white/35 text-xs whitespace-nowrap">
            {formatShort(currentDay.date)} ({getWeekday(currentDay.date)})
          </span>
          {current === todayIndex && (
            <span
              className="text-[10px] font-semibold text-[#00FF66] bg-[#00FF66]/10 px-1.5 py-0.5 rounded-md whitespace-nowrap overflow-hidden"
              style={{
                maxWidth: phase === "shrinking" || phase === "collapsed" ? "0px" : "40px",
                opacity: phase === "shrinking" || phase === "collapsed" ? 0 : 1,
                transition: "max-width 0.3s ease, opacity 0.2s ease",
              }}
            >
              오늘
            </span>
          )}
          <svg
            className="w-3 h-3 text-white/25 ml-auto shrink-0"
            style={{
              transform: isWide ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Expandable content */}
        <div
          style={{
            maxHeight: phase === "expanded" ? `${contentHeight}px` : "0px",
            opacity: phase === "expanded" ? 1 : phase === "dropping" ? 0 : 0,
            transition: phase === "expanded"
              ? "max-height 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s ease 0.05s"
              : "max-height 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease",
          }}
          className="overflow-hidden"
        >
          <div ref={contentRef} className="px-4 pb-4">
            <div className="h-px bg-white/[0.06] mb-3" />

            <div className="space-y-0.5">
              {days.map((day, i) => {
                const isActive = i === current;
                const isToday = i === todayIndex;
                return (
                  <button
                    key={day.id}
                    onClick={() => {
                      onSelect(i);
                      collapse();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] active:scale-[0.98] ${
                      isActive ? "bg-white/[0.08]" : ""
                    }`}
                    style={{
                      transition: "background 0.2s ease, transform 0.15s ease",
                    }}
                  >
                    <div
                      className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                        isActive ? "bg-white/[0.12]" : "bg-white/[0.05]"
                      } ${isToday ? "ring-1 ring-[#00FF66]/40" : ""}`}
                      style={{ transition: "background 0.2s ease" }}
                    >
                      <FlagBadge flag={day.flag} />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[13px] font-medium ${
                            isActive ? "text-white" : "text-white/40"
                          }`}
                        >
                          {day.label}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-semibold text-[#00FF66] bg-[#00FF66]/10 px-1.5 py-0.5 rounded-md">
                            오늘
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/25">
                        {formatShort(day.date)} ({getWeekday(day.date)})
                      </span>
                    </div>

                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00FF66] shadow-[0_0_6px_rgba(0,255,102,0.4)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

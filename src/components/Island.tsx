"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import LiquidGlass from "./LiquidGlass";
import BlurSwap from "./BlurSwap";
import { spring, EXIT_MS } from "@/lib/motion";

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
  onPrev: () => void;
  onNext: () => void;
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

function FlagBadge({ flag }: { flag: string }) {
  return (
    <span
      className="text-2xl inline-flex items-center justify-center shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
      style={{ filter: "contrast(1.1) saturate(1.2)" }}
    >
      {flag}
    </span>
  );
}

const glassFallback: React.CSSProperties = {
  background: "rgba(28,28,30,0.7)",
  WebkitBackdropFilter: "blur(50px) saturate(180%)",
  backdropFilter: "blur(50px) saturate(180%)",
};

const BAR_HEIGHT = 56;
const BORDER = 1;
const NAV_SIZE = BAR_HEIGHT + BORDER * 2;
const NAV_GAP = 8;
const ROW_HEIGHT = 56;
const ROW_GAP = 2;
// Time for the active indicator to travel before the island closes on a pick
const PICK_MS = 260;

// One shape, never cut: collapsed ⇄ open morph size/radius on a spring.
// Closing first blurs the content out, then shrinks, so text never overlaps the morph.
type Phase = "collapsed" | "open" | "closing";

export default function Island({ days, current, onSelect, onPrev, onNext, slideDir, todayIndex }: IslandProps) {
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [openCount, setOpenCount] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContentHeight(entry.borderBoxSize[0].blockSize));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  // Long trips scroll: bring the current day into the middle of the list on open
  useEffect(() => {
    const el = listScrollRef.current;
    if (!el || openCount === 0) return;
    el.scrollTop = current * (ROW_HEIGHT + ROW_GAP) - (el.clientHeight - ROW_HEIGHT) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [openCount]);

  const expand = useCallback(() => {
    setOpenCount((n) => n + 1);
    setPhase("open");
  }, []);

  const collapse = useCallback(() => {
    setPhase("closing");
    timers.current.push(window.setTimeout(() => setPhase("collapsed"), EXIT_MS));
  }, []);

  const toggle = () => {
    if (phase === "collapsed") expand();
    else if (phase === "open") collapse();
  };

  // Close on outside tap
  useEffect(() => {
    if (phase !== "open") return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-island]")) collapse();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [phase, collapse]);

  const pick = (i: number) => {
    if (phase !== "open" || pending !== null) return;
    if (i === current) {
      collapse();
      return;
    }
    // Let the liquid indicator travel to the row, then close and navigate
    setPending(i);
    timers.current.push(
      window.setTimeout(() => {
        collapse();
        onSelect(i);
        setPending(null);
      }, PICK_MS)
    );
  };

  const isOpen = phase !== "collapsed";
  const showNavButtons = phase === "collapsed";
  const hasPrev = current > 0;
  const hasNext = current < days.length - 1;
  const selected = pending ?? current;

  // Liquid indicator: the edge in the direction of travel rides the snappy spring,
  // the trailing edge the soft one, so it stretches ahead and then catches up.
  const [indicator, setIndicator] = useState({ index: selected, dir: 0 });
  if (indicator.index !== selected) {
    setIndicator({ index: selected, dir: selected > indicator.index ? 1 : -1 });
  }
  const listHeight = days.length * ROW_HEIGHT + (days.length - 1) * ROW_GAP;
  const indicatorTop = selected * (ROW_HEIGHT + ROW_GAP);
  const indicatorBottom = listHeight - indicatorTop - ROW_HEIGHT;
  const leading = indicator.dir > 0 ? "bottom" : "top";
  const trailing = indicator.dir > 0 ? "top" : "bottom";

  const wide = "min(340px, calc(100vw - 40px))";
  // Leave room for both arrow slots so the pill never gets squeezed on narrow phones
  const pill = `min(280px, calc(100vw - 40px - ${2 * (NAV_SIZE + NAV_GAP)}px))`;
  const openHeight = BAR_HEIGHT + contentHeight + BORDER * 2;
  const isTodayShown = current === todayIndex && isOpen;

  // Arrows keep their slot while collapsed (first/last pages stay centered),
  // and slide out sideways, collapsing their width, while the island is open.
  const navStyle = (occupy: boolean, visible: boolean, side: -1 | 1): React.CSSProperties => ({
    width: occupy ? NAV_SIZE : 0,
    height: NAV_SIZE,
    [side < 0 ? "marginRight" : "marginLeft"]: occupy ? NAV_GAP : 0,
    borderWidth: occupy ? BORDER : 0,
    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateX(0) scale(1)" : `translateX(${side * 32}px) scale(0.5)`,
    filter: visible ? "blur(0)" : "blur(4px)",
    visibility: visible ? "visible" : "hidden",
    pointerEvents: visible ? "auto" : "none",
    transition: [
      spring(["width", "margin", "border-width"], "morph"),
      spring(["transform", "scale"], "snappy"),
      visible ? spring(["opacity", "filter"], "snappy", 80) : `opacity ${EXIT_MS}ms ease-in, filter ${EXIT_MS}ms ease-in`,
      `visibility 0s linear ${visible ? 0 : 450}ms`,
    ].join(", "),
  });

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-center pb-8 px-5 pointer-events-none"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.45)" }}
    >
      {/* Prev button */}
      <LiquidGlass
        as="button"
        onClick={onPrev}
        aria-hidden={!(showNavButtons && hasPrev)}
        tabIndex={showNavButtons && hasPrev ? 0 : -1}
        className="pointer-events-auto flex items-center justify-center rounded-full border-white/[0.06] overflow-hidden active:scale-90 shrink-0"
        fallbackStyle={glassFallback}
        shade={0.45}
        style={navStyle(showNavButtons, showNavButtons && hasPrev, -1)}
      >
        <svg className="w-5 h-5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0l6-6m-6 6l6 6" />
        </svg>
      </LiquidGlass>

      <LiquidGlass
        data-island
        className="pointer-events-auto overflow-hidden border border-white/[0.06]"
        fallbackStyle={glassFallback}
        shade={0.45}
        blur={9}
        style={{
          width: isOpen ? wide : pill,
          height: isOpen ? openHeight : NAV_SIZE,
          borderRadius: isOpen ? 26 : NAV_SIZE / 2,
          boxShadow: isOpen
            ? "0 20px 60px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.08)"
            : "0 8px 28px rgba(0,0,0,0.5)",
          transition: spring(["width", "height", "border-radius", "box-shadow"], "morph"),
        }}
      >
        {/* Pill bar */}
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-4 w-full min-w-0 active:opacity-70 transition-opacity overflow-hidden"
          style={{ height: BAR_HEIGHT }}
        >
          <BlurSwap
            swapKey={current}
            className="min-w-0 items-center"
            layerClassName="flex items-center gap-2 min-w-0"
            style={{ ["--swap-x" as string]: slideDir === "left" ? "14px" : "-14px" }}
            render={(i) => (
              <>
                <FlagBadge flag={days[i].flag} />
                <span className="text-white text-[13px] font-semibold tracking-tight whitespace-nowrap shrink-0">
                  {days[i].label}
                </span>
                <span className="text-white/70 text-xs whitespace-nowrap truncate min-w-0">
                  {formatShort(days[i].date)} ({getWeekday(days[i].date)})
                </span>
              </>
            )}
          />
          {current === todayIndex && (
            <span
              className="text-[10px] font-semibold text-[#00FF66] bg-[#00FF66]/10 py-0.5 rounded-md whitespace-nowrap overflow-hidden shrink-0"
              style={{
                // Fully collapse (padding + flex gap too) so the date keeps its room
                maxWidth: isTodayShown ? 40 : 0,
                paddingInline: isTodayShown ? 6 : 0,
                marginLeft: isTodayShown ? 0 : -8,
                opacity: isTodayShown ? 1 : 0,
                filter: isTodayShown ? "blur(0)" : "blur(4px)",
                transition: spring(["max-width", "padding", "margin", "opacity", "filter"], "snappy", isTodayShown ? 120 : 0),
              }}
            >
              오늘
            </span>
          )}
          <svg
            className="w-3 h-3 text-white/60 ml-auto shrink-0"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: spring("transform", "snappy"),
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Expandable content — always mounted so its height is known before opening */}
        <div
          ref={contentRef}
          inert={phase !== "open"}
          className={`px-4 pb-4 ${phase === "closing" ? "blur-exit" : ""}`}
          style={{ visibility: phase === "collapsed" ? "hidden" : "visible" }}
        >
          <div className="h-px bg-white/[0.06] mb-3" />

          <div
            ref={listScrollRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: "45vh", scrollbarWidth: "none" }}
          >
          {/* Remounted on each open so the rows replay their staggered entrance */}
          <div key={openCount} className="relative" style={{ height: listHeight }}>
            {/* Liquid active indicator */}
            <div
              className="absolute left-0 right-0 rounded-[14px] bg-white/[0.08]"
              style={{
                top: indicatorTop,
                bottom: indicatorBottom,
                transition: `${spring(leading, "snappy")}, ${spring(trailing, "soft")}`,
              }}
            />

            {days.map((day, i) => {
              const isActive = i === selected;
              const isToday = i === todayIndex;
              return (
                <button
                  key={day.id}
                  onClick={() => pick(i)}
                  className={`absolute left-0 right-0 flex items-center gap-3 px-3 rounded-[14px] active:scale-[0.98] ${
                    phase === "open" ? "blur-enter" : ""
                  }`}
                  style={{
                    top: i * (ROW_HEIGHT + ROW_GAP),
                    height: ROW_HEIGHT,
                    ["--enter-delay" as string]: `${90 + Math.min(Math.abs(i - current), 6) * 35}ms`,
                    transition: spring("scale", "snappy"),
                  }}
                >
                  <div
                    className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${
                      isActive ? "bg-white/[0.12]" : "bg-white/[0.05]"
                    } ${isToday ? "ring-1 ring-[#00FF66]/40" : ""}`}
                    style={{ transition: spring("background-color", "snappy") }}
                  >
                    <FlagBadge flag={day.flag} />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[13px] font-medium ${isActive ? "text-white" : "text-white/75"}`}
                        style={{ transition: spring("color", "snappy") }}
                      >
                        {day.label}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-semibold text-[#00FF66] bg-[#00FF66]/10 px-1.5 py-0.5 rounded-md">
                          오늘
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/60">
                      {formatShort(day.date)} ({getWeekday(day.date)})
                    </span>
                  </div>

                  <div
                    className="w-1.5 h-1.5 rounded-full bg-[#00FF66] shadow-[0_0_6px_rgba(0,255,102,0.4)]"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? "scale(1)" : "scale(0)",
                      transition: spring(["opacity", "transform"], "snappy"),
                    }}
                  />
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </LiquidGlass>

      {/* Next button */}
      <LiquidGlass
        as="button"
        onClick={onNext}
        aria-hidden={!(showNavButtons && hasNext)}
        tabIndex={showNavButtons && hasNext ? 0 : -1}
        className="pointer-events-auto flex items-center justify-center rounded-full border-white/[0.06] overflow-hidden active:scale-90 shrink-0"
        fallbackStyle={glassFallback}
        shade={0.45}
        style={navStyle(showNavButtons, showNavButtons && hasNext, 1)}
      >
        <svg className="w-5 h-5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6" />
        </svg>
      </LiquidGlass>
    </div>
  );
}

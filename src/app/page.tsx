"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import Island from "@/components/Island";
import WeatherIsland, { type CityInfo } from "@/components/WeatherIsland";
import LiquidGlass from "@/components/LiquidGlass";

const TARGET_DATE = "2026-12-04";
const TARGET_TIME = "2026-12-04T13:00:00+09:00"; // 12월 4일 오후 1시 KST

const CITIES: Record<string, CityInfo> = {
  seoul: { name: "Seoul", timezone: "Asia/Seoul", lat: 37.5665, lon: 126.978 },
  lisbon: { name: "Lisbon", timezone: "Europe/Lisbon", lat: 38.7223, lon: -9.1393 },
};

const DAYS = [
  { id: 0, image: "/images/cover.jpg", label: "Cover", date: "2026-12-03", flag: "✈️", isCover: true, city: null as CityInfo | null },
  { id: 1, image: "/images/day_1.jpg", label: "Day 1", date: "2026-12-04", flag: "🇰🇷", isCover: false, city: CITIES.seoul },
  { id: 2, image: "/images/day_2.jpg", label: "Day 2", date: "2026-12-05", flag: "🇵🇹", isCover: false, city: CITIES.lisbon },
  { id: 3, image: "/images/day_3.jpg", label: "Day 3", date: "2026-12-06", flag: "🇵🇹", isCover: false, city: CITIES.lisbon },
];

interface DdayInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total ms remaining (negative = past)
}

function getDday(): DdayInfo {
  const now = Date.now();
  const target = new Date(TARGET_TIME).getTime();
  const diff = target - now;
  const absDiff = Math.abs(diff);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, total: diff };
}

function getTodayIndex(): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const idx = DAYS.findIndex((d) => d.date === todayStr);
  return idx >= 0 ? idx : 0;
}

export default function Home() {
  const [current, setCurrent] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [todayIndex, setTodayIndex] = useState(-1);
  const [dday, setDday] = useState<DdayInfo | null>(null);
  const touchRef = useRef({ startX: 0, startY: 0, locked: false, isHorizontal: false });
  const mainRef = useRef<HTMLElement>(null);

  // Block vertical scroll during horizontal swipe via native event listener (needs {passive: false})
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => {
      if (touchRef.current.isHorizontal) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  // Auto-focus today's schedule on mount + tick D-day every second
  useEffect(() => {
    const idx = getTodayIndex();
    setTodayIndex(idx);
    setDday(getDday());
    if (idx > 0) {
      setCurrent(idx);
    }
    const interval = setInterval(() => setDday(getDday()), 1000);
    return () => clearInterval(interval);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= DAYS.length || index === current || animating) return;
      setSlideDir(index > current ? "left" : "right");
      setCurrent(index);
      setOffsetX(0);
      setIsSwiping(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [current, animating]
  );

  const SLIDE_DURATION = 420;
  const SLIDE_EASE = "cubic-bezier(0.25, 1, 0.5, 1)";

  const snapTo = useCallback((targetIndex: number) => {
    if (animating) return;
    const w = window.innerWidth;
    const dir = targetIndex > current ? -1 : 1;
    const nextDir = targetIndex > current ? "left" : "right";

    const alreadySwiping = isSwiping;
    setAnimating(true);
    setIsSwiping(true);

    if (alreadySwiping) {
      setOffsetX(dir * w);
      setTimeout(() => {
        setSlideDir(nextDir);
        setCurrent(targetIndex);
        setOffsetX(0);
        setIsSwiping(false);
        setAnimating(false);
        window.scrollTo({ top: 0, behavior: "instant" });
      }, SLIDE_DURATION);
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOffsetX(dir * w);
          setTimeout(() => {
            setSlideDir(nextDir);
            setCurrent(targetIndex);
            setOffsetX(0);
            setIsSwiping(false);
            setAnimating(false);
            window.scrollTo({ top: 0, behavior: "instant" });
          }, SLIDE_DURATION);
        });
      });
    }
  }, [current, animating, isSwiping]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, locked: false, isHorizontal: false };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (animating) return;
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = e.touches[0].clientY - touchRef.current.startY;

    if (!touchRef.current.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        touchRef.current.locked = true;
        if (Math.abs(dy) > Math.abs(dx)) return; // vertical → ignore
        touchRef.current.isHorizontal = true;
        setIsSwiping(true);
      }
      return;
    }
    if (!isSwiping) return;

    const atEdge =
      (current === 0 && dx > 0) || (current === DAYS.length - 1 && dx < 0);
    setOffsetX(atEdge ? dx * 0.15 : dx);
  };

  const onTouchEnd = () => {
    touchRef.current.isHorizontal = false;
    if (!isSwiping || animating) {
      touchRef.current.locked = false;
      return;
    }
    touchRef.current.locked = false;

    if (offsetX < -50 && current < DAYS.length - 1) {
      snapTo(current + 1);
    } else if (offsetX > 50 && current > 0) {
      snapTo(current - 1);
    } else {
      // Snap back
      setAnimating(true);
      setOffsetX(0);
      setTimeout(() => {
        setAnimating(false);
        setIsSwiping(false);
      }, SLIDE_DURATION);
    }
  };

  const peekIndex = offsetX < 0 ? current + 1 : offsetX > 0 ? current - 1 : null;
  const peekDay = peekIndex !== null && peekIndex >= 0 && peekIndex < DAYS.length ? DAYS[peekIndex] : null;
  const peekIsCover = peekDay?.isCover ?? false;
  const currentDay = DAYS[current];

  return (
    <main
      ref={mainRef}
      className={`bg-[#212121] overflow-x-hidden ${currentDay.isCover ? "h-[100vh] overflow-hidden" : ""}`}
      style={{ minHeight: currentDay.isCover ? undefined : "100dvh" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative overflow-hidden">
        {/* Current image */}
        <div
          style={{
            transform: `translateX(${offsetX}px)`,
            transition: animating ? `transform ${SLIDE_DURATION}ms ${SLIDE_EASE}` : "none",
          }}
        >
          {currentDay.isCover ? (
            <div className="relative w-full" style={{ height: "100vh" }}>
              <Image
                key={currentDay.id}
                data-glass-source
                src={currentDay.image}
                alt={currentDay.label}
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
              {/* Dynamic Island D-day */}
              {dday !== null && (
                <div className="absolute top-0 left-0 right-0 flex justify-center z-10"
                  style={{ paddingTop: "max(14px, calc(env(safe-area-inset-top, 0px) + 8px))" }}
                >
                  <LiquidGlass className="dday-island" fallbackStyle={{ background: "#000" }} shade={0.45} blur={9}>
                    {dday.total <= 0 ? (
                      <span className="dday-label">
                        {dday.days === 0 && dday.hours === 0 && dday.minutes === 0
                          ? "D-Day 🎉"
                          : `D+${dday.days > 0 ? `${dday.days}일 ` : ""}${String(dday.hours).padStart(2, "0")}:${String(dday.minutes).padStart(2, "0")}:${String(dday.seconds).padStart(2, "0")}`}
                      </span>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="dday-label">D-{dday.days}</span>
                        <span className="dday-time">
                          {String(dday.hours).padStart(2, "0")}:{String(dday.minutes).padStart(2, "0")}:{String(dday.seconds).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </LiquidGlass>
                </div>
              )}
            </div>
          ) : (
            <Image
              key={currentDay.id}
              data-glass-source
              src={currentDay.image}
              alt={currentDay.label}
              width={750}
              height={0}
              sizes="100vw"
              className="w-full h-auto"
              priority
              style={{ height: "auto" }}
            />
          )}
        </div>

        {/* Peek image (adjacent day, only during swipe) */}
        {(isSwiping || animating) && peekDay && (
          <div
            className="absolute top-0"
            style={{
              width: "100vw",
              left: offsetX < 0 ? "100%" : undefined,
              right: offsetX > 0 ? "100%" : undefined,
              transform: `translateX(${offsetX}px)`,
              transition: animating ? `transform ${SLIDE_DURATION}ms ${SLIDE_EASE}` : "none",
            }}
          >
            {peekIsCover ? (
              <div className="relative w-full" style={{ height: "100vh" }}>
                <Image
                  data-glass-source
                src={peekDay.image}
                  alt={peekDay.label}
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
              </div>
            ) : (
              <Image
                data-glass-source
                src={peekDay.image}
                alt={peekDay.label}
                width={750}
                height={0}
                sizes="100vw"
                className="w-full h-auto"
                style={{ height: "auto" }}
              />
            )}
          </div>
        )}
      </div>

      {/* Bottom spacer — hide on cover */}
      {!currentDay.isCover && (
        <>
          <div className="h-28" />
          <WeatherIsland city={currentDay.city} />
        </>
      )}
      <Island
        days={DAYS}
        current={current}
        onSelect={goTo}
        onPrev={() => { if (current > 0) snapTo(current - 1); }}
        onNext={() => { if (current < DAYS.length - 1) snapTo(current + 1); }}
        slideDir={slideDir}
        todayIndex={todayIndex}
      />
    </main>
  );
}

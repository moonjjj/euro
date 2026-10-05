"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface CityInfo {
  name: string;
  timezone: string;
  lat: number;
  lon: number;
}

interface WeatherIslandProps {
  city: CityInfo | null;
}

interface HourlyEntry {
  hour: string; // "14:00"
  temperature: number;
  weatherCode: number;
  isNow: boolean;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  hourly: HourlyEntry[];
}

const WMO_ICONS: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "맑음" },
  1: { icon: "🌤", label: "대체로 맑음" },
  2: { icon: "⛅", label: "구름 조금" },
  3: { icon: "☁️", label: "흐림" },
  45: { icon: "🌫", label: "안개" },
  48: { icon: "🌫", label: "안개" },
  51: { icon: "🌦", label: "이슬비" },
  53: { icon: "🌦", label: "이슬비" },
  55: { icon: "🌦", label: "이슬비" },
  61: { icon: "🌧", label: "비" },
  63: { icon: "🌧", label: "비" },
  65: { icon: "🌧", label: "폭우" },
  71: { icon: "🌨", label: "눈" },
  73: { icon: "🌨", label: "눈" },
  75: { icon: "❄️", label: "폭설" },
  77: { icon: "🌨", label: "싸락눈" },
  80: { icon: "🌧", label: "소나기" },
  81: { icon: "🌧", label: "소나기" },
  82: { icon: "🌧", label: "폭우" },
  85: { icon: "🌨", label: "눈" },
  86: { icon: "❄️", label: "폭설" },
  95: { icon: "⛈", label: "뇌우" },
  96: { icon: "⛈", label: "뇌우" },
  99: { icon: "⛈", label: "뇌우" },
};

function getWeatherInfo(code: number) {
  return WMO_ICONS[code] ?? { icon: "🌡", label: "날씨" };
}

function getLocalTime(timezone: string): string {
  const now = new Date();
  return now.toLocaleTimeString("ko-KR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getLocalHour(timezone: string): number {
  const now = new Date();
  return parseInt(
    now.toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }),
    10
  );
}

export default function WeatherIsland({ city }: WeatherIslandProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [localTime, setLocalTime] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Record<string, { data: WeatherData; ts: number }>>({});

  const fetchWeather = useCallback(async (c: CityInfo) => {
    const key = `${c.lat},${c.lon}`;
    const cached = cacheRef.current[key];
    if (cached && Date.now() - cached.ts < 600_000) {
      setWeather(cached.data);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&forecast_days=2&timezone=${encodeURIComponent(c.timezone)}`
      );
      const json = await res.json();

      const currentHour = getLocalHour(c.timezone);

      // Build 24-hour forecast starting from current hour
      const hourlyTimes: string[] = json.hourly.time;
      const hourlyTemps: number[] = json.hourly.temperature_2m;
      const hourlyCodes: number[] = json.hourly.weather_code;

      // Find index of current hour in the hourly data
      const nowDate = new Date();
      const localDateStr = nowDate.toLocaleDateString("en-CA", { timeZone: c.timezone }); // YYYY-MM-DD
      const nowKey = `${localDateStr}T${String(currentHour).padStart(2, "0")}:00`;
      let startIdx = hourlyTimes.indexOf(nowKey);
      if (startIdx < 0) startIdx = 0;

      const hourly: HourlyEntry[] = [];
      for (let i = 0; i < 24 && startIdx + i < hourlyTimes.length; i++) {
        const idx = startIdx + i;
        const timeStr = hourlyTimes[idx]; // "2026-10-05T14:00"
        const h = timeStr.split("T")[1]; // "14:00"
        hourly.push({
          hour: h,
          temperature: Math.round(hourlyTemps[idx]),
          weatherCode: hourlyCodes[idx],
          isNow: i === 0,
        });
      }

      const data: WeatherData = {
        temperature: Math.round(json.current.temperature_2m),
        weatherCode: json.current.weather_code,
        hourly,
      };
      cacheRef.current[key] = { data, ts: Date.now() };
      setWeather(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Update time every second
  useEffect(() => {
    if (!city) return;
    setLocalTime(getLocalTime(city.timezone));
    const interval = setInterval(() => {
      setLocalTime(getLocalTime(city.timezone));
    }, 1000);
    return () => clearInterval(interval);
  }, [city]);

  // Fetch weather when city changes
  useEffect(() => {
    if (!city) return;
    setExpanded(false);
    fetchWeather(city);
  }, [city, fetchWeather]);

  // Scroll to "now" when expanded
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [expanded]);

  // Close on outside tap
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [expanded]);

  if (!city) return null;

  const info = weather ? getWeatherInfo(weather.weatherCode) : null;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 pointer-events-auto"
      style={{
        top: "max(14px, env(safe-area-inset-top, 14px))",
        right: "14px",
      }}
    >
      <div
        className="cursor-pointer overflow-hidden bg-[#000]/80 border border-white/[0.06]"
        style={{
          borderRadius: expanded ? "22px" : "50%",
          width: expanded ? "min(320px, calc(100vw - 28px))" : "44px",
          height: expanded ? "auto" : "44px",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          backdropFilter: "blur(40px) saturate(180%)",
          boxShadow: expanded
            ? "0 12px 40px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.08)"
            : "0 4px 16px rgba(0,0,0,0.5)",
          transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transformOrigin: "top right",
        }}
      >
        {/* Collapsed: weather icon + temp */}
        {!expanded && (
          <div
            className="w-[44px] h-[44px] flex items-center justify-center"
            onClick={() => setExpanded(true)}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
            ) : info ? (
              <span className="text-lg">{info.icon}</span>
            ) : (
              <span className="text-lg">🌡</span>
            )}
          </div>
        )}

        {/* Expanded content */}
        {expanded && (
          <div
            style={{
              animation: "weather-expand 0.3s cubic-bezier(0.32, 0.72, 0, 1) both",
            }}
          >
            {/* Header: city + time + current weather */}
            <div className="px-4 pt-3 pb-2" onClick={() => setExpanded(false)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/50 text-[10px] font-medium tracking-wide uppercase">
                  {city.name}
                </span>
                <span className="text-white text-[13px] font-semibold tabular-nums">
                  {localTime}
                </span>
              </div>
              {weather && info && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <span className="text-white text-[22px] font-semibold leading-tight">
                    {weather.temperature}°
                  </span>
                  <span className="text-white/40 text-[11px]">{info.label}</span>
                </div>
              )}
              {loading && !weather && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                  <span className="text-white/40 text-xs">로딩 중...</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/[0.08]" />

            {/* Hourly forecast - horizontal scroll */}
            {weather && weather.hourly.length > 0 && (
              <div
                ref={scrollRef}
                className="flex gap-0 overflow-x-auto py-3 px-2 scrollbar-none"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {weather.hourly.map((h, i) => {
                  const hInfo = getWeatherInfo(h.weatherCode);
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center shrink-0 px-2.5 gap-1.5"
                      style={{
                        opacity: h.isNow ? 1 : 0.6,
                      }}
                    >
                      <span
                        className={`text-[10px] tabular-nums ${
                          h.isNow
                            ? "text-[#00FF66] font-semibold"
                            : "text-white/50 font-medium"
                        }`}
                      >
                        {h.isNow ? "지금" : h.hour.replace(":00", "시")}
                      </span>
                      <span className="text-base">{hInfo.icon}</span>
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          h.isNow ? "text-white" : "text-white/70"
                        }`}
                      >
                        {h.temperature}°
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

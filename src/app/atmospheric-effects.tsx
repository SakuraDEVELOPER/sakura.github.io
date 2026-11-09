"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocaleText } from "@/lib/ui-locale";

export type Season = "winter" | "spring" | "summer" | "autumn";

const SEASON_STORAGE_KEY = "sakura_atmospheric_season_pref";

// Determine season by current month (0 = Jan, 1 = Feb, ..., 11 = Dec)
export function getAutoSeason(): Season {
  const month = new Date().getMonth();
  if (month === 11 || month === 0 || month === 1) return "winter"; // Dec, Jan, Feb
  if (month >= 2 && month <= 4) return "spring"; // Mar, Apr, May
  if (month >= 5 && month <= 7) return "summer"; // Jun, Jul, Aug
  return "autumn"; // Sep, Oct, Nov
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  swingOffset: number;
  swingSpeed: number;
  type: "petal" | "snow" | "firefly" | "leaf";
  color: string;
}

export default function AtmosphericEffects() {
  const { t } = useLocaleText();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [seasonMode, setSeasonMode] = useState<"auto" | Season | "off">("auto");
  const [activeSeason, setActiveSeason] = useState<Season>("spring");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize saved preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(SEASON_STORAGE_KEY) as any;
    if (saved && ["auto", "winter", "spring", "summer", "autumn", "off"].includes(saved)) {
      setSeasonMode(saved);
    }
  }, []);

  // Update active season based on mode
  useEffect(() => {
    if (seasonMode === "off") return;
    if (seasonMode === "auto") {
      setActiveSeason(getAutoSeason());
    } else {
      setActiveSeason(seasonMode);
    }
  }, [seasonMode]);

  // Canvas animation
  useEffect(() => {
    if (seasonMode === "off") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Season-specific color palettes & particle types
    const getParticleConfig = (season: Season) => {
      switch (season) {
        case "winter": // Frozen crystal sakura petals & soft snowflakes
          return {
            count: 36,
            colors: ["#ffffff", "#e0f2fe", "#bae6fd", "#fbcfe8", "#dbeafe"],
            types: ["petal", "snow", "snow"] as const,
            windBase: 0.3,
            speedYMin: 0.6,
            speedYMax: 1.6,
          };
        case "summer": // Vibrant cherry blossoms & warm glowing fireflies
          return {
            count: 34,
            colors: ["#fda4af", "#fb7185", "#f43f5e", "#fef08a", "#fef9c3"],
            types: ["petal", "petal", "firefly"] as const,
            windBase: 0.4,
            speedYMin: 0.5,
            speedYMax: 1.4,
          };
        case "autumn": // Crimson, golden & deep amber autumn sakura leaves
          return {
            count: 35,
            colors: ["#fb923c", "#f97316", "#e11d48", "#b91c1c", "#fbbf24"],
            types: ["leaf", "petal", "leaf"] as const,
            windBase: 0.7,
            speedYMin: 0.7,
            speedYMax: 2.0,
          };
        case "spring": // Classic blooming sakura petals
        default:
          return {
            count: 38,
            colors: ["#ffb7c5", "#f472b6", "#fbcfe8", "#fda4af", "#ffe4e6"],
            types: ["petal"] as const,
            windBase: 0.5,
            speedYMin: 0.6,
            speedYMax: 1.5,
          };
      }
    };

    const cfg = getParticleConfig(activeSeason);
    const particles: Particle[] = [];

    const createParticle = (spawnTop = false): Particle => {
      const type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
      const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      return {
        x: Math.random() * width,
        y: spawnTop ? -20 - Math.random() * 40 : Math.random() * height,
        size: type === "snow" ? 1.5 + Math.random() * 2.5 : type === "firefly" ? 2 + Math.random() * 2 : 6 + Math.random() * 8,
        speedY: cfg.speedYMin + Math.random() * (cfg.speedYMax - cfg.speedYMin),
        speedX: cfg.windBase + (Math.random() - 0.4) * 0.8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.03,
        opacity: 0.25 + Math.random() * 0.55,
        swingOffset: Math.random() * Math.PI * 2,
        swingSpeed: 0.015 + Math.random() * 0.02,
        type,
        color,
      };
    };

    for (let i = 0; i < cfg.count; i++) {
      particles.push(createParticle(false));
    }

    let isDocumentVisible = !document.hidden;
    const handleVisibility = () => {
      isDocumentVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    let lastTime = performance.now();

    const drawSakuraPetal = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(Math.cos(p.swingOffset), 1);
      ctx.beginPath();

      // Organic curved petal path
      const r = p.size;
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.8, -r * 0.7, r * 0.9, r * 0.3, 0, r);
      ctx.bezierCurveTo(-r * 0.9, r * 0.3, -r * 0.8, -r * 0.7, 0, -r);

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;

      // Subtle ice/frost sheen in winter
      if (activeSeason === "winter") {
        ctx.shadowColor = "#93c5fd";
        ctx.shadowBlur = 6;
      }

      ctx.fill();
      ctx.restore();
    };

    const drawSnowflake = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity * 0.85;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
    };

    const drawFirefly = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      const pulse = 0.5 + Math.sin(p.swingOffset * 2) * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity * (0.4 + pulse * 0.6);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10 * pulse;
      ctx.fill();
      ctx.restore();
    };

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (!isDocumentVisible) return;

      const dt = Math.min((time - lastTime) / 16.667, 2);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.swingOffset += p.swingSpeed * dt;
        p.rotation += p.rotationSpeed * dt;
        p.y += p.speedY * dt;
        p.x += (p.speedX + Math.sin(p.swingOffset) * 0.7) * dt;

        if (p.type === "snow") {
          drawSnowflake(p);
        } else if (p.type === "firefly") {
          drawFirefly(p);
        } else {
          drawSakuraPetal(p);
        }

        // Wrap around bottom/sides
        if (p.y > height + 20) {
          particles[i] = createParticle(true);
        } else if (p.x > width + 30) {
          p.x = -20;
        } else if (p.x < -30) {
          p.x = width + 20;
        }
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [seasonMode, activeSeason]);

  const selectSeason = (mode: "auto" | Season | "off") => {
    setSeasonMode(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SEASON_STORAGE_KEY, mode);
    }
    setIsMenuOpen(false);
  };

  const seasonIcons: Record<Season, string> = {
    winter: "❄️",
    spring: "🌸",
    summer: "✨",
    autumn: "🍁",
  };

  const seasonLabels: Record<Season, { ru: string; en: string }> = {
    winter: { ru: "Зима (Морозная сакура)", en: "Winter (Frost Sakura)" },
    spring: { ru: "Весна (Цветение сакуры)", en: "Spring (Sakura Bloom)" },
    summer: { ru: "Лето (Сакура со светлячками)", en: "Summer (Fireflies)" },
    autumn: { ru: "Осень (Багряный листопад)", en: "Autumn (Crimson Fall)" },
  };

  return (
    <>
      {seasonMode !== "off" && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-20 h-full w-full"
        />
      )}

      {/* Atmospheric Season Switcher Control */}
      {isMounted && typeof document !== "undefined" && document.getElementById("sakura-atmospheric-slot") ? (
        createPortal(
          <div className="relative">
            {isMenuOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
            )}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title={t("Atmospheric Effects & Season", "Атмосферные эффекты и сезон")}
              className="group relative z-20 flex items-center gap-1.5 rounded-full border border-[#2f1922] bg-[#120b0e]/95 px-3 py-1.5 text-[11px] font-mono text-gray-400 shadow-[0_0_20px_rgba(255,183,197,0.1)] backdrop-blur transition hover:border-[#ffb7c5]/50 hover:text-white"
            >
              <span className="text-xs">
                {seasonMode === "off" ? "⊘" : seasonIcons[activeSeason]}
              </span>
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-[#ffb7c5]">
                {seasonMode === "auto"
                  ? t("Auto", "Авто")
                  : seasonMode === "off"
                  ? t("Off", "Выкл")
                  : activeSeason.toUpperCase()}
              </span>
            </button>

            {isMenuOpen && (
              <div className="absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-[#2d1820] bg-[#120b0e]/95 p-2 shadow-[0_0_30px_rgba(255,183,197,0.18)] backdrop-blur-md">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-[#ffb7c5]">
                  {t("Atmosphere Season", "Сезон атмосферы")}
                </div>
                <div className="mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => selectSeason("auto")}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                      seasonMode === "auto"
                        ? "bg-[#ffb7c5] font-bold text-black"
                        : "text-gray-300 hover:bg-[#1f1118] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🔄</span>
                      <span>{t("Auto (By date)", "Авто (По календарю)")}</span>
                    </span>
                    {seasonMode === "auto" && <span>✓</span>}
                  </button>

                  {(["winter", "spring", "summer", "autumn"] as Season[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectSeason(s)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                        seasonMode === s
                          ? "bg-[#ffb7c5] font-bold text-black"
                          : "text-gray-300 hover:bg-[#1f1118] hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{seasonIcons[s]}</span>
                        <span>{t(seasonLabels[s].en, seasonLabels[s].ru)}</span>
                      </span>
                      {seasonMode === s && <span>✓</span>}
                    </button>
                  ))}

                  <div className="my-1 border-t border-[#25151c]" />

                  <button
                    type="button"
                    onClick={() => selectSeason("off")}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                      seasonMode === "off"
                        ? "bg-[#ff5a54] font-bold text-black"
                        : "text-gray-400 hover:bg-[#1f1118] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>⊘</span>
                      <span>{t("Disable Effects", "Отключить эффекты")}</span>
                    </span>
                    {seasonMode === "off" && <span>✓</span>}
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.getElementById("sakura-atmospheric-slot")!
        )
      ) : null}
    </>
  );
}

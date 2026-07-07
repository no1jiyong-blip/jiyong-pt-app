"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";

interface Props {
  /** 시작 시간(초). 0이면 처음에 비활성. */
  initialSeconds?: number;
}

const PRESETS = [60, 90, 120, 180];

export function RestTimer({ initialSeconds = 90 }: Props) {
  const [target, setTarget] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          // Beep via vibration if supported
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate?.([200, 100, 200]);
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const reset = () => {
    setRunning(false);
    setRemaining(target);
  };

  const adjust = (delta: number) => {
    const newTarget = Math.max(15, Math.min(600, target + delta));
    setTarget(newTarget);
    if (!running) setRemaining(newTarget);
  };

  const setPreset = (sec: number) => {
    setTarget(sec);
    setRemaining(sec);
    setRunning(false);
  };

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = target > 0 ? (remaining / target) * 100 : 0;
  const isLow = remaining > 0 && remaining <= 10;
  const isDone = remaining === 0;

  return (
    <div
      className="pt-card-xl flex flex-col gap-5"
      style={{
        background: isDone
          ? "linear-gradient(160deg, rgba(211,255,82,0.15) 0%, var(--pt-3) 60%)"
          : undefined,
        borderColor: isDone ? "var(--volt-glow-2)" : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-2 font-cond tracking-wide-2 uppercase leading-none">
          휴식 타이머
        </p>
        {isDone && (
          <span
            className="px-3 py-1 rounded-full font-cond font-bold text-[10px] tracking-wider leading-none"
            style={{
              background: "var(--grad-volt)",
              color: "#000",
            }}
          >
            완료!
          </span>
        )}
      </div>

      {/* Time display */}
      <div className="flex flex-col items-center gap-3">
        <p
          className={`font-display leading-none tabular-nums ${
            isLow ? "anim-pulse" : ""
          }`}
          style={{
            fontSize: 72,
            color: isDone
              ? "var(--volt)"
              : isLow
              ? "var(--warn)"
              : "var(--ink-0)",
            textShadow: isDone
              ? "0 0 32px var(--volt-glow-2)"
              : isLow
              ? "0 0 20px rgba(255,140,0,0.4)"
              : undefined,
          }}
        >
          {mm}:{ss}
        </p>

        {/* Track */}
        <div
          className="w-full rounded-full overflow-hidden"
          style={{
            height: 8,
            background: "var(--pt-2)",
            border: "1px solid var(--pt-5)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: isLow
                ? "linear-gradient(90deg, #ff8c00 0%, #ff5577 100%)"
                : "var(--grad-volt-bar)",
              transition: "width 1s linear",
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => adjust(-15)}
          className="tap-haptic w-12 h-12 rounded-2xl bg-pt-2 border border-pt-5 flex items-center justify-center text-ink-1 shrink-0"
        >
          <Minus size={16} />
        </button>

        <button
          onClick={() => {
            if (isDone) {
              setRemaining(target);
              setRunning(true);
            } else {
              setRunning((r) => !r);
            }
          }}
          className="tap-haptic flex-1 rounded-2xl flex items-center justify-center gap-2 font-cond font-bold tracking-wider"
          style={{
            background: running ? "var(--pt-4)" : "var(--grad-volt)",
            color: running ? "var(--ink-0)" : "#000",
            minHeight: 52,
            boxShadow: running ? undefined : "0 0 20px var(--volt-glow-2)",
            border: running ? "1px solid var(--pt-6)" : undefined,
          }}
        >
          {running ? (
            <>
              <Pause size={16} />
              일시정지
            </>
          ) : (
            <>
              <Play size={16} fill={isDone ? "#000" : "#000"} />
              {isDone ? "다시 시작" : "시작"}
            </>
          )}
        </button>

        <button
          onClick={() => adjust(15)}
          className="tap-haptic w-12 h-12 rounded-2xl bg-pt-2 border border-pt-5 flex items-center justify-center text-ink-1 shrink-0"
        >
          <Plus size={16} />
        </button>

        <button
          onClick={reset}
          className="tap-haptic w-12 h-12 rounded-2xl bg-pt-2 border border-pt-5 flex items-center justify-center text-ink-1 shrink-0"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Presets */}
      <div className="flex gap-2">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            onClick={() => setPreset(sec)}
            className={`tap-haptic flex-1 py-2.5 rounded-xl font-cond font-bold text-xs tracking-wider leading-none transition-colors ${
              target === sec
                ? "bg-volt text-black"
                : "bg-pt-2 text-ink-2 border border-pt-5"
            }`}
          >
            {sec >= 60 ? `${sec / 60}분` : `${sec}초`}
          </button>
        ))}
      </div>
    </div>
  );
}

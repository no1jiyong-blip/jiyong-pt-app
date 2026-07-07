"use client";

import { cn } from "@/lib/utils";

interface Props {
  /** 0-100, 백분위 (값이 클수록 상위) */
  percentile: number;
  /** 종목 이름 */
  exerciseName?: string;
  /** 강조 톤 */
  tone?: "volt" | "info";
}

export function PercentileGauge({
  percentile,
  exerciseName,
  tone = "volt",
}: Props) {
  // percentile 0~100. "상위 X%" = 100 - percentile (단, percentile이 백분위 등급일 때 그대로 사용)
  const topPct = Math.max(1, Math.round(100 - percentile));
  const fillPct = Math.min(100, Math.max(0, percentile));

  const fillStyle =
    tone === "volt"
      ? "var(--grad-volt-bar)"
      : "linear-gradient(90deg, #6ba3ff 0%, #4488ff 50%, #2a5db8 100%)";

  const tierLabel =
    topPct <= 5
      ? "엘리트"
      : topPct <= 25
      ? "상급"
      : topPct <= 50
      ? "중급"
      : topPct <= 75
      ? "초급"
      : "초보";

  return (
    <div className="flex flex-col gap-4">
      {/* Headline */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          {exerciseName && (
            <p className="text-[11px] font-cond text-ink-3 leading-none tracking-wider uppercase">
              {exerciseName}
            </p>
          )}
          <p
            className="font-display leading-none flex items-baseline gap-2"
            style={{ color: "var(--volt)" }}
          >
            <span style={{ fontSize: 14 }}>당신은</span>
            <span style={{ fontSize: 34, textShadow: "0 0 20px var(--volt-glow-2)" }}>
              상위 {topPct}%
            </span>
          </p>
          <p className="text-xs text-ink-2 font-cond leading-none">
            입니다 · {tierLabel} 수준
          </p>
        </div>
      </div>

      {/* Track */}
      <div className="relative">
        <div
          className="w-full rounded-full overflow-hidden"
          style={{
            height: 18,
            background: "linear-gradient(180deg, var(--pt-2) 0%, var(--pt-3) 100%)",
            border: "1px solid var(--pt-5)",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPct}%`,
              background: fillStyle,
              boxShadow:
                "0 0 16px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.25)",
              transition: "width 0.7s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          />
        </div>

        {/* Tier markers */}
        <div className="flex justify-between mt-2 px-1">
          {[
            { label: "초보", at: 0 },
            { label: "초급", at: 25 },
            { label: "중급", at: 50 },
            { label: "상급", at: 75 },
            { label: "엘리트", at: 95 },
          ].map((m) => (
            <span
              key={m.label}
              className={cn(
                "font-cond text-[9px] leading-none tracking-wider",
                fillPct >= m.at ? "text-volt" : "text-ink-4"
              )}
              style={{ fontWeight: fillPct >= m.at ? 700 : 500 }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

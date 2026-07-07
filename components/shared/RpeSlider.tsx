"use client";

interface Props {
  value: number; // 1-10
  onChange: (v: number) => void;
}

const RPE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "매우 가벼움", color: "#475569" },
  2: { label: "매우 가벼움", color: "#475569" },
  3: { label: "가벼움", color: "#64748b" },
  4: { label: "여유로움", color: "#94a3b8" },
  5: { label: "보통", color: "#cbd5e1" },
  6: { label: "약간 힘듦", color: "#cbd5e1" },
  7: { label: "힘듦", color: "#D3FF52" },
  8: { label: "매우 힘듦", color: "#D3FF52" },
  9: { label: "최대치 직전", color: "#ff8c00" },
  10: { label: "최대 강도", color: "#ff3b3b" },
};

export function RpeSlider({ value, onChange }: Props) {
  const info = RPE_LABELS[value];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-cond font-bold text-ink-2 tracking-wide-2 uppercase leading-none">
            RPE — 운동 강도
          </p>
          <p
            className="font-cond font-bold text-base leading-none"
            style={{ color: info.color }}
          >
            {info.label}
          </p>
        </div>
        <p
          className="font-display leading-none tabular-nums"
          style={{
            fontSize: 56,
            color: info.color,
            textShadow:
              value >= 7
                ? `0 0 20px ${info.color}80`
                : undefined,
          }}
        >
          {value}
        </p>
      </div>

      {/* Custom range slider */}
      <div className="relative">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full appearance-none cursor-pointer rpe-slider"
          style={{
            height: 14,
            borderRadius: 999,
            background: `linear-gradient(90deg, #475569 0%, #94a3b8 40%, var(--volt) 70%, #ff3b3b 100%)`,
            border: "1px solid var(--pt-5)",
          }}
        />
        <style jsx>{`
          .rpe-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 28px;
            height: 28px;
            border-radius: 999px;
            background: ${info.color};
            border: 3px solid #000;
            box-shadow: 0 0 16px ${info.color}80,
              inset 0 1px 0 rgba(255, 255, 255, 0.3);
            cursor: pointer;
            transition: transform 0.1s;
          }
          .rpe-slider::-webkit-slider-thumb:active {
            transform: scale(1.15);
          }
          .rpe-slider::-moz-range-thumb {
            width: 28px;
            height: 28px;
            border-radius: 999px;
            background: ${info.color};
            border: 3px solid #000;
            box-shadow: 0 0 16px ${info.color}80;
            cursor: pointer;
          }
        `}</style>
      </div>

      {/* Tick labels */}
      <div className="flex justify-between px-1">
        {[1, 3, 5, 7, 10].map((n) => (
          <span
            key={n}
            className="font-cond text-[10px] leading-none tracking-wider"
            style={{
              color: n === value ? info.color : "var(--ink-3)",
              fontWeight: n === value ? 700 : 500,
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

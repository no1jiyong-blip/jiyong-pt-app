"use client";

import type { Member } from "@/lib/types";

interface Props {
  member: Member;
}

export function StatsCards({ member }: Props) {
  const used = member.used_sessions;
  const total = member.total_sessions;
  const remaining = total - used;
  const progressPct = total > 0 ? Math.round((used / total) * 100) : 0;

  return (
    <div className="px-6 flex flex-col gap-4">
      {/* 등록 / 잔여 */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="등록 세션" value={total} accent />
        <StatCard label="잔여 세션" value={remaining} />
      </div>

      {/* Progress card */}
      <div className="pt-card flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-2 font-cond tracking-wide-2 uppercase leading-none">
            진행률
          </p>
          <p className="font-display text-volt text-xl tracking-wide leading-none">
            {used}/{total}
          </p>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="text-xs text-ink-3 font-cond text-right leading-none">
          {progressPct}% 완료
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="pt-card flex flex-col gap-4">
      <p className="text-xs text-ink-2 font-cond tracking-wide-2 uppercase leading-none">
        {label}
      </p>
      <p
        className="font-display leading-none"
        style={{
          color: accent ? "var(--volt)" : "var(--ink-0)",
          fontSize: 48,
          textShadow: accent ? "0 0 24px var(--volt-glow-2)" : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

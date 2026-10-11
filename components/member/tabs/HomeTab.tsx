"use client";

import { useMemo } from "react";
import { AlertTriangle, Calendar } from "lucide-react";
import type { Member, Session, ExerciseRecord } from "@/lib/types";
import { formatKoreanDate, getTodayISO } from "@/lib/utils";
import { SmartCalendar } from "@/components/member/SmartCalendar";
import { TabHeader } from "@/components/member/TabHeader";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
}

export function HomeTab({ member, sessions, recordsBySession }: Props) {
  const today = getTodayISO();
  const remaining = member.total_sessions - member.used_sessions;
  const used = member.used_sessions;
  const total = member.total_sessions;
  const progressPct = total > 0 ? Math.round((used / total) * 100) : 0;

  const isLow = remaining <= 5;
  const isCritical = remaining <= 3;

  /* 오늘 또는 가장 가까운 다음 세션 */
  const nextSession = useMemo(() => {
    const upcoming = [...sessions]
      .filter((s) => s.date >= today && s.status === "scheduled")
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }, [sessions, today]);

  /* 다음 수업까지 남은 일수 (D-Day) */
  const dDay = useMemo(() => {
    if (!nextSession) return null;
    const diffMs = new Date(nextSession.date).getTime() - new Date(today).getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }, [nextSession, today]);

  return (
    <div className="anim-tab-slide flex flex-col gap-7 px-5 pt-2 pb-32">
      {/* ─── 1. 통일된 탭 헤더 ─── */}
      <TabHeader
        title="DASHBOARD"
        subtitle="오늘의 현황을 한눈에"
      />

      {/* ─── 2. 3단 카드 [등록 | 진행 | 잔여] ─── */}
      <section className="grid grid-cols-3 gap-2.5">
        <CompactStat label="등록" value={total} muted />
        <CompactStat label="진행" value={used} />
        <CompactStat
          label="잔여"
          value={remaining}
          accent
          critical={isCritical}
          warning={isLow && !isCritical}
        />
      </section>

      {/* 위험 경고 */}
      {isLow && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3 border anim-fade-slide"
          style={{
            background: isCritical
              ? "rgba(255,59,59,0.08)"
              : "rgba(255,140,0,0.08)",
            borderColor: isCritical
              ? "rgba(255,59,59,0.3)"
              : "rgba(255,140,0,0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <AlertTriangle
            size={16}
            className="shrink-0 mt-0.5"
            style={{ color: isCritical ? "var(--danger)" : "var(--warn)" }}
          />
          <p
            className="text-xs leading-relaxed font-cond"
            style={{ color: isCritical ? "#ff8080" : "#e5a968" }}
          >
            {isCritical
              ? "세션이 곧 소진됩니다. 트레이너와 재등록을 상의하세요."
              : "잔여 세션이 얼마 남지 않았습니다. 미리 재등록을 준비하세요."}
          </p>
        </div>
      )}

      {/* ─── 3. 진행률 바 ─── */}
      <section className="pt-card flex flex-col gap-4" style={{ padding: 24 }}>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm font-cond font-bold text-ink-0 tracking-wide-2 leading-none uppercase">
            진행률
          </p>
          <p
            className="font-mono-num font-extrabold leading-none"
            style={{
              fontSize: 26,
              color: "var(--volt)",
              textShadow: "0 0 16px var(--volt-glow-2)",
            }}
          >
            {progressPct}%
          </p>
        </div>

        <div
          className="progress-track"
          style={{ height: 8, background: "var(--pt-5)" }}
        >
          <div
            className="progress-fill"
            style={{
              width: `${progressPct}%`,
              background: "var(--volt)",
              boxShadow: "0 0 10px rgba(211,255,82,0.5)",
            }}
          />
        </div>
      </section>

      {/* ─── 4. 캘린더 ─── */}
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2" style={{ fontSize: 18 }}>
          <Calendar size={16} style={{ color: "var(--volt)" }} />
          <span className="font-display text-ink-0 tracking-wider">
            SCHEDULE
          </span>
          <span className="font-cond text-sm text-ink-3">캘린더</span>
        </h2>
        <SmartCalendar
          sessions={sessions}
          recordsBySession={recordsBySession}
        />
      </section>

      {/* ─── 5. 다음 수업 — 티켓형 카드 (글래스모피즘) ─── */}
      {nextSession && (
        <section
          className="pt-card-glass flex flex-col gap-4"
          style={{ padding: 24 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-volt" />
              <p className="text-[10px] text-volt font-cond font-bold tracking-wide-2 uppercase leading-none">
                NEXT SESSION
              </p>
            </div>
            {dDay !== null && (
              <span
                className="font-mono-num font-bold px-2.5 py-1 rounded-full text-[10px] leading-none shrink-0"
                style={{
                  background: "rgba(211,255,82,0.12)",
                  color: "var(--volt)",
                  border: "1px solid var(--volt-glow-2)",
                }}
              >
                {dDay <= 0 ? "D-DAY" : `D-${dDay}`}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-mono-num font-bold text-xl text-ink-0 leading-tight">
              {formatKoreanDate(nextSession.date)}
              {nextSession.time && ` · ${nextSession.time}`}
            </p>
            <p className="text-sm text-ink-2 font-cond leading-none">
              1:1 퍼스널 트레이닝
              {nextSession.session_number && ` (Session ${nextSession.session_number})`}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Compact Stat (3단 카드 1칸) ─── */
function CompactStat({
  label,
  value,
  accent = false,
  muted = false,
  critical = false,
  warning = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
  critical?: boolean;
  warning?: boolean;
}) {
  const cardClass = accent ? "pt-stat-volt" : "pt-stat";
  const numColor = accent
    ? critical
      ? "var(--danger)"
      : "var(--volt)"
    : muted
    ? "var(--ink-2)"
    : "var(--ink-0)";

  const numShadow = accent
    ? critical
      ? "0 0 18px rgba(255,59,59,0.4)"
      : "0 0 22px var(--volt-glow-2)"
    : undefined;

  return (
    <div
      className={`${cardClass} flex flex-col gap-2 items-center justify-center text-center ${
        accent && critical
          ? "anim-danger-pulse"
          : accent && warning
          ? "anim-glow-pulse"
          : ""
      }`}
      style={{
        borderColor: accent && critical ? "rgba(255,59,59,0.5)" : undefined,
        background:
          accent && critical
            ? "linear-gradient(160deg, rgba(255,59,59,0.10) 0%, rgba(20,20,20,0.85) 70%)"
            : undefined,
      }}
    >
      <p className="text-[10px] font-cond text-ink-3 tracking-wider leading-none uppercase">
        {label}
      </p>
      <p
        className="font-mono-num font-extrabold leading-none"
        style={{
          fontSize: accent ? 36 : 26,
          color: numColor,
          textShadow: numShadow,
        }}
      >
        {value}
      </p>
    </div>
  );
}

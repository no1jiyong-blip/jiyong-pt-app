"use client";

import { useMemo } from "react";
import { Clock, MessageSquare, AlertTriangle, Calendar, Dumbbell } from "lucide-react";
import type { Member, Session, ExerciseRecord } from "@/lib/types";
import { formatKoreanDate, getTodayISO } from "@/lib/utils";
import { SmartCalendar } from "@/components/member/SmartCalendar";
import { BrandLogo } from "@/components/shared/BrandLogo";
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

  /* 가장 최근 트레이너 노트/피드백 */
  const latestNote = useMemo(() => {
    const sorted = [...sessions].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    for (const s of sorted) {
      if (s.feedback?.trim())
        return { text: s.feedback, type: "feedback" as const, date: s.date };
      if (s.trainer_note?.trim())
        return { text: s.trainer_note, type: "note" as const, date: s.date };
    }
    return null;
  }, [sessions]);

  return (
    <div className="anim-tab-slide flex flex-col gap-7 px-5 pt-2">
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
            className="font-display tabular-nums leading-none"
            style={{
              fontSize: 36,
              color: "var(--volt)",
              textShadow: "0 0 16px var(--volt-glow-2)",
            }}
          >
            {progressPct}%
            <span
              className="text-ink-3 text-xs font-cond ml-2"
              style={{ textShadow: "none" }}
            >
              완료
            </span>
          </p>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </section>

      {/* ─── 4. 캘린더 ─── */}
      <section className="flex flex-col gap-4">
        <h2 className="section-title" style={{ fontSize: 20 }}>
          <span className="section-bar"></span>
          <Calendar size={16} className="text-volt" />
          <span>캘린더</span>
        </h2>
        <SmartCalendar
          sessions={sessions}
          recordsBySession={recordsBySession}
        />
      </section>

      {/* ─── 5. 다음 수업 (제목 → 카드 내부 Volt 강조) ─── */}
      {nextSession && (
        <section
          className="pt-card flex flex-col gap-5"
          style={{ padding: 24 }}
        >
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-volt" />
            <p className="text-[10px] text-volt font-cond font-bold tracking-wide-2 uppercase leading-none">
              다음 수업
            </p>
          </div>

          {/* 날짜 / 시간 / 세션 번호 */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="font-display text-2xl text-ink-0 tracking-wider leading-none">
              {formatKoreanDate(nextSession.date)}
            </p>
            <span className="text-ink-4">·</span>
            <span className="flex items-center gap-1.5 text-sm font-cond text-ink-2 leading-none">
              <Clock size={13} />
              {nextSession.time ?? "—"}
            </span>
            {nextSession.session_number && (
              <>
                <span className="text-ink-4">·</span>
                <span className="text-sm font-cond text-ink-2 leading-none">
                  Session {nextSession.session_number}
                </span>
              </>
            )}
          </div>

          {/* 오늘의 운동 제목 — Volt Green 강조 */}
          {nextSession.title && (
            <div
              className="rounded-2xl p-5 flex items-center gap-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(211,255,82,0.10) 0%, rgba(20,20,20,0.8) 100%)",
                border: "1px solid var(--volt-glow-2)",
                boxShadow: "inset 0 0 20px rgba(211,255,82,0.05)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(211,255,82,0.12)",
                  border: "1px solid var(--volt-glow-2)",
                }}
              >
                <Dumbbell size={18} className="text-volt" />
              </div>
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <p className="text-[10px] font-cond font-bold text-volt tracking-wider leading-none uppercase">
                  오늘의 운동
                </p>
                <p
                  className="font-italic-display uppercase leading-none truncate"
                  style={{
                    color: "var(--volt)",
                    fontSize: "clamp(20px, 5vw, 26px)",
                    textShadow: "0 0 16px var(--volt-glow-2)",
                  }}
                >
                  {nextSession.title}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── 6. 트레이너 한마디 ─── */}
      {latestNote && (
        <section
          className="pt-card flex flex-col gap-3"
          style={{
            padding: 24,
            background:
              "linear-gradient(135deg, rgba(211,255,82,0.08) 0%, rgba(20,20,20,0.78) 70%)",
            borderColor: "var(--volt-glow-2)",
          }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-volt" />
            <p className="text-[10px] font-cond font-bold text-volt tracking-wide-2 uppercase leading-none">
              트레이너 한마디
            </p>
          </div>

          <p className="text-base text-ink-0 leading-relaxed font-body">
            {latestNote.text}
          </p>

          <p className="text-[11px] text-ink-3 font-cond leading-none">
            {latestNote.date} ·{" "}
            {latestNote.type === "feedback" ? "피드백" : "메모"}
          </p>
        </section>
      )}

      {/* ─── 7. 하단 누적 횟수 + 브랜드 로고 ─── */}
      <section className="flex items-center justify-center gap-3 py-6 opacity-80">
        <BrandLogo size={28} glow="soft" />
        <p className="font-cond text-sm text-ink-2 leading-none tracking-wide-2">
          누적{" "}
          <span className="text-volt font-bold tabular-nums">{used}</span>회
          완료 · JIYONG PT PRO
        </p>
      </section>
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
        className="font-display tabular-nums leading-none"
        style={{
          fontSize: accent ? 40 : 28,
          color: numColor,
          textShadow: numShadow,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}

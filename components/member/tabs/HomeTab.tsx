"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Member, Session, ExerciseRecord, PersonalLog } from "@/lib/types";
import { getTodayISO, DAY_NAME_KO } from "@/lib/utils";
import { SmartCalendar } from "@/components/member/SmartCalendar";
import { TabHeader } from "@/components/member/TabHeader";

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
}

export function HomeTab({ member, sessions, recordsBySession, personalLogs }: Props) {
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

  /* 다음 수업에 트레이너가 미리 입력해둔 예정 종목명 (세트·무게·횟수는 생략 — 현장에서 바뀌는 경우가 많아 종목명만 안내) */
  const plannedExerciseNames = useMemo(() => {
    if (!nextSession) return [];
    const recs = recordsBySession[nextSession.id] ?? [];
    return [...new Set(recs.map((r) => r.exercise_name))];
  }, [nextSession, recordsBySession]);

  return (
    <div className="anim-tab-slide flex flex-col gap-7 px-5 pt-2 pb-36">
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
            className="font-mono-num font-extrabold tabular-nums leading-none"
            style={{
              fontSize: 20,
              color: "var(--volt)",
              textShadow: "0 0 12px var(--volt-glow-2)",
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            출석 캘린더
          </h2>
          <div className="flex items-center gap-3 text-[10px] font-cond text-ink-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--volt)", boxShadow: "0 0 6px var(--volt)" }} />
              수업
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BA8FF", boxShadow: "0 0 6px #5BA8FF" }} />
              개인
            </span>
          </div>
        </div>
        <SmartCalendar
          sessions={sessions}
          recordsBySession={recordsBySession}
          personalLogs={personalLogs}
        />
      </section>

      {/* ─── 5. 다음 수업 — 섹션 제목(카드 바깥) + 메인 하이라이트 카드 ─── */}
      {nextSession && (
        <section className="flex flex-col gap-4">
          <h2 className="font-cond font-bold text-ink-0" style={{ fontSize: 17 }}>
            다음 수업
          </h2>

          <div
            className="flex flex-col gap-4"
            style={{
              padding: 22,
              borderRadius: 24,
              background: "linear-gradient(160deg, rgba(211,255,82,0.07) 0%, #141414 65%)",
              border: "1px solid rgba(211,255,82,0.2)",
            }}
          >
            {/* 상단 메타 한 줄 + D-Day */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-cond font-semibold text-ink-3 tabular-nums leading-none">
                {new Date(nextSession.date).getMonth() + 1}월 {new Date(nextSession.date).getDate()}일
                {" "}({DAY_NAME_KO[new Date(nextSession.date).getDay()].charAt(0)})
                {nextSession.time ? ` · ${nextSession.time}` : ""}
                {nextSession.session_number ? ` · ${nextSession.session_number}회차` : ""}
              </span>
              {dDay !== null && (
                <span
                  className="font-cond font-extrabold tabular-nums leading-none shrink-0"
                  style={{ fontSize: 16, color: "var(--volt)" }}
                >
                  {dDay <= 0 ? "D-DAY" : `D-${dDay}`}
                </span>
              )}
            </div>

            {/* 운동 컨셉 — 카드의 단독 메인 타이틀 */}
            <h3
              className="font-extrabold text-ink-0 leading-tight truncate"
              style={{ fontSize: 28, letterSpacing: "-0.02em" }}
            >
              {nextSession.title || "PT 수업"}
            </h3>

            {/* 예정 종목 — 긴 문장형 종목명도 자연스럽게 줄바꿈되는 무채색 텍스트 행 리스트 */}
            {plannedExerciseNames.length > 0 && (
              <div className="flex flex-col pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {plannedExerciseNames.map((name, i) => (
                  <p
                    key={name}
                    className="text-sm font-cond font-semibold text-ink-1 leading-snug py-2"
                    style={i > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}
                  >
                    {name}
                  </p>
                ))}
              </div>
            )}
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

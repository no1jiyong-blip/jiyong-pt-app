"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatKoreanDate, getTodayISO } from "@/lib/utils";
import type { Session, ExerciseRecord } from "@/lib/types";

interface Props {
  sessions: Session[];
  exerciseRecordsBySession: Record<string, ExerciseRecord[]>;
}

type FilterTab = "prev" | "today" | "next";

export function SessionScheduleCard({
  sessions,
  exerciseRecordsBySession,
}: Props) {
  const today = getTodayISO();

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.date.localeCompare(b.date)),
    [sessions]
  );

  const initialIdx = useMemo(() => {
    if (sortedSessions.length === 0) return 0;
    const todayIdx = sortedSessions.findIndex((s) => s.date === today);
    if (todayIdx >= 0) return todayIdx;
    const upcoming = sortedSessions.findIndex((s) => s.date >= today);
    return upcoming >= 0 ? upcoming : sortedSessions.length - 1;
  }, [sortedSessions, today]);

  const [currentIdx, setCurrentIdx] = useState(initialIdx);

  const currentSession = sortedSessions[currentIdx];
  const records = currentSession
    ? exerciseRecordsBySession[currentSession.id] ?? []
    : [];

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () =>
    setCurrentIdx((i) => Math.min(sortedSessions.length - 1, i + 1));

  const handleTab = (tab: FilterTab) => {
    if (sortedSessions.length === 0) return;
    if (tab === "today") {
      setCurrentIdx(initialIdx);
    } else if (tab === "prev") {
      const reversedIdx = [...sortedSessions]
        .reverse()
        .findIndex((s) => s.date < today);
      if (reversedIdx >= 0)
        setCurrentIdx(sortedSessions.length - 1 - reversedIdx);
    } else {
      const next = sortedSessions.findIndex((s) => s.date > today);
      if (next >= 0) setCurrentIdx(next);
    }
  };

  const activeTab: FilterTab = currentSession
    ? currentSession.date < today
      ? "prev"
      : currentSession.date > today
      ? "next"
      : "today"
    : "today";

  if (sortedSessions.length === 0) {
    return (
      <section className="px-6 flex flex-col gap-5">
        <h2 className="section-title">
          <span className="section-bar"></span>
          운동 일정
        </h2>
        <div className="pt-card text-center">
          <p className="text-ink-3 font-cond">등록된 세션이 없습니다</p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 flex flex-col gap-6">
      <h2 className="section-title">
        <span className="section-bar"></span>
        운동 일정
      </h2>

      {/* Tabs */}
      <div className="flex gap-2.5">
        {(["prev", "today", "next"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTab(tab)}
            className={cn("tab-pill", activeTab === tab && "tab-pill-active")}
          >
            {tab === "prev" ? "이전" : tab === "today" ? "오늘" : "다음"}
          </button>
        ))}
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="w-12 h-12 rounded-full bg-pt-3 border border-pt-5 flex items-center justify-center text-ink-1 disabled:opacity-30 shrink-0"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <p className="font-display text-2xl text-ink-0 tracking-wider leading-none truncate w-full text-center">
            {formatKoreanDate(currentSession.date)}
          </p>
          {currentSession.date === today && (
            <span className="font-display text-xs text-volt tracking-wide-3 leading-none">
              TODAY
            </span>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={currentIdx === sortedSessions.length - 1}
          className="w-12 h-12 rounded-full bg-pt-3 border border-pt-5 flex items-center justify-center text-ink-1 disabled:opacity-30 shrink-0"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Session card */}
      <SessionDetailCard session={currentSession} records={records} />
    </section>
  );
}

function SessionDetailCard({
  session,
  records,
}: {
  session: Session;
  records: ExerciseRecord[];
}) {
  return (
    <div className="pt-card-hot flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        {session.time && (
          <p className="text-ink-2 font-cond text-sm leading-none">
            {session.time}
          </p>
        )}
        <h3 className="font-display text-3xl text-volt tracking-wider leading-none">
          {session.title || "오늘의 운동"}
        </h3>
        {session.session_number && (
          <p className="text-ink-3 text-sm font-cond leading-none">
            Session {session.session_number}
          </p>
        )}
      </div>

      {/* Exercise list */}
      {records.length > 0 && (
        <div className="flex flex-col gap-3">
          {records.map((ex) => (
            <div
              key={ex.id}
              className="pt-card-inner flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <p className="font-cond font-bold text-ink-0 text-base leading-tight">
                  {ex.exercise_name}
                </p>
                {ex.description && (
                  <p className="text-ink-3 text-xs leading-relaxed">
                    {ex.description}
                  </p>
                )}
                <p className="text-ink-2 text-xs font-cond leading-none mt-1">
                  {ex.sets ?? 0}세트 × {ex.reps ?? 0}회
                </p>
              </div>
              {ex.weight ? (
                <div
                  className="px-4 py-2 rounded-full font-cond font-bold text-xs shrink-0 leading-none"
                  style={{
                    background: "var(--grad-volt)",
                    color: "#000",
                    boxShadow: "0 0 12px var(--volt-glow-2)",
                  }}
                >
                  {ex.weight}kg
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* Trainer note */}
      {records.length === 0 && session.trainer_note && (
        <div className="pt-card-inner flex flex-col gap-3">
          <p className="text-xs text-info font-cond font-bold tracking-wider leading-none uppercase">
            트레이너 메모
          </p>
          <p className="text-ink-1 text-sm leading-relaxed">
            {session.trainer_note}
          </p>
        </div>
      )}
    </div>
  );
}

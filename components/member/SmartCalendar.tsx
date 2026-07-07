"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Dumbbell, Clock } from "lucide-react";
import { cn, formatKoreanDate, getTodayISO } from "@/lib/utils";
import type { Session, ExerciseRecord } from "@/lib/types";

interface Props {
  /** 수업이 있던 날짜 리스트 (sessions로부터 자동 추출) */
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
}

export function SmartCalendar({ sessions, recordsBySession }: Props) {
  const today = getTodayISO();
  const [current, setCurrent] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const toISO = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

  const sessionDates = new Set(sessions.map((s) => s.date));

  const selectedSession = selectedDate
    ? sessions.find((s) => s.date === selectedDate)
    : null;
  const selectedRecords = selectedSession
    ? recordsBySession[selectedSession.id] ?? []
    : [];

  return (
    <>
      <div className="pt-card-xl flex flex-col gap-5">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="tap-haptic w-11 h-11 rounded-full bg-pt-2 border border-pt-5 flex items-center justify-center text-ink-1"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[10px] font-cond text-ink-3 leading-none tracking-wide-2 uppercase">
              CALENDAR
            </p>
            <h3 className="font-display text-xl text-ink-0 tracking-wider leading-none">
              {year}.{pad(month + 1)}
            </h3>
          </div>
          <button
            onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="tap-haptic w-11 h-11 rounded-full bg-pt-2 border border-pt-5 flex items-center justify-center text-ink-1"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div
              key={d}
              className="text-center text-[11px] font-cond font-bold py-1.5 leading-none"
              style={{
                color:
                  i === 0 ? "#ff5577" : i === 6 ? "#5BA8FF" : "var(--ink-2)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="h-11" />;
            const iso = toISO(day);
            const hasSession = sessionDates.has(iso);
            const isToday = iso === today;

            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  "tap-haptic h-11 rounded-xl font-cond font-bold text-sm transition-all relative leading-none flex items-center justify-center",
                  isToday ? "text-volt" : "text-ink-1"
                )}
                style={{
                  background: isToday ? "rgba(211,255,82,0.08)" : "transparent",
                  border: isToday
                    ? "1px solid var(--volt-glow-2)"
                    : "1px solid transparent",
                }}
              >
                {day}
                {hasSession && (
                  <span
                    className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: 4,
                      height: 4,
                      background: "var(--volt)",
                      boxShadow: "0 0 6px var(--volt-glow-2)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          session={selectedSession ?? null}
          records={selectedRecords}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}

/* ─── 날짜 모달 ──────────────────────── */
function DayModal({
  date,
  session,
  records,
  onClose,
}: {
  date: string;
  session: Session | null;
  records: ExerciseRecord[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-0 md:px-6"
      style={{
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-modal w-full md:max-w-md max-h-[85vh] overflow-y-auto p-7 anim-fade-slide flex flex-col gap-5 safe-pb"
        style={{
          borderRadius: "24px 24px 0 0",
        }}
      >
        {/* Drag handle */}
        <div
          className="md:hidden mx-auto rounded-full"
          style={{ width: 40, height: 4, backgroundColor: "var(--pt-5)" }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-[10px] font-cond font-bold text-volt tracking-wide-2 leading-none uppercase">
              운동 기록
            </p>
            <h3 className="font-display text-2xl text-ink-0 tracking-wider leading-none">
              {formatKoreanDate(date)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="tap-haptic w-11 h-11 rounded-full bg-pt-2 hover:bg-pt-4 flex items-center justify-center text-ink-2 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {!session ? (
          <div className="py-10 text-center flex flex-col gap-3">
            <p className="text-ink-3 font-cond text-sm">
              이 날짜에는 운동 기록이 없습니다
            </p>
          </div>
        ) : (
          <>
            {/* Session info */}
            <div className="pt-card-inner flex flex-col gap-3">
              {session.title && (
                <h4 className="font-display text-lg text-volt tracking-wider leading-none">
                  {session.title}
                </h4>
              )}
              <div className="flex items-center gap-3 text-xs text-ink-2 font-cond leading-none">
                {session.time && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    {session.time}
                  </span>
                )}
                {session.session_number && (
                  <>
                    <span className="text-ink-4">·</span>
                    <span>Session {session.session_number}</span>
                  </>
                )}
                <span className="text-ink-4">·</span>
                <span
                  className={
                    session.status === "completed"
                      ? "text-volt font-bold"
                      : session.status === "cancelled"
                      ? "text-ink-3"
                      : "text-info"
                  }
                >
                  {session.status === "completed"
                    ? "완료"
                    : session.status === "cancelled"
                    ? "결석"
                    : "예정"}
                </span>
              </div>
            </div>

            {/* Trainer note */}
            {session.trainer_note && (
              <div
                className="rounded-2xl p-5 border flex flex-col gap-2"
                style={{
                  background: "rgba(68,136,255,0.06)",
                  borderColor: "rgba(68,136,255,0.25)",
                }}
              >
                <p className="text-[10px] text-info font-cond font-bold tracking-wider leading-none uppercase">
                  트레이너 메모
                </p>
                <p className="text-sm text-ink-1 leading-relaxed">
                  {session.trainer_note}
                </p>
              </div>
            )}

            {/* Exercise records */}
            {records.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-cond font-bold text-ink-2 tracking-wider leading-none uppercase flex items-center gap-1.5">
                  <Dumbbell size={12} />
                  운동 기록
                </p>
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="bg-pt-2 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <span className="font-cond font-bold text-ink-0 text-sm">
                      {r.exercise_name}
                    </span>
                    <span className="text-xs text-ink-2 font-cond shrink-0">
                      {r.sets ?? 0}세트 × {r.reps ?? 0}회
                      {r.weight ? ` @ ${r.weight}kg` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {session.feedback && (
              <div
                className="rounded-2xl p-5 border flex flex-col gap-2"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(211,255,82,0.08) 0%, transparent 100%)",
                  borderColor: "var(--volt-glow-2)",
                }}
              >
                <p className="text-[10px] text-volt font-cond font-bold tracking-wider leading-none uppercase">
                  피드백
                </p>
                <p className="text-sm text-ink-1 leading-relaxed">
                  {session.feedback}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

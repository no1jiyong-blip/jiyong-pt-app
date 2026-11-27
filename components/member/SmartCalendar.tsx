"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Dumbbell, Clock, Activity } from "lucide-react";
import { cn, formatKoreanDate, getTodayISO } from "@/lib/utils";
import type { Session, ExerciseRecord, PersonalLog } from "@/lib/types";

interface Props {
  /** 수업이 있던 날짜 리스트 (sessions로부터 자동 추출) */
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
}

type AttendanceType = "pt" | "personal" | "both";
interface AttendanceRecord {
  type: AttendanceType;
  title: string;
}

export function SmartCalendar({ sessions, recordsBySession, personalLogs }: Props) {
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

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed"),
    [sessions]
  );
  const scheduledDates = useMemo(
    () => new Set(sessions.filter((s) => s.status === "scheduled").map((s) => s.date)),
    [sessions]
  );

  /* 날짜별 출석 기록(완료된 PT 수업 + 개인 운동) — 출석 탭과 동일한 집계 방식 */
  const attendanceRecords = useMemo(() => {
    const map: Record<string, AttendanceRecord> = {};

    completedSessions.forEach((s) => {
      const names = Array.from(new Set((recordsBySession[s.id] ?? []).map((r) => r.exercise_name)));
      const title = names.length > 0 ? `PT 수업 · ${names.slice(0, 3).join(" · ")}` : "PT 수업";
      map[s.date] = { type: "pt", title };
    });

    personalLogs.forEach((l) => {
      const personalTitle = `개인 운동 · ${l.workout_memo ?? l.exercise_name}`;
      const existing = map[l.log_date];
      if (!existing) {
        map[l.log_date] = { type: "personal", title: personalTitle };
      } else if (existing.type === "pt") {
        map[l.log_date] = { type: "both", title: `${existing.title} + ${personalTitle}` };
      } else {
        map[l.log_date] = { ...existing, title: `${existing.title} · ${personalTitle}` };
      }
    });

    return map;
  }, [completedSessions, recordsBySession, personalLogs]);

  const monthTotal = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}`;
    return Object.entries(attendanceRecords).reduce((acc, [date, rec]) => {
      if (!date.startsWith(prefix)) return acc;
      return acc + (rec.type === "both" ? 2 : 1);
    }, 0);
  }, [attendanceRecords, year, month]);

  const selectedSession = selectedDate
    ? sessions.find((s) => s.date === selectedDate) ?? null
    : null;
  const selectedRecords = selectedSession
    ? recordsBySession[selectedSession.id] ?? []
    : [];
  const selectedPersonalLogs = selectedDate
    ? personalLogs.filter((l) => l.log_date === selectedDate)
    : [];

  return (
    <>
      <div className="pt-card-xl flex flex-col gap-4">
        {/* 상단: 월 표시 + 총 출석 배지 / 월 이동 버튼 */}
        <div
          className="flex items-center justify-between pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <h3 className="font-mono-num font-bold text-lg text-ink-0 leading-none tabular-nums">
              {year}.{pad(month + 1)}
            </h3>
            <span className="text-[10px] font-cond font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-100 border border-zinc-700 tabular-nums">
              총 {monthTotal}회 출석
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrent(new Date(year, month - 1, 1))}
              aria-label="이전 달"
              className="tap-haptic w-8 h-8 rounded-full bg-pt-1 border border-pt-5 flex items-center justify-center text-ink-2"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrent(new Date(year, month + 1, 1))}
              aria-label="다음 달"
              className="tap-haptic w-8 h-8 rounded-full bg-pt-1 border border-pt-5 flex items-center justify-center text-ink-2"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div
              key={d}
              className={cn(
                "text-center text-[11px] font-cond font-semibold py-1.5 leading-none",
                i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-ink-3"
              )}
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
            const record = attendanceRecords[iso] ?? null;
            const isScheduled = scheduledDates.has(iso);
            const isToday = iso === today;

            return (
              <button
                key={iso}
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  "tap-haptic h-11 rounded-xl font-mono-num font-bold text-sm transition-all relative leading-none flex items-center justify-center tabular-nums",
                  isToday ? "text-volt" : "text-ink-1"
                )}
                style={{
                  background: isToday ? "rgba(211,255,82,0.12)" : "transparent",
                  border: isToday
                    ? "1px solid var(--volt)"
                    : "1px solid transparent",
                }}
              >
                {day}
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                  {record?.type === "pt" && <Dot color="var(--volt)" />}
                  {record?.type === "personal" && <Dot color="#5BA8FF" />}
                  {record?.type === "both" && (
                    <>
                      <Dot color="var(--volt)" />
                      <Dot color="#5BA8FF" />
                    </>
                  )}
                  {!record && isScheduled && (
                    <span
                      className="rounded-full"
                      style={{ width: 6, height: 6, border: "1.5px solid var(--ink-3)" }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {selectedDate && (
        <DayModal
          date={selectedDate}
          session={selectedSession}
          records={selectedRecords}
          personalLogs={selectedPersonalLogs}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="rounded-full"
      style={{ width: 6, height: 6, background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

/* ─── 날짜 모달 ──────────────────────── */
function DayModal({
  date,
  session,
  records,
  personalLogs,
  onClose,
}: {
  date: string;
  session: Session | null;
  records: ExerciseRecord[];
  personalLogs: PersonalLog[];
  onClose: () => void;
}) {
  const hasAnything = !!session || personalLogs.length > 0;

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

        {!hasAnything ? (
          <div className="py-10 text-center flex flex-col gap-3">
            <p className="text-ink-3 font-cond text-sm">
              이 날짜에는 운동 기록이 없습니다
            </p>
          </div>
        ) : (
          <>
            {session && (
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
                        <span className="tabular-nums">Session {session.session_number}</span>
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
                        <span className="text-xs text-ink-2 font-cond shrink-0 tabular-nums">
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

            {/* 개인 운동 기록 */}
            {personalLogs.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-cond font-bold text-ink-2 tracking-wider leading-none uppercase flex items-center gap-1.5">
                  <Activity size={12} />
                  개인 운동 기록
                </p>
                {personalLogs.map((l) => (
                  <div key={l.id} className="bg-pt-2 rounded-xl p-4 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-cond font-bold text-ink-0 text-sm">
                        {l.exercise_name}
                      </span>
                      <span className="text-xs text-ink-2 font-cond shrink-0 tabular-nums">
                        {l.sets ?? 0}세트 × {l.reps ?? 0}회
                      </span>
                    </div>
                    {l.workout_memo && (
                      <p className="text-xs text-ink-3 font-cond">{l.workout_memo}</p>
                    )}
                    {l.memo && (
                      <p className="text-xs text-ink-3 font-cond leading-relaxed">{l.memo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

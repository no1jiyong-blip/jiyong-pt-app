"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, X, Copy, Trophy, Save, Loader2,
  ChevronDown, ChevronUp, Play, Pause, RotateCcw, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ALL_EXERCISES, type PersonalLog, type Session,
  type ExerciseRecord, type Member, calcOneRM,
} from "@/lib/types";
import { formatShortKoreanDate, getTodayISO } from "@/lib/utils";
import { Confetti } from "@/components/shared/Confetti";
import { TabHeader } from "@/components/member/TabHeader";

/* ─── RPE 설명 ─── */
const RPE_DESC: Record<number, { label: string; desc: string }> = {
  1:  { label: "매우 가벼움", desc: "일상적인 움직임 수준, 운동 강도 거의 없음" },
  2:  { label: "매우 가벼움", desc: "일상적인 움직임 수준, 운동 강도 거의 없음" },
  3:  { label: "가벼움",     desc: "가벼운 운동, 대화가 자유롭고 힘들지 않음" },
  4:  { label: "가벼움",     desc: "약간의 땀남, 대화는 여전히 편안한 수준" },
  5:  { label: "보통",       desc: "알맞은 운동 강도, 대화는 가능하나 약간 숨이 참" },
  6:  { label: "보통",       desc: "숨이 조금 차지만 아직 여유 있음, 5개 이상 더 가능" },
  7:  { label: "힘듦",       desc: "대화가 끊긴 힘든 수준, 몇 개 더 할 수 있음" },
  8:  { label: "힘듦",       desc: "2~3개 더 할 수 있는 수준, 호흡이 상당히 거침" },
  9:  { label: "매우 힘듦",  desc: "1개 정도 더 할 수 있는 한계 근접 수준" },
  10: { label: "최대 한계",  desc: "더 이상 할 수 없는 최대치, 완전 소진 상태" },
};

/* ─── 컨디션 설명 ─── */
const COND_DESC: Record<number, { label: string; desc: string }> = {
  1:  { label: "매우 안좋음", desc: "몸살/극심한 피로, 운동 추천하지 않음" },
  2:  { label: "안좋음",      desc: "수면 부족 또는 컨디션 다운, 가벼운 운동만 권장" },
  3:  { label: "안좋음",      desc: "피로감 뚜렷, 운동 강도 낮게 설정" },
  4:  { label: "약간 안좋음", desc: "멍멍함, 평소보다 강도 낮춤 권장" },
  5:  { label: "보통",        desc: "평범한 컨디션, 일반적인 운동 가능" },
  6:  { label: "보통",        desc: "양호한 상태, 고정 강도 소화 가능" },
  7:  { label: "좋음",        desc: "에너지 넘치고 운동 의욕 높음" },
  8:  { label: "좋음",        desc: "컨디션 양호, 고강도 운동이 가능한 상태" },
  9:  { label: "매우 좋음",   desc: "컨디션 최상, PR(개인 기록) 도전 가능" },
  10: { label: "매우 좋음",   desc: "완벽한 컨디션, 한계 도전에 최적의 날" },
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  member: Member;
  sessions: Session[];
  recordsBySession: Record<string, ExerciseRecord[]>;
  personalLogs: PersonalLog[];
  onUpdate: () => void;
}

type HistoryFilter = "all" | "pt" | "personal";
type PeriodFilter  = "all" | "week" | "month";

export function WorkoutTab({ member, sessions, recordsBySession, personalLogs, onUpdate }: Props) {
  const today = getTodayISO();
  const [confettiKey,  setConfettiKey]  = useState(0);
  const [pbExercise,   setPbExercise]   = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [histFilter,   setHistFilter]   = useState<HistoryFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  /* 다음 PT 세션 */
  const nextSession = useMemo(() =>
    sessions
      .filter(s => s.date >= today && s.status === "scheduled")
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    [sessions, today]
  );

  /* D-day */
  const dDay = useMemo(() => {
    if (!nextSession) return null;
    return Math.ceil(
      (new Date(nextSession.date).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
    );
  }, [nextSession, today]);

  /* PB 맵 */
  const pbMap = useMemo(() => {
    const map = new Map<string, number>();
    sessions.filter(s => s.status === "completed").forEach(s => {
      (recordsBySession[s.id] ?? []).forEach(r => {
        const orm = calcOneRM(r.weight ?? 0, r.reps ?? 0);
        if (orm > 0 && orm > (map.get(r.exercise_name) ?? 0))
          map.set(r.exercise_name, orm);
      });
    });
    return map;
  }, [sessions, recordsBySession]);

  /* 기간 필터 시작일 */
  const periodStart = useMemo(() => {
    const now = new Date();
    if (periodFilter === "week") {
      const dow = now.getDay();
      const d = new Date(now);
      d.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      return d.toISOString().slice(0, 10);
    }
    if (periodFilter === "month")
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return null;
  }, [periodFilter]);

  /* ─── 통합 히스토리 ─── */
  interface HItem {
    id: string; type: "pt" | "personal"; date: string;
    title: string; subtitle: string;
    totalSets: number;
    exercises: { name: string; sets: number; reps: number; weight?: number | null }[];
    feedback?: string | null;
    rpe?: number | null; condScore?: number | null;
    workoutMemo?: string | null;
  }

  const history: HItem[] = useMemo(() => {
    const items: HItem[] = [];

    sessions.filter(s => {
      if (s.status !== "completed") return false;
      if (periodStart && s.date < periodStart) return false;
      return true;
    }).forEach(s => {
      const recs = recordsBySession[s.id] ?? [];
      items.push({
        id: `pt-${s.id}`, type: "pt", date: s.date,
        title: s.title || "PT 수업",
        subtitle: `SESSION ${s.session_number ?? "?"}  ·  ${s.time ?? ""}`,
        totalSets: recs.reduce((a, r) => a + (r.sets ?? 0), 0),
        exercises: recs.map(r => ({ name: r.exercise_name, sets: r.sets ?? 0, reps: r.reps ?? 0, weight: r.weight })),
        feedback: s.feedback,
      });
    });

    /* 개인 운동: 날짜별 그룹 */
    const grp = new Map<string, PersonalLog[]>();
    personalLogs.filter(l => !periodStart || l.log_date >= periodStart)
      .forEach(l => {
        if (!grp.has(l.log_date)) grp.set(l.log_date, []);
        grp.get(l.log_date)!.push(l);
      });

    grp.forEach((logs, date) => {
      const totalSets = logs.reduce((a, l) => a + (l.sets ?? 0), 0);
      items.push({
        id: `personal-${date}`, type: "personal", date,
        title: logs[0]?.workout_memo || "개인 운동",
        subtitle: `${logs.length}종목`,
        totalSets,
        exercises: logs.map(l => ({ name: l.exercise_name, sets: l.sets ?? 0, reps: l.reps ?? 0 })),
        rpe: (() => {
          const m = logs[0]?.memo?.match(/RPE (\d+)/);
          return m ? parseInt(m[1]) : null;
        })(),
        condScore: logs[0]?.condition_score ?? null,
        workoutMemo: logs[0]?.workout_memo ?? null,
      });
    });

    return items
      .filter(item => histFilter === "all" || item.type === histFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, recordsBySession, personalLogs, histFilter, periodStart]);

  return (
    <div className="anim-tab-slide flex flex-col gap-6 px-5 pt-2">
      <Confetti trigger={confettiKey} count={70} />
      {pbExercise && (
        <div className="fixed top-6 left-1/2 z-[60] -translate-x-1/2 px-6 py-4 rounded-2xl flex items-center gap-3"
          style={{ background: "var(--grad-volt)", color: "#000", boxShadow: "0 0 32px var(--volt-glow-2)" }}>
          <Trophy size={20} strokeWidth={2.5} />
          <div className="flex flex-col gap-0.5">
            <p className="font-display text-base tracking-wider leading-none">PB 달성!</p>
            <p className="font-cond font-bold text-xs leading-none">{pbExercise} 신기록</p>
          </div>
        </div>
      )}

      <TabHeader title="WORKOUT LOG" subtitle="오늘의 운동과 개인 운동 일지를 관리하세요" />

      {/* 플로팅 타이머 */}
      <FloatingTimer />

      {/* ─── NEXT WORKOUT ─── */}
      <NextWorkoutSection
        session={nextSession}
        records={nextSession ? (recordsBySession[nextSession.id] ?? []) : []}
        isToday={nextSession?.date === today}
        dDay={dDay}
      />

      {/* ─── 개인 운동 일지 ─── */}
      <section className="flex flex-col gap-3">
        {/* 섹션 헤더 */}
        <div className="flex items-center gap-3">
          <div className="section-bar" />
          <span className="font-display text-xl text-ink-0 tracking-wide leading-none uppercase">개인 운동 일지</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-cond font-bold leading-none"
            style={{ background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
            {personalLogs.length}건
          </span>
        </div>

        {/* 추가 버튼 */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="tap-haptic w-full rounded-2xl flex items-center justify-center gap-2 font-cond font-bold text-sm text-ink-0"
            style={{ height: 52, background: "var(--pt-2)", border: "1px dashed var(--volt-glow-2)" }}
          >
            <Plus size={16} strokeWidth={3} style={{ color: "var(--volt)" }} />
            개인 운동 기록 추가
          </button>
        )}

        {showForm && (
          <PersonalWorkoutForm
            memberId={member.id} pbMap={pbMap}
            onSaved={() => { setShowForm(false); onUpdate(); }}
            onCancel={() => setShowForm(false)}
            onPB={name => {
              setPbExercise(name); setConfettiKey(k => k + 1);
              setTimeout(() => setPbExercise(null), 3500);
            }}
          />
        )}
      </section>

      {/* ─── 운동 히스토리 ─── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="section-bar" />
          <span className="font-display text-xl text-ink-0 tracking-wide leading-none uppercase">운동 히스토리</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-cond font-bold leading-none"
            style={{ background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
            {history.length}건
          </span>
        </div>

        {/* 타입 필터 */}
        <div className="flex gap-2">
          {([
            ["all",      "전체보기",  null],
            ["pt",       "PT 수업",   "var(--volt)"],
            ["personal", "개인 운동", "#5BA8FF"],
          ] as [HistoryFilter, string, string | null][]).map(([key, label, dot]) => (
            <button key={key} onClick={() => setHistFilter(key)}
              className="tap-haptic flex-1 py-2.5 rounded-xl font-cond font-bold text-xs tracking-wide leading-none transition-all flex items-center justify-center gap-1.5"
              style={histFilter === key
                ? { background: key === "all" ? "var(--grad-volt)" : key === "pt" ? "var(--pt-4)" : "var(--pt-4)", color: key === "all" ? "#000" : "var(--ink-0)", border: "1px solid var(--pt-6)" }
                : { background: "var(--pt-2)", color: "var(--ink-3)", border: "1px solid var(--pt-5)" }}>
              {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />}
              {label}
            </button>
          ))}
        </div>

        {/* 기간 필터 */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: "var(--pt-2)", border: "1px solid var(--pt-5)" }}>
          {([["all","전체"],["week","이번 주"],["month","이번 달"]] as [PeriodFilter,string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPeriodFilter(key)}
              className="tap-haptic flex-1 py-2.5 rounded-lg font-cond font-bold text-xs leading-none transition-all"
              style={periodFilter === key
                ? { background: "var(--grad-volt)", color: "#000", boxShadow: "0 0 8px var(--volt-glow-2)" }
                : { color: "var(--ink-3)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* 카드 목록 */}
        {history.length === 0
          ? <div className="pt-card text-center py-8"><p className="text-ink-3 font-cond text-sm">운동 기록이 없습니다</p></div>
          : <div className="flex flex-col gap-2">{history.map(item => <HistoryCard key={item.id} item={item} />)}</div>}
      </section>

      <div style={{ height: 20 }} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   NEXT WORKOUT 섹션 — 스크린샷 1:1 구현
   세션 없어도 항상 표시
   ════════════════════════════════════════════════════════════════ */
function NextWorkoutSection({ session, records, isToday, dDay }: {
  session: Session | null;
  records: ExerciseRecord[];
  isToday: boolean | undefined;
  dDay: number | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      {/* ── 헤더: NEXT WORKOUT + D-day 배지 ── */}
      <div className="flex items-center gap-2.5">
        <div className="section-bar" />
        <span
          className="font-display text-ink-0 tracking-wide leading-none uppercase"
          style={{ fontSize: 18, letterSpacing: "0.08em" }}
        >
          NEXT WORKOUT
        </span>
        {dDay !== null && (
          <span
            className="font-cond font-bold leading-none"
            style={{
              fontSize: 11,
              color: "var(--volt)",
              border: "1.5px solid var(--volt)",
              borderRadius: 6,
              padding: "3px 8px",
              letterSpacing: "0.04em",
            }}
          >
            {dDay === 0 ? "TODAY" : dDay === 1 ? "D-1" : `D-${dDay}`}
          </span>
        )}
      </div>

      {/* ── 카드 ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {session ? (
          <div className="p-5 flex flex-col gap-2.5">
            {/* 시간 */}
            {session.time && (
              <p className="font-cond text-ink-2 leading-none" style={{ fontSize: 13 }}>
                {session.time}
              </p>
            )}

            {/* 제목 + TODAY 배지 */}
            <div className="flex items-center justify-between gap-3">
              <h3
                className="font-display leading-none"
                style={{
                  fontSize: 26,
                  color: "var(--volt)",
                  textShadow: "0 0 18px rgba(211,255,82,0.35)",
                }}
              >
                {isToday ? "오늘의 운동" : session.title || "다음 운동"}
              </h3>
              {isToday && (
                <span
                  className="font-cond font-bold leading-none shrink-0"
                  style={{
                    background: "var(--grad-volt)",
                    color: "#000",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 13,
                  }}
                >
                  TODAY
                </span>
              )}
            </div>

            {/* SESSION 번호 */}
            {session.session_number && (
              <p
                className="font-cond text-ink-3 leading-none uppercase tracking-wider"
                style={{ fontSize: 11 }}
              >
                SESSION {session.session_number}
              </p>
            )}

            {/* 구분선 */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />

            {/* 운동 목록 or 안내 메시지 */}
            {records.length > 0 ? (
              <div className="flex flex-col gap-2 mt-1">
                {records.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between gap-3 px-3 rounded-xl"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      height: 44,
                    }}
                  >
                    <p className="font-cond font-bold text-ink-0 text-sm leading-none">{ex.exercise_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-cond text-ink-3">{ex.sets}세트 × {ex.reps}회</span>
                      {ex.weight && (
                        <span
                          className="font-cond font-bold leading-none"
                          style={{
                            background: "var(--grad-volt)",
                            color: "#000",
                            borderRadius: 999,
                            padding: "4px 10px",
                            fontSize: 10,
                          }}
                        >
                          {ex.weight}kg
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="font-cond text-ink-3 text-center"
                style={{ fontSize: 13, padding: "10px 0 4px" }}
              >
                아직 운동 계획이 입력되지 않았습니다
              </p>
            )}
          </div>
        ) : (
          /* 세션 자체가 없을 때 */
          <div className="p-5 flex flex-col gap-2.5">
            <p className="font-cond text-ink-3 text-center" style={{ fontSize: 13, padding: "14px 0" }}>
              예정된 수업이 없습니다
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════
   개인 운동 입력 폼
   ════════════════════════════════════════════════════════════════ */
interface SetRow { weight: string; reps: string; }
interface ExEntry { exercise: string; sets: SetRow[]; isOpen: boolean; }

function PersonalWorkoutForm({ memberId, pbMap, onSaved, onCancel, onPB }: {
  memberId: string; pbMap: Map<string, number>;
  onSaved: () => void; onCancel: () => void; onPB: (n: string) => void;
}) {
  const [date,        setDate]        = useState(getTodayISO());
  const [workoutMemo, setWorkoutMemo] = useState("");
  const [entries,     setEntries]     = useState<ExEntry[]>([
    { exercise: "", sets: [{ weight: "", reps: "" }], isOpen: true },
  ]);
  const [rpe,       setRpe]       = useState(7);
  const [condition, setCondition] = useState(7);
  const [saving,    setSaving]    = useState(false);

  const addExercise  = () => setEntries(p => [...p, { exercise: "", sets: [{ weight: "", reps: "" }], isOpen: true }]);
  const toggleOpen   = (i: number) => setEntries(p => p.map((e, idx) => idx === i ? { ...e, isOpen: !e.isOpen } : e));
  const updateName   = (i: number, v: string) => setEntries(p => p.map((e, idx) => idx === i ? { ...e, exercise: v } : e));
  const removeEntry  = (i: number) => setEntries(p => p.filter((_, idx) => idx !== i));
  const addSet       = (i: number) => setEntries(p => p.map((e, idx) => idx === i ? { ...e, sets: [...e.sets, { weight: "", reps: "" }] } : e));
  const copyLast     = (i: number) => setEntries(p => p.map((e, idx) => { if (idx !== i) return e; const last = e.sets[e.sets.length - 1]; return { ...e, sets: [...e.sets, { ...last }] }; }));
  const removeSet    = (ei: number, si: number) => setEntries(p => p.map((e, idx) => idx === ei ? { ...e, sets: e.sets.filter((_, i) => i !== si) } : e));
  const updateSet    = (ei: number, si: number, k: "weight" | "reps", v: string) =>
    setEntries(p => p.map((e, idx) => { if (idx !== ei) return e; const s = [...e.sets]; s[si] = { ...s[si], [k]: v }; return { ...e, sets: s }; }));

  const save = async () => {
    const valid = entries.filter(e => e.exercise.trim() && e.sets.some(s => s.reps || s.weight));
    if (!valid.length) return;
    setSaving(true);

    let pbName: string | null = null;
    for (const entry of valid) {
      const cur = pbMap.get(entry.exercise.trim()) ?? 0;
      if (cur > 0 && entry.sets.some(s => calcOneRM(Number(s.weight), Number(s.reps)) > cur)) {
        pbName = entry.exercise.trim(); break;
      }
    }

    const rows = valid.map(e => ({
      member_id: memberId, log_date: date,
      exercise_name: e.exercise.trim(),
      reps: Math.round(e.sets.reduce((a, s) => a + Number(s.reps || 0), 0) / e.sets.length) || null,
      sets: e.sets.filter(s => s.reps || s.weight).length,
      workout_memo: workoutMemo.trim() || null,
      memo: workoutMemo.trim()
        ? `${workoutMemo.trim()} · RPE ${rpe} · 컨디션 ${condition}`
        : `RPE ${rpe} · 컨디션 ${condition}`,
      condition_score: condition,
    }));

    const { error } = await supabase.from("personal_logs").insert(rows);
    setSaving(false);
    if (!error) { if (pbName) onPB(pbName); onSaved(); }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl p-5"
      style={{ background: "var(--pt-2)", border: "1px solid var(--pt-5)" }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: "var(--volt)" }} />
        <span className="font-cond font-bold text-ink-0 text-sm leading-none">새 운동 기록</span>
        <div className="flex-1" />
        <button onClick={onCancel} className="tap-haptic w-8 h-8 rounded-full bg-pt-3 flex items-center justify-center text-ink-3">
          <X size={14} />
        </button>
      </div>

      {/* 날짜 */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">날짜</p>
        <div className="rounded-xl flex items-center px-4" style={{ background: "var(--pt-3)", border: "1px solid var(--pt-5)", height: 52 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 bg-transparent font-cond font-bold text-ink-0 text-sm leading-none outline-none" />
        </div>
      </div>

      {/* 운동 종목 */}
      <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">운동 종목</p>

      {entries.map((entry, ei) => (
        <ExerciseBlock key={ei} index={ei} entry={entry} pbMap={pbMap}
          onToggle={() => toggleOpen(ei)}
          onNameChange={v => updateName(ei, v)}
          onSetUpdate={(si, k, v) => updateSet(ei, si, k, v)}
          onAddSet={() => addSet(ei)}
          onCopyLast={() => copyLast(ei)}
          onRemoveSet={si => removeSet(ei, si)}
          onRemove={entries.length > 1 ? () => removeEntry(ei) : undefined}
        />
      ))}

      {/* 새 종목 추가 */}
      <button onClick={addExercise}
        className="tap-haptic w-full rounded-xl flex items-center justify-center gap-2 font-cond font-bold text-sm text-ink-1"
        style={{ height: 48, background: "var(--pt-3)", border: "1px dashed var(--pt-6)" }}>
        <Plus size={14} strokeWidth={3} />+ 새 운동 종목 추가
      </button>

      {/* 운동 강도 RPE */}
      <ScoreRow label="운동 강도 (RPE)" value={rpe} onChange={setRpe} dict={RPE_DESC} />

      {/* 컨디션 */}
      <ScoreRow label="컨디션" value={condition} onChange={setCondition} dict={COND_DESC} />

      {/* 메모 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">메모</p>
          <span className="text-[9px] font-cond text-ink-4 leading-none">선택</span>
        </div>
        <textarea value={workoutMemo} onChange={e => setWorkoutMemo(e.target.value)}
          placeholder="컨디션, 강도, 특이사항 등..."
          className="pt-input rounded-xl resize-none" rows={3}
          style={{ lineHeight: 1.6, paddingTop: 14, paddingBottom: 14 }} />
      </div>

      {/* 저장 / 취소 */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={save} disabled={saving}
          className="tap-haptic rounded-2xl flex items-center justify-center gap-2 font-display tracking-wider"
          style={{ height: 56, fontSize: 16, background: "var(--grad-volt)", color: "#000", boxShadow: "0 4px 20px var(--volt-glow-2)" }}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
          {saving ? "저장 중..." : "저장"}
        </button>
        <button onClick={onCancel} className="tap-haptic rounded-2xl font-cond font-bold text-ink-1"
          style={{ height: 56, background: "var(--pt-3)", border: "1px solid var(--pt-5)", fontSize: 15 }}>
          취소
        </button>
      </div>
    </div>
  );
}

/* ─── 종목 블록 ─── */
function ExerciseBlock({ index, entry, pbMap, onToggle, onNameChange, onSetUpdate, onAddSet, onCopyLast, onRemoveSet, onRemove }: {
  index: number; entry: ExEntry; pbMap: Map<string, number>;
  onToggle: () => void; onNameChange: (v: string) => void;
  onSetUpdate: (si: number, k: "weight" | "reps", v: string) => void;
  onAddSet: () => void; onCopyLast: () => void;
  onRemoveSet: (si: number) => void; onRemove?: () => void;
}) {
  const currentPb = entry.exercise.trim() ? pbMap.get(entry.exercise.trim()) ?? 0 : 0;

  /* 접힌 상태 요약 "60×10, 70×8, 70×8" */
  const summary = entry.sets
    .filter(s => s.weight || s.reps)
    .map(s => `${s.weight || "—"}×${s.reps || "—"}`)
    .join(", ");

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--pt-3)", border: "1px solid var(--pt-5)" }}>
      {/* 종목 헤더 행 */}
      <div className="flex items-center gap-2 px-3 py-3">
        {/* 번호 배지 */}
        <span className="w-8 h-8 rounded-xl flex items-center justify-center font-display text-sm leading-none shrink-0"
          style={{ background: "var(--grad-volt)", color: "#000" }}>
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* 종목명 입력 */}
        <input type="text" list="all-ex" value={entry.exercise}
          onChange={e => onNameChange(e.target.value)} placeholder="종목명"
          className="flex-1 bg-transparent font-cond font-bold text-ink-0 text-sm leading-none outline-none placeholder:text-ink-4" />
        <datalist id="all-ex">{ALL_EXERCISES.map(e => <option key={e} value={e} />)}</datalist>

        {/* 접힌 상태 요약 */}
        {!entry.isOpen && summary && (
          <span className="text-[9px] font-cond text-ink-3 leading-none truncate max-w-[130px] shrink-0">{summary}</span>
        )}

        {/* 펼치기/접기 */}
        <button onClick={onToggle} className="tap-haptic w-7 h-7 flex items-center justify-center text-ink-2 shrink-0">
          {entry.isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {/* 종목 삭제 */}
        {onRemove && (
          <button onClick={onRemove}
            className="tap-haptic w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,59,59,0.15)", color: "var(--danger)" }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* 펼친 상태 — 세트 입력 */}
      {entry.isOpen && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {/* 컬럼 헤더 */}
          <div className="grid text-[9px] font-cond text-ink-3 uppercase tracking-wider leading-none"
            style={{ gridTemplateColumns: "36px 1fr 1fr 36px" }}>
            <span className="text-center">SET</span>
            <span className="text-center">WEIGHT</span>
            <span className="text-center">REPS</span>
            <span />
          </div>

          {/* 세트 행 */}
          {entry.sets.map((set, si) => {
            const isPb = currentPb > 0 && calcOneRM(Number(set.weight), Number(set.reps)) > currentPb;
            return (
              <div key={si} className="grid items-center gap-2"
                style={{ gridTemplateColumns: "36px 1fr 1fr 36px" }}>
                {/* SET 번호 */}
                <span className="font-display text-sm leading-none text-center"
                  style={{ color: isPb ? "var(--volt)" : "var(--ink-3)" }}>
                  {si + 1}
                </span>

                {/* WEIGHT 입력 */}
                <div
                  className="flex items-center rounded-xl overflow-hidden"
                  style={{
                    background: "var(--pt-2)",
                    border: `1px solid ${isPb ? "var(--volt)" : "var(--pt-5)"}`,
                    height: 50,
                  }}
                >
                  <input
                    type="number"
                    value={set.weight}
                    placeholder="0"
                    onChange={e => onSetUpdate(si, "weight", e.target.value)}
                    className="flex-1 min-w-0 bg-transparent font-display text-ink-0 text-right outline-none pr-1"
                    style={{ fontSize: 22, paddingLeft: 8 }}
                  />
                  <span
                    className="font-cond font-bold text-ink-3 shrink-0 leading-none"
                    style={{ fontSize: 10, paddingRight: 8, paddingLeft: 4 }}
                  >
                    KG
                  </span>
                </div>

                {/* REPS 입력 */}
                <div
                  className="flex items-center rounded-xl overflow-hidden"
                  style={{
                    background: "var(--pt-2)",
                    border: `1px solid ${isPb ? "var(--volt)" : "var(--pt-5)"}`,
                    height: 50,
                  }}
                >
                  <input
                    type="number"
                    value={set.reps}
                    placeholder="0"
                    onChange={e => onSetUpdate(si, "reps", e.target.value)}
                    className="flex-1 min-w-0 bg-transparent font-display text-ink-0 text-right outline-none pr-1"
                    style={{ fontSize: 22, paddingLeft: 8 }}
                  />
                  <span
                    className="font-cond font-bold text-ink-3 shrink-0 leading-none"
                    style={{ fontSize: 10, paddingRight: 8, paddingLeft: 4 }}
                  >
                    REPS
                  </span>
                </div>

                {/* 세트 삭제 */}
                <button onClick={() => onRemoveSet(si)} disabled={entry.sets.length === 1}
                  className="tap-haptic w-7 h-7 rounded-lg flex items-center justify-center mx-auto disabled:opacity-20"
                  style={{ background: "rgba(255,59,59,0.12)", color: "var(--danger)" }}>
                  <X size={12} />
                </button>
              </div>
            );
          })}

          {/* 세트 추가 / 복사 */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button onClick={onAddSet}
              className="tap-haptic py-3 rounded-xl flex items-center justify-center gap-1.5 font-cond font-bold text-xs"
              style={{ background: "var(--pt-4)", border: "1px solid var(--pt-5)", color: "var(--ink-0)" }}>
              <Plus size={12} strokeWidth={3} />+ 세트 추가
            </button>
            <button onClick={onCopyLast}
              className="tap-haptic py-3 rounded-xl flex items-center justify-center gap-1.5 font-cond font-bold text-xs text-volt"
              style={{ background: "rgba(211,255,82,0.08)", border: "1px solid var(--volt-glow-2)" }}>
              <Copy size={12} strokeWidth={2.5} />이전 세트 복사
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 점수 선택 행 (RPE / 컨디션 공용) ─── */
function ScoreRow({ label, value, onChange, dict }: {
  label: string; value: number; onChange: (v: number) => void;
  dict: Record<number, { label: string; desc: string }>;
}) {
  const info = dict[value];
  return (
    <div className="flex flex-col gap-2.5">
      {/* 레이블 + 현재 점수 */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-cond text-ink-2 uppercase tracking-wider leading-none">{label}</p>
        <span className="font-display tabular-nums leading-none" style={{ fontSize: 15, color: "var(--volt)" }}>
          {value}<span className="text-ink-3 text-xs">/10</span>
        </span>
      </div>

      {/* 1~10 버튼 그리드 */}
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => onChange(n)}
            className="tap-haptic rounded-lg font-display text-sm leading-none transition-all"
            style={{
              height: 38,
              background: value === n ? "var(--grad-volt)" : "var(--pt-3)",
              color: value === n ? "#000" : "var(--ink-3)",
              border: value === n ? "none" : "1px solid var(--pt-5)",
              boxShadow: value === n ? "0 0 10px var(--volt-glow-2)" : "none",
            }}>
            {n}
          </button>
        ))}
      </div>

      {/* 설명 박스 */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: "rgba(211,255,82,0.06)", border: "1px solid var(--volt-glow-2)" }}>
        <span className="px-2.5 py-1.5 rounded-lg font-cond font-bold text-[10px] leading-none shrink-0"
          style={{ background: "var(--grad-volt)", color: "#000" }}>
          {info.label}
        </span>
        <p className="text-xs text-ink-1 leading-none">
          <span className="font-bold text-volt">{value}점</span>
          {" · "}{info.desc}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   히스토리 카드
   ════════════════════════════════════════════════════════════════ */
interface HItem {
  id: string; type: "pt" | "personal"; date: string;
  title: string; subtitle: string; totalSets: number;
  exercises: { name: string; sets: number; reps: number; weight?: number | null }[];
  feedback?: string | null; rpe?: number | null; condScore?: number | null;
}

function HistoryCard({ item }: { item: HItem }) {
  const [open, setOpen] = useState(false);
  const isPT = item.type === "pt";
  const d = new Date(item.date);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--pt-2)",
        border: open
          ? `1px solid ${isPT ? "var(--volt-glow-2)" : "rgba(91,168,255,0.3)"}`
          : "1px solid var(--pt-5)",
      }}>
      <button onClick={() => setOpen(v => !v)} className="tap-haptic w-full flex items-center gap-3 p-4 text-left">
        {/* 날짜 */}
        <div className="flex flex-col gap-1 shrink-0" style={{ minWidth: 44 }}>
          <p className="font-display text-ink-0 leading-none tabular-nums" style={{ fontSize: 18 }}>
            {item.date.slice(5, 7)}.{item.date.slice(8, 10)}
          </p>
          <p className="text-[10px] font-cond text-ink-3 leading-none">{DAYS[d.getDay()]}요일</p>
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* 태그 */}
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-cond font-bold text-[9px] leading-none w-fit"
            style={isPT
              ? { background: "rgba(211,255,82,0.15)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }
              : { background: "rgba(91,168,255,0.12)", color: "#5BA8FF", border: "1px solid rgba(91,168,255,0.3)" }}>
            {isPT ? "PT 수업" : "개인 운동"}
          </span>
          {/* 제목 */}
          <p className="font-cond font-bold text-ink-0 text-sm leading-tight truncate">{item.title}</p>
          {/* 서브타이틀 */}
          <p className="text-[10px] font-cond text-ink-3 leading-none">{item.subtitle}</p>
        </div>

        {/* SET 배지 */}
        <div className="flex flex-col items-center justify-center shrink-0 rounded-xl"
          style={{
            width: 48, height: 48,
            background: isPT ? "rgba(211,255,82,0.15)" : "var(--pt-3)",
            border: isPT ? "1px solid var(--volt-glow-2)" : "1px solid var(--pt-5)",
          }}>
          <span className="font-display tabular-nums leading-none"
            style={{ fontSize: 20, color: isPT ? "var(--volt)" : "var(--ink-0)" }}>
            {item.totalSets}
          </span>
          <span className="text-[8px] font-cond leading-none mt-0.5"
            style={{ color: isPT ? "var(--volt)" : "var(--ink-3)" }}>
            SET
          </span>
        </div>

        <ChevronDown size={14} className="text-ink-3 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {/* 아코디언 */}
      {open && (
        <div className="px-4 pb-4 border-t border-pt-5 pt-3 flex flex-col gap-2">
          {item.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-pt-5 last:border-0">
              <span className="font-cond font-bold text-ink-0 text-sm">{ex.name}</span>
              <div className="flex items-center gap-2 text-xs font-cond text-ink-2 shrink-0">
                <span>{ex.sets}세트 × {ex.reps}회</span>
                {ex.weight && (
                  <span className="px-2 py-1 rounded-full font-bold text-[10px] leading-none"
                    style={{ background: "rgba(211,255,82,0.12)", color: "var(--volt)" }}>
                    @{ex.weight}kg
                  </span>
                )}
              </div>
            </div>
          ))}
          {(item.rpe || item.condScore) && (
            <div className="flex gap-4 mt-1">
              {item.rpe && <span className="text-[10px] font-cond text-ink-3">RPE <b className="text-volt">{item.rpe}</b></span>}
              {item.condScore && <span className="text-[10px] font-cond text-ink-3">컨디션 <b style={{ color: "#5BA8FF" }}>{item.condScore}</b></span>}
            </div>
          )}
          {item.feedback && (
            <div className="mt-1 rounded-xl p-3" style={{ background: "rgba(211,255,82,0.06)", border: "1px solid var(--volt-glow-2)" }}>
              <p className="text-[9px] text-volt font-cond font-bold uppercase tracking-wider mb-1.5 leading-none">트레이너 피드백</p>
              <p className="text-xs text-ink-1 leading-relaxed">{item.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   플로팅 타이머 (우측 상단 고정)
   ════════════════════════════════════════════════════════════════ */
const PRESETS = [60, 90, 120, 180];

function FloatingTimer() {
  const [target,    setTarget]    = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running,   setRunning]   = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) { if (ref.current) clearInterval(ref.current); return; }
    ref.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { setRunning(false); navigator.vibrate?.([200, 100, 200]); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");
  const pct = target > 0 ? (remaining / target) * 100 : 0;
  const isDone = remaining === 0;
  const isLow  = remaining > 0 && remaining <= 10;
  const tColor = isDone ? "var(--volt)" : isLow ? "#ff8c00" : "var(--ink-0)";

  return (
    <div className="fixed top-20 right-4 z-30">
      <button onClick={() => setExpanded(v => !v)} className="tap-haptic relative"
        style={{ width: 64, height: 64, background: "rgba(14,14,14,0.92)", backdropFilter: "blur(16px)",
          border: `2px solid ${running ? "var(--volt)" : "var(--pt-5)"}`, borderRadius: "50%",
          boxShadow: running ? "0 0 16px var(--volt-glow-2)" : "0 2px 12px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1 }}>
        <svg style={{ position: "absolute", inset: -2, width: 68, height: 68, transform: "rotate(-90deg)" }} viewBox="0 0 68 68">
          <circle cx="34" cy="34" r="30" fill="none" stroke="var(--pt-4)" strokeWidth="3" />
          <circle cx="34" cy="34" r="30" fill="none" stroke={tColor} strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 30}`}
            strokeDashoffset={`${2 * Math.PI * 30 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <span className="font-display tabular-nums leading-none" style={{ fontSize: 14, color: tColor, position: "relative", zIndex: 1 }}>{mm}:{ss}</span>
        {running
          ? <Pause size={10} style={{ color: tColor, position: "relative", zIndex: 1 }} />
          : <Play  size={10} style={{ color: tColor, position: "relative", zIndex: 1 }} />}
      </button>

      {expanded && (
        <div className="absolute top-16 right-0 w-52 flex flex-col gap-3 p-4 anim-fade-slide"
          style={{ background: "rgba(12,12,12,0.96)", backdropFilter: "blur(20px)",
            border: "1px solid var(--volt-glow-2)", borderRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-cond text-volt tracking-wider uppercase leading-none">휴식 타이머</p>
            <button onClick={() => setExpanded(false)} className="text-ink-3"><X size={12} /></button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map(sec => (
              <button key={sec} onClick={() => { setTarget(sec); setRemaining(sec); setRunning(false); }}
                className="tap-haptic py-2 rounded-lg font-cond font-bold text-[10px] leading-none transition-all"
                style={target === sec
                  ? { background: "var(--volt)", color: "#000" }
                  : { background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
                {sec < 60 ? `${sec}s` : `${sec / 60}m`}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { if (isDone) { setRemaining(target); setRunning(true); } else setRunning(r => !r); }}
              className="tap-haptic flex-1 rounded-xl flex items-center justify-center gap-1.5 font-cond font-bold text-xs"
              style={{ minHeight: 36, background: running ? "var(--pt-4)" : "var(--grad-volt)", color: running ? "var(--ink-0)" : "#000", border: running ? "1px solid var(--pt-6)" : "none" }}>
              {running ? <><Pause size={12} />일시정지</> : <><Play size={12} />{isDone ? "재시작" : "시작"}</>}
            </button>
            <button onClick={() => { setRunning(false); setRemaining(target); }}
              className="tap-haptic w-9 h-9 rounded-xl bg-pt-3 border border-pt-5 flex items-center justify-center text-ink-2">
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

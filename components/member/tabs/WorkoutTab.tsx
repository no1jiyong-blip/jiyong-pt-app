"use client";

import { useState, useMemo } from "react";
import {
  Plus, X, Copy, Trophy, Loader2, Dumbbell, Minus,
  ChevronDown, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ALL_EXERCISES, type PersonalLog, type Session,
  type ExerciseRecord, type Member, calcOneRM,
} from "@/lib/types";
import { getTodayISO } from "@/lib/utils";
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
  const [confettiKey,  setConfettiKey]  = useState(0);
  const [pbExercise,   setPbExercise]   = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [histFilter,   setHistFilter]   = useState<HistoryFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

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
        subtitle: [s.session_number ? `${s.session_number}회차` : null, s.time || null]
          .filter(Boolean)
          .join("  ·  "),
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
    <div className="anim-tab-slide flex flex-col gap-6 px-5 pt-2 pb-36">
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

      {/* ─── 개인 운동 일지 ─── */}
      <section className="flex flex-col gap-3">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-cond font-bold text-ink-0" style={{ fontSize: 15 }}>
            개인 운동 일지
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-cond font-bold leading-none tabular-nums"
            style={{ background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
            {personalLogs.length}건 기록됨
          </span>
        </div>

        {/* 토스 스타일 단계별 간편 기록 카드 */}
        <QuickLogCard
          member={member}
          personalLogs={personalLogs}
          onUpdate={onUpdate}
          onOpenDetail={() => setShowForm(true)}
        />

        {showForm && (
          <PersonalWorkoutModal
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
        <div className="flex items-center justify-between gap-3">
          <span className="font-cond font-bold text-ink-0" style={{ fontSize: 15 }}>
            운동 히스토리
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-cond font-bold leading-none tabular-nums"
            style={{ background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
            {history.length}건 완료
          </span>
        </div>

        {/* 타입 필터 */}
        <div className="grid grid-cols-3 gap-1 p-1.5 rounded-2xl" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid var(--pt-5)" }}>
          {([
            ["all",      "전체보기"],
            ["pt",       "PT 수업"],
            ["personal", "개인 운동"],
          ] as [HistoryFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setHistFilter(key)}
              className="tap-haptic py-2.5 rounded-xl font-cond font-bold text-xs tracking-wide leading-none transition-all flex items-center justify-center"
              style={histFilter === key
                ? { background: "var(--pt-5)", color: key === "pt" ? "var(--volt)" : "var(--ink-0)" }
                : { color: "var(--ink-3)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* 기간 필터 */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--pt-5)" }}>
          {([["all","전체"],["week","이번 주"],["month","이번 달"]] as [PeriodFilter,string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPeriodFilter(key)}
              className="tap-haptic py-1.5 rounded-lg font-cond font-semibold leading-none transition-all"
              style={{
                fontSize: 11,
                background: periodFilter === key ? "var(--pt-5)" : "transparent",
                color: periodFilter === key ? "var(--ink-0)" : "var(--ink-3)",
                fontWeight: periodFilter === key ? 700 : 500,
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* 카드 목록 */}
        {history.length === 0
          ? <div className="pt-card text-center py-8"><p className="text-ink-3 font-cond text-sm">운동 기록이 없습니다</p></div>
          : <div className="flex flex-col gap-2">{history.map(item => <HistoryCard key={item.id} item={item} />)}</div>}
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   간편 기록 카드 — 토스 스타일 단계별(Step-by-step) 대화형 입력
   Step1 출석 → Step2 운동 종류·부위(중복 선택) → Step3 운동 시간 → 완료
   ════════════════════════════════════════════════════════════════ */
type QuickStep = "attend" | "category" | "duration" | "done";

const QUICK_CATEGORIES = [
  { key: "lower", label: "하체운동" },
  { key: "upper", label: "상체운동" },
  { key: "combo", label: "상&하체 복합" },
  { key: "core", label: "코어운동" },
  { key: "cardio", label: "유산소운동" },
] as const;
type QuickCategoryKey = (typeof QUICK_CATEGORIES)[number]["key"];

const LOWER_PARTS = ["엉덩이", "뒷허벅지", "앞허벅지"];
const UPPER_PARTS = ["어깨", "등", "가슴", "팔"];
const QUICK_DURATIONS = ["20분", "30분", "40분", "50분", "60분", "90분 이상"];

function buildQuickSummary(categories: QuickCategoryKey[], lowerParts: string[], upperParts: string[]) {
  return categories
    .map((key) => {
      const cat = QUICK_CATEGORIES.find((c) => c.key === key)!;
      if (key === "lower" && lowerParts.length > 0) return `${cat.label}(${lowerParts.join("·")})`;
      if (key === "upper" && upperParts.length > 0) return `${cat.label}(${upperParts.join("·")})`;
      return cat.label;
    })
    .join(" + ");
}

function QuickChip({
  label, active, onClick, mono = false,
}: {
  label: string; active: boolean; onClick: () => void; mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap-haptic px-3.5 py-2.5 rounded-xl text-sm font-cond font-bold transition-all ${mono ? "tabular-nums" : ""}`}
      style={
        active
          ? { background: "rgba(211,255,82,0.12)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }
          : { background: "var(--pt-3)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }
      }
    >
      {label}
    </button>
  );
}

function QuickLogCard({
  member, personalLogs, onUpdate, onOpenDetail,
}: {
  member: Member;
  personalLogs: PersonalLog[];
  onUpdate: () => void;
  onOpenDetail: () => void;
}) {
  const today = getTodayISO();
  const todayLog = useMemo(
    () => personalLogs.find((l) => l.log_date === today) ?? null,
    [personalLogs, today]
  );

  const [step, setStep] = useState<QuickStep>(todayLog ? "done" : "attend");
  const [logId, setLogId] = useState<string | null>(todayLog?.id ?? null);
  const [categories, setCategories] = useState<QuickCategoryKey[]>([]);
  const [lowerParts, setLowerParts] = useState<string[]>([]);
  const [upperParts, setUpperParts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(
    todayLog
      ? `${todayLog.workout_memo || todayLog.exercise_name}${todayLog.memo ? ` · ${todayLog.memo}` : ""}`
      : null
  );

  const toggleCategory = (key: QuickCategoryKey) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const toggleLowerPart = (part: string) =>
    setLowerParts((prev) => (prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]));
  const toggleUpperPart = (part: string) =>
    setUpperParts((prev) => (prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]));

  /* Step 1 — 출석만으로 즉시 저장 (히스토리·출석 캘린더 반영) */
  const handleAttend = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("personal_logs")
      .insert({ member_id: member.id, log_date: today, exercise_name: "출석", workout_memo: "출석" })
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      setLogId(data.id);
      setStep("category");
      onUpdate();
    }
  };

  /* Step 3 — 운동 시간 선택 즉시 Step1 로그를 종류·부위·시간으로 업데이트 */
  const handleDuration = async (duration: string) => {
    if (!logId) return;
    setSaving(true);
    const finalSummary = buildQuickSummary(categories, lowerParts, upperParts);
    await supabase
      .from("personal_logs")
      .update({ exercise_name: finalSummary, workout_memo: finalSummary, memo: duration })
      .eq("id", logId);
    setSaving(false);
    setSummary(`${finalSummary} · ${duration}`);
    setStep("done");
    onUpdate();
  };

  if (step === "done") {
    return (
      <div className="pt-card flex flex-col gap-3" style={{ padding: 20 }}>
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(211,255,82,0.12)" }}
          >
            <Check size={14} className="text-volt" strokeWidth={3} />
          </span>
          <span className="text-sm font-cond font-bold text-ink-0">오늘 운동 기록 완료</span>
        </div>
        {summary && (
          <p className="text-sm font-cond font-semibold text-ink-1 leading-relaxed">{summary}</p>
        )}
        <button
          type="button"
          onClick={onOpenDetail}
          className="tap-haptic text-xs font-cond font-bold text-ink-3 text-left w-fit"
        >
          + 종목·무게 상세 기록하기
        </button>
      </div>
    );
  }

  return (
    <div className="pt-card flex flex-col gap-4" style={{ padding: 20 }}>
      {step === "attend" && (
        <>
          <p className="font-bold text-ink-0 leading-snug" style={{ fontSize: 17 }}>
            오늘 운동하러 오셨나요?
          </p>
          <button
            type="button"
            onClick={handleAttend}
            disabled={saving}
            className="w-full rounded-2xl flex items-center justify-center gap-2 font-cond font-bold text-sm transition-transform duration-150 active:scale-[0.98] bg-[#D3FF52]/15 border border-[#D3FF52]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            style={{ height: 52, color: "var(--volt)" }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            네, 출석할게요
          </button>
        </>
      )}

      {step === "category" && (
        <>
          <p className="font-bold text-ink-0 leading-snug" style={{ fontSize: 17 }}>
            어떤 운동을 하시나요?
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_CATEGORIES.map((cat) => (
              <QuickChip
                key={cat.key}
                label={cat.label}
                active={categories.includes(cat.key)}
                onClick={() => toggleCategory(cat.key)}
              />
            ))}
          </div>

          {categories.includes("lower") && (
            <div className="flex flex-col gap-2 anim-fade-slide">
              <span className="text-[11px] font-cond font-semibold text-ink-3">어느 부위인가요?</span>
              <div className="flex flex-wrap gap-2">
                {LOWER_PARTS.map((part) => (
                  <QuickChip
                    key={part}
                    label={part}
                    active={lowerParts.includes(part)}
                    onClick={() => toggleLowerPart(part)}
                  />
                ))}
              </div>
            </div>
          )}

          {categories.includes("upper") && (
            <div className="flex flex-col gap-2 anim-fade-slide">
              <span className="text-[11px] font-cond font-semibold text-ink-3">어느 부위인가요?</span>
              <div className="flex flex-wrap gap-2">
                {UPPER_PARTS.map((part) => (
                  <QuickChip
                    key={part}
                    label={part}
                    active={upperParts.includes(part)}
                    onClick={() => toggleUpperPart(part)}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("duration")}
            disabled={categories.length === 0}
            className="tap-haptic w-full rounded-2xl flex items-center justify-center font-cond font-bold text-sm mt-1"
            style={{
              height: 52,
              background: categories.length > 0 ? "var(--volt)" : "var(--pt-3)",
              color: categories.length > 0 ? "#000" : "var(--ink-4)",
            }}
          >
            다음
          </button>
        </>
      )}

      {step === "duration" && (
        <>
          <p className="font-bold text-ink-0 leading-snug" style={{ fontSize: 17 }}>
            운동 시간은 얼마나 되나요?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDuration(d)}
                disabled={saving}
                className="tap-haptic py-3 rounded-xl text-sm font-cond font-bold tabular-nums"
                style={{ background: "var(--pt-3)", color: "var(--ink-1)", border: "1px solid var(--pt-5)" }}
              >
                {d}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   개인 운동 입력 모달 (상세 기록 — 간편 기록 완료 후 보조 경로)
   ════════════════════════════════════════════════════════════════ */
const QUICK_EXERCISES = ["랫풀다운", "체스트프레스", "스쿼트", "데드리프트", "레그프레스", "숄더프레스"];

interface SetRow { weight: number; reps: number; }

function PersonalWorkoutModal({ memberId, pbMap, onSaved, onCancel, onPB }: {
  memberId: string; pbMap: Map<string, number>;
  onSaved: () => void; onCancel: () => void; onPB: (n: string) => void;
}) {
  const [date,         setDate]         = useState(getTodayISO());
  const [exerciseName, setExerciseName] = useState("");
  const [sets,         setSets]         = useState<SetRow[]>([{ weight: 20, reps: 12 }]);
  const [rpe,          setRpe]          = useState(7);
  const [condition,    setCondition]    = useState(7);
  const [workoutMemo,  setWorkoutMemo]  = useState("");
  const [saving,       setSaving]       = useState(false);

  const updateSet = (si: number, k: "weight" | "reps", delta: number, min: number) =>
    setSets(p => p.map((s, idx) => idx === si ? { ...s, [k]: Math.max(min, s[k] + delta) } : s));
  const addSet    = () => setSets(p => [...p, { weight: 20, reps: 12 }]);
  const copyLast  = () => setSets(p => [...p, { ...p[p.length - 1] }]);
  const removeSet = (si: number) => setSets(p => p.filter((_, idx) => idx !== si));

  const currentPb = exerciseName.trim() ? pbMap.get(exerciseName.trim()) ?? 0 : 0;

  const save = async () => {
    if (!exerciseName.trim() || sets.length === 0) return;
    setSaving(true);

    const isPb = currentPb > 0 && sets.some(s => calcOneRM(s.weight, s.reps) > currentPb);

    const { error } = await supabase.from("personal_logs").insert({
      member_id: memberId, log_date: date,
      exercise_name: exerciseName.trim(),
      reps: Math.round(sets.reduce((a, s) => a + s.reps, 0) / sets.length) || null,
      sets: sets.length,
      workout_memo: workoutMemo.trim() || null,
      memo: workoutMemo.trim()
        ? `${workoutMemo.trim()} · RPE ${rpe} · 컨디션 ${condition}`
        : `RPE ${rpe} · 컨디션 ${condition}`,
      condition_score: condition,
    });

    setSaving(false);
    if (!error) { if (isPb) onPB(exerciseName.trim()); onSaved(); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 flex flex-col gap-5 anim-fade-slide"
        style={{ background: "var(--pt-2)", border: "1px solid var(--pt-5)", maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--pt-5)" }}>
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-volt" />
            <h3 className="font-cond font-bold text-ink-0 text-base leading-none">개인 운동 기록</h3>
          </div>
          <button onClick={onCancel} className="tap-haptic w-8 h-8 rounded-full bg-pt-4 flex items-center justify-center text-ink-3">
            <X size={14} />
          </button>
        </div>

        {/* 날짜 */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-cond font-bold text-ink-3 uppercase tracking-wider">운동 날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="pt-input" />
        </div>

        {/* 운동 종목 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-cond font-bold text-ink-3 uppercase tracking-wider">운동 종목</label>
            <span className="text-[10px] font-cond text-volt">자주 하는 운동 탭</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {QUICK_EXERCISES.map(item => (
              <button key={item} onClick={() => setExerciseName(item)}
                className="tap-haptic px-3 py-1.5 rounded-xl text-xs font-cond font-bold shrink-0 transition-colors"
                style={exerciseName === item
                  ? { background: "var(--volt)", color: "#000" }
                  : { background: "var(--pt-3)", border: "1px solid var(--pt-5)", color: "var(--ink-2)" }}>
                {item}
              </button>
            ))}
          </div>
          <input type="text" list="all-ex" value={exerciseName}
            onChange={e => setExerciseName(e.target.value)} placeholder="직접 종목명을 입력하세요"
            className="pt-input" />
          <datalist id="all-ex">{ALL_EXERCISES.map(e => <option key={e} value={e} />)}</datalist>
        </div>

        {/* 세트 입력 */}
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--pt-1)", border: "1px solid var(--pt-5)" }}>
          {sets.map((set, si) => {
            const isPb = currentPb > 0 && calcOneRM(set.weight, set.reps) > currentPb;
            return (
              <div key={si} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span
                    className="font-cond font-bold text-[10px] px-2 py-0.5 rounded-md leading-none"
                    style={{
                      background: isPb ? "var(--grad-volt)" : "rgba(211,255,82,0.1)",
                      color: isPb ? "#000" : "var(--volt)",
                    }}
                  >
                    SET {si + 1}{isPb ? " · PB" : ""}
                  </span>
                  {sets.length > 1 && (
                    <button onClick={() => removeSet(si)} className="tap-haptic text-ink-3 hover:text-danger">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3" style={{ background: "var(--pt-3)", border: "1px solid var(--pt-5)" }}>
                    <span className="text-[9px] font-cond font-bold text-ink-3 block mb-1">무게 (WEIGHT)</span>
                    <div className="flex items-center justify-between">
                      <button onClick={() => updateSet(si, "weight", -5, 0)} className="tap-haptic w-7 h-7 rounded-lg bg-pt-4 flex items-center justify-center text-ink-2">
                        <Minus size={14} />
                      </button>
                      <span className="font-mono-num font-extrabold text-ink-0" style={{ fontSize: 17 }}>
                        {set.weight}<span className="text-xs font-normal text-ink-3"> kg</span>
                      </span>
                      <button onClick={() => updateSet(si, "weight", 5, 0)} className="tap-haptic w-7 h-7 rounded-lg bg-pt-4 flex items-center justify-center text-ink-2">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--pt-3)", border: "1px solid var(--pt-5)" }}>
                    <span className="text-[9px] font-cond font-bold text-ink-3 block mb-1">횟수 (REPS)</span>
                    <div className="flex items-center justify-between">
                      <button onClick={() => updateSet(si, "reps", -1, 1)} className="tap-haptic w-7 h-7 rounded-lg bg-pt-4 flex items-center justify-center text-ink-2">
                        <Minus size={14} />
                      </button>
                      <span className="font-mono-num font-extrabold text-ink-0" style={{ fontSize: 17 }}>
                        {set.reps}<span className="text-xs font-normal text-ink-3"> 회</span>
                      </span>
                      <button onClick={() => updateSet(si, "reps", 1, 1)} className="tap-haptic w-7 h-7 rounded-lg bg-pt-4 flex items-center justify-center text-ink-2">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={addSet}
              className="tap-haptic py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-cond font-bold text-xs"
              style={{ background: "var(--pt-4)", border: "1px solid var(--pt-5)", color: "var(--ink-0)" }}>
              <Plus size={12} strokeWidth={3} />세트 추가
            </button>
            <button onClick={copyLast}
              className="tap-haptic py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-cond font-bold text-xs text-volt"
              style={{ background: "rgba(211,255,82,0.08)", border: "1px solid var(--volt-glow-2)" }}>
              <Copy size={12} strokeWidth={2.5} />이전 세트 복사
            </button>
          </div>
        </div>

        {/* 운동 강도 RPE */}
        <ScoreRow label="운동 강도 (RPE)" value={rpe} onChange={setRpe} dict={RPE_DESC} />

        {/* 컨디션 */}
        <ScoreRow label="컨디션" value={condition} onChange={setCondition} dict={COND_DESC} />

        {/* 메모 */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-cond font-bold text-ink-3 uppercase tracking-wider">운동 메모 (선택)</label>
          <textarea value={workoutMemo} onChange={e => setWorkoutMemo(e.target.value)}
            placeholder="오늘의 컨디션, 특이사항, 자극 부위를 가볍게 적어보세요..."
            className="pt-input rounded-xl resize-none" rows={2}
            style={{ lineHeight: 1.6, paddingTop: 14, paddingBottom: 14 }} />
        </div>

        {/* 저장 / 취소 */}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="tap-haptic flex-1 rounded-2xl font-cond font-bold text-ink-1"
            style={{ height: 56, background: "var(--pt-4)", fontSize: 15 }}>
            취소
          </button>
          <button onClick={save} disabled={saving || !exerciseName.trim()}
            className="tap-haptic rounded-2xl flex items-center justify-center gap-2 font-display tracking-wider"
            style={{ flex: 2, height: 56, fontSize: 16, background: "var(--grad-volt)", color: "#000", boxShadow: "0 4px 20px var(--volt-glow-2)" }}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
            {saving ? "저장 중..." : "기록 완료"}
          </button>
        </div>
      </div>
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
    <div className="flex flex-col gap-2">
      {/* 레이블 + 현재 점수 */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-cond font-semibold text-ink-2">{label}</p>
        <span className="font-mono-num font-bold tabular-nums leading-none" style={{ fontSize: 13, color: "var(--volt)" }}>
          {value}<span className="text-ink-3 text-[11px]">/10</span>
        </span>
      </div>

      {/* 1~10 버튼 그리드 */}
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} onClick={() => onChange(n)}
            className="tap-haptic rounded-md font-mono-num text-xs tabular-nums transition-all"
            style={{
              height: 30,
              background: value === n ? "var(--volt)" : "var(--pt-3)",
              color: value === n ? "#000" : "var(--ink-3)",
            }}>
            {n}
          </button>
        ))}
      </div>

      {/* 설명 한 줄 */}
      <p className="text-[11px] text-ink-3 leading-relaxed">
        <span className="font-bold" style={{ color: "var(--volt)" }}>{info.label}</span>
        {" · "}{info.desc}
      </p>
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
    <div className="rounded-3xl overflow-hidden transition-all"
      style={{
        background: open ? "rgba(20,20,20,0.85)" : "rgba(20,20,20,0.6)",
        border: open ? "1px solid rgba(255,255,255,0.1)" : "1px solid var(--pt-5)",
      }}>
      <button onClick={() => setOpen(v => !v)} className="tap-haptic w-full flex items-center justify-between gap-3 p-5 text-left">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* 날짜 */}
          <div className="text-center shrink-0" style={{ width: 48 }}>
            <p className="font-cond font-bold tabular-nums text-ink-0 leading-none" style={{ fontSize: 17 }}>
              {item.date.slice(5, 7)}.{item.date.slice(8, 10)}
            </p>
            <p className="text-[10px] font-cond text-ink-3 leading-none mt-1">{DAYS[d.getDay()]}요일</p>
          </div>

          <div style={{ width: 1, height: 32, background: "var(--pt-5)" }} className="shrink-0" />

          {/* 내용 */}
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-cond font-bold text-[9px] leading-none tracking-wider w-fit"
                style={isPT
                  ? { background: "rgba(211,255,82,0.1)", color: "var(--volt)", border: "1px solid var(--volt-glow-2)" }
                  : { background: "rgba(255,255,255,0.05)", color: "var(--ink-2)", border: "1px solid var(--pt-5)" }}>
                {isPT ? "PT 수업" : "개인 운동"}
              </span>
              <span className="font-mono-num font-bold text-ink-3 leading-none" style={{ fontSize: 10 }}>
                {item.subtitle}
              </span>
            </div>
            <p className="font-bold text-ink-0 text-sm leading-tight truncate">{item.title}</p>
          </div>
        </div>

        {/* SET 배지 + 토글 */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex flex-col items-center justify-center rounded-xl px-3 py-1.5"
            style={{
              minWidth: 50,
              background: isPT ? "rgba(211,255,82,0.06)" : "var(--pt-4)",
              border: isPT ? "1px solid rgba(211,255,82,0.25)" : "1px solid var(--pt-5)",
            }}>
            <span className="font-mono-num font-extrabold leading-none"
              style={{ fontSize: 16, color: isPT ? "var(--volt)" : "var(--ink-0)" }}>
              {item.totalSets}
            </span>
            <span className="text-[9px] font-cond font-bold uppercase tracking-widest leading-none mt-0.5 text-ink-3">
              SET
            </span>
          </div>
          <ChevronDown size={16} className="text-ink-3 shrink-0 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </div>
      </button>

      {/* 아코디언 */}
      {open && (
        <div className="px-5 pb-5 pt-1 flex flex-col gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex flex-col gap-2 pt-3">
            {item.exercises.map((ex, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="font-bold text-ink-0 text-xs truncate">{ex.name}</span>
                <span className="font-mono-num text-ink-3 tabular-nums shrink-0" style={{ fontSize: 11 }}>
                  {ex.sets}세트 · {ex.reps}회{ex.weight ? ` · ${ex.weight}kg` : ""}
                </span>
              </div>
            ))}
          </div>
          {(item.rpe || item.condScore) && (
            <div className="flex gap-4 px-1">
              {item.rpe && <span className="text-[10px] font-cond text-ink-3">RPE <b className="text-volt">{item.rpe}</b></span>}
              {item.condScore && <span className="text-[10px] font-cond text-ink-3">컨디션 <b className="text-ink-0">{item.condScore}</b></span>}
            </div>
          )}
          {item.feedback && (
            <div className="rounded-xl p-3" style={{ background: "rgba(211,255,82,0.06)", border: "1px solid var(--volt-glow-2)" }}>
              <p className="text-[9px] text-volt font-cond font-bold uppercase tracking-wider mb-1.5 leading-none">트레이너 피드백</p>
              <p className="text-xs text-ink-1 leading-relaxed">{item.feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

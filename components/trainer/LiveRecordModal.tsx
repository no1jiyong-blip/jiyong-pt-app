"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, Shield, Scale } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ALL_EXERCISES, type Session, type ExerciseRecord, type SessionQuality } from "@/lib/types";
import { Input, Textarea } from "@/components/ui/input";

interface Props {
  session: Session;
  memberName: string;
  onClose: () => void;
  onSaved: () => void;
}

interface Row {
  exercise_name: string;
  weight: number;
  reps: number;
  sets: number;
}

export function LiveRecordModal({ session, memberName, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [trainerNote, setTrainerNote] = useState(session.trainer_note ?? "");
  const [feedback, setFeedback] = useState(session.feedback ?? "");
  const [videoUrl, setVideoUrl] = useState(session.video_url ?? "");
  const [title, setTitle] = useState(session.title ?? "");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /* 코어/밸런스 품질 점수 */
  const [coreScore, setCoreScore] = useState<number | null>(null);
  const [leftScore, setLeftScore] = useState<number | null>(null);
  const [rightScore, setRightScore] = useState<number | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [existingQualityId, setExistingQualityId] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  useEffect(() => {
    (async () => {
      const { data: recs } = await supabase
        .from("exercise_records")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      setRows(
        (recs ?? []).length > 0
          ? (recs as ExerciseRecord[]).map((r) => ({
              exercise_name: r.exercise_name,
              weight: r.weight ?? 0,
              reps: r.reps ?? 0,
              sets: r.sets ?? 0,
            }))
          : [{ exercise_name: "", weight: 0, reps: 0, sets: 0 }]
      );

      const { data: q } = await supabase
        .from("session_quality")
        .select("*")
        .eq("session_id", session.id)
        .maybeSingle();

      if (q) {
        const sq = q as SessionQuality;
        setCoreScore(sq.core_score);
        setLeftScore(sq.left_score);
        setRightScore(sq.right_score);
        setBalanceNote(sq.balance_note ?? "");
        setExistingQualityId(sq.id);
      }

      setLoading(false);
    })();
  }, [session.id]);

  const save = async () => {
    setSaving(true);

    // 세션 기본 정보
    await supabase.from("sessions").update({
      title: title.trim() || null,
      trainer_note: trainerNote.trim() || null,
      feedback: feedback.trim() || null,
      video_url: videoUrl.trim() || null,
    }).eq("id", session.id);

    // 운동 기록
    await supabase.from("exercise_records").delete().eq("session_id", session.id);
    const validRows = rows.filter((r) => r.exercise_name.trim());
    if (validRows.length > 0) {
      await supabase.from("exercise_records").insert(
        validRows.map((r) => ({
          session_id: session.id,
          exercise_name: r.exercise_name.trim(),
          weight: r.weight || null,
          reps: r.reps || null,
          sets: r.sets || null,
        }))
      );
    }

    // 코어/밸런스 품질 점수
    if (coreScore !== null || leftScore !== null || rightScore !== null) {
      const qualityData = {
        session_id: session.id,
        core_score: coreScore,
        left_score: leftScore,
        right_score: rightScore,
        balance_note: balanceNote.trim() || null,
      };
      if (existingQualityId) {
        await supabase.from("session_quality").update(qualityData).eq("id", existingQualityId);
      } else {
        await supabase.from("session_quality").insert(qualityData);
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-pt-3 anim-fade-slide flex flex-col gap-6 p-7 safe-pb"
        style={{ border: "1px solid var(--volt-glow-2)", borderRadius: "24px 24px 0 0" }}
      >
        {/* Drag handle */}
        <div className="md:hidden mx-auto rounded-full" style={{ width: 40, height: 4, backgroundColor: "var(--pt-5)" }} />

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-xs text-volt font-cond font-bold tracking-wider leading-none uppercase">실시간 운동 기록</p>
            <h3 className="font-display text-2xl text-ink-0 tracking-wider leading-none truncate">
              {memberName} · {session.date}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-pt-2 hover:bg-pt-4 flex items-center justify-center text-ink-2 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="animate-spin text-volt mx-auto" size={28} />
          </div>
        ) : (
          <>
            {/* 세션 제목 */}
            <Field label="세션 제목">
              <Input placeholder="예: 가슴 운동의 날" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            {/* 트레이너 메모 */}
            <Field label="트레이너 계획 / 메모" color="var(--info)">
              <Textarea
                placeholder="예: 스쿼트 3x8 @80kg, 데드리프트 3x5 @100kg"
                value={trainerNote}
                onChange={(e) => setTrainerNote(e.target.value)}
              />
            </Field>

            {/* 운동 기록 */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <FieldLabel label="운동 기록" />
                <button
                  onClick={() => setRows((p) => [...p, { exercise_name: "", weight: 0, reps: 0, sets: 0 }])}
                  className="flex items-center gap-1 text-xs font-cond font-bold text-volt bg-volt-glow px-3 py-1.5 rounded-full leading-none"
                >
                  <Plus size={12} strokeWidth={3} /> 추가
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {rows.map((r, i) => (
                  <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: "minmax(0,2fr) 1fr 1fr 1fr auto" }}>
                    <input
                      type="text"
                      list={`ex-${i}`}
                      value={r.exercise_name}
                      onChange={(e) => {
                        const n = [...rows]; n[i] = { ...n[i], exercise_name: e.target.value }; setRows(n);
                      }}
                      placeholder="종목명"
                      className="pt-input"
                      style={{ minHeight: 44, padding: "8px 12px", fontSize: 13 }}
                    />
                    <datalist id={`ex-${i}`}>
                      {ALL_EXERCISES.map((e) => <option key={e} value={e} />)}
                    </datalist>
                    {(["weight", "reps", "sets"] as const).map((key) => (
                      <input
                        key={key}
                        type="number"
                        value={r[key] || ""}
                        onChange={(e) => {
                          const n = [...rows]; n[i] = { ...n[i], [key]: Number(e.target.value) }; setRows(n);
                        }}
                        placeholder={key === "weight" ? "kg" : key === "reps" ? "회" : "세트"}
                        className="pt-input"
                        style={{ minHeight: 44, padding: 8, fontSize: 13, textAlign: "center" }}
                      />
                    ))}
                    <button
                      onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                      className="w-9 h-9 flex items-center justify-center text-ink-3 hover:text-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 코어 / 밸런스 품질 점수 ─── */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: "rgba(211,255,82,0.05)", border: "1px solid var(--volt-glow-2)" }}
            >
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-volt" />
                <p className="text-[10px] font-cond font-bold text-volt tracking-wide-2 uppercase leading-none">
                  코어 / 밸런스 품질 점수
                </p>
              </div>

              {/* 코어 점수 */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-cond text-ink-2 leading-none">
                    코어 안정성 (자세 유지 점수)
                  </p>
                  <p className="font-display text-volt leading-none" style={{ fontSize: 18 }}>
                    {coreScore ?? "—"} / 10
                  </p>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={coreScore ?? 5}
                  onChange={(e) => setCoreScore(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--volt)", height: 6 }}
                />
                <div className="flex justify-between text-[9px] font-cond text-ink-4 leading-none">
                  <span>1 (무너짐)</span>
                  <span>5 (보통)</span>
                  <span>10 (완벽)</span>
                </div>
              </div>

              {/* 좌우 밸런스 */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <Scale size={12} className="text-info" />
                  <p className="text-xs font-cond text-ink-2 leading-none">좌/우 밸런스 점수</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[9px] font-cond text-ink-3 leading-none">좌측</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={1} max={10} step={1}
                        value={leftScore ?? 5}
                        onChange={(e) => setLeftScore(Number(e.target.value))}
                        className="flex-1"
                        style={{ accentColor: "#5BA8FF", height: 6 }}
                      />
                      <span className="font-display text-info leading-none w-6 text-center" style={{ fontSize: 16 }}>
                        {leftScore ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[9px] font-cond text-ink-3 leading-none">우측</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={1} max={10} step={1}
                        value={rightScore ?? 5}
                        onChange={(e) => setRightScore(Number(e.target.value))}
                        className="flex-1"
                        style={{ accentColor: "#5BA8FF", height: 6 }}
                      />
                      <span className="font-display text-info leading-none w-6 text-center" style={{ fontSize: 16 }}>
                        {rightScore ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {leftScore !== null && rightScore !== null && leftScore !== rightScore && (
                  <p className="text-[10px] font-cond text-warn leading-relaxed">
                    ⚠ 좌우 편차 {Math.abs(leftScore - rightScore)}점 —
                    {leftScore > rightScore ? " 우측 " : " 좌측 "} 보강 필요
                  </p>
                )}
              </div>

              {/* 밸런스 코멘트 */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-cond text-ink-2 leading-none">코멘트 (이유/특이사항)</p>
                <Textarea
                  placeholder="예: 스쿼트 시 좌측 무릎 외반 주의. 고중량 시 코어 브레이싱 강조 필요."
                  value={balanceNote}
                  onChange={(e) => setBalanceNote(e.target.value)}
                  style={{ minHeight: 72 }}
                />
              </div>
            </div>

            {/* 피드백 */}
            <Field label="피드백 (회원에게 표시됨)" color="var(--volt)">
              <Textarea
                placeholder="이번 세션에 대한 피드백..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </Field>

            {/* 영상 URL */}
            <Field label="영상 URL (선택)">
              <Input type="url" placeholder="https://..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
            </Field>

            {/* 저장/취소 */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="btn-volt font-display tracking-wider"
                style={{ minHeight: 60, fontSize: 16 }}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
              <button onClick={onClose} className="btn-ghost" style={{ minHeight: 60 }}>
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldLabel({ label, color }: { label: string; color?: string }) {
  return (
    <p
      className="text-[10px] font-cond font-bold tracking-wider uppercase leading-none"
      style={{ color: color ?? "var(--ink-2)" }}
    >
      {label}
    </p>
  );
}

function Field({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <FieldLabel label={label} color={color} />
      {children}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ALL_EXERCISES, type PersonalLog } from "@/lib/types";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getTodayISO, formatShortKoreanDate } from "@/lib/utils";

interface Props {
  memberId: string;
  logs: PersonalLog[];
  onUpdate: () => void;
}

export function PersonalLogSection({ memberId, logs, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(getTodayISO());
  const [exercises, setExercises] = useState([
    { name: "", reps: 0, sets: 0 },
  ]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, PersonalLog[]>();
    [...logs]
      .sort((a, b) => b.log_date.localeCompare(a.log_date))
      .forEach((log) => {
        if (!map.has(log.log_date)) map.set(log.log_date, []);
        map.get(log.log_date)!.push(log);
      });
    return Array.from(map.entries());
  }, [logs]);

  const reset = () => {
    setExercises([{ name: "", reps: 0, sets: 0 }]);
    setMemo("");
    setDate(getTodayISO());
    setOpen(false);
  };

  const save = async () => {
    const valid = exercises.filter((e) => e.name.trim());
    if (valid.length === 0) return;
    setSaving(true);
    const rows = valid.map((e) => ({
      member_id: memberId,
      log_date: date,
      exercise_name: e.name.trim(),
      reps: e.reps || null,
      sets: e.sets || null,
      memo: memo.trim() || null,
    }));
    const { error } = await supabase.from("personal_logs").insert(rows);
    setSaving(false);
    if (!error) {
      reset();
      onUpdate();
    }
  };

  return (
    <section className="px-6 flex flex-col gap-5">
      <h2 className="section-title">
        <span className="section-bar"></span>
        개인 운동 일지
      </h2>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="rounded-2xl flex items-center justify-center gap-2 font-cond font-bold tracking-wider"
          style={{
            background: "var(--grad-volt)",
            color: "#000",
            height: 60,
            fontSize: 16,
            boxShadow:
              "0 8px 28px var(--volt-glow-2), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          <Plus size={20} strokeWidth={3} />새 운동 기록 추가
        </button>
      )}

      {open && (
        <div className="pt-card-hot flex flex-col gap-5 anim-fade-slide">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-ink-0 tracking-wider leading-none">
              새 운동 기록
            </h3>
            <button
              onClick={reset}
              className="w-10 h-10 rounded-full flex items-center justify-center text-ink-3 hover:text-ink-0 hover:bg-pt-3"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              날짜
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              운동 종목
            </label>
            {exercises.map((ex, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  list={`exlist-${i}`}
                  placeholder="종목명"
                  value={ex.name}
                  onChange={(e) => {
                    const next = [...exercises];
                    next[i] = { ...next[i], name: e.target.value };
                    setExercises(next);
                  }}
                  className="pt-input flex-1"
                  style={{ minHeight: 46, padding: "10px 14px" }}
                />
                <datalist id={`exlist-${i}`}>
                  {ALL_EXERCISES.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
                <input
                  type="number"
                  placeholder="회"
                  value={ex.reps || ""}
                  onChange={(e) => {
                    const next = [...exercises];
                    next[i] = { ...next[i], reps: Number(e.target.value) };
                    setExercises(next);
                  }}
                  className="pt-input"
                  style={{
                    width: 70,
                    textAlign: "center",
                    minHeight: 46,
                    padding: "10px 8px",
                  }}
                />
                <input
                  type="number"
                  placeholder="세트"
                  value={ex.sets || ""}
                  onChange={(e) => {
                    const next = [...exercises];
                    next[i] = { ...next[i], sets: Number(e.target.value) };
                    setExercises(next);
                  }}
                  className="pt-input"
                  style={{
                    width: 70,
                    textAlign: "center",
                    minHeight: 46,
                    padding: "10px 8px",
                  }}
                />
                {exercises.length > 1 && (
                  <button
                    onClick={() =>
                      setExercises((p) => p.filter((_, idx) => idx !== i))
                    }
                    className="text-ink-3 hover:text-danger w-9 h-9 flex items-center justify-center shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() =>
                setExercises((p) => [
                  ...p,
                  { name: "", reps: 0, sets: 0 },
                ])
              }
              className="text-volt text-sm font-cond font-bold self-start mt-1"
            >
              + 운동 추가
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
              메모
            </label>
            <Textarea
              placeholder="간단한 메모..."
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              style={{ minHeight: 80 }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
            <Button variant="ghost" onClick={reset}>
              취소
            </Button>
          </div>
        </div>
      )}

      {grouped.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          {grouped.map(([logDate, dayLogs]) => (
            <div key={logDate} className="pt-card flex flex-col gap-4">
              <p className="text-ink-2 font-cond text-sm leading-none">
                {formatShortKoreanDate(logDate)}
              </p>
              <div className="flex flex-col gap-2.5">
                {dayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-pt-2 rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <span className="font-cond font-bold text-ink-0 text-sm">
                      {log.exercise_name}
                    </span>
                    <span className="text-xs text-ink-2 font-cond shrink-0">
                      {log.reps ?? 0}회 × {log.sets ?? 0}세트
                    </span>
                  </div>
                ))}
                {dayLogs[0]?.memo && (
                  <p className="text-xs text-ink-3 mt-2 italic leading-relaxed">
                    {dayLogs[0].memo}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

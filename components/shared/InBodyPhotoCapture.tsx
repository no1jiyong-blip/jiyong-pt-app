"use client";

import { useRef, useState } from "react";
import { Camera, X, Loader2, AlertTriangle } from "lucide-react";
import { INBODY_FIELDS, validateInBodyValues, type InBodyValues } from "@/lib/inbody";
import { getTodayISO } from "@/lib/utils";

interface Props {
  /** 실제 저장 방식은 호출하는 화면이 결정 — 회원 화면은 /api/body-measurements, 트레이너 화면은 직접 insert */
  onSave: (values: InBodyValues) => Promise<{ error?: string } | void>;
  onSaved?: () => void;
  label?: string;
}

type Stage = "idle" | "analyzing" | "review" | "saving";

/** 이미지가 너무 크면 업로드/분석이 느려지므로 최대 1600px로 축소 후 JPEG 압축 */
function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) { reject(new Error("이미지를 처리할 수 없습니다")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob); else reject(new Error("이미지 변환에 실패했습니다"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 불러올 수 없습니다")); };
    img.src = url;
  });
}

export function InBodyPhotoCapture({ onSave, onSaved, label = "사진으로 기록하기" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [values, setValues] = useState<InBodyValues | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setStage("analyzing");
    try {
      const resized = await resizeImage(file);
      const form = new FormData();
      form.append("image", resized, "inbody.jpg");
      const res = await fetch("/api/parse-inbody", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인식에 실패했습니다");
      setValues({
        measured_at: data.measured_at ?? getTodayISO(),
        weight_kg: data.weight_kg ?? null,
        skeletal_muscle_kg: data.skeletal_muscle_kg ?? null,
        body_fat_kg: data.body_fat_kg ?? null,
        body_fat_pct: data.body_fat_pct ?? null,
        whr: data.whr ?? null,
        bmr_kcal: data.bmr_kcal ?? null,
      });
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("idle");
    }
  };

  const issues = values ? validateInBodyValues(values) : [];

  const handleSave = async () => {
    if (!values || issues.length > 0) return;
    setStage("saving");
    setError(null);
    const result = await onSave(values);
    if (result && "error" in result && result.error) {
      setError(result.error);
      setStage("review");
      return;
    }
    setStage("idle");
    setValues(null);
    onSaved?.();
  };

  const closeModal = () => {
    setStage("idle");
    setValues(null);
    setError(null);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={stage === "analyzing"}
        className="tap-haptic w-full flex items-center justify-center gap-2 rounded-2xl font-cond font-bold"
        style={{
          minHeight: 52,
          background: "var(--volt)",
          color: "#000",
          fontSize: 14,
          opacity: stage === "analyzing" ? 0.7 : 1,
        }}
      >
        {stage === "analyzing" ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            사진 분석 중...
          </>
        ) : (
          <>
            <Camera size={16} />
            {label}
          </>
        )}
      </button>

      {error && stage === "idle" && (
        <p className="text-xs font-cond mt-2" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {(stage === "review" || stage === "saving") && values && (
        <ReviewModal
          values={values}
          onChange={setValues}
          issues={issues}
          error={error}
          saving={stage === "saving"}
          onCancel={closeModal}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function ReviewModal({
  values, onChange, issues, error, saving, onCancel, onSave,
}: {
  values: InBodyValues;
  onChange: (v: InBodyValues) => void;
  issues: { field: string; message: string }[];
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const issueFields = new Set(issues.map((i) => i.field));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center px-0 md:px-6"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div
        className="w-full md:max-w-md max-h-[88vh] overflow-y-auto p-6 flex flex-col gap-5 safe-pb"
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px 24px 0 0",
        }}
      >
        <div
          className="md:hidden mx-auto rounded-full"
          style={{ width: 40, height: 4, backgroundColor: "var(--pt-5)" }}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-cond font-bold text-volt tracking-wide-2 leading-none uppercase">
              인바디 사진 인식 결과
            </p>
            <h3 className="font-cond font-bold text-ink-0" style={{ fontSize: 18 }}>
              내용을 확인하고 수정해 주세요
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="tap-haptic w-10 h-10 rounded-full bg-pt-2 hover:bg-pt-4 flex items-center justify-center text-ink-2 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">측정 날짜</label>
          <input
            type="date"
            value={values.measured_at ?? ""}
            onChange={(e) => onChange({ ...values, measured_at: e.target.value })}
            className="pt-input tabular-nums"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {INBODY_FIELDS.map(({ key, label, unit }) => {
            const hasIssue = issueFields.has(key);
            const v = values[key];
            return (
              <div key={key} className="flex flex-col gap-2">
                <label className="text-[10px] font-cond text-ink-3 uppercase tracking-wider leading-none">
                  {label}{unit && <span className="text-ink-4 ml-1">({unit})</span>}
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={v ?? ""}
                  onChange={(e) =>
                    onChange({ ...values, [key]: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="pt-input text-center tabular-nums"
                  style={{
                    fontSize: 17,
                    borderColor: hasIssue ? "var(--danger)" : undefined,
                  }}
                />
              </div>
            );
          })}
        </div>

        {issues.length > 0 && (
          <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: "rgba(255,59,59,0.08)", border: "1px solid rgba(255,59,59,0.3)" }}>
            {issues.map((i) => (
              <div key={i.field} className="flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" style={{ color: "var(--danger)" }} />
                <p className="text-xs font-cond leading-relaxed" style={{ color: "#ff8080" }}>{i.message}</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs font-cond" style={{ color: "var(--danger)" }}>{error}</p>
        )}

        <button
          onClick={onSave}
          disabled={saving || issues.length > 0}
          className="tap-haptic rounded-2xl flex items-center justify-center gap-2 font-cond font-bold"
          style={{
            minHeight: 52,
            fontSize: 15,
            background: issues.length > 0 ? "var(--pt-5)" : "var(--volt)",
            color: issues.length > 0 ? "var(--ink-3)" : "#000",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "저장 중..." : "저장하기"}
        </button>
      </div>
    </div>
  );
}

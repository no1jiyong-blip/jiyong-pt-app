"use client";

import { useState } from "react";
import { changePassword } from "@/lib/auth";
import { Input } from "@/components/ui/input";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    if (newPassword.trim().length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("비밀번호가 서로 일치하지 않습니다");
      return;
    }
    setSaving(true);
    setError("");
    const { error: err } = await changePassword(newPassword.trim());
    setSaving(false);
    if (err) {
      setError("변경 실패: " + err);
      return;
    }
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-md bg-pt-3 anim-fade-slide flex flex-col gap-5 p-7 safe-pb"
        style={{
          border: "1px solid var(--volt-glow-2)",
          borderRadius: "24px 24px 0 0",
        }}
      >
        <h3 className="font-display text-2xl text-ink-0 tracking-wider leading-none">
          비밀번호 변경
        </h3>

        {done ? (
          <>
            <p className="text-sm text-ink-1 font-cond leading-relaxed">
              비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.
            </p>
            <button onClick={onClose} className="btn-volt" style={{ minHeight: 56 }}>
              확인
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
                새 비밀번호
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-cond text-ink-2 leading-none tracking-wide-2 uppercase">
                새 비밀번호 확인
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
            </div>

            {error && (
              <div className="text-sm text-danger font-cond bg-danger-soft border border-danger px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="btn-volt"
                style={{ minHeight: 56 }}
              >
                {saving ? "변경 중..." : "변경"}
              </button>
              <button onClick={onClose} className="btn-ghost" style={{ minHeight: 56 }}>
                취소
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

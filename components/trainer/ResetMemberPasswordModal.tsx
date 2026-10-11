"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

export function ResetMemberPasswordModal({
  memberId,
  memberName,
  onClose,
}: {
  memberId: string;
  memberName: string;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async () => {
    if (newPassword.trim().length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다");
      return;
    }
    setSaving(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("세션이 만료되었습니다. 다시 로그인해주세요");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/auth/reset-member-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ memberId, newPassword: newPassword.trim() }),
    });
    const result = await res.json();

    setSaving(false);
    if (!res.ok) {
      setError(result.error ?? "비밀번호 재설정 실패");
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
          {memberName}님 비밀번호 재설정
        </h3>

        {done ? (
          <>
            <p className="text-sm text-ink-1 font-cond leading-relaxed">
              비밀번호가 변경되었습니다. 회원에게 새 비밀번호를 전달해주세요.
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
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                autoFocus
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

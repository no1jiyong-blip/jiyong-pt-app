"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { login, getCurrentUser } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/shared/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.replace(user.role === "trainer" ? "/trainer" : "/member");
    }
  }, [router]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    const user = await login(username.trim(), password.trim());
    setLoading(false);
    if (!user) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다");
      return;
    }
    router.replace(user.role === "trainer" ? "/trainer" : "/member");
  };

  return (
    <div className="min-h-screen bg-pt-0 px-6 py-14 safe-pt safe-pb">
      <div className="pt-container flex flex-col gap-12 max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-7 pt-8">
          <BrandLogo size={104} glow="strong" />
          <div className="flex flex-col items-center gap-3">
            <h1 className="font-display text-4xl tracking-wide-3 text-ink-0 leading-none">
              PT MEMBER
            </h1>
            <p className="text-ink-2 font-cond text-sm tracking-wider">
              개인 트레이닝 회원 관리 시스템
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="pt-card flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond font-bold text-ink-1 tracking-wide-2 uppercase">
              아이디
            </label>
            <Input
              type="text"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-cond font-bold text-ink-1 tracking-wide-2 uppercase">
              비밀번호
            </label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="current-password"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-1 p-1"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-danger font-cond bg-danger-soft border border-danger px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="btn-volt w-full"
            style={{ height: 60, fontSize: 17, fontWeight: 800 }}
          >
            <LogIn size={20} strokeWidth={2.5} />
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>

        {/* Test accounts */}
        <div className="pt-card">
          <p className="text-center text-xs font-cond font-bold text-ink-2 tracking-wide-2 uppercase mb-5">
            테스트 계정
          </p>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-ink-3 font-cond">회원</p>
              <p className="font-cond font-bold text-ink-0 text-sm leading-none">
                minsu / 1234
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-ink-3 font-cond">관리자</p>
              <p className="font-cond font-bold text-ink-0 text-sm leading-none">
                admin / admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

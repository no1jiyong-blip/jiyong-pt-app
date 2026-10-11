"use client";

import { useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { ChangePasswordModal } from "@/components/shared/ChangePasswordModal";

interface Props {
  greeting: string;
  name: string;
  rightInfo?: string;
}

export function PageHeader({ greeting, name, rightInfo }: Props) {
  const router = useRouter();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <header className="px-6 pt-10 pb-2 flex items-start justify-between gap-3 safe-pt">
      <div className="flex items-center gap-3 min-w-0">
        <BrandLogo size={44} glow="soft" />
        <div className="flex flex-col gap-2 min-w-0">
          <p className="font-display text-volt text-sm tracking-wide-2 leading-none">
            {greeting}
          </p>
          <h1 className="font-display text-3xl text-ink-0 tracking-wider leading-none truncate">
            {name}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 mt-1">
        {rightInfo && (
          <div
            className="px-3.5 py-2 rounded-full text-xs font-cond font-semibold text-ink-1 leading-none whitespace-nowrap"
            style={{
              background: "rgba(20,20,20,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {rightInfo}
          </div>
        )}
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-2 hover:text-ink-0 transition-colors"
          style={{ background: "rgba(20,20,20,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}
          aria-label="비밀번호 변경"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-2 hover:text-ink-0 transition-colors"
          style={{ background: "rgba(20,20,20,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}
          aria-label="로그아웃"
        >
          <LogOut size={16} />
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </header>
  );
}

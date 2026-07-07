"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";
import { BrandLogo } from "@/components/shared/BrandLogo";

interface Props {
  greeting: string;
  name: string;
  rightInfo?: string;
}

export function PageHeader({ greeting, name, rightInfo }: Props) {
  const router = useRouter();
  const handleLogout = () => {
    logout();
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
          <div className="px-4 py-2 rounded-full bg-pt-3 border border-pt-5 text-xs font-cond text-ink-2 leading-none whitespace-nowrap">
            {rightInfo}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-12 h-12 rounded-full flex items-center justify-center text-ink-2 hover:text-ink-0 hover:bg-pt-3 transition-colors"
          aria-label="로그아웃"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

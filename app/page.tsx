"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
    } else if (user.role === "trainer") {
      router.replace("/trainer");
    } else {
      router.replace("/member");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pt-0">
      <p className="font-display text-3xl tracking-wide-3 text-volt anim-pulse">
        LOADING...
      </p>
    </div>
  );
}

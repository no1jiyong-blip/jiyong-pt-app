import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service role 키를 쓰는 서버 전용 클라이언트. RLS를 우회하므로 절대
 * 클라이언트 컴포넌트나 브라우저로 전달되는 코드에서 import하면 안 됨
 * (route.ts 같은 서버 전용 파일에서만 사용).
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

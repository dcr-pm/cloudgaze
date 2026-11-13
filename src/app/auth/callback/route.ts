import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Landing point for magic links: turns the code in the URL into a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  // Only ever redirect within this site.
  const next = /^\/(?![\/\\])/.test(rawNext) && !rawNext.includes("\\") ? rawNext : "/";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) {
    const back = new URL("/login", origin);
    back.searchParams.set("error", "link");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back);
  }
  return NextResponse.redirect(new URL(next, origin));
}

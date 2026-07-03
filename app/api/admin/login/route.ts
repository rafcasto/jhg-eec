import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, makeToken } from "@/lib/adminAuth";
import { verifyUser } from "@/lib/adminUsers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const username = (body.username || "").trim();
  const password = body.password || "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 }
    );
  }

  if (!verifyUser(username, password)) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 }
    );
  }

  // Only mark the cookie Secure on real HTTPS. Marking it Secure while the
  // admin is served over plain http (a non-localhost host) makes the browser
  // silently drop the cookie, so the user "logs in" but is bounced back to the
  // login page. Detect the actual protocol (respecting a reverse proxy).
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "");
  const isHttps = proto === "https";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 12, // 12h session
  });
  return res;
}

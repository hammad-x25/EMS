import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";

const roleByPrefix = {
  "/admin": "ADMIN",
  "/examiner": "EXAMINER",
  "/candidate": "CANDIDATE",
} as const;

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const required = Object.entries(roleByPrefix).find(([prefix]) => request.nextUrl.pathname.startsWith(prefix))?.[1];
  if (!required) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (session.role !== required) {
    const destination = session.role === "ADMIN" ? "/admin" : session.role === "EXAMINER" ? "/examiner" : "/candidate";
    return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/examiner/:path*", "/candidate/:path*"],
};

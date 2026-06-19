import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy (ex-middleware, Next 16). Deux rôles :
 *
 * 1) Routage par hôte de la console. Si CONSOLE_HOST est défini, l'hôte dédié
 *    (ex. console.obsidio.fr) ne sert QUE la console : login + /admin + /api.
 *    Toute autre route y est redirigée vers /admin (pas de chat tenant sur la
 *    console). Le blocage de /admin sur les domaines tenants est assuré côté
 *    Node par le layout admin (404). On lit process.env directement (pas de DB
 *    en Edge ; cf. lib/tenant/resolve.ts pour la résolution tenant).
 *
 * 2) En-têtes de sécurité. L'app est NON-framable (anti-clickjacking), SAUF
 *    /embed et /widget.js (widget embarquable).
 */
function withSecurity(res: NextResponse, path: string): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const embeddable = path.startsWith("/embed") || path === "/widget.js";
  if (embeddable) {
    res.headers.set("Content-Security-Policy", "frame-ancestors *");
  } else {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }
  return res;
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const consoleHost = (process.env.CONSOLE_HOST ?? "")
    .split(":")[0]
    .toLowerCase();

  if (consoleHost && host === consoleHost) {
    const allowed =
      path.startsWith("/admin") ||
      path.startsWith("/api") ||
      path.startsWith("/login");
    if (!allowed) {
      return withSecurity(
        NextResponse.redirect(new URL("/admin", req.url)),
        path,
      );
    }
  }

  return withSecurity(NextResponse.next(), path);
}

export const config = {
  // S'applique à tout sauf les assets internes Next et fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

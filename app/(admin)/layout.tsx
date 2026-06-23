import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { ToastProvider } from "@/components/ui/Toast";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { CONSOLE_THEME, isConsoleHost } from "@/lib/console";
import { env } from "@/lib/env";

// Onglet de la console : titre dédié (override du branding tenant) + favicon
// propre (app/(admin)/icon.svg, badge indigo). Pages enfants → "<page> — Console".
export const metadata: Metadata = {
  title: { default: "Console — Ask", template: "%s — Console Ask" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1) Garde par hôte : si CONSOLE_HOST est défini, la console n'existe QUE là.
  //    Sur tout autre domaine (tenants), on masque son existence (404).
  if (env.CONSOLE_HOST && !(await isConsoleHost())) notFound();

  // 2) Garde par rôle. Sur l'hôte console, toute session invalide (non
  //    connectée OU identité périmée / mauvais type) → /login (sinon un vieux
  //    cookie piégerait l'utilisateur en 404). Hors hôte console (dev sans
  //    CONSOLE_HOST), un non-admin est masqué (404).
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED" || env.CONSOLE_HOST) {
      redirect("/login");
    }
    notFound();
  }

  return (
    <ToastProvider>
      <div
        className="flex min-h-screen flex-col bg-surface-2 text-ink md:flex-row"
        style={CONSOLE_THEME}
      >
        <AdminNav />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}

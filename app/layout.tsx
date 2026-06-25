import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { isConsoleHost } from "@/lib/console";
import { brandingColorVars, getBranding } from "@/lib/tenant/branding";
import { resolveProject } from "@/lib/tenant/resolve";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const project = await resolveProject();
  const { name, description, faviconUrl } = getBranding(project);
  const meta: Metadata = {
    title: name,
    description,
    applicationName: name,
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    other: {
      // Compatibilité iOS plus anciens (plein écran depuis l'écran d'accueil)
      "apple-mobile-web-app-capable": "yes",
    },
  };
  // Sur l'hôte console, on laisse la convention app/(admin)/icon.svg fournir le
  // favicon : poser des `icons` ici écraserait l'icône propre de la console par
  // celle du tenant par défaut.
  if (!(await isConsoleHost())) {
    meta.icons = {
      icon: faviconUrl,
      // Faute d'asset dédié, on réutilise le favicon du projet (sinon l'icône iOS par défaut).
      apple: project?.theme?.faviconUrl || "/apple-icon.png",
    };
  }
  return meta;
}

export async function generateViewport(): Promise<Viewport> {
  const project = await resolveProject();
  return { themeColor: project?.theme?.colors?.navy ?? "#141934" };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const project = await resolveProject();
  const branding = getBranding(project);
  const colorVars = brandingColorVars(project);

  return (
    <html
      lang="fr"
      className={`${cormorant.variable} h-full antialiased`}
      style={colorVars}
    >
      <body className="min-h-full">
        <BrandingProvider value={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}

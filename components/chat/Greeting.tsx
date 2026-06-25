"use client";

import Image from "next/image";
import { useBranding } from "@/components/branding/BrandingProvider";

export function Greeting() {
  const { greeting, logoUrl, name, heroLogoOnly } = useBranding();
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4 text-center">
      <div className="flex items-center justify-center gap-3">
        <Image
          src={logoUrl}
          alt={name}
          width={heroLogoOnly ? 220 : 120}
          height={heroLogoOnly ? 220 : 120}
          priority
          unoptimized
          className="max-w-[80vw] object-contain"
        />
        {!heroLogoOnly && (
          <h1 className="font-serif text-4xl font-semibold text-navy sm:text-5xl md:text-6xl">
            Bonjour&nbsp;!
          </h1>
        )}
      </div>
      <p className="text-[0.95rem] leading-relaxed text-muted">{greeting}</p>
    </div>
  );
}

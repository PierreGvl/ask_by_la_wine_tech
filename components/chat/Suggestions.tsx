"use client";

import { useBranding } from "@/components/branding/BrandingProvider";

export function Suggestions({ onPick }: { onPick: (text: string) => void }) {
  const { suggestions } = useBranding();
  return (
    <div className="grid w-full max-w-3xl gap-2.5 sm:auto-rows-fr sm:grid-cols-2">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="flex items-center rounded-xl border border-line bg-white px-4 py-3 text-left text-sm text-ink transition-colors hover:border-rose/40 hover:bg-rose-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

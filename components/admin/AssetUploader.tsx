"use client";

import { ImageUp } from "lucide-react";
import { useState, useTransition } from "react";
import { uploadProjectImageAction } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_SIZE = 128;

/**
 * Recadre une image bitmap en carré PNG (contain, centrée, fond transparent)
 * pour normaliser un favicon. Les SVG sont retournés tels quels (scalables).
 */
async function squarePng(file: File, size: number): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  const scale = Math.min(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png"),
  );
  bitmap.close();
  return blob ? new File([blob], "favicon.png", { type: "image/png" }) : file;
}

/**
 * Téléversement d'un asset image d'un projet (logo ou favicon), stocké en base
 * et servi par /api/assets. Aperçu local + validation client (l'action serveur
 * reste l'autorité).
 */
export function AssetUploader({
  projectId,
  kind,
  currentUrl,
}: {
  projectId: string;
  kind: "logo" | "favicon";
  currentUrl: string | null;
}) {
  const { show } = useToast();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const shown = preview ?? currentUrl;
  const noun = kind === "favicon" ? "Le favicon" : "Le logo";

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreview(null);
      setHasFile(false);
      return;
    }
    if (!f.type.startsWith("image/")) {
      show(`${noun} doit être une image.`, "err");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_BYTES) {
      show(`${noun} est trop lourd (max 2 Mo).`, "err");
      e.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(f));
    setHasFile(true);
  }

  function submit(formData: FormData) {
    start(async () => {
      try {
        // Favicon : on normalise en carré PNG côté client avant l'envoi.
        if (kind === "favicon") {
          const f = formData.get("file");
          if (f instanceof File && f.size > 0) {
            formData.set("file", await squarePng(f, FAVICON_SIZE));
          }
        }
        const res = await uploadProjectImageAction(formData);
        if (res.ok) {
          show(
            kind === "favicon" ? "Favicon mis à jour" : "Logo mis à jour",
            "ok",
          );
          setPreview(null);
          setHasFile(false);
        } else {
          show(res.error, "err");
        }
      } catch {
        // Rejet niveau framework (ex. taille de body Server Action dépassée).
        show("Téléversement refusé (fichier trop volumineux ?).", "err");
      }
    });
  }

  return (
    <form action={submit} className="flex items-center gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="kind" value={kind} />
      <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={kind} className="h-full w-full object-contain" />
        ) : (
          <ImageUp className="h-6 w-6 text-faint" />
        )}
      </span>
      <div className="flex flex-col gap-2">
        <input
          type="file"
          name="file"
          accept="image/*"
          onChange={onPick}
          className="block w-full text-xs text-faint file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy-700"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending || !hasFile}
        >
          {pending
            ? "Envoi…"
            : kind === "favicon"
              ? "Téléverser le favicon"
              : "Téléverser le logo"}
        </Button>
      </div>
    </form>
  );
}

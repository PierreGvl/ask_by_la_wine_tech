"use client";

import { type ReactNode, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";

/**
 * `<form>` lié à une server action, avec toast de confirmation/erreur. À utiliser
 * pour les actions qui mutent SANS rediriger (les actions qui `redirect()` ne
 * doivent pas être enveloppées : la navigation sert déjà de retour).
 */
export function ToastForm({
  action,
  children,
  className,
  success = "Enregistré",
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  success?: string;
}) {
  const { show } = useToast();
  const [, start] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        start(async () => {
          try {
            await action(formData);
            show(success, "ok");
          } catch {
            show("Une erreur est survenue", "err");
          }
        });
      }}
    >
      {children}
    </form>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ChatUIMessage } from "@/lib/chat/types";
import { Composer } from "./Composer";
import { Greeting } from "./Greeting";
import { Message } from "./Message";
import { Suggestions } from "./Suggestions";

export function ChatPane({
  chatId,
  initialMessages,
  isAuthenticated,
  isNew,
}: {
  chatId: string;
  initialMessages: ChatUIMessage[];
  isAuthenticated: boolean;
  isNew: boolean;
}) {
  const router = useRouter();
  const navigatedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error, regenerate } =
    useChat<ChatUIMessage>({
      id: chatId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: { messages, conversationId: id },
        }),
      }),
    });

  const busy = status === "submitted" || status === "streaming";
  // Requête envoyée mais aucune réponse encore en cours de rédaction.
  const waiting =
    status === "submitted" &&
    messages[messages.length - 1]?.role !== "assistant";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fin du 1er échange (utilisateur connecté) : rafraîchit la barre latérale
  // pour faire apparaître la nouvelle conversation et son titre.
  useEffect(() => {
    if (status === "ready" && navigatedRef.current) router.refresh();
  }, [status, router]);

  function handleSend(text: string) {
    if (isNew && isAuthenticated && !navigatedRef.current) {
      navigatedRef.current = true;
      window.history.replaceState(null, "", `/c/${chatId}`);
    }
    sendMessage({ text });
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {!isAuthenticated && (
        <div className="bg-navy px-4 py-2 text-center text-sm text-white/85">
          Vous discutez en mode invité.{" "}
          <Link
            href="/login"
            className="font-semibold text-rose-100 underline-offset-2 hover:underline"
          >
            Connectez-vous
          </Link>{" "}
          pour conserver votre historique de conversations.
        </div>
      )}

      {empty ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-8">
            <Greeting />
            <Suggestions onPick={handleSend} />
            <div className="w-full">
              <Composer onSend={handleSend} onStop={stop} busy={busy} large />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
              {messages.map((m, i) => (
                <Message
                  key={m.id}
                  message={m}
                  streaming={
                    busy && i === messages.length - 1 && m.role === "assistant"
                  }
                />
              ))}

              {waiting && (
                <div className="flex items-center gap-2 text-sm text-faint">
                  <Loader2 className="h-4 w-4 animate-spin text-rose" />
                  L&apos;assistant réfléchit…
                </div>
              )}

              {error && (
                <div className="flex flex-col items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <p>
                    Une erreur est survenue. La réponse a peut-être été
                    interrompue ou a pris trop de temps. Réessayez.
                  </p>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réessayer
                  </button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-line bg-rose-50/80 px-4 py-4 backdrop-blur">
            <Composer onSend={handleSend} onStop={stop} busy={busy} />
          </div>
        </>
      )}
    </div>
  );
}

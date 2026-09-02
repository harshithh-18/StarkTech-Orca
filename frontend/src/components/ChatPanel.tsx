/**
 * Conversational chat panel.
 *
 * Owner: D · Phase: P1
 *
 * Multi-turn, streaming, language auto-detected from what the user types. The input must
 * accept regional scripts — no Latin-only validation anywhere near this box.
 */

import { useEffect, useRef, useState } from "react";

import MessageBubble from "@/components/MessageBubble";
import type { ChatMessage } from "@/types/orca";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onAsk: (query: string) => void;
  onRetry?: (id: string) => void;
}

/** The four golden queries. They show a first-time user what ORCA can actually do. */
const SUGGESTIONS = [
  "Where is the nearest fishing zone near Kakinada?",
  "Is it safe to go to sea tomorrow morning near Kakinada?",
  "Am I approaching any restricted boundary?",
  "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
];

export default function ChatPanel({ messages, loading, onAsk, onRetry }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const text = draft.trim();
    if (!text || loading) return;
    onAsk(text);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-slate-500">
              Ask about fishing zones, sea safety or maritime boundaries — in English or
              your own language.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onAsk(suggestion)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-ocean-deep shadow-sm hover:border-ocean-mid hover:bg-blue-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onRetry={onRetry} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter makes a newline. IME composition must not be
              // interrupted — Indic and CJK input both commit text with Enter.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask ORCA…"
            aria-label="Ask ORCA a question"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean-mid focus:outline-none focus:ring-1 focus:ring-ocean-mid"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !draft.trim()}
            className="h-10 shrink-0 rounded-lg bg-ocean-mid px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

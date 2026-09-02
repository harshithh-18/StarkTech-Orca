/**
 * Conversational chat panel.
 *
 * Owner: D · Phase: P1 · Polished P3
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

/** The golden path, in the order the demo walks them. Labels keep the chips scannable. */
const SUGGESTIONS: { label: string; query: string; icon: string }[] = [
  {
    icon: "🎣",
    label: "Nearest fishing zone",
    query: "Where is the nearest Potential Fishing Zone today?",
  },
  {
    icon: "⚓",
    label: "Is it safe to sail?",
    query: "Is it safe to go to sea tomorrow morning near Kakinada?",
  },
  {
    icon: "🚩",
    label: "Near a boundary?",
    query: "Am I approaching any restricted boundary?",
  },
  {
    icon: "📉",
    label: "Why fewer fish?",
    query: "Why has fish productivity declined in this region?",
  },
  {
    icon: "🗣️",
    label: "తెలుగులో అడగండి",
    query: "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
  },
];

export default function ChatPanel({ messages, loading, onAsk, onRetry }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Grow the box with the text, up to a cap — a fixed single line hides long Indic input.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || loading) return;
    onAsk(text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 transition-colors dark:bg-abyss-950">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="animate-fade-in space-y-4 pt-2">
            <div className="rounded-2xl border border-ocean-200 bg-gradient-to-br from-ocean-50 to-white p-4 dark:border-ocean-800/50 dark:from-abyss-800 dark:to-abyss-900">
              <p className="text-sm font-semibold text-ocean-800 dark:text-ocean-200">
                Ask about the sea — in any Indian language.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Fishing zones, sea safety, maritime boundaries and ocean productivity.
                Every answer shows its evidence and the agents behind it.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Try one
              </p>
              {SUGGESTIONS.map((suggestion, index) => (
                <button
                  key={suggestion.query}
                  type="button"
                  onClick={() => onAsk(suggestion.query)}
                  style={{
                    animationDelay: `${index * 55}ms`,
                    animationFillMode: "backwards",
                  }}
                  className="group flex w-full animate-slide-up items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-ocean-400 hover:shadow-md dark:border-white/10 dark:bg-abyss-900 dark:hover:border-ocean-500"
                >
                  <span aria-hidden="true" className="text-base">
                    {suggestion.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-ocean-800 dark:text-ocean-200">
                      {suggestion.label}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {suggestion.query}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ocean-400"
                  >
                    →
                  </span>
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

      <div className="shrink-0 border-t border-slate-200 bg-white p-3 transition-colors dark:border-white/10 dark:bg-abyss-900">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              id="orca-input"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter makes a newline. IME composition must not be
                // interrupted — Indic and CJK input both commit text with Enter.
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask ORCA…  (⌘K)"
              aria-label="Ask ORCA a question"
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm transition-all placeholder:text-slate-400 focus:border-ocean-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-500/25 dark:border-white/10 dark:bg-abyss-950 dark:text-slate-100 dark:focus:bg-abyss-950"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading || !draft.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-500 to-ocean-700 text-white shadow-md transition-all hover:scale-105 hover:shadow-glow active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:hover:scale-100 dark:disabled:from-white/10 dark:disabled:to-white/10"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span aria-hidden="true" className="text-lg leading-none">
                ↑
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

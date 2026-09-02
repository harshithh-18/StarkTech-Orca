/**
 * One chat message.
 *
 * Owner: D · Phase: P1 · Polished P3
 *
 * An ORCA message is not just text: it carries the verdict badge, the top reasons and a
 * link into its own evidence. Keep it glanceable — the detail belongs in the trace panel.
 */

import { useState } from "react";

import type { ChatMessage, Verdict } from "@/types/orca";

interface Props {
  message: ChatMessage;
  onRetry?: (id: string) => void;
}

const VERDICT_BADGE: Record<
  Exclude<Verdict, "NOT_APPLICABLE">,
  { text: string; className: string }
> = {
  GO: { text: "GO", className: "bg-emerald-500 text-white" },
  CAUTION: { text: "CAUTION", className: "bg-amber-500 text-white" },
  NO_GO: { text: "NO-GO", className: "bg-rose-600 text-white" },
};

export default function MessageBubble({ message, onRetry }: Props) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isUser = message.role === "user";
  const response = message.response;
  const verdict =
    response?.verdict && response.verdict !== "NOT_APPLICABLE"
      ? VERDICT_BADGE[response.verdict]
      : null;

  return (
    <div className={`flex animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm transition-colors",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-ocean-600 to-ocean-700 text-white"
            : message.failed
              ? "rounded-bl-md border border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
              : "rounded-bl-md border border-slate-200 bg-white text-ocean-deep dark:border-white/10 dark:bg-abyss-900 dark:text-slate-100",
        ].join(" ")}
        // Tell the browser which language this is so Indic scripts shape and wrap
        // correctly — without it, Telugu and Tamil can break mid-cluster.
        lang={response?.language ?? undefined}
      >
        {message.pending ? (
          <span
            className="flex items-center gap-1.5 py-1"
            aria-label="ORCA is thinking"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ocean-400"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        ) : (
          <>
            {verdict && (
              <span
                className={`mb-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider ${verdict.className}`}
              >
                {verdict.text}
              </span>
            )}

            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

            {message.failed && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="mt-2 rounded-lg border border-rose-400 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/40"
              >
                ↻ Retry
              </button>
            )}

            {response && response.evidence.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEvidence((value) => !value)}
                  aria-expanded={showEvidence}
                  className="mt-2 inline-flex items-center gap-1 rounded-md text-[11px] font-semibold text-ocean-600 transition-colors hover:text-ocean-500 dark:text-ocean-300"
                >
                  <span
                    aria-hidden="true"
                    className={`text-[8px] transition-transform ${showEvidence ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  {showEvidence ? "Hide evidence" : `Why? (${response.evidence.length})`}
                </button>

                {showEvidence && (
                  <dl className="mt-2 animate-fade-in space-y-1.5 border-t border-slate-200 pt-2 text-[11px] dark:border-white/10">
                    {response.evidence.map((item, index) => (
                      <div key={`${item.field}-${index}`}>
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <dt className="font-semibold text-slate-600 dark:text-slate-300">
                            {item.field.replace(/_/g, " ")}
                          </dt>
                          <dd className="font-mono font-semibold text-ocean-700 dark:text-ocean-300">
                            {String(item.value)}
                            {item.unit ? ` ${item.unit}` : ""}
                          </dd>
                        </div>
                        <dd className="text-slate-400 dark:text-slate-500">
                          {item.source}
                          {item.time && ` · ${new Date(item.time).toLocaleString()}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </>
            )}

            {response?.used_mock_data && (
              <span className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                demo data
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

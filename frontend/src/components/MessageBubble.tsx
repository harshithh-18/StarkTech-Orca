/**
 * One chat message.
 *
 * Owner: D · Phase: P1
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

const VERDICT_BADGE: Record<Exclude<Verdict, "NOT_APPLICABLE">, { text: string; className: string }> = {
  GO: { text: "GO", className: "bg-verdict-go text-white" },
  CAUTION: { text: "CAUTION", className: "bg-verdict-caution text-white" },
  NO_GO: { text: "NO-GO", className: "bg-verdict-nogo text-white" },
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
          isUser
            ? "rounded-br-sm bg-ocean-mid text-white"
            : message.failed
              ? "rounded-bl-sm border border-red-200 bg-red-50 text-red-900"
              : "rounded-bl-sm border border-slate-200 bg-white text-ocean-deep",
        ].join(" ")}
        // Tell the browser which language this is so Indic scripts shape and wrap
        // correctly — without it, Telugu and Tamil can break mid-cluster.
        lang={response?.language ?? undefined}
      >
        {message.pending ? (
          <span className="flex items-center gap-1.5 py-0.5" aria-label="ORCA is thinking">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        ) : (
          <>
            {verdict && (
              <span
                className={`mb-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${verdict.className}`}
              >
                {verdict.text}
              </span>
            )}
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

            {message.failed && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="mt-2 rounded border border-red-300 px-2 py-0.5 text-xs font-medium hover:bg-red-100"
              >
                Retry
              </button>
            )}

            {response && response.evidence.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEvidence((value) => !value)}
                  aria-expanded={showEvidence}
                  className="mt-2 text-xs font-medium text-ocean-mid underline decoration-dotted underline-offset-2"
                >
                  {showEvidence ? "Hide evidence" : `Why? (${response.evidence.length})`}
                </button>

                {showEvidence && (
                  <dl className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-[11px]">
                    {response.evidence.map((item, index) => (
                      <div key={`${item.field}-${index}`} className="flex flex-wrap gap-x-1.5">
                        <dt className="font-medium text-slate-600">
                          {item.field.replace(/_/g, " ")}:
                        </dt>
                        <dd className="text-slate-800">
                          {String(item.value)}
                          {item.unit ? ` ${item.unit}` : ""}
                        </dd>
                        <dd className="w-full text-slate-400">
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
              <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                demo data
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

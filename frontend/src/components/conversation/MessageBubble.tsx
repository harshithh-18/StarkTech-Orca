/**
 * One turn in the conversation.
 *
 * Owner: D · Phase: P1 · Rebuilt P4
 *
 * An ORCA turn is not just text: it carries the verdict, the evidence behind it, and a
 * button to hear it read aloud. The bubble stays glanceable and the numbers live behind
 * a disclosure — the detail belongs in the insight rail, not stacked in the chat.
 *
 * `lang` is set from the response so the browser shapes and line-breaks Indic scripts
 * correctly. Without it Telugu and Tamil can break mid-cluster, which looks like mojibake
 * and is entirely our fault.
 */

import { useState } from "react";

import Icon from "@/components/common/Icon";
import Logo from "@/components/common/Logo";
import { fieldLabel } from "@/components/insight/fieldLabel";
import type { ChatMessage, Verdict } from "@/types/orca";

interface Props {
  message: ChatMessage;
  onRetry?: (id: string) => void;
  onSpeak?: (message: ChatMessage) => void;
  speaking?: boolean;
}

const VERDICT: Record<
  Exclude<Verdict, "NOT_APPLICABLE">,
  { text: string; className: string }
> = {
  GO: { text: "Safe to go", className: "bg-emerald-500 text-white" },
  CAUTION: { text: "Caution", className: "bg-amber-500 text-white" },
  NO_GO: { text: "Do not go to sea", className: "bg-rose-600 text-white" },
};

export default function MessageBubble({ message, onRetry, onSpeak, speaking }: Props) {
  const [showEvidence, setShowEvidence] = useState(false);
  const isUser = message.role === "user";
  const response = message.response;
  const verdict =
    response?.verdict && response.verdict !== "NOT_APPLICABLE"
      ? VERDICT[response.verdict]
      : null;

  if (isUser) {
    return (
      <div className="flex animate-slide-up justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ocean-600 px-3.5 py-2 text-[13.5px] leading-relaxed text-white dark:bg-ocean-600">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex animate-slide-up gap-2.5">
      {message.failed ? (
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500/10 band-no_go"
        >
          <Icon name="alert" size={15} />
        </span>
      ) : (
        <Logo size={28} className="mt-0.5" />
      )}

      <div
        className={`min-w-0 max-w-[calc(100%-2.5rem)] rounded-2xl rounded-tl-md border px-3.5 py-2.5 ${
          message.failed
            ? "border-rose-500/30 bg-rose-500/[0.06]"
            : "border-slate-200 bg-white dark:border-white/10 dark:bg-abyss-850"
        }`}
        lang={response?.language ?? undefined}
      >
        {message.pending ? (
          <span className="flex items-center gap-1.5 py-1" aria-label="ORCA is thinking">
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
                className={`mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${verdict.className}`}
              >
                {verdict.text}
              </span>
            )}

            <p
              className={`whitespace-pre-wrap text-[13.5px] leading-relaxed ${
                message.failed
                  ? "band-no_go"
                  : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {message.text}
            </p>

            {message.failed && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="btn-ghost mt-2.5 px-2.5 py-1"
              >
                <Icon name="refresh" size={13} />
                Try again
              </button>
            )}

            {response && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2 dark:border-white/10">
                {onSpeak && (
                  <button
                    type="button"
                    onClick={() => onSpeak(message)}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ocean-600 transition-colors hover:text-ocean-500 dark:text-ocean-300"
                  >
                    <Icon name={speaking ? "stop" : "volume"} size={13} />
                    {speaking ? "Stop" : "Listen"}
                  </button>
                )}

                {response.evidence.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEvidence((value) => !value)}
                    aria-expanded={showEvidence}
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-ocean-600 transition-colors hover:text-ocean-500 dark:text-ocean-300"
                  >
                    <Icon
                      name="chevron"
                      size={12}
                      className={`transition-transform ${showEvidence ? "rotate-90" : ""}`}
                    />
                    {showEvidence ? "Hide evidence" : `Evidence (${response.evidence.length})`}
                  </button>
                )}

                {response.used_mock_data && (
                  <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    Demo data
                  </span>
                )}
              </div>
            )}

            {showEvidence && response && (
              <dl className="mt-2 animate-fade-in space-y-2">
                {response.evidence.map((item, index) => (
                  <div
                    key={`${item.field}-${index}`}
                    className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-white/[0.04]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <dt className="text-[11.5px] font-medium text-slate-700 dark:text-slate-200">
                        {fieldLabel(item.field)}
                      </dt>
                      <dd className="font-mono text-[11.5px] font-semibold text-ocean-700 dark:text-ocean-300">
                        {String(item.value)}
                        {item.unit ? ` ${item.unit}` : ""}
                      </dd>
                    </div>
                    <dd className="mt-0.5 text-[10.5px] leading-snug muted">
                      {item.source}
                      {item.time && ` · ${new Date(item.time).toLocaleString()}`}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </div>
  );
}

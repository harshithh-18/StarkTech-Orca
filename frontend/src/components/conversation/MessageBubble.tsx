/**
 * One turn in the conversation — Structured Maritime Response Bubble.
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
  { text: string; className: string; icon: "check" | "alert" | "close" }
> = {
  GO: {
    text: "Safe to Sail",
    className: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
    icon: "check",
  },
  CAUTION: {
    text: "Caution Advisory",
    className: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
    icon: "alert",
  },
  NO_GO: {
    text: "Do Not Go To Sea",
    className: "bg-rose-600 text-white shadow-sm shadow-rose-600/30",
    icon: "close",
  },
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
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-r from-ocean-700 via-ocean-600 to-teal-600 px-4 py-2.5 text-[13.5px] font-medium leading-relaxed text-white shadow-md">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-slide-up gap-2.5">
      {message.failed ? (
        <span
          aria-hidden="true"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-rose-500/10 band-no_go"
        >
          <Icon name="alert" size={15} />
        </span>
      ) : (
        <Logo size={30} rounded="rounded-xl" className="mt-0.5 shadow-sm ring-1 ring-cyan-500/30" />
      )}

      <div
        className={`min-w-0 max-w-[calc(100%-2.5rem)] rounded-2xl rounded-tl-sm border px-4 py-3 shadow-sm ${
          message.failed
            ? "border-rose-500/30 bg-rose-500/[0.06]"
            : "border-sky-100 bg-white/95 dark:border-white/10 dark:bg-abyss-850/95"
        }`}
        lang={response?.language ?? undefined}
      >
        {message.pending ? (
          <div className="flex items-center gap-2 py-1 text-ocean-600 dark:text-cyan-300" aria-label="ORCA is reasoning">
            <span className="flex items-center gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-2 w-2 animate-bounce rounded-full bg-current"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            <span className="text-[11.5px] font-semibold">Specialist agents synthesizing telemetry…</span>
          </div>
        ) : (
          <>
            {verdict && (
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black tracking-wide ${verdict.className}`}
                >
                  <Icon name={verdict.icon} size={12} />
                  {verdict.text}
                </span>
                {response?.intent && (
                  <span className="text-[10px] font-mono uppercase tracking-wider muted">
                    {response.intent.replace("_", " ")}
                  </span>
                )}
              </div>
            )}

            <p
              className={`whitespace-pre-wrap text-[13.5px] leading-relaxed font-normal ${
                message.failed ? "band-no_go font-medium" : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {message.text}
            </p>

            {message.failed && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="btn-ghost mt-2.5 px-3 py-1 text-rose-600 dark:text-rose-300"
              >
                <Icon name="refresh" size={13} />
                Retry Question
              </button>
            )}

            {response && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-sky-100 pt-2.5 dark:border-white/10">
                {onSpeak && (
                  <button
                    type="button"
                    onClick={() => onSpeak(message)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-ocean-700 hover:bg-ocean-50 dark:text-cyan-300 dark:hover:bg-white/5 transition-colors"
                  >
                    <Icon name={speaking ? "stop" : "volume"} size={13} />
                    {speaking ? "Stop Broadcast" : "Read Aloud"}
                  </button>
                )}

                {response.evidence.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEvidence((value) => !value)}
                    aria-expanded={showEvidence}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold text-ocean-700 hover:bg-ocean-50 dark:text-cyan-300 dark:hover:bg-white/5 transition-colors"
                  >
                    <Icon
                      name="chevron"
                      size={11}
                      className={`transition-transform duration-200 ${showEvidence ? "rotate-90 text-ocean-600" : ""}`}
                    />
                    {showEvidence ? "Hide Evidence" : `Evidence Citations (${response.evidence.length})`}
                  </button>
                )}

                {response.used_mock_data && (
                  <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] py-0.5">
                    Cached Fallback
                  </span>
                )}
              </div>
            )}

            {/* Evidence Drawer */}
            {showEvidence && response && (
              <dl className="mt-2.5 animate-fade-in space-y-1.5 rounded-xl bg-sky-50/60 p-2.5 dark:bg-abyss-950/60 border border-sky-100 dark:border-white/5">
                {response.evidence.map((item, index) => (
                  <div
                    key={`${item.field}-${index}`}
                    className="rounded-lg bg-white px-2.5 py-1.5 dark:bg-abyss-850 border border-sky-100/70 dark:border-white/5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <dt className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {fieldLabel(item.field)}
                      </dt>
                      <dd className="font-mono text-[11.5px] font-black text-ocean-700 dark:text-cyan-300">
                        {String(item.value)}
                        {item.unit ? ` ${item.unit}` : ""}
                      </dd>
                    </div>
                    <dd className="mt-0.5 font-mono text-[9.5px] leading-snug muted">
                      {item.source}
                      {item.time && ` · ${new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
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

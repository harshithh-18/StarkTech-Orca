/**
 * The conversation.
 *
 * Owner: D · Phase: P1 · Rebuilt P4
 *
 * Multi-turn, multilingual, voice-capable. The composer accepts any script — there is no
 * Latin-only validation anywhere near this box, and there must never be.
 *
 * ## Starters are per role
 *
 * A fisher, a coastal authority, a researcher and a shipping operator ask genuinely
 * different questions of the same data. Showing all four sets at once is how a first-time
 * user concludes the tool is not for them; showing the four that match who they said they
 * were is how they get a useful answer on their first try. The role comes from the
 * welcome screen and is changeable at any time.
 */

import { useEffect, useRef, useState } from "react";

import Icon, { type IconName } from "@/components/common/Icon";
import ConditionsGlance from "@/components/conditions/ConditionsGlance";
import MessageBubble from "@/components/conversation/MessageBubble";
import type { ChatMessage, ConditionsSnapshot, Role } from "@/types/orca";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  role: Role;
  locationName: string;
  onAsk: (query: string) => void;
  /** The live now-cast, summarised above the starters so the panel opens with a fact. */
  conditions: ConditionsSnapshot | null;
  conditionsLoading: boolean;
  onOpenConditions: () => void;
  onRetry?: (id: string) => void;
  onSpeak?: (message: ChatMessage) => void;
  speaking?: boolean;
  voice?: {
    supported: boolean;
    listening: boolean;
    listen: () => void;
    stopListening: () => void;
  };
}

interface Starter {
  icon: IconName;
  label: string;
  query: string;
}

/** The golden path, split by who is asking. Every one of these answers end to end. */
const STARTERS: Record<Role, Starter[]> = {
  fisherman: [
    {
      icon: "fish",
      label: "Nearest fishing zone",
      query: "Where is the nearest Potential Fishing Zone today?",
    },
    {
      icon: "anchor",
      label: "Is it safe to sail tomorrow?",
      query: "Is it safe to go to sea tomorrow morning?",
    },
    {
      icon: "tide",
      label: "Tide, wind and sea state",
      query: "What are the tide, weather and sea conditions near my location?",
    },
    {
      icon: "boundary",
      label: "Am I near a boundary?",
      query: "Am I approaching any restricted maritime boundary?",
    },
  ],
  authority: [
    {
      icon: "boundary",
      label: "Boundary proximity",
      query: "Am I approaching any restricted maritime boundary?",
    },
    {
      icon: "storm",
      label: "Hazard advisories",
      query: "Are there any lightning or cyclone alerts in my area?",
    },
    {
      icon: "shield",
      label: "Zones to avoid",
      query: "Which fishing zones should be avoided due to hazardous marine conditions?",
    },
    {
      icon: "anchor",
      label: "Small-craft safety",
      query: "Is it safe for small craft to venture out tomorrow morning?",
    },
  ],
  researcher: [
    {
      icon: "chart",
      label: "Why productivity fell",
      query: "Why has fish productivity declined in this region?",
    },
    {
      icon: "front",
      label: "Chlorophyll and SST",
      query: "Which regions show high chlorophyll concentration and favourable sea surface temperature?",
    },
    {
      icon: "temperature",
      label: "Thermal fronts",
      query: "Are there any thermal fronts or eddies near this location?",
    },
    {
      icon: "fish",
      label: "Fishing zones today",
      query: "Where is the nearest Potential Fishing Zone today?",
    },
  ],
  operator: [
    {
      icon: "route",
      label: "Safest route",
      query: "What is the safest route from Kakinada to Chennai?",
    },
    {
      icon: "wave",
      label: "Sea state on passage",
      query: "What is the sea state and swell along the coast over the next two days?",
    },
    {
      icon: "storm",
      label: "Hazards en route",
      query: "Are there any cyclone or high-wave hazards on this coast?",
    },
    {
      icon: "boundary",
      label: "Restricted waters",
      query: "Which waters near here are restricted or protected?",
    },
  ],
};

/** One multilingual example, always shown — it is how a user learns they may switch. */
const MULTILINGUAL: Starter = {
  icon: "sparkles",
  label: "తెలుగులో అడగండి",
  query: "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
};

export default function ConversationPanel({
  messages,
  loading,
  role,
  locationName,
  onAsk,
  conditions,
  conditionsLoading,
  onOpenConditions,
  onRetry,
  onSpeak,
  speaking,
  voice,
}: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Grow the box with the text, up to a cap — a fixed single line hides long Indic input.
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || loading) return;
    onAsk(text);
    setDraft("");
  };

  const starters = [...STARTERS[role], MULTILINGUAL];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="animate-fade-in space-y-4">
            <div className="rounded-xl border border-ocean-500/20 bg-ocean-500/[0.06] p-3.5">
              <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                Ask about the sea — in any Indian language.
              </p>
              <p className="mt-1 text-[12px] leading-relaxed muted">
                Questions are answered for{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {locationName}
                </span>{" "}
                unless you name somewhere else. Every answer shows the agents that ran and
                the evidence behind it.
              </p>
            </div>

            <div>
              <p className="eyebrow mb-1.5">Right now</p>
              <ConditionsGlance
                data={conditions}
                loading={conditionsLoading}
                locationName={locationName}
                onOpen={onOpenConditions}
              />
            </div>

            <div>
              <p className="eyebrow mb-1.5">Try one</p>
              <div className="space-y-1.5">
                {starters.map((starter, index) => (
                  <button
                    key={starter.query}
                    type="button"
                    onClick={() => onAsk(starter.query)}
                    style={{
                      animationDelay: `${index * 45}ms`,
                      animationFillMode: "backwards",
                    }}
                    className="group flex w-full animate-slide-up items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-all hover:border-ocean-400 hover:bg-ocean-500/[0.04] dark:border-white/10 dark:bg-abyss-850 dark:hover:border-ocean-500/60"
                  >
                    <Icon
                      name={starter.icon}
                      size={16}
                      className="text-ocean-600 dark:text-ocean-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                        {starter.label}
                      </span>
                      <span className="block truncate text-[11px] muted">{starter.query}</span>
                    </span>
                    <Icon
                      name="arrow-right"
                      size={14}
                      className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ocean-500 dark:text-slate-600"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={onRetry}
              onSpeak={onSpeak}
              speaking={speaking}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* ── Composer ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10">
        <div className="flex items-end gap-2">
          <textarea
            id="orca-input"
            ref={inputRef}
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
            className="input resize-none py-2.5 text-[13.5px]"
          />

          {voice?.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stopListening() : voice.listen())}
              disabled={loading}
              aria-label={voice.listening ? "Stop listening" : "Ask by voice"}
              aria-pressed={voice.listening}
              title={
                voice.listening
                  ? "Listening — click to stop"
                  : "Ask by voice, in your own language"
              }
              className={`btn relative h-[38px] w-[38px] shrink-0 border ${
                voice.listening
                  ? "border-rose-500 bg-rose-500 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
              }`}
            >
              {voice.listening && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-pulse-ring rounded-lg bg-rose-400"
                />
              )}
              <Icon name={voice.listening ? "stop" : "mic"} size={16} className="relative" />
            </button>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={loading || !draft.trim()}
            aria-label="Send"
            className="btn-primary h-[38px] w-[38px] shrink-0 p-0"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Icon name="send" size={16} />
            )}
          </button>
        </div>

        <p className="mt-1.5 px-0.5 text-[10.5px] muted">
          Enter to send · Shift+Enter for a new line · ⌘K to focus
        </p>
      </div>
    </div>
  );
}

/**
 * The conversation — Multilingual Maritime Reasoning & Query Console.
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

const STARTERS: Record<Role, Starter[]> = {
  fisherman: [
    {
      icon: "fish",
      label: "Potential Fishing Zones",
      query: "Where is the nearest Potential Fishing Zone today?",
    },
    {
      icon: "anchor",
      label: "Tomorrow Morning Sailing Safety",
      query: "Is it safe to go to sea tomorrow morning?",
    },
    {
      icon: "tide",
      label: "Sea State, Tides & Wave Swell",
      query: "What are the tide, weather and sea conditions near my location?",
    },
    {
      icon: "boundary",
      label: "Maritime Boundary Distance",
      query: "Am I approaching any restricted maritime boundary or IMBL?",
    },
  ],
  authority: [
    {
      icon: "boundary",
      label: "Border & IMBL Proximity Check",
      query: "Am I approaching any restricted maritime boundary?",
    },
    {
      icon: "storm",
      label: "Cyclone & Lightning Advisories",
      query: "Are there any lightning or cyclone alerts in my area?",
    },
    {
      icon: "shield",
      label: "Hazardous Coastal Sectors",
      query: "Which fishing zones should be avoided due to hazardous marine conditions?",
    },
    {
      icon: "anchor",
      label: "Small Craft Advisory Limits",
      query: "Is it safe for small craft to venture out tomorrow morning?",
    },
  ],
  researcher: [
    {
      icon: "chart",
      label: "Chlorophyll & Biomass Analysis",
      query: "Why has fish productivity declined in this region?",
    },
    {
      icon: "front",
      label: "Thermal Fronts & Eddies",
      query: "Which regions show high chlorophyll concentration and favourable sea surface temperature?",
    },
    {
      icon: "temperature",
      label: "SST Gradients & Upwelling",
      query: "Are there any thermal fronts or eddies near this location?",
    },
    {
      icon: "fish",
      label: "Computed Zone Coordinates",
      query: "Where is the nearest Potential Fishing Zone today?",
    },
  ],
  operator: [
    {
      icon: "route",
      label: "Least-Risk Coastal Route",
      query: "What is the safest route from Kakinada to Chennai?",
    },
    {
      icon: "wave",
      label: "Passage Swell & Wave Height",
      query: "What is the sea state and swell along the coast over the next two days?",
    },
    {
      icon: "storm",
      label: "En-Route Hazards & Squalls",
      query: "Are there any cyclone or high-wave hazards on this coast?",
    },
    {
      icon: "boundary",
      label: "Navigational Restrictions",
      query: "Which waters near here are restricted or protected?",
    },
  ],
};

const MULTILINGUAL_STARTERS: Starter[] = [
  {
    icon: "sparkles",
    label: "తెలుగు (Telugu)",
    query: "రేపు సముద్రంలోకి వెళ్ళడం సురక్షితమేనా?",
  },
  {
    icon: "sparkles",
    label: "தமிழ் (Tamil)",
    query: "இன்று மீன்பிடி மண்டலம் எங்கே உள்ளது?",
  },
];

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

  const starters = [...STARTERS[role], ...MULTILINGUAL_STARTERS];

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50/60 dark:bg-[#080e1c]">
      {/* ── Chat Messages Scroll Area ─────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="animate-fade-in space-y-4">
            {/* Operational Briefing Card */}
            <div className="card-ocean p-4 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-ocean-500/20 text-ocean-700 dark:text-ocean-400">
                  <Icon name="compass" size={14} />
                </span>
                <p className="text-[13px] font-bold text-slate-900 dark:text-white">
                  Coastal Operations Briefing
                </p>
                <span className="ml-auto font-mono text-[10px] text-ocean-700 dark:text-ocean-400 font-semibold">
                  {locationName}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed muted">
                Pose maritime questions in any Indian coastal language. ORCA plans and runs specialist
                meteorological, oceanographic, and geospatial agents in parallel, returning verified verdicts
                with full sensor citations.
              </p>
            </div>

            {/* Conditions Glance */}
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                <Icon name="gauge" size={12} />
                Live Harbour Telemetry
              </p>
              <ConditionsGlance
                data={conditions}
                loading={conditionsLoading}
                locationName={locationName}
                onOpen={onOpenConditions}
              />
            </div>

            {/* Quick Starters */}
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1.5">
                <Icon name="sparkles" size={12} />
                Suggested Mission Queries
              </p>
              <div className="space-y-1.5">
                {starters.map((starter, index) => (
                  <button
                    key={starter.query}
                    type="button"
                    onClick={() => onAsk(starter.query)}
                    style={{
                      animationDelay: `${index * 40}ms`,
                      animationFillMode: "backwards",
                    }}
                    className="group flex w-full animate-slide-up items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] px-3 py-2.5 text-left transition-all hover:border-emerald-500/70 hover:bg-emerald-500/[0.08] hover:shadow-sm dark:border-emerald-400/25 dark:bg-emerald-500/[0.04] dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/[0.10] shadow-sm"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                      <Icon name={starter.icon} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-slate-900 dark:text-slate-100">
                        {starter.label}
                      </span>
                      <span className="block truncate text-[11px] muted">{starter.query}</span>
                    </span>
                    <Icon
                      name="arrow-right"
                      size={13}
                      className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-600 dark:group-hover:text-emerald-400"
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

      {/* ── Floating Composer Dock ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200 bg-white/95 p-3 dark:border-white/10 dark:bg-[#080e1c]">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              id="orca-input"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder={`Ask ORCA about sea state, fish zones, or boundaries…`}
              aria-label="Ask ORCA a maritime question"
              className="input resize-none py-2.5 text-[13px] pr-2 shadow-inner"
            />
          </div>

          {/* Voice Input Button */}
          {voice?.supported && (
            <button
              type="button"
              onClick={() => (voice.listening ? voice.stopListening() : voice.listen())}
              disabled={loading}
              aria-label={voice.listening ? "Stop voice listening" : "Ask by voice"}
              aria-pressed={voice.listening}
              title={
                voice.listening
                  ? "Listening to voice… click to send"
                  : "Speak query in any Indian coastal tongue"
              }
              className={`btn relative h-[38px] w-[38px] shrink-0 rounded-xl border transition-all ${
                voice.listening
                  ? "border-rose-500 bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105"
                  : "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-700 hover:bg-emerald-500/15 hover:border-emerald-500/70 dark:border-emerald-400/30 dark:bg-emerald-500/[0.08] dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              }`}
            >
              {voice.listening && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-pulse-ring rounded-xl bg-rose-400/50"
                />
              )}
              <Icon name={voice.listening ? "stop" : "mic"} size={16} className="relative z-10" />
            </button>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={submit}
            disabled={loading || !draft.trim()}
            aria-label="Send Query"
            className="btn-primary h-[38px] w-[38px] shrink-0 rounded-xl p-0 shadow-md"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Icon name="send" size={15} />
            )}
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] muted">
          <span>Press Enter to send · Shift+Enter for newline</span>
          <span className="hidden sm:inline font-mono">⌘K composer</span>
        </div>
      </div>
    </div>
  );
}

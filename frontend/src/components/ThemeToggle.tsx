/**
 * Light / dark / system toggle.
 *
 * Owner: D · Phase: P3
 *
 * One button cycling three states, labelled by icon and by `title`. Kept small and in the
 * header — it is a convenience, not a feature to show off.
 */

import type { ThemeChoice } from "@/hooks/useTheme";

interface Props {
  choice: ThemeChoice;
  onCycle: () => void;
}

const LABEL: Record<ThemeChoice, { icon: string; text: string }> = {
  light: { icon: "☀", text: "Light theme — click for dark" },
  dark: { icon: "☾", text: "Dark theme — click to follow system" },
  system: { icon: "◐", text: "Following system theme — click for light" },
};

export default function ThemeToggle({ choice, onCycle }: Props) {
  const { icon, text } = LABEL[choice];

  return (
    <button
      type="button"
      onClick={onCycle}
      title={text}
      aria-label={text}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-sm text-white/90 transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

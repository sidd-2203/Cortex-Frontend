import { ImagePlus, Wand2, Crop, Film, Wrench, MessageCircleQuestion, type LucideIcon } from "lucide-react";

interface Suggestion {
  icon: LucideIcon;
  label: string;
  prompt: string;
}

// One example per real registered tool/capability, not marketing copy —
// crop_image, merge_videos, and edit_image all need an attached file, so
// those prompts say so rather than pretending to be one-click complete.
const SUGGESTIONS: Suggestion[] = [
  {
    icon: ImagePlus,
    label: "Generate an image",
    prompt: "Generate an image of a cozy reading nook by a rainy window, warm cinematic lighting",
  },
  {
    icon: Wand2,
    label: "Edit an image",
    prompt: 'Attach an image, then ask me to edit it — for example: "make the background transparent"',
  },
  {
    icon: Crop,
    label: "Crop an image",
    prompt: "Attach an image and crop it to a centered square",
  },
  {
    icon: Film,
    label: "Merge videos",
    prompt: "Attach two videos and merge them into one with a fade transition between them",
  },
  {
    icon: Wrench,
    label: "See available tools",
    prompt: "What tools and skills do you have access to?",
  },
  {
    icon: MessageCircleQuestion,
    label: "Just ask something",
    prompt: "Explain how transformer models work, like I'm new to machine learning",
  },
];

export function PromptSuggestions({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
      {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          onClick={() => onSelect(prompt)}
          className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
        >
          <Icon className="size-4 text-brand" />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}

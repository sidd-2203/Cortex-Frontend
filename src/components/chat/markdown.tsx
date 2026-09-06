import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./copy-button";

/** Recursively joins the string leaves of a React tree — used to recover a code block's raw text for copying. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

// Assistant replies come back as markdown (headings, tables, fenced code),
// so they're rendered as markdown rather than dumped as raw text. Styling is
// spelled out per element instead of pulling in a typography plugin, so the
// design tokens stay the single source of truth for color and radius.
const COMPONENTS: Components = {
  p: ({ children }) => <p className="whitespace-pre-wrap leading-relaxed">{children}</p>,
  h1: ({ children }) => <h1 className="mt-2 text-base font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-2 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2 text-sm font-semibold">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="border-border" />,
  // The model routinely narrates a generated asset's URL as a markdown
  // image in its own reply text — but the tool_use/tool_result pair that
  // actually produced it already renders a real preview (see MediaRow in
  // message-list.tsx). Rendering this as a second <img> would just show
  // the same picture twice. A plain link keeps the reference without
  // duplicating the image.
  img: ({ src, alt }) => (
    <a
      href={typeof src === "string" ? src : undefined}
      target="_blank"
      rel="noreferrer"
      className="text-xs underline underline-offset-2"
    >
      {alt || "generated image"}
    </a>
  ),
  code: ({ className, children }) => {
    // react-markdown gives fenced blocks a language class and inline code
    // none — that's the only reliable way to tell them apart here.
    const isBlock = Boolean(className);
    if (isBlock) {
      return <code className={`${className ?? ""} font-mono text-xs`}>{children}</code>;
    }
    return <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  pre: ({ children }) => (
    <div className="group/code relative">
      <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-foreground/5 p-3 pr-9">{children}</pre>
      <CopyButton
        text={textOf(children)}
        className="absolute right-1.5 top-1.5 bg-background/80 opacity-0 transition-opacity group-hover/code:opacity-100"
      />
    </div>
  ),
  // Wide tables scroll inside their own container rather than stretching
  // the message bubble past its max width.
  table: ({ children }) => (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-border px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // If the content is empty, show a cursor block or loading pulses
  if (!content) {
    return <span className="inline-block w-2 h-4 bg-zinc-400 dark:bg-zinc-500 animate-pulse" />;
  }

  // Regex to split content by code fences: ```lang ... ```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 leading-relaxed text-sm tracking-normal break-words font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      {parts.map((part, index) => {
        if (part.startsWith("```")) {
          // It's a code block
          const match = part.match(/```(\w*)\n([\s\S]*?)```/);
          const lang = match ? match[1] : "code";
          const code = match ? match[2].trim() : part.slice(3, -3).trim();

          return (
            <div key={index}>
              <CodeBlock code={code} lang={lang} />
            </div>
          );
        } else {
          // It's normal text with potential inline formatting
          return (
            <div key={index}>
              <TextBlock text={part} />
            </div>
          );
        }
      })}
    </div>
  );
}

interface CodeBlockProps {
  code: string;
  lang: string;
}

function CodeBlock({ code, lang }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="my-4 overflow-hidden border border-zinc-200/60 dark:border-zinc-800/80 rounded-xl bg-zinc-950/95 font-mono text-xs shadow-sm shadow-black/20">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 border-b border-zinc-800/60 text-zinc-400">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 font-sans">
          {lang || "plain text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md transition duration-150 text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95"
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400 animate-in fade-in" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents */}
      <div className="p-4 overflow-x-auto max-h-[420px] scrollbar-thin scrollbar-thumb-zinc-800">
        <pre className="text-zinc-200 leading-relaxed font-mono whitespace-pre text-left">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function TextBlock({ text }: { text: string }) {
  // Simple paragraph lines list
  const lines = text.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();

        // 1. Render Headers
        if (trimmed.startsWith("#")) {
          const depth = (line.match(/^#+/) || ["#"])[0].length;
          const content = line.replace(/^#+\s*/, "");
          const headerClasses =
            depth === 1
              ? "text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-4 mb-2 first:mt-0 font-sans"
              : depth === 2
              ? "text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-3 mb-1 first:mt-0 font-sans"
              : "text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-2 mb-1 first:mt-0 font-sans";
          return React.createElement(`h${Math.min(depth + 1, 6)}`, { key: lIdx, className: headerClasses }, parseInline(content));
        }

        // 2. Render Unordered Lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const listContent = trimmed.replace(/^[-*]\s*/, "");
          return (
            <ul key={lIdx} className="list-disc pl-5 space-y-1 my-1 text-zinc-700 dark:text-zinc-300">
              <li>{parseInline(listContent)}</li>
            </ul>
          );
        }

        // 3. Render Ordered Lists (e.g., 1. item)
        if (/^\d+\.\s+/.test(trimmed)) {
          const orderNum = trimmed.match(/^(\d+)\.\s+/)?.[1] || "1";
          const listContent = trimmed.replace(/^\d+\.\s+/, "");
          return (
            <ol key={lIdx} className="list-decimal pl-5 space-y-1 my-1 text-zinc-700 dark:text-zinc-300">
              <li value={parseInt(orderNum, 10)}>{parseInline(listContent)}</li>
            </ol>
          );
        }

        // 4. Empty line spacing
        if (trimmed === "") {
          return lIdx > 0 ? <div key={lIdx} className="h-2" /> : null;
        }

        // 5. Standard line
        return (
          <p key={lIdx} className="text-zinc-700 dark:text-zinc-300 font-normal leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}

// Inline token parser for bold (**text**), code (`code`)
function parseInline(text: string) {
  if (!text) return "";

  // Split by inline markdown rules (bold, code)
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const tokens = text.split(regex);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded-md font-mono text-[13px] bg-zinc-100 dark:bg-zinc-800 text-rose-500 dark:text-rose-400 font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}

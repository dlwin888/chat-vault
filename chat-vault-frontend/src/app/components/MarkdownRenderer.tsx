"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="prose prose-zinc max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (inline) {
              return (
                <code className="bg-zinc-200 text-red-500 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                  {children}
                </code>
              );
            }

            return match ? (
              <div className="relative my-4 rounded-lg overflow-hidden border border-zinc-700 bg-[#1e1e1e]">
                <div className="flex justify-between items-center px-4 py-2 bg-zinc-800 text-zinc-400 text-xs border-b border-zinc-700">
                  <span>{match[1].toUpperCase()}</span>
                  <button
                    onClick={() => handleCopy(codeString)}
                    className="hover:text-white transition-colors"
                  >
                    {copiedCode === codeString ? "已复制 ✓" : "复制代码"}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: "1rem", background: "transparent" }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <pre className="bg-zinc-800 text-white p-4 rounded-lg overflow-x-auto my-4 text-sm">
                <code>{children}</code>
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
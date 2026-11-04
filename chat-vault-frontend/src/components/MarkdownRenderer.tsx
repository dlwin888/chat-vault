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
    <div className="text-zinc-800 text-sm leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义标题样式
          h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mt-3 mb-2">{children}</h3>,
          // 自定义列表样式
          ul: ({ children }) => <ul className="list-disc pl-6 space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          // 自定义段落和链接
          p: ({ children }) => <p className="mb-3">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {children}
            </a>
          ),
          // 代码块与行内代码
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            // 行内代码
            if (inline) {
              return (
                <code className="bg-zinc-200 text-red-600 px-1.5 py-0.5 rounded text-[13px] font-mono font-semibold" {...props}>
                  {children}
                </code>
              );
            }

            // 多行代码块（带高亮）
            return match ? (
              <div className="relative my-4 rounded-lg overflow-hidden border border-zinc-700 bg-[#1e1e1e] shadow-md">
                <div className="flex justify-between items-center px-4 py-2 bg-zinc-800 text-zinc-400 text-xs border-b border-zinc-700">
                  <span className="font-mono uppercase">{match[1]}</span>
                  <button
                    onClick={() => handleCopy(codeString)}
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    {copiedCode === codeString ? "已复制 ✓" : "复制代码"}
                  </button>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: "1rem", background: "transparent", fontSize: "13px" }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              // 如果没有指定语言，显示普通的黑色代码块
              <pre className="bg-zinc-800 text-zinc-100 p-4 rounded-lg overflow-x-auto my-4 text-[13px] font-mono">
                <code>{codeString}</code>
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
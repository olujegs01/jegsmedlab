"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Bot, Copy, Check, MessageCircle } from "lucide-react";
import { useState } from "react";
import clsx from "clsx";

interface AIResponseProps {
  text: string;
  isStreaming: boolean;
  title?: string;
  reportId?: string | null;
}

export default function AIResponse({ text, isStreaming, title, reportId }: AIResponseProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-full flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {title || "AI Analysis"}
            </p>
            <p className="text-xs text-slate-400">Claude Opus 4.6 · RAG-Enhanced</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Analyzing...
            </div>
          )}
          {text && !isStreaming && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 max-h-[600px]">
        {text ? (
          <div className="ai-response prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h2 className="text-xl font-bold text-slate-900 mt-6 mb-3 first:mt-0">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h3 className="text-lg font-bold text-slate-900 mt-5 mb-2.5 border-b border-slate-100 pb-1.5">
                    {children}
                  </h3>
                ),
                h3: ({ children }) => (
                  <h4 className="text-base font-semibold text-slate-800 mt-4 mb-2">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="text-slate-700 leading-relaxed mb-3 text-sm">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-none space-y-1.5 mb-3">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-slate-900">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-300 bg-blue-50 pl-4 py-2 pr-3 rounded-r-lg my-3 text-sm text-slate-700 italic">
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="w-full text-sm border-collapse">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-slate-50 border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 text-xs">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-slate-100 px-3 py-2 text-slate-700 text-xs">
                    {children}
                  </td>
                ),
                hr: () => <hr className="border-slate-200 my-4" />,
              }}
            >
              {text}
            </ReactMarkdown>

            {/* Streaming cursor */}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-500 rounded-sm animate-pulse ml-0.5" />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full dot-bounce" />
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full dot-bounce" />
              <div className="w-2.5 h-2.5 bg-blue-600 rounded-full dot-bounce" />
            </div>
            <p className="text-sm text-slate-400">AI is analyzing your report...</p>
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      {!isStreaming && text && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-400 text-center">
            ⚠️ This analysis is for educational purposes only. Always consult a qualified
            healthcare provider for medical decisions.
          </p>
        </div>
      )}
    </div>
  );
}

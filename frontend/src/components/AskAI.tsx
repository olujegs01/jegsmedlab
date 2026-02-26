"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle, Send, Bot, User, Loader2,
  Lightbulb, FlaskConical
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface AskAIProps {
  reportId: string | null;
  patientId?: string;
}

const SUGGESTED_QUESTIONS = [
  "What does a high LDL cholesterol mean for my heart health?",
  "What lifestyle changes can lower my blood sugar?",
  "Why is TSH the first thyroid test done?",
  "What are signs that my kidneys may be struggling?",
  "How often should I get my cholesterol checked?",
  "What does low vitamin D affect in the body?",
  "What causes iron deficiency anemia?",
  "How do I interpret my HbA1c result?",
];

export default function AskAI({ reportId, patientId = "demo-patient" }: AskAIProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (question?: string) => {
    const userInput = question || input.trim();
    if (!userInput || loading) return;

    setInput("");
    setLoading(true);

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userInput },
      { role: "assistant", content: "", isStreaming: true },
    ];
    setMessages(newMessages);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          report_id: reportId,
          patient_id: patientId,
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text") {
              aiText += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: aiText,
                  isStreaming: true,
                };
                return updated;
              });
            } else if (data.type === "done") {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: aiText,
                  isStreaming: false,
                };
                return updated;
              });
            }
          } catch (_) {}
        }
      }
    } catch (_) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-emerald-600" />
          Ask AI
        </h1>
        <p className="text-slate-500 mt-1">
          Ask any medical question about your lab results or health in general.
          {reportId && (
            <span className="text-emerald-600 font-medium"> · Contextual with your latest report.</span>
          )}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <div className="space-y-6">
              {/* Welcome */}
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">JegsMedLab Assistant</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Ask me anything about your lab results, symptoms, or health topics.
                    I use medical knowledge and{" "}
                    {reportId ? "your latest report " : ""}
                    to give you personalized answers.
                  </p>
                </div>
              </div>

              {/* Suggested questions */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-semibold text-slate-700">Suggested Questions</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left text-sm text-slate-600 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl px-4 py-3 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={clsx(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    msg.role === "user"
                      ? "bg-blue-600"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={clsx(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none"
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="text-sm ai-response prose prose-sm max-w-none">
                      {msg.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                          <span className="text-slate-400 text-xs">Thinking...</span>
                        </div>
                      )}
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-1.5 h-4 bg-emerald-400 rounded-sm animate-pulse ml-0.5" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your lab results, symptoms, or any health question..."
                className="w-full bg-transparent text-sm text-slate-700 px-4 py-3 resize-none focus:outline-none placeholder-slate-400 min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={loading}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all shadow-sm",
                !input.trim() || loading
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md"
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

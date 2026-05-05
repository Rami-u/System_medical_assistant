import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import {
  Activity, LayoutDashboard, Droplets, Utensils, Settings,
  LogOut, Menu, X, Send, Square, Copy, Check,
  RotateCcw, Plus, Sparkles, ChevronRight, MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  timestamp: Date;
}

interface Conversation {
  id: number;
  title: string;
  preview: string;
  date: string;
  messages: Message[];
}

import { chatApi } from "../../api/chatApi";

// ─── AI Response Library (Removed mock) ──────────────────────────────────────────────────────


// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  {
    icon: "💉",
    title: "Explain my fasting glucose",
    subtitle: "112 mg/dL this morning",
    prompt: "My fasting glucose reading was 112 mg/dL this morning. What does this mean and what should I do?",
  },
  {
    icon: "🍽️",
    title: "Create a meal plan",
    subtitle: "Tailored to my condition",
    prompt: "Can you create a personalized meal plan for managing my Type 2 diabetes?",
  },
  {
    icon: "💊",
    title: "About my Metformin",
    subtitle: "1000mg twice daily",
    prompt: "Can you explain how Metformin works and what side effects I should watch for?",
  },
  {
    icon: "🏃",
    title: "Exercise guidance",
    subtitle: "Safe workouts for diabetics",
    prompt: "What type of exercise is best for managing Type 2 diabetes and how does it affect blood sugar?",
  },
  {
    icon: "📊",
    title: "My HbA1c explained",
    subtitle: "Lab test due in 5 days",
    prompt: "Can you explain what HbA1c measures and what I should aim for?",
  },
  {
    icon: "⚠️",
    title: "Complication prevention",
    subtitle: "Long-term diabetes care",
    prompt: "What are the main diabetes complications I should watch for and how can I prevent them?",
  },
];

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text: string): JSX.Element {
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H2
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="text-slate-900 mt-5 mb-2 first:mt-0" style={{ fontWeight: 700, fontSize: "1rem" }}>
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="text-slate-800 mt-4 mb-1.5" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }

    // Table
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!lines[i].match(/^\|[-| ]+\|$/)) tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.map(l =>
        l.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim())
      );
      elements.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {rows[0]?.map((cell, ci) => (
                  <th key={ci} className="text-left px-3 py-2 bg-slate-100 border border-slate-200 text-slate-700" style={{ fontWeight: 600 }}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 border border-slate-200 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="space-y-1 my-2 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2 text-slate-700 text-sm leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="space-y-1.5 my-2 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex items-start gap-3 text-slate-700 text-sm leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5" style={{ fontWeight: 700 }}>
                {ii + 1}
              </span>
              <span>{inlineMarkdown(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={key++} className="border-l-2 border-blue-400 pl-3 py-1 my-3 bg-blue-50/60 rounded-r-lg">
          <p className="text-blue-800 text-sm leading-relaxed italic">{inlineMarkdown(line.slice(2))}</p>
        </blockquote>
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={key++} className="text-slate-700 text-sm leading-relaxed">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

function inlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  let match;
  let idx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[1]) parts.push(<strong key={idx++} style={{ fontWeight: 700 }} className="text-slate-900">{match[1]}</strong>);
    else if (match[2]) parts.push(<em key={idx++} className="italic">{match[2]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, onCopy }: { msg: Message; onCopy: (text: string) => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[75%]">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
            {msg.content}
          </div>
          <p className="text-right text-xs text-slate-400 mt-1.5 pr-1">
            {msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-6 group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-900 text-xs" style={{ fontWeight: 700 }}>DiaCheck AI</span>
          <span className="text-slate-300 text-xs">·</span>
          <span className="text-slate-400 text-xs">
            {msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
          {msg.streaming && (
            <span className="flex items-center gap-1 text-blue-500 text-xs">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              generating…
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-5 py-4">
          {msg.streaming
            ? <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}<span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-text-bottom" /></p>
            : renderMarkdown(msg.content)
          }
        </div>

        {/* Actions */}
        {!msg.streaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Thinking Indicator ───────────────────────────────────────────────────────
function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm px-5 py-4 mt-0.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-slate-400 text-xs">DiaCheck AI is analyzing your question…</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [abortStream, setAbortStream] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef(false);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const sidebarNav = [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dashboard/patient",           active: false },
    { icon: Droplets,        label: "Glucose Logs", path: "/dashboard/patient/glucose",   active: false },
    { icon: Utensils,        label: "Meal Logs",    path: "/dashboard/patient/meals",     active: false },
    { icon: Sparkles,        label: "AI Assistant", path: "/dashboard/patient/ai-chat",   active: true  },
    { icon: Settings,        label: "Settings",     path: "/dashboard/patient/settings",  active: false },
  ];

  const [conversationsList, setConversationsList] = useState<any[]>([]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatApi.getConversations();
      setConversationsList(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  const selectConversation = async (id: number) => {
    setActiveConvId(id);
    setMessages([]);
    setThinking(true);
    setSidebarOpen(false);
    try {
      const data = await chatApi.getConversationDetail(id);
      const mapped: Message[] = data.messages.map((m: any) => ({
        id: m.id,
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.message_text,
        timestamp: new Date(m.created_at),
      }));
      setMessages(mapped);
    } catch (err) {
      console.error("Failed to load conversation details", err);
    } finally {
      setThinking(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  const streamResponse = useCallback((fullText: string, msgId: number) => {
    streamRef.current = false;
    const words = fullText.split(" ");
    let idx = 0;

    const tick = () => {
      if (streamRef.current) {
        // aborted — set full text immediately
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText, streaming: false } : m));
        setStreaming(false);
        return;
      }
      idx += 2; // reveal 2 words at a time for speed
      if (idx > words.length) idx = words.length;
      setMessages(prev =>
        prev.map(m => m.id === msgId
          ? { ...m, content: words.slice(0, idx).join(" "), streaming: idx < words.length }
          : m
        )
      );
      if (idx < words.length) {
        setTimeout(tick, 18);
      } else {
        setStreaming(false);
      }
    };
    setTimeout(tick, 18);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking || streaming) return;
    const userMsg: Message = { id: Date.now(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setThinking(true);

    try {
      let convId = activeConvId;
      if (!convId) {
        const newConv = await chatApi.startConversation(text.substring(0, 40));
        convId = newConv.id;
        setActiveConvId(convId);
        loadConversations();
      }

      const res = await chatApi.sendMessage(convId!, text);
      const aiResponse = res[res.length - 1]; // The latest message from AI

      setThinking(false);

      const assistantMsg: Message = {
        id: aiResponse.id,
        role: "assistant",
        content: "",
        streaming: true,
        timestamp: new Date(aiResponse.created_at),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreaming(true);
      streamRef.current = false;
      streamResponse(aiResponse.message_text, assistantMsg.id);
    } catch (err) {
      console.error(err);
      setThinking(false);
      alert("Failed to send message.");
    }
  }, [thinking, streaming, messages, streamResponse, activeConvId, loadConversations]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStop = () => {
    streamRef.current = true;
  };

  const handleNewChat = () => {
    streamRef.current = true;
    setMessages([]);
    setInput("");
    setThinking(false);
    setStreaming(false);
    setActiveConvId(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── App Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-teal-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-slate-800" style={{ fontWeight: 700, fontSize: "1rem" }}>
              Dia<span className="text-blue-600">Check</span>
            </span>
          </Link>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm" style={{ fontWeight: 700 }}>
              {user?.name?.charAt(0) ?? "P"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name ?? "Patient"}</p>
              <p className="text-slate-400 text-xs">Patient</p>
            </div>
          </div>
        </div>

        <nav className="px-3 py-3 space-y-0.5">
          {sidebarNav.map(({ icon: Icon, label, path, active }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

        {/* Past Conversations */}
        <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-slate-50">
          <p className="text-slate-400 text-xs px-3 py-2" style={{ fontWeight: 600 }}>RECENT CHATS</p>
          <div className="space-y-0.5">
            {conversationsList.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors group ${activeConvId === conv.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 text-xs truncate" style={{ fontWeight: 500 }}>{conv.title || "New Conversation"}</p>
                    <p className="text-slate-400 text-xs truncate">{new Date(conv.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>
            ))}
            {conversationsList.length === 0 && (
              <p className="text-slate-400 text-xs px-3 py-2">No history yet.</p>
            )}
          </div>
        </div>

        <div className="px-3 py-4 border-t border-slate-100">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Chat Area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <span className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>DiaCheck AI</span>
                <span className="ml-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>Health Model</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl transition-colors bg-white hover:bg-slate-50"
            style={{ fontWeight: 500 }}
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            /* ── Empty State ── */
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-slate-900 mb-2 text-center" style={{ fontWeight: 800, fontSize: "1.5rem" }}>
                What can I help you with?
              </h2>
              <p className="text-slate-500 text-sm text-center max-w-md mb-10 leading-relaxed">
                I'm your personalized AI health assistant. I have access to your health profile and can provide
                evidence-based guidance on diabetes management, nutrition, medications, and more.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => sendMessage(p.prompt)}
                    className="group text-left bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl p-4 transition-all hover:shadow-md hover:shadow-blue-100/50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5">{p.icon}</span>
                      <div>
                        <p className="text-slate-900 text-sm group-hover:text-blue-700 transition-colors" style={{ fontWeight: 600 }}>{p.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">{p.subtitle}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 mt-2 ml-auto transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message Thread ── */
            <div className="max-w-3xl mx-auto px-5 py-8">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onCopy={handleCopy} />
              ))}
              {thinking && <ThinkingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-100 px-4 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your glucose levels, diet, medications, symptoms…"
                rows={1}
                disabled={thinking}
                className="flex-1 text-sm text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: "24px", maxHeight: "160px" }}
              />
              <div className="flex items-center gap-2 flex-shrink-0 pb-0.5">
                {streaming ? (
                  <button
                    onClick={handleStop}
                    className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
                    title="Stop generating"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || thinking}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      input.trim() && !thinking
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2.5">
              DiaCheck AI provides health information, not medical advice. Always consult your doctor for clinical decisions. <span className="text-slate-300">·</span> Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500" style={{ fontFamily: "monospace" }}>Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500" style={{ fontFamily: "monospace" }}>Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

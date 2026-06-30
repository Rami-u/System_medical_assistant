import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link, useLocation } from "react-router";
import {
  Activity, LayoutDashboard, LogOut, Menu, X,
  Users, Sparkles, MessageSquare, Search, ChevronRight,
  Clock, AlertTriangle, RefreshCw, Eye, MessageCircle,
  User as UserIcon, Bot, Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { doctorApi } from "../../api/doctorApi";
import { chatApi } from "../../api/chatApi";

function isRTL(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicPattern.test(text);
}

interface PatientConversation {
  id: number;
  title: string;
  created_at: string;
  message_count: number;
  deleted_by_patient?: boolean;
  deleted_at?: string | null;
  messages: Array<{
    id: number;
    sender: string;
    message_text: string;
    created_at: string;
  }>;
}

interface PatientInfo {
  id: number;
  name: string;
}

const sidebarNav = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard/doctor" },
  { icon: Users, label: "Patients", path: "/dashboard/doctor/patients" },
  { icon: Sparkles, label: "AI Chat", path: "/dashboard/doctor/ai-chat" },
];

export default function DoctorAIAssistantPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [conversations, setConversations] = useState<PatientConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedConv, setSelectedConv] = useState<PatientConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  // Auto-scroll to bottom when conversation changes
  useEffect(() => {
    if (selectedConv && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConv]);

  // Auto-refresh conversations every 30 seconds when a patient is selected
  useEffect(() => {
    if (!selectedPatient) return;
    const interval = setInterval(() => {
      refreshConversations(selectedPatient, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPatient]);

  const loadPatients = async () => {
    setLoadingPatients(true);
    try {
      const data = await doctorApi.getPatients();
      // Response is { patients: [...] } with patient_id and full_name fields
      const patientList = (data.patients || data || []);
      setPatients(patientList.map((p: any) => ({
        id: p.patient_id ?? p.id,
        name: p.full_name || p.name || `Patient #${p.patient_id ?? p.id}`,
      })));
    } catch (err) {
      console.error("Failed to load patients", err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const loadConversations = async (patientId: number) => {
    setLoading(true);
    setSelectedPatient(patientId);
    setSelectedConv(null);
    // Find and set the patient name
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatientName(patient?.name || `Patient #${patientId}`);
    try {
      const data = await chatApi.getPatientConversations(patientId);
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations", err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshConversations = useCallback(async (patientId: number, silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await chatApi.getPatientConversations(patientId);
      setConversations(data);
      // If selected conversation was deleted, clear it
      if (selectedConv && !data.find((c: PatientConversation) => c.id === selectedConv.id)) {
        setSelectedConv(null);
      }
      // If selected conversation still exists, update its messages
      if (selectedConv) {
        const updated = data.find((c: PatientConversation) => c.id === selectedConv.id);
        if (updated) setSelectedConv(updated);
      }
    } catch (err) {
      console.error("Failed to refresh conversations", err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [selectedConv]);

  const handleSignOut = () => { signOut(); navigate("/"); };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-screen bg-[#F7F8FC] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
              {user?.name?.charAt(0) ?? "D"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-sm truncate" style={{ fontWeight: 600 }}>{user?.name ?? "Doctor"}</p>
              <p className="text-slate-400 text-xs">Physician</p>
            </div>
          </div>
        </div>

        <nav className="px-3 py-3 space-y-0.5">
          {sidebarNav.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path;
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                style={{ fontWeight: active ? 600 : 400 }}
              >
                <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
                <span className="flex-1 text-left">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-slate-100">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
            <LogOut className="w-4 h-4" strokeWidth={1.8} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
                <span className="text-slate-900 text-sm" style={{ fontWeight: 700 }}>Patient AI Conversations</span>
                <span className="ml-2 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>Read-Only</span>
              </div>
            </div>
          </div>
          {selectedPatient && (
            <button
              onClick={() => refreshConversations(selectedPatient)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Refresh conversations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Patient list */}
          <div className="w-64 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 text-xs text-slate-700 bg-transparent focus:outline-none placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingPatients && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loadingPatients && filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadConversations(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${
                    selectedPatient === p.id
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: selectedPatient === p.id ? 600 : 400 }}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      selectedPatient === p.id
                        ? "bg-blue-600 text-white"
                        : "bg-blue-100 text-blue-600"
                    }`} style={{ fontWeight: 700 }}>
                      {p.name.charAt(0)}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </div>
                </button>
              ))}
              {!loadingPatients && filteredPatients.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No patients found</p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="w-80 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>
                  {selectedPatient ? (
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {selectedPatientName}'s Conversations
                    </span>
                  ) : "Select a patient"}
                </p>
                {conversations.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>
                    {conversations.length}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loading && conversations.map((conv) => {
                const lastMsg = conv.messages?.[conv.messages.length - 1];
                const isDeleted = conv.deleted_by_patient;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                      selectedConv?.id === conv.id
                        ? "bg-blue-50 shadow-sm border border-blue-100"
                        : isDeleted
                          ? "hover:bg-red-50/50 border border-red-100/60 bg-red-50/30"
                          : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isDeleted ? (
                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
                      ) : (
                        <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                          selectedConv?.id === conv.id ? "text-blue-600" : "text-slate-400"
                        }`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${
                            isDeleted
                              ? "text-red-600"
                              : selectedConv?.id === conv.id ? "text-blue-700" : "text-slate-700"
                          }`} style={{ fontWeight: 500 }}>
                            {conv.title || "Conversation"}
                          </p>
                          {isDeleted && (
                            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ fontWeight: 600, fontSize: '0.65rem' }}>
                              Deleted
                            </span>
                          )}
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {lastMsg.sender === "ai" ? "AI: " : "Patient: "}
                            {lastMsg.message_text.substring(0, 60)}…
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">{formatDate(conv.created_at)}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{conv.message_count} messages</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 mt-1 ${
                        selectedConv?.id === conv.id ? "text-blue-400" : "text-slate-300"
                      }`} />
                    </div>
                  </button>
                );
              })}
              {!loading && selectedPatient && conversations.length === 0 && (
                <div className="text-center py-10">
                  <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400" style={{ fontWeight: 500 }}>No conversations yet</p>
                  <p className="text-xs text-slate-300 mt-1">This patient hasn't started any AI chats</p>
                </div>
              )}
            </div>
          </div>

          {/* Message view */}
          <div className="flex-1 overflow-y-auto bg-[#F7F8FC]">
            {selectedConv ? (
              <div className="max-w-4xl mx-auto px-5 py-6">
                {/* Conversation header */}
                <div className={`mb-6 rounded-2xl border shadow-sm p-4 ${selectedConv.deleted_by_patient ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                  {selectedConv.deleted_by_patient && (
                    <div className="flex items-start gap-3 mb-3 bg-red-100 border border-red-200 rounded-xl px-4 py-3">
                      <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-red-800" style={{ fontWeight: 700 }}>Deleted by Patient</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          The patient removed this conversation from their view{selectedConv.deleted_at ? ` on ${new Date(selectedConv.deleted_at).toLocaleString()}` : ''}. It remains accessible to you for clinical review.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>
                        {selectedConv.title || "Conversation"}
                      </h2>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(selectedConv.created_at).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {selectedConv.messages.length} messages
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-xs" style={{ fontWeight: 600 }}>Viewing</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-4">
                  {selectedConv.messages.map((msg) => {
                    const rtl = isRTL(msg.message_text);
                    const isUser = msg.sender === "user";
                    return (
                      <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                          {/* Avatar */}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isUser
                              ? "bg-slate-600"
                              : "bg-gradient-to-br from-blue-500 to-indigo-600"
                          }`}>
                            {isUser ? (
                              <UserIcon className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Bot className="w-3.5 h-3.5 text-white" />
                            )}
                          </div>

                          {/* Bubble */}
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            isUser
                              ? "bg-slate-700 text-white rounded-tr-sm"
                              : "bg-white border border-slate-100 shadow-sm rounded-tl-sm"
                          }`}>
                            {!isUser && (
                              <p className="text-xs text-blue-500 mb-1.5 flex items-center gap-1" style={{ fontWeight: 600 }}>
                                <Sparkles className="w-3 h-3" />
                                DiaCheck AI
                              </p>
                            )}
                            {isUser && (
                              <p className="text-xs text-slate-300 mb-1" style={{ fontWeight: 600 }}>Patient</p>
                            )}
                            <p
                              className={`${isUser ? "text-white" : "text-slate-700"} whitespace-pre-wrap ${rtl ? "text-right" : ""}`}
                              dir={rtl ? "rtl" : "ltr"}
                            >
                              {msg.message_text}
                            </p>
                            <p className={`text-xs mt-1.5 ${
                              isUser ? "text-slate-400" : "text-slate-400"
                            } ${rtl ? "text-left" : "text-right"}`}>
                              {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Read-only footer notice */}
                <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Read-Only View</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      You are viewing this patient's AI conversation history. Doctors cannot send messages in patient chats.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-4">
                  <MessageSquare className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-sm" style={{ fontWeight: 500 }}>
                  {selectedPatient ? "Select a conversation to view" : "Select a patient to get started"}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {selectedPatient
                    ? "Choose a conversation from the list to view its messages"
                    : "Pick a patient from the sidebar to see their AI chat history"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

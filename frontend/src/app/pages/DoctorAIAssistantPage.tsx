import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import {
  Activity, LayoutDashboard, LogOut, Menu, X,
  Users, Sparkles, MessageSquare, Search, ChevronRight,
  Clock, AlertTriangle,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [conversations, setConversations] = useState<PatientConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConv, setSelectedConv] = useState<PatientConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await doctorApi.getPatients();
      setPatients(data.map((p: any) => ({ id: p.id, name: p.name || p.full_name || `Patient #${p.id}` })));
    } catch (err) {
      console.error("Failed to load patients", err);
    }
  };

  const loadConversations = async (patientId: number) => {
    setLoading(true);
    setSelectedPatient(patientId);
    setSelectedConv(null);
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

  const handleSignOut = () => { signOut(); navigate("/"); };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          {sidebarNav.map(({ icon: Icon, label, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                path === "/dashboard/doctor/ai-chat"
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              style={{ fontWeight: path === "/dashboard/doctor/ai-chat" ? 600 : 400 }}
            >
              <Icon className={`w-4 h-4 ${path === "/dashboard/doctor/ai-chat" ? "text-blue-600" : "text-slate-400"}`} strokeWidth={1.8} />
              <span className="flex-1 text-left">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100">
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
                <span className="ml-2 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>Doctor View</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Patient list */}
          <div className="w-64 bg-white border-r border-slate-100 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-slate-400" />
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
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadConversations(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    selectedPatient === p.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: selectedPatient === p.id ? 600 : 400 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs" style={{ fontWeight: 700 }}>
                      {p.name.charAt(0)}
                    </div>
                    <span className="truncate">{p.name}</span>
                  </div>
                </button>
              ))}
              {filteredPatients.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No patients found</p>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div className="w-80 bg-white border-r border-slate-100 flex flex-col">
            <div className="p-3 border-b border-slate-100">
              <p className="text-xs text-slate-500" style={{ fontWeight: 600 }}>
                {selectedPatient ? "Patient Conversations" : "Select a patient"}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loading && conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-colors ${
                    selectedConv?.id === conv.id ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 500 }}>{conv.title || "Conversation"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{new Date(conv.created_at).toLocaleDateString()}</span>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">{conv.message_count} messages</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
              {!loading && selectedPatient && conversations.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No conversations yet</p>
              )}
            </div>
          </div>

          {/* Message view */}
          <div className="flex-1 overflow-y-auto bg-[#F7F8FC]">
            {selectedConv ? (
              <div className="max-w-3xl mx-auto px-5 py-6">
                <div className="mb-6">
                  <h2 className="text-lg text-slate-900" style={{ fontWeight: 700 }}>{selectedConv.title || "Conversation"}</h2>
                  <p className="text-xs text-slate-400">{new Date(selectedConv.created_at).toLocaleString()}</p>
                </div>
                <div className="space-y-4">
                  {selectedConv.messages.map((msg) => {
                    const rtl = isRTL(msg.message_text);
                    return (
                      <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-white border border-slate-100 shadow-sm rounded-tl-sm"
                        }`}>
                          {msg.sender === "ai" && (
                            <p className="text-xs text-slate-400 mb-1" style={{ fontWeight: 600 }}>DiaCheck AI</p>
                          )}
                          <p className={`${msg.sender === "user" ? "text-white" : "text-slate-700"} ${rtl ? "text-right" : ""}`} dir={rtl ? "rtl" : "ltr"}>{msg.message_text}</p>
                          <p className={`text-xs mt-1.5 ${
                            msg.sender === "user" ? "text-blue-200" : "text-slate-400"
                          } ${rtl ? "text-left" : "text-right"}`}>
                            {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <MessageSquare className="w-12 h-12 mb-3 text-slate-200" />
                <p className="text-sm">Select a conversation to view</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

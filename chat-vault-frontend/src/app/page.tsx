"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const API_BASE = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8001";

interface Message {
  id?: number;
  role: string;
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [latestAiMsgId, setLatestAiMsgId] = useState<number | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAuthError = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedName = localStorage.getItem("username");
    if (!savedToken) {
      router.push("/login");
    } else {
      setToken(savedToken);
      setUsername(savedName || "User");
      fetchConversations(savedToken);
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchConversations = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConversations(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadConversation = async (convId: number) => {
    if (!token || loading) return;
    setCurrentConvId(convId);
    setIsSidebarOpen(false);
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleAuthError();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMessages(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 👇 新增：重命名会话
  const handleRename = async (e: React.MouseEvent, convId: number, oldTitle: string) => {
    e.stopPropagation(); // 阻止触发外层会话点击事件
    const newTitle = window.prompt("请输入新的会话名称", oldTitle);
    if (!newTitle || newTitle.trim() === oldTitle) return;

    try {
      const res = await fetch(`${API_BASE}/api/conversations/${convId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: newTitle } : c))
        );
      }
    } catch (err) {
      alert("重命名失败");
    }
  };

  // 👇 新增：删除会话
  const handleDeleteConv = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除这个会话及所有聊天记录吗？此操作不可恢复。")) return;

    try {
      const res = await fetch(`${API_BASE}/api/conversations/${convId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        // 如果删除的是当前正在看的会话，清空聊天区
        if (currentConvId === convId) {
          setCurrentConvId(null);
          setMessages([]);
        }
        // 从侧边栏列表中移除
        setConversations((prev) => prev.filter((c) => c.id !== convId));
      } else {
        alert("删除失败");
      }
    } catch (err) {
      alert("网络错误");
    }
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
    setLatestAiMsgId(null);
    setIsSidebarOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;

    const userMsg = input;
    setInput("");
    setLatestAiMsgId(null);
    
    const newMessages = [...messages, { role: "user", content: userMsg }, { role: "ai", content: "" }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg, conversation_id: currentConvId }),
      });

      if (response.status === 401) {
        handleAuthError();
        return;
      }
      if (!response.ok) throw new Error("请求失败");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      let newConvId = currentConvId;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          aiText += text;

          const displayText = aiText.split("\n\n__MSG_ID__")[0];
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "ai", content: displayText };
            return updated;
          });
        }

        const idMatch = aiText.match(/__MSG_ID__:(\d+)__CONV_ID__:(\d+)/);
        if (idMatch) {
          const msgId = parseInt(idMatch[1]);
          newConvId = parseInt(idMatch[2]);
          setLatestAiMsgId(msgId);
          if (!currentConvId) {
            setCurrentConvId(newConvId);
            fetchConversations(token);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", content: "⚠️ 网络异常或登录已过期。" };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async (msgIndex: number) => {
    if (!token) return;
    const aiMessage = messages[msgIndex];
    const userMessage = messages[msgIndex - 1];
    const messageId = aiMessage.id || latestAiMsgId;
    if (!messageId) return;

    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: messageId, question: userMessage.content, answer: aiMessage.content }),
      });
      if (res.ok) alert("⭐ 收藏成功！");
    } catch (err) {
      alert("网络错误");
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-white relative overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* 👈 左侧会话侧边栏 */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-[260px] bg-zinc-50 border-r border-zinc-200 flex flex-col transition-transform duration-300 ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="p-4">
          <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 shadow-sm font-medium text-sm text-zinc-800">
            <span>➕</span> 新建对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {conversations.map((conv) => (
            // 👇 修改了这里，加上了 group 和菜单按钮
            <div
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                currentConvId === conv.id ? "bg-zinc-200/60 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-200/30"
              }`}
            >
              <span className="truncate flex-1 mr-2">💬 {conv.title || "未命名对话"}</span>
              
              {/* 悬浮菜单按钮 */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleRename(e, conv.id, conv.title)}
                  className="p-1 hover:text-blue-600 hover:bg-white rounded"
                  title="重命名"
                >
                  ✏️
                </button>
                <button 
                  onClick={(e) => handleDeleteConv(e, conv.id)}
                  className="p-1 hover:text-red-600 hover:bg-white rounded"
                  title="删除"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 space-y-2">
          <Link href="/favorites" className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-200/50 rounded-lg text-sm transition-colors">
            <span>⭐</span> 我的收藏
          </Link>
          <button onClick={handleAuthError} className="w-full flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm transition-colors">
            <span>🚪</span> 退出登录 ({username})
          </button>
        </div>
      </div>

      {/* 👉 右侧主聊天区 */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-100 bg-white">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <span className="font-bold text-zinc-800">ChatVault</span>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">✨</div>
              <p className="text-lg font-medium text-zinc-600">有什么我可以帮你的吗？</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl ${
                msg.role === "user" ? "bg-zinc-900 text-white rounded-br-sm" : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
              }`}>
                {msg.role === "ai" ? <MarkdownRenderer content={msg.content} /> : <p className="whitespace-pre-wrap">{msg.content}</p>}
                {msg.role === "ai" && msg.content && !loading && (
                  <button onClick={() => handleFavorite(idx)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-yellow-600 bg-white/50 hover:bg-white px-3 py-1.5 rounded-lg">
                    ⭐ 收藏此回答
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 p-4 rounded-2xl rounded-bl-sm flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-zinc-100">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="w-full bg-zinc-100 border-none rounded-2xl pl-6 pr-16 py-4 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all placeholder-zinc-500"
              placeholder={currentConvId ? "继续对话..." : "给 AI 发送新消息..."}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="absolute right-2 w-10 h-10 flex items-center justify-center bg-zinc-900 text-white rounded-xl disabled:opacity-30">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
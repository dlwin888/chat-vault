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
  
  // 会话状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  
  // 记录刚刚生成的 AI 消息 ID（用于流式输出后的收藏）
  const [latestAiMsgId, setLatestAiMsgId] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初始化：校验登录，拉取会话列表
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

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 拉取左侧侧边栏会话列表
  const fetchConversations = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/conversations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 点击历史会话，加载聊天记录
  const loadConversation = async (convId: number) => {
    if (!token || loading) return;
    setCurrentConvId(convId);
    setLoading(true);
    
    try {
      const res = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.items || []);
      }
    } catch (err) {
      console.error("加载历史消息失败", err);
    } finally {
      setLoading(false);
    }
  };

  // 新建对话
  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
    setLatestAiMsgId(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  // 发送消息核心逻辑
  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;

    const userMsg = input;
    setInput("");
    setLatestAiMsgId(null);
    
    // 乐观更新 UI
    const newMessages = [...messages, { role: "user", content: userMsg }, { role: "ai", content: "" }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          message: userMsg,
          conversation_id: currentConvId
        }),
      });

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

          // 实时更新界面：过滤掉后端的特殊标记
          const displayText = aiText.split("\n\n__MSG_ID__")[0];
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "ai", content: displayText };
            return updated;
          });
        }

        // 流输出完毕，解析特殊标记，提取消息 ID 和会话 ID
        const idMatch = aiText.match(/__MSG_ID__:(\d+)__CONV_ID__:(\d+)/);
        if (idMatch) {
          const msgId = parseInt(idMatch[1]);
          newConvId = parseInt(idMatch[2]);
          setLatestAiMsgId(msgId);
          
          if (!currentConvId) {
            setCurrentConvId(newConvId);
            fetchConversations(token); // 如果是新对话，刷新侧边栏列表
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", content: "⚠️ 网络异常，请稍后重试。" };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  // 收藏消息
  const handleFavorite = async (msgIndex: number) => {
    if (!token) return;
    const aiMessage = messages[msgIndex];
    const userMessage = messages[msgIndex - 1];

    // 判断是否有 ID（如果是刚生成的，用 latestAiMsgId；如果是历史的，用 aiMessage.id）
    const messageId = aiMessage.id || latestAiMsgId;
    if (!messageId) {
      alert("⚠️ 这条消息还在生成中，或者系统未分配 ID，无法收藏。");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          message_id: messageId,
          question: userMessage.content,
          answer: aiMessage.content
        }),
      });
      
      if (res.ok) {
        alert("⭐ 收藏成功！");
      } else {
        alert("收藏失败");
      }
    } catch (err) {
      alert("网络错误");
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-white">
      {/* 👈 左侧会话侧边栏 */}
      <div className="w-[260px] bg-zinc-50 border-r border-zinc-200 flex flex-col hidden md:flex">
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors shadow-sm font-medium text-sm text-zinc-800"
          >
            <span>➕</span> 新建对话
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm truncate transition-colors ${
                currentConvId === conv.id 
                  ? "bg-zinc-200/60 font-medium text-zinc-900" 
                  : "text-zinc-600 hover:bg-zinc-200/30"
              }`}
            >
              💬 {conv.title || "未命名对话"}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 space-y-2">
          <Link href="/favorites" className="flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-zinc-200/50 rounded-lg text-sm transition-colors">
            <span>⭐</span> 我的收藏
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-zinc-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm transition-colors">
            <span>🚪</span> 退出登录 ({username})
          </button>
        </div>
      </div>

      {/* 👉 右侧主聊天区 */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">✨</div>
              <p className="text-lg font-medium text-zinc-600">有什么我可以帮你的吗？</p>
              <p className="text-sm mt-1">开始你的第一段对话吧。</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-zinc-900 text-white rounded-br-sm" 
                  : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
              }`}>
                {msg.role === "ai" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
                
                {/* 收藏按钮：只有在 AI 消息生成完毕且不处于 loading 状态时才显示 */}
                {msg.role === "ai" && msg.content && !loading && (
                  <button 
                    onClick={() => handleFavorite(idx)} 
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-yellow-600 bg-white/50 hover:bg-white px-3 py-1.5 rounded-lg transition-all"
                  >
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

        {/* 底部输入区 */}
        <div className="p-4 md:p-6 bg-white border-t border-zinc-100">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="w-full bg-zinc-100 border-none rounded-2xl pl-6 pr-16 py-4 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all placeholder-zinc-500"
              placeholder={currentConvId ? "继续当前对话..." : "给 AI 发送新消息..."}
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()} 
              className="absolute right-2 w-10 h-10 flex items-center justify-center bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-30 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
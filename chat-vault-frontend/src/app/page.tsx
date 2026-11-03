"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8001";

export default function ChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedName = localStorage.getItem("username");
    if (!savedToken) {
      router.push("/login");
    } else {
      setToken(savedToken);
      setUsername(savedName || "User");
    }
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    router.push("/login");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !token) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });

      if (!response.body) throw new Error("No body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        aiText += text;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: "ai", content: aiText };
          return newMessages;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async (index: number) => {
    if (!token) return;
    const aiMessage = messages[index];
    const userMessage = messages[index - 1];

    try {
      const res = await fetch(`${API_BASE}/api/favorites`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: userMessage.content,
          answer: aiMessage.content
        }),
      });
      
      if (res.ok) {
        alert("⭐ 收藏成功！");
      } else {
        alert("收藏失败，请重新登录");
        handleLogout();
      }
    } catch (err) {
      alert("收藏失败");
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-white">
      <div className="w-[260px] bg-zinc-50 border-r border-zinc-200 flex flex-col hidden md:flex">
        <div className="p-4">
          <div className="flex items-center gap-2 px-2 py-3 bg-white border border-zinc-200 rounded-xl shadow-sm mb-6">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="font-medium text-zinc-800 text-sm truncate">{username}</div>
          </div>
          
          <nav className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 bg-zinc-200/50 text-zinc-900 rounded-lg text-sm font-medium">
              <span>💬</span> 开始对话
            </Link>
            <Link href="/favorites" className="flex items-center gap-3 px-3 py-2.5 text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 rounded-lg text-sm font-medium transition-colors">
              <span>⭐</span> 我的收藏
            </Link>
          </nav>
        </div>
        
        <div className="mt-auto p-4">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full text-zinc-600 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm font-medium transition-colors">
            <span>🚪</span> 退出登录
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative">
        <div className="md:hidden flex justify-between items-center p-4 border-b border-zinc-100">
          <span className="font-bold">ChatVault</span>
          <Link href="/favorites" className="text-sm text-blue-600">收藏夹</Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4 text-3xl">✨</div>
              <p className="text-lg font-medium text-zinc-600">有什么我可以帮你的吗？</p>
              <p className="text-sm mt-1">在这里提问，把喜欢的回答收藏起来。</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-zinc-900 text-white rounded-br-sm" 
                  : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                
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
          {loading && (
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
              placeholder="给 AI 发送消息..."
            />
            <button 
              onClick={sendMessage} 
              disabled={loading || !input.trim()} 
              className="absolute right-2 w-10 h-10 flex items-center justify-center bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-zinc-900 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 环境判断：线上走相对路径（Nginx接管），本地直连后端（解决本地代理缓冲问题）
const API_BASE = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8001";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append("username", username);
        formData.append("password", password);

        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "登录失败");

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", username);
        router.push("/");
      } else {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "注册失败");

        alert("注册成功，请登录！");
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 rounded-full blur-3xl"></div>

      <div className="bg-white/80 backdrop-blur-xl p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/20 w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            {isLogin ? "欢迎回到 ChatVault" : "创建 ChatVault 账号"}
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            {isLogin ? "登录以同步你的 AI 收藏" : "开始构建你的私人 AI 知识库"}
          </p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
              placeholder="输入用户名"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 text-white py-3 rounded-xl font-medium hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 transition-all shadow-md"
          >
            {loading ? "处理中..." : isLogin ? "登录" : "注册"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-8">
          {isLogin ? "还没有账号？" : "已有账号？"}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-blue-600 font-medium hover:underline ml-1"
          >
            {isLogin ? "去注册" : "去登录"}
          </button>
        </p>
      </div>
    </div>
  );
}
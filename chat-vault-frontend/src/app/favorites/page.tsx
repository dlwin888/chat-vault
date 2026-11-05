"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownRenderer from "@/components/MarkdownRenderer";

const API_BASE = process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8001";
const PAGE_SIZE = 10;

interface FavoriteItem {
  id: number;
  question: string;
  answer: string;
  created_at: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  // 👇 新增：弹窗和 Toast 状态
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2500);
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "";
    return new Date(timeStr).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  };

  const fetchFavorites = async (keyword: string = "", isLoadMore: boolean = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    const currentSkip = isLoadMore ? skip : 0;

    try {
      const url = `${API_BASE}/api/favorites?q=${encodeURIComponent(keyword)}&skip=${currentSkip}&limit=${PAGE_SIZE}`;
      const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });

      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      
      const data = await res.json();
      if (isLoadMore) setItems((prev) => [...prev, ...data.items]);
      else setItems(data.items);
      
      setSkip(currentSkip + PAGE_SIZE);
      setHasMore(currentSkip + PAGE_SIZE < data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, [router]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSkip(0);
      fetchFavorites(search, false);
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // 提交删除
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/api/favorites/${deleteTarget}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== deleteTarget));
        showToast("success", "已成功删除收藏");
      } else {
        showToast("error", "删除失败");
      }
    } catch (err) {
      showToast("error", "网络错误");
    } finally {
      setDeleteTarget(null); // 关闭弹窗
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 relative">
      {/* 桌面端侧边栏 */}
      <div className="w-[260px] bg-white border-r border-zinc-200 flex-col hidden md:flex">
        <div className="p-4">
          <Link href="/" className="flex items-center gap-2 px-2 py-3 hover:bg-zinc-50 rounded-xl transition-colors mb-6">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-bold">🔒</div>
            <div className="font-bold text-zinc-900">ChatVault</div>
          </Link>
          <nav className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 text-zinc-600 hover:bg-zinc-200/50 rounded-lg text-sm font-medium transition-colors">
              <span>💬</span> 开始对话
            </Link>
            <Link href="/favorites" className="flex items-center gap-3 px-3 py-2.5 bg-zinc-200/50 text-zinc-900 rounded-lg text-sm font-medium">
              <span>⭐</span> 我的收藏
            </Link>
          </nav>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col h-full w-full">
        {/* 移动端专属顶部导航 */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 bg-white">
          <Link href="/" className="p-2 -ml-2 text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <span className="font-bold text-zinc-800">我的收藏夹</span>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-3xl mx-auto">
            <div className="hidden md:block mb-10">
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">我的收藏夹</h1>
              <p className="text-zinc-500">你保存在 ChatVault 里的所有 AI 洞察。</p>
            </div>

            <div className="relative mb-6 md:mb-8">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                placeholder="搜索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 md:py-4 bg-white border border-zinc-200 rounded-xl md:rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm text-sm md:text-base"
              />
            </div>

            {loading ? (
              <div className="text-center py-20 text-zinc-400">正在检索...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200 border-dashed">
                <span className="text-4xl mb-4 block">🪹</span>
                <p className="text-zinc-500">没有找到相关的收藏</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:gap-6">
                  {items.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl border border-zinc-200 p-4 md:p-6 shadow-sm">
                      <div className="mb-4">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">你问</span>
                        <p className="mt-2 text-zinc-900 font-medium text-base md:text-lg leading-snug break-words">{item.question}</p>
                      </div>
                      <div className="pl-4 border-l-2 border-zinc-200">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">AI 答</span>
                        <div className="mt-2 text-sm md:text-base">
                          <MarkdownRenderer content={item.answer} />
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-zinc-100 flex justify-between items-center">
                        <p className="text-xs text-zinc-400 font-mono">{formatTime(item.created_at)}</p>
                        {/* 👇 点击不再是 window.confirm，而是唤起自定义弹窗 */}
                        <button onClick={() => setDeleteTarget(item.id)} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md">
                          🗑️ 删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 flex justify-center pb-10">
                  {hasMore ? (
                    <button onClick={() => fetchFavorites(search, true)} disabled={loadingMore} className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-medium disabled:opacity-50">
                      {loadingMore ? "加载中..." : "加载更多"}
                    </button>
                  ) : (
                    <p className="text-zinc-400 text-sm">已经到底啦 ~</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 👇 删除收藏的确认弹窗 */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4"><span className="text-2xl">🗑️</span></div>
              <h3 className="text-lg font-bold text-zinc-900 mb-2">确认删除这条收藏？</h3>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">删除后，这条 AI 洞察将从你的私人保险箱中永久移除。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">取消</button>
                <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors">确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 👇 全局轻提示 (Toast) */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg font-medium text-sm ${
            toast.type === "success" ? "bg-zinc-900 text-white" : "bg-red-50 text-red-600 border border-red-100"
          }`}>
            {toast.type === "success" ? "✅" : "❌"} {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
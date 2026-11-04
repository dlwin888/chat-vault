"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  
  // 分页状态
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);

  // 拉取数据核心函数
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

      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
        }
        throw new Error("获取失败");
      }
      
      const data = await res.json();
      
      // 更新列表
      if (isLoadMore) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      
      // 更新分页状态
      setSkip(currentSkip + PAGE_SIZE);
      setHasMore(currentSkip + PAGE_SIZE < data.total);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 首次加载
  useEffect(() => {
    fetchFavorites();
  }, [router]);

  // 搜索防抖
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSkip(0);
      fetchFavorites(search, false);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  // 删除记录逻辑
  const handleDelete = async (id: number) => {
    if (!window.confirm("确定要删除这条记录吗？")) return;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/api/favorites/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        // 删除成功，直接从 UI 中过滤掉该项
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("删除失败");
      }
    } catch (err) {
      alert("网络错误");
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* 左侧边栏 */}
      <div className="w-[260px] bg-white border-r border-zinc-200 flex flex-col hidden md:flex">
        <div className="p-4">
          <Link href="/" className="flex items-center gap-2 px-2 py-3 hover:bg-zinc-50 rounded-xl transition-colors mb-6">
            <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-bold">🔒</div>
            <div className="font-bold text-zinc-900">ChatVault</div>
          </Link>
          
          <nav className="space-y-1">
            <Link href="/" className="flex items-center gap-3 px-3 py-2.5 text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 rounded-lg text-sm font-medium transition-colors">
              <span>💬</span> 开始对话
            </Link>
            <Link href="/favorites" className="flex items-center gap-3 px-3 py-2.5 bg-zinc-200/50 text-zinc-900 rounded-lg text-sm font-medium">
              <span>⭐</span> 我的收藏
            </Link>
          </nav>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">我的收藏夹</h1>
            <p className="text-zinc-500">你保存在 ChatVault 里的所有 AI 洞察。</p>
          </div>

          {/* 搜索框 */}
          <div className="relative mb-8">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              placeholder="搜索你的问题或 AI 的回答..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm"
            />
          </div>

          {loading ? (
            <div className="text-center py-20 text-zinc-400">正在检索数据库...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200 border-dashed">
              <span className="text-4xl mb-4 block">🪹</span>
              <p className="text-zinc-500">没有找到相关的收藏</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6">
                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">你问</span>
                      </div>
                      <p className="text-zinc-900 font-medium text-lg leading-snug">{item.question}</p>
                    </div>
                    
                    <div className="pl-4 border-l-2 border-zinc-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">AI 答</span>
                      </div>
                      <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap text-sm">{item.answer}</p>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-zinc-100 flex justify-between items-center">
                      <p className="text-xs text-zinc-400 font-mono">{item.created_at}</p>
                      {/* 删除按钮（已修复为永久显示） */}
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-all flex items-center gap-1"
                      >
                        🗑️ 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 加载更多按钮 */}
              <div className="mt-10 flex justify-center pb-10">
                {hasMore ? (
                  <button 
                    onClick={() => fetchFavorites(search, true)}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-50 transition-all"
                  >
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
  );
}
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 彻底移除 rewrites
  // 因为线上 Nginx 已经配置了 location /api/ 直接转发给 Python 后端
  // 这样可以完美解决 Next.js 代理导致流式输出（打字机效果）失效的 Bug
  
  // 可选：关闭 Next.js 自身的压缩，进一步防止任何潜在的缓冲问题
  compress: false, 
};

export default nextConfig;
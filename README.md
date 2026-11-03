# 🔒 ChatVault - AI 驱动的私人对话保险箱

一个基于现代全栈技术栈构建的 AI 聊天与知识管理应用。用户可以与 AI 进行丝滑的流式对话，并将高质量的回答一键收藏。应用具备完整的多用户隔离机制与实时全文检索能力。

🔗 **在线体验**: [https://ai.m3u8player.com.cn](https://ai.m3u8player.com.cn)

## ✨ 核心功能

- **🤖 丝滑的流式对话**：接入智谱 GLM-4 大模型，实现真正的“打字机”效果，拒绝等待焦虑。
- **⭐ 一键收藏与标签**：随时保存 AI 的精彩回答，构建你的私人 AI 知识库。
- **🔍 毫秒级全文检索**：基于后端数据库，输入关键词瞬间定位历史收藏。
- **🔒 多用户数据隔离**：基于 JWT 与 Bcrypt 密码加密的完整用户认证系统，结合 PostgreSQL 行级数据隔离，保障数据绝对隐私。
- **🐳 一键容器化部署**：前端、后端、数据库全部通过 Docker Compose 编排，彻底告别环境不一致。

## 🛠️ 技术栈

**前端 (Frontend)**
- **框架**: Next.js 16 (App Router) + React 19 + TypeScript
- **样式**: Tailwind CSS (磨砂玻璃拟态设计，完全响应式)
- **流式处理**: Fetch API + ReadableStream 实时解析数据流

**后端 (Backend)**
- **框架**: FastAPI (Python 3.12)
- **数据库**: PostgreSQL 16 + SQLAlchemy (ORM 映射与安全的数据查询)
- **认证**: JWT (JSON Web Token) + Bcrypt 原生密码哈希
- **AI 集成**: 智谱 AI SDK (`glm-4-flash`)

**基础设施与部署 (DevOps)**
- **容器化**: Docker + Docker Compose (多服务一键启动)
- **网关**: Nginx (反向代理与 HTTPS 证书)
- **服务器**: 阿里云 ECS (Ubuntu 24.04)

## 🏗️ 系统架构与流式输出突破

本项目最大的挑战在于：**Next.js 的 `rewrites` 代理在生产环境会缓冲流式响应**，导致用户无法看到打字机效果。

**解决方案**：将业务请求与页面请求彻底分流。
```text
用户浏览器
   │ 访问 https://ai.m3u8player.com.cn
   ▼
Nginx (宝塔反向代理)
   │
   ├── /api/*  ──(关闭缓冲直连)──▶ Docker: FastAPI (127.0.0.1:8002)
   │                                    │
   │                                    ▼
   │                             PostgreSQL (数据隔离)
   │                                    │
   │                                    ▼
   │                             智谱 GLM-4 (流式响应)
   │
   └── /*      ──(页面渲染)─────▶ Docker: Next.js (127.0.0.1:3001)
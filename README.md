# 🔒 ChatVault - AI 驱动的私人对话保险箱

一个基于现代全栈技术栈构建的 AI 聊天与知识管理应用。用户可以与 AI 进行丝滑的流式对话（支持多轮上下文记忆），并将高质量的回答一键收藏，构建专属的私人 AI 知识库。

🔗 **在线体验**: [https://ai.m3u8player.com.cn](https://ai.m3u8player.com.cn)

## ✨ 核心功能

- **🧠 多轮对话记忆**：基于 PostgreSQL 持久化存储，AI 能记住你在此次会话中的上下文，不再是“金鱼记忆”。
- **💬 会话侧边栏管理**：类似 ChatGPT 的左侧边栏，支持随时新建对话、查看历史会话，并在不同对话间丝滑切换。
- **🎨 极致排版渲染**：集成 `react-markdown` 与 `react-syntax-highlighter`，完美渲染 AI 返回的代码块（带语法高亮与一键复制）、表格、列表等复杂格式。
- **🤖 丝滑的流式对话**：接入智谱 GLM-4 大模型，通过定制 Nginx 配置与流式解析，实现真正的“打字机”效果。
- **⭐ 一键收藏与搜索**：随时保存精彩回答，支持后端分页与防抖搜索，保障海量数据下的检索性能。
- **🔒 多用户数据隔离**：基于 JWT 认证与行级数据隔离，确保用户只能看到自己的会话与收藏。

## 🛠️ 技术栈

- **前端**: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS / react-markdown
- **后端**: FastAPI (Python 3.12) / SQLAlchemy ORM
- **数据库**: PostgreSQL 16
- **AI 驱动**: 智谱 AI SDK (glm-4-flash)
- **部署**: Docker Compose / Nginx / GitHub Actions / Let's Encrypt

## 🏗️ 系统架构与流式输出突破

本项目最大的挑战在于：Next.js 的 `rewrites` 代理在生产环境会缓冲流式响应，导致用户无法看到打字机效果。

**解决方案**：将业务请求与页面请求彻底分流。

    用户浏览器
       │ 访问 https://ai.m3u8player.com.cn
       ▼
    Nginx (反向代理)
       │
       ├── /api/*  ──(关闭 proxy_buffering 直连)──▶ Docker: FastAPI (127.0.0.1:8002)
       │                                                    │
       │                                                    ▼
       │                                             PostgreSQL (多轮对话/收藏数据)
       │
       └── /*      ──(页面渲染)──────────────────▶ Docker: Next.js (127.0.0.1:3001)

---

## 🚀 本地开发指南

### 1. 环境准备
请确保你的电脑安装了以下软件：
- Node.js (v22+) & pnpm
- Python (3.12+)
- PostgreSQL (16+) 或使用 Docker 启动本地数据库

### 2. 启动后端 (FastAPI)

    # 进入后端目录
    cd chat-vault-backend

    # 创建并激活虚拟环境
    python -m venv .venv
    source .venv/Scripts/activate  # Windows Git Bash

    # 安装依赖
    pip install -r requirements.txt

    # 配置环境变量
    # 在 backend 目录下新建 .env 文件，填入以下内容：
    # DATABASE_URL=postgresql+psycopg2://admin:password@127.0.0.1:5432/chatvault
    # ZHIPUAI_API_KEY=你的智谱API_KEY

    # 启动服务
    uvicorn main:app --reload --port 8001

后端 API 文档将运行在 http://127.0.0.1:8001/docs

### 3. 启动前端 (Next.js)

    # 进入前端目录
    cd chat-vault-frontend

    # 安装依赖
    pnpm install

    # 启动开发服务器
    pnpm dev

前端将运行在 http://localhost:3000

> **💡 本地开发小贴士**：
> 前端代码已内置环境判断：在本地环境（NODE_ENV=development）下，会自动请求 http://127.0.0.1:8001（直连后端），以绕过 Next.js 代理在本地开发环境下的流式缓冲问题，确保本地也能看到完美的打字机效果。

---

## 🐳 生产环境一键部署 (Docker)

本项目已全面容器化，推荐在服务器上使用 Docker Compose 进行部署。

### 1. 服务器环境要求
- Ubuntu 24.04 (或其他 Linux 发行版)
- 安装 Docker 和 Docker Compose
- 安装 Nginx (用于反向代理与 SSL)

### 2. 配置文件准备
在服务器 /www/wwwroot/chat-vault 目录下，创建 docker-compose.yml 与 .env 文件。

docker-compose.yml 核心配置：

    services:
      db:
        image: docker.1ms.run/library/postgres:16-alpine
        environment:
          POSTGRES_USER: admin
          POSTGRES_PASSWORD: ${DB_PASSWORD}
          POSTGRES_DB: chatvault
        volumes:
          - pgdata:/var/lib/postgresql/data

      backend:
        build: ./chat-vault-backend
        environment:
          - DATABASE_URL=postgresql+psycopg2://admin:${DB_PASSWORD}@db:5432/chatvault
          - ZHIPUAI_API_KEY=${ZHIPUAI_API_KEY}
        ports:
          - "127.0.0.1:8002:8001"

      frontend:
        build: ./chat-vault-frontend
        ports:
          - "127.0.0.1:3001:3000"

    volumes:
      pgdata:

### 3. 启动服务

    docker compose up -d --build
    docker compose ps

### 4. Nginx 反向代理配置 (流式输出关键)
为了确保打字机效果，Nginx 配置必须拆分 api 路由并关闭缓冲：

    server {
        listen 443 ssl;
        server_name ai.m3u8player.com.cn;

        # 1. 拦截 API 请求，直连 Python 后端并关闭缓冲
        location /api/ {
            proxy_pass http://127.0.0.1:8002; 
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_buffering off;
            proxy_cache off;
            gzip off;
            chunked_transfer_encoding on;
        }

        # 2. 页面渲染请求，转发给 Next.js 容器
        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_set_header Host $host;
        }
    }

---

## ⚙️ CI/CD 自动化部署

项目配置了 GitHub Actions，实现真正的“提交即部署”。每次 git push 至 main 分支，自动化工作流将：
1. 通过 SSH 安全连接至阿里云服务器。
2. 拉取最新代码并执行 docker compose up -d --build。
3. 自动清理旧的无用镜像，释放服务器磁盘空间。

## 📝 踩坑与收获 (Engineering Highlights)

1. **流式输出缓冲 Bug**：彻底理解了 Nginx 的 proxy_buffering 和 Next.js SSR 代理机制，最终采用 Nginx location /api/ 直接代理后端的方案，完美实现了 Typing Effect。
2. **Docker 存储驱动灾难恢复**：在一次清理磁盘时误删了底层 overlay2 目录，导致 Docker 挂掉。通过强制停止 Docker、清空损坏的 image 与 overlay 目录，并利用挂载的独立 Volumes 完整恢复了所有容器与数据库数据。
3. **数据库迁移与权限控制**：在后端 SQL 层面强制绑定 user_id 与 conversation_id，杜绝了水平越权漏洞，保障了 SaaS 级应用的数据安全。

## 📄 License
MIT
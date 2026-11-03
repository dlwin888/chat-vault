# 🔒 ChatVault - AI 驱动的私人对话保险箱

一个基于现代全栈技术栈构建的 AI 聊天与知识管理应用。用户可以与 AI 进行丝滑的流式对话，并将高质量的回答一键收藏。应用具备完整的多用户隔离机制与实时全文检索能力。

🔗 **在线体验**: [https://ai.m3u8player.com.cn](https://ai.m3u8player.com.cn)

## ✨ 核心功能

- **🤖 丝滑的流式对话**：接入智谱 GLM-4 大模型，实现真正的“打字机”效果，拒绝等待焦虑。
- **⭐ 一键收藏与标签**：随时保存 AI 的精彩回答，构建你的私人 AI 知识库。
- **🔍 毫秒级全文检索**：基于后端数据库查询，输入关键词瞬间定位历史收藏。
- **🔒 多用户数据隔离**：基于 JWT 与 Bcrypt 密码加密的完整用户认证系统，结合 PostgreSQL 行级数据隔离，保障数据绝对隐私。
- **🐳 一键容器化部署**：前端、后端、数据库全部通过 Docker Compose 编排，彻底告别环境不一致。

## 🛠️ 技术栈

- **前端**: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS
- **后端**: FastAPI (Python 3.12) / SQLAlchemy (ORM)
- **数据库**: PostgreSQL 16
- **AI 驱动**: 智谱 AI SDK (glm-4-flash)
- **部署**: Docker / Docker Compose / Nginx / Let's Encrypt (HTTPS)

## 🏗️ 系统架构与流式输出突破

本项目最大的挑战在于：**Next.js 的 rewrites 代理在生产环境会缓冲流式响应**，导致用户无法看到打字机效果。

**解决方案**：将业务请求与页面请求彻底分流。

    用户浏览器
       │ 访问 https://ai.m3u8player.com.cn
       ▼
    Nginx (反向代理)
       │
       ├── /api/*  ──(关闭 proxy_buffering 直连)──▶ Docker: FastAPI (127.0.0.1:8002)
       │                                                    │
       │                                                    ▼
       │                                             PostgreSQL (数据隔离)
       │
       └── /*      ──(页面渲染)──────────────────▶ Docker: Next.js (127.0.0.1:3001)

---

## 🚀 本地开发指南

### 1. 环境准备
请确保你的电脑安装了以下软件：
- Node.js (v22+)
- pnpm (npm install -g pnpm)
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
在服务器 /www/wwwroot/chat-vault 目录下，创建 docker-compose.yml：

    services:
      db:
        image: postgres:16-alpine
        container_name: chatvault_db
        environment:
          POSTGRES_USER: admin
          POSTGRES_PASSWORD: 你的强密码
          POSTGRES_DB: chatvault
        volumes:
          - pgdata:/var/lib/postgresql/data
        restart: always

      backend:
        build: ./chat-vault-backend
        container_name: chatvault_backend
        environment:
          - DATABASE_URL=postgresql+psycopg2://admin:你的强密码@db:5432/chatvault
          - ZHIPUAI_API_KEY=你的智谱API_KEY
        depends_on:
          - db
        restart: always
        ports:
          - "127.0.0.1:8002:8001"

      frontend:
        build: ./chat-vault-frontend
        container_name: chatvault_frontend
        depends_on:
          - backend
        restart: always
        ports:
          - "127.0.0.1:3001:3000"

    volumes:
      pgdata:

### 3. 启动服务

    # 构建并后台启动容器
    docker compose up -d --build

    # 查看容器状态
    docker compose ps

### 4. Nginx 反向代理配置 (关键)
为了确保流式输出（打字机效果）不被缓冲，Nginx 配置必须拆分 api 路由并关闭缓冲：

    server {
        listen 443 ssl;
        server_name ai.m3u8player.com.cn;

        # SSL 证书配置 ...

        # 1. 拦截 API 请求，直连 Python 后端并关闭缓冲
        location /api/ {
            proxy_pass http://127.0.0.1:8002; 
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            proxy_buffering off;
            proxy_cache off;
            gzip off;
            chunked_transfer_encoding on;
        }

        # 2. 页面渲染请求，转发给 Next.js 容器
        location / {
            proxy_pass http://127.0.0.1:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

---

## 📝 踩坑与收获

1. **Docker 镜像拉取超时**：通过配置阿里云专属镜像加速器，并在 Dockerfile 中显式指定 docker.1ms.run 代理源，解决了国内服务器拉取基础镜像失败的问题。
2. **流式输出缓冲 Bug**：彻底理解了 Nginx 的 proxy_buffering 和 Next.js SSR 代理机制，最终采用 Nginx location /api/ 直接代理后端的方案，完美实现了 Typing Effect。
3. **数据权限越权**：在 SQL 层面强制绑定 user_id 作为查询与删除条件，杜绝了水平越权漏洞。

## 📄 License
MIT
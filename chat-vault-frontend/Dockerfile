FROM docker.1ms.run/library/node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build

FROM docker.1ms.run/library/node:22-alpine AS runner
WORKDIR /app
# 👇 在 runner 阶段也安装 pnpm，这样 CMD 里的 pnpm start 就能找到了
RUN npm install -g pnpm
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
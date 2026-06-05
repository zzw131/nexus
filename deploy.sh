#!/usr/bin/env bash
#
# Nexus 节点机 · 一键部署脚本
# 原则：本地修改 → 本地打包 → 推送产物到服务器
# 绝对禁止在阿里云服务器上修改或打包源码！
#
set -euo pipefail

# ─── 配置 ───────────────────────────────────────────────
REMOTE_HOST="root@123.56.182.139"
REMOTE_PATH="/www/wwwroot/nexus-webui/dist/"
PM2_APP="nexus-webui"
SSH_KEY="$HOME/.ssh/aliyun_ed25519"
LOCAL_DIR="$HOME/Desktop/nexus"

# ─── 颜色 ───────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🚀 Nexus 节点机 · 一键部署${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Step 1: 进入本地源码目录 ───────────────────────────
echo -e "${YELLOW}[1/4]${NC} 进入源码目录: ${LOCAL_DIR}"
cd "$LOCAL_DIR"
echo "      当前目录: $(pwd)"
echo ""

# ─── Step 2: 本地构建 ──────────────────────────────────
echo -e "${YELLOW}[2/4]${NC} 本地构建中..."
echo "      → vite build (前端 assets)"
echo "      → esbuild server.ts → dist/server.cjs (后端)"
npm run build
echo -e "${GREEN}      ✅ 构建完成${NC}"
echo ""

# ─── Step 3: 推送产物到服务器 ──────────────────────────
echo -e "${YELLOW}[3/4]${NC} 推送产物到阿里云 ${REMOTE_HOST}..."
rsync -avz --delete \
  -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
  "${LOCAL_DIR}/dist/" \
  "${REMOTE_HOST}:${REMOTE_PATH}"
echo -e "${GREEN}      ✅ 推送完成${NC}"
echo ""

# ─── Step 4: 远程重启 PM2 服务 ──────────────────────────
echo -e "${YELLOW}[4/4]${NC} 重启远程 PM2 服务..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE_HOST}" \
  "pm2 restart ${PM2_APP}"
echo -e "${GREEN}      ✅ PM2 重启完成${NC}"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 部署完成！${NC}"
echo -e "${GREEN}  🌐 https://ai.mywebzzw.top/${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

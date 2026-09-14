#!/bin/bash
#
# BGFS (Battlegrounds Faceoff Series) — Production Deploy Script
#
# Run this ON THE AZURE VM to pull the latest code, run safety checks,
# build Next.js 16, deploy, and reload the server with zero downtime.
#
# If ANY step fails, the script automatically rolls back to the previous
# state — restores the old git commit, old working .next build, and restarts
# the previous running server.
#
# Usage:
#   bash scripts/deploy.sh                    # Standard deploy
#   bash scripts/deploy.sh --force            # Skip sanity checks / stash uncommitted
#   bash scripts/deploy.sh --dry-run          # Show what would happen without changes
#

set -e

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Configuration ───
PROJECT_DIR="/var/www/bgfs"
PM2_PROCESS_NAME="bgfs-app"
GIT_BRANCH="main"
BACKUP_DIR="/tmp/bgfs-rollback"
PORT=3000
HEALTH_URL="http://localhost:${PORT}/"
MIN_RAM_MB=1500  # Warn if less than this much total RAM + swap

FORCE=false
DRY_RUN=false
HAS_CHANGED=false
ROLLBACK_DONE=false

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

# ─── Catch-all: if the script exits unexpectedly, run rollback ───
cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ] && [ "$HAS_CHANGED" = true ]; then
    rollback
  elif [ $exit_code -ne 0 ]; then
    rm -rf "$BACKUP_DIR" 2>/dev/null
  fi
}
trap cleanup EXIT

# ─── Helper Functions ───
info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; }

run_cmd() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} Would run: $1"
    return 0
  fi
  local rc=0
  eval "$1" || rc=$?
  if [ "${rc:-0}" -ne 0 ]; then
    fail "Command failed: $1 (exit code: $rc)"
    exit 1  # triggers cleanup trap → rollback if HAS_CHANGED=true
  fi
}

# ─── Rollback ───
# Restores the VM to its exact state before this deploy started
rollback() {
  if [ "$ROLLBACK_DONE" = true ]; then return 0; fi
  ROLLBACK_DONE=true
  set +e

  echo ""
  echo -e "${YELLOW}╔══════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║        ROLLBACK IN PROGRESS              ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════╝${NC}"
  echo ""

  # 1. Restore old git commit
  if [ -n "$BEFORE_COMMIT" ]; then
    info "Rolling back git to $(echo "$BEFORE_COMMIT" | head -c 12)..."
    git reset --hard "$BEFORE_COMMIT" 2>/dev/null
    info "Git restored to $(echo "$BEFORE_COMMIT" | head -c 12)"
  fi

  # 2. Restore old working .next build directory
  if [ -d "${BACKUP_DIR}/.next" ]; then
    info "Restoring previous working Next.js build (.next)..."
    rm -rf "${PROJECT_DIR}/.next" 2>/dev/null
    cp -r "${BACKUP_DIR}/.next" "${PROJECT_DIR}/.next" 2>/dev/null
    info "Previous Next.js build restored successfully"
  fi

  # 3. Restart PM2 with the old code
  if command -v pm2 &>/dev/null; then
    if pm2 describe "$PM2_PROCESS_NAME" &>/dev/null; then
      info "Restarting Next.js server with previous working code..."
      pm2 restart "$PM2_PROCESS_NAME" 2>/dev/null
      info "Server restarted"
    fi
  fi

  # 4. Clean up backup
  rm -rf "$BACKUP_DIR" 2>/dev/null

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║     Rollback Complete — Server Safe      ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
  echo ""

  set -e
}

wait_for_health() {
  local max_attempts=15
  local attempt=0
  info "  Waiting for Next.js server to become healthy on port ${PORT}..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -sf --connect-timeout 2 "$HEALTH_URL" > /dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  return 1
}

# ──────────────────────────────────────────────────
#  MAIN DEPLOY
# ──────────────────────────────────────────────────

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     BGFS Next.js — Production Deploy     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Started:   $(date)"
echo "  Directory: $PROJECT_DIR"
echo "  Branch:    $GIT_BRANCH"
echo "  Mode:      $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'LIVE')"
echo ""

# ─── Step 0: Verify project directory ───
info "Step 0: Verifying project directory..."
if [ ! -d "$PROJECT_DIR" ]; then
  fail "Project directory $PROJECT_DIR not found!"
  exit 1
fi
cd "$PROJECT_DIR"
if [ ! -f "package.json" ]; then
  fail "package.json not found in $PROJECT_DIR"
  exit 1
fi
pass "Project directory verified"

# ─── Step 1: Check git status & backup current working build ───
info "Step 1: Checking git status and backing up current build..."
if ! command -v git &>/dev/null; then
  fail "Git is not installed"
  exit 1
fi

UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -v 'package-lock.json' | grep -v '\.env' | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
  if [ "$FORCE" = true ]; then
    warn "$UNCOMMITTED uncommitted change(s) found. Stashing them..."
    git stash --include-untracked 2>/dev/null || true
    pass "Local changes stashed"
  else
    warn "You have $UNCOMMITTED uncommitted change(s):"
    git status --short | grep -v 'package-lock.json' | grep -v '\.env'
    echo ""
    echo "  Commit or stash them first, or use --force to deploy anyway."
    exit 1
  fi
fi

BEFORE_COMMIT=$(git rev-parse HEAD)
info "  Current commit: $(echo "$BEFORE_COMMIT" | head -c 12)"

# Backup old working .next build directory
rm -rf "$BACKUP_DIR" 2>/dev/null
mkdir -p "$BACKUP_DIR"
if [ -d "${PROJECT_DIR}/.next" ]; then
  cp -r "${PROJECT_DIR}/.next" "${BACKUP_DIR}/.next"
  info "  Backed up current .next production build"
fi
pass "State backed up at $BACKUP_DIR"

# ─── Step 2: Pull latest code from GitHub ───
info "Step 2: Pulling latest code from $GIT_BRANCH..."

# Clear any dirty index quirks on package-lock.json
if git ls-files package-lock.json >/dev/null 2>&1 || [ -f package-lock.json ]; then
  git update-index --no-skip-worktree package-lock.json 2>/dev/null || true
  git update-index --no-assume-unchanged package-lock.json 2>/dev/null || true
  git checkout HEAD -- package-lock.json 2>/dev/null || true
  if [ -n "$(git status --porcelain -- package-lock.json 2>/dev/null)" ]; then
    warn "package-lock.json was modified. Discarding local drift..."
    git checkout -- package-lock.json 2>/dev/null || true
  fi
fi

run_cmd "git fetch origin $GIT_BRANCH"
run_cmd "git pull origin $GIT_BRANCH"
AFTER_COMMIT=$(git rev-parse HEAD)

if [ "$BEFORE_COMMIT" = "$AFTER_COMMIT" ]; then
  info "  Already up to date at $(echo "$AFTER_COMMIT" | head -c 12)"
else
  HAS_CHANGED=true
  pass "Updated code: $(echo "$BEFORE_COMMIT" | head -c 8) → $(echo "$AFTER_COMMIT" | head -c 8)"
  echo "  Recent commits:"
  git log --oneline "$BEFORE_COMMIT..$AFTER_COMMIT" 2>/dev/null | head -10
fi

# ─── Step 3: Check memory & swap space ───
info "Step 3: Checking memory and swap space..."
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
TOTAL_MB=$((RAM_MB + SWAP_MB))
echo "  RAM: ${RAM_MB}MB | Swap: ${SWAP_MB}MB | Total: ${TOTAL_MB}MB"
if [ "$TOTAL_MB" -lt "$MIN_RAM_MB" ]; then
  warn "Low total memory (${TOTAL_MB}MB). Build may fail with OOM 'Killed' error."
  warn "  Ensure a 2GB swap file exists at /swapfile."
else
  pass "Memory buffer verified"
fi

# ─── Step 4: Install Dependencies ───
info "Step 4: Installing dependencies..."
if [ "$DRY_RUN" = false ]; then
  run_cmd "npm install"
  pass "Dependencies up to date"
else
  warn "Dependency install skipped (dry-run)"
fi

# ─── Step 5: Run sanity checks (if sanity-check.js exists) ───
if [ -f "scripts/sanity-check.js" ] && [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
  info "Step 5: Running pre-deploy sanity checks..."
  set +e
  node scripts/sanity-check.js
  SANITY_EXIT=$?
  set -e
  if [ $SANITY_EXIT -ne 0 ]; then
    fail "Sanity checks failed (exit code: $SANITY_EXIT)"
    exit 1  # triggers rollback
  fi
  pass "Sanity checks passed"
fi

# ─── Step 6: Build Next.js Application ───
info "Step 6: Building Next.js production bundle..."
if [ "$DRY_RUN" = false ]; then
  # Mark HAS_CHANGED so failure triggers rollback to previous working build
  HAS_CHANGED=true
  run_cmd "NODE_OPTIONS='--max-old-space-size=1536' npm run build"
  pass "Next.js build succeeded"
else
  warn "Build skipped (dry-run)"
fi

# ─── Step 7: Zero-Downtime Reload with PM2 ───
info "Step 7: Reloading server with PM2..."
if [ "$DRY_RUN" = false ]; then
  if command -v pm2 &>/dev/null; then
    if pm2 describe "$PM2_PROCESS_NAME" &>/dev/null; then
      run_cmd "pm2 reload $PM2_PROCESS_NAME"
      pass "PM2 reloaded with zero downtime"
    else
      info "  PM2 process not active, starting..."
      run_cmd "pm2 start ecosystem.config.cjs"
      pass "PM2 process started"
    fi

    # ─── Step 8: Post-Deploy Health Check ───
    info "Step 8: Verifying server health..."
    if wait_for_health; then
      pass "Next.js server is healthy and responding with HTTP 200"
    else
      fail "Health check failed after deploy! Next.js did not respond on port ${PORT}."
      exit 1  # triggers cleanup trap → rollback
    fi

    run_cmd "pm2 save"
    pass "PM2 process state saved"
  else
    warn "PM2 is not installed. Start manually with 'npm start'."
  fi
fi

# ─── Step 9: Clean up backup (Deploy Succeeded!) ───
info "Step 9: Cleaning up temporary rollback artifacts..."
rm -rf "$BACKUP_DIR" 2>/dev/null
pass "Rollback backup removed (deploy succeeded)"

# ─── Summary ───
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Deploy Complete!                ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  Finished: $(date)"
echo "  Commit:   $(echo "$AFTER_COMMIT" | head -c 12)"
echo "  URL:      https://battlegroundsfaceoffseries.in"
echo ""
echo "  ─── Handy Server Commands ───"
echo "  Logs:    pm2 logs $PM2_PROCESS_NAME"
echo "  Status:  pm2 status"
echo "  Restart: pm2 restart $PM2_PROCESS_NAME"
echo "  Nginx:   sudo nginx -t && sudo systemctl reload nginx"
echo ""

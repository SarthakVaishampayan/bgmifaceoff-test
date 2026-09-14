# BGFS — Azure VM Production Infrastructure & Deployment Guide

> **Official Operations & Handover Manual for Battlegrounds Faceoff Series (BGFS)**  
> **Live Production Domain:** [https://battlegroundsfaceoffseries.in](https://battlegroundsfaceoffseries.in)  
> **Server Public IP:** `172.198.69.78`  
> **Region:** Azure `indiasouthcentral` (Hyderabad, India)

---

## 1. 🏗️ Infrastructure Architecture Overview

```
[ GoDaddy DNS ]
     │ (A record pointing to 172.198.69.78)
     ▼
[ Azure Network Security Group (NSG) ]
     │ Open Inbound Ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
     ▼
[ Azure Virtual Machine: Standard_B1s (Ubuntu 24.04 LTS) ]
     │
     ├── [ Nginx Reverse Proxy (Port 80/443 + Let's Encrypt SSL) ]
     │        ├── Direct Cache & Delivery: /_next/static/ & /images/* (Bypasses Node.js)
     │        ├── Auto HTTP -> HTTPS redirect
     │        └── Proxy Pass: http://127.0.0.1:3000
     │
     ├── [ PM2 Process Manager (`bgfs-app`) ]
     │        └── Next.js 16 Production Server (`next start -p 3000`)
     │            ├── Auto-restart on crash & boot (`systemd`)
     │            └── Memory leak protection (`max_memory_restart: 450M`)
     │
     ├── [ 2 GB Linux Swap File (/swapfile) ] (Prevents OOM during builds)
     │
     ▼
[ External Services ]
     ├── Supabase PostgreSQL & Auth (Mumbai AWS `ap-south-1` — ~8ms latency)
     └── Razorpay Payment Gateway (Orders, Verification, Webhooks)
```

---

## 2. 📋 Server & Azure Specifications

| Attribute | Production Value |
| :--- | :--- |
| **Cloud Provider** | Microsoft Azure |
| **Subscription** | Azure for Students |
| **Resource Group** | `bgfs-india-rg` |
| **VM Name** | `bgfs-vm` |
| **Location / Region** | `indiasouthcentral` (Hyderabad, India) |
| **VM Size** | `Standard_B1s` (1 vCPU, 1.0 GiB RAM) |
| **Operating System** | Ubuntu Server 24.04 LTS (x64 Gen2) |
| **OS Disk** | 30 GiB Standard SSD (`/dev/sda1`) |
| **Virtual Memory** | 2.0 GiB Swap file at `/swapfile` |
| **Public IPv4** | `172.198.69.78` (Standard Static SKU) |
| **Node.js Version** | `v20.20.2 LTS` |
| **Process Manager** | PM2 (`v7.0.4`) |
| **Reverse Proxy** | Nginx (`v1.24.0`) |
| **SSL Certificate** | Let's Encrypt automated via Certbot |

---

## 3. 🔑 SSH Access

### Connect to the Server
From any authorized terminal:
```bash
ssh azureuser@172.198.69.78
```

* **Default Username:** `azureuser`
* **Project Directory:** `/var/www/bgfs`
* **Sudo Access:** Enabled (`sudo <command>`)

---

## 4. 🚀 How to Deploy Updates (One-Command Flow)

The deployment process is completely automated with **automatic rollback** protection.

### Standard Deployment:
1. Push your code changes to GitHub:
   ```bash
   git push origin main
   ```
2. Connect to the Azure VM:
   ```bash
   ssh azureuser@172.198.69.78
   ```
3. Run the deploy script:
   ```bash
   cd /var/www/bgfs && bash scripts/deploy.sh
   ```

### What `scripts/deploy.sh` Does Automatically:
1. **Safety Backup:** Backs up the current commit hash and existing `.next` production build to `/tmp/bgfs-rollback`.
2. **Git Pull:** Pulls the latest commits from `origin main`.
3. **Memory Safety Check:** Verifies that RAM + Swap is healthy (> 1.5 GB).
4. **Dependencies:** Runs `npm install`.
5. **Sanity Checks:** Executes `node scripts/sanity-check.js` to verify environment variables, database ping, and route health.
6. **Production Build:** Compiles the Next.js 16 app with `NODE_OPTIONS="--max-old-space-size=1536" npm run build`.
7. **Zero-Downtime Reload:** Issues `pm2 reload bgfs-app`.
8. **Health Check:** Polls `http://localhost:3000/` for up to 30 seconds to ensure the server responds with `HTTP 200`.
9. **Automatic Rollback:** If *any* step fails (git merge conflict, npm error, build failure, or health check timeout), the script immediately catches the error, restores the old `.next` build and old git commit, restarts PM2, and keeps the live site up!

### Deployment Flags:
```bash
bash scripts/deploy.sh --dry-run   # Preview actions without changing files
bash scripts/deploy.sh --force     # Stash uncommitted changes and skip sanity checks
```

---

## 5. ⚙️ Environment Variables Configuration

The environment file is stored on the server at:
`/var/www/bgfs/.env.production`

```env
NEXT_PUBLIC_SUPABASE_URL=https://urdzthjwejyrrkuqxrdm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_WEBHOOK_SECRET=...
```

> [!WARNING]
> Never commit `.env.production` or `.env.local` to GitHub. It is kept securely on the VM in `/var/www/bgfs/.env.production`.

---

## 6. 🌐 Nginx & SSL Configuration

### Nginx Virtual Host:
Path: `/etc/nginx/sites-available/default`

Key highlights:
* **Offloading Static Assets:** Nginx serves `/_next/static/` directly from `/var/www/bgfs/.next/static/` with 1-year immutable caching. Node.js never wastes CPU on static assets.
* **Direct Image Delivery:** Nginx serves `/images/` directly from `/var/www/bgfs/public/images/`.
* **Reverse Proxy:** Proxies all other dynamic requests to `http://127.0.0.1:3000`.

### Nginx Commands:
```bash
sudo nginx -t                     # Test configuration for syntax errors
sudo systemctl reload nginx       # Gracefully reload configuration without dropping traffic
sudo systemctl restart nginx      # Hard restart Nginx
sudo tail -f /var/log/nginx/error.log  # View live Nginx errors
```

### SSL (Certbot) Auto-Renewal:
Certbot automatically installed a systemd timer that renews your Let's Encrypt certificate before it expires:
```bash
sudo certbot certificates         # Check certificate expiry date
sudo certbot renew --dry-run      # Test auto-renewal mechanism
```

---

## 7. 🔄 PM2 Process Manager Commands

PM2 keeps Next.js running in the background and automatically restarts it on crashes or server reboots.

```bash
pm2 status                        # View running processes, CPU, and RAM
pm2 logs bgfs-app                 # View live application console logs
pm2 reload bgfs-app               # Zero-downtime reload of Next.js
pm2 restart bgfs-app              # Hard restart of Next.js
pm2 stop bgfs-app                 # Stop Next.js
```

PM2 configuration is defined in `/var/www/bgfs/ecosystem.config.cjs`:
* Process name: `bgfs-app`
* Working directory: `/var/www/bgfs`
* Max memory limit before restart: `450M`

---

## 8. 🌍 Domain & DNS Setup (GoDaddy)

The domain is managed on GoDaddy. Current production records:

| Record Type | Host | Points To / Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `172.198.69.78` | 600 seconds (10 min) |
| **CNAME** | `www` | `battlegroundsfaceoffseries.in.` | 1800 seconds (30 min) |

---

## 9. 🛡️ Instant Rollback Plan (If Reverting to Vercel is Needed)

If an catastrophic server failure or emergency occurs and you need to switch back to Vercel instantly:
1. Open **GoDaddy DNS Management**.
2. Edit the **`@`** A Record: change Value back to `76.76.21.21` (Vercel IP).
3. Edit the **`www`** CNAME: change Value back to `cname.vercel-dns.com.`.
4. Because TTL is set to 600s, worldwide traffic will revert back to Vercel within 5–10 minutes.

---

## 10. 📈 Upgrading VM Resources (When Traffic Grows)

If tournament registrations spike and you want to upgrade from `Standard_B1s` (1 GB RAM) to `Standard_B1ms` (2 GB RAM) or `Standard_B2s` (4 GB RAM):
1. Go to [Azure Portal](https://portal.azure.com) ➔ **Virtual machines** ➔ `bgfs-vm`.
2. In the left menu, click **Size** (under Availability + scale).
3. Select **`Standard_B1ms`** or **`Standard_B2s`**.
4. Click **Resize**.
5. The VM reboots with higher RAM and CPU in **under 45 seconds**. No data, files, or IP addresses are lost.

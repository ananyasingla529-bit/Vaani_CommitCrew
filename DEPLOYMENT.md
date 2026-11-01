# 🚀 Vaani Deployment Guide (Vercel + Render)

This repository is pre-configured for instant zero-configuration deployment to **Vercel** (Frontend) and **Render** (Backend).

---

## 1. Deploy Frontend to Vercel (2 Minutes)

### Option A: Via Vercel Web Dashboard (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new) and log in with your GitHub account.
2. Select and import the **`Vaani_CommitCrew`** repository.
3. Configure the project:
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: Select `frontend` (or leave as root `/`; the root `vercel.json` will automatically build `frontend`)
   - **Build Command**: `tsc -b && vite build` (or `npm run build`)
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://vaani-backend.onrender.com` | Your deployed backend URL |
   | `VITE_USE_MOCK` | `false` | Disables mock mode so live backend data is used |
   | `VITE_TELEGRAM_BOT_USERNAME` | `VaaniSafetyBot` | Your Telegram bot username |
   | `VITE_DISCORD_CLIENT_ID` | `1234567890` | Your Discord bot client ID |
5. Click **Deploy**. Vercel will build and assign you a live production URL (e.g., `https://vaani-commitcrew.vercel.app`).

---

## 2. Deploy Backend to Render (3 Minutes)

### Option A: Using Render Blueprint (`render.yaml`)
1. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** > **Blueprint**.
2. Select your `Vaani_CommitCrew` repository. Render will automatically read `render.yaml` and configure the `vaani-backend` Web Service.
3. Provide your environment secrets in the Render dashboard:
   - `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from `@BotFather`.
   - `DISCORD_BOT_TOKEN`: Your Discord bot token from the Discord Developer Portal.
   - `YOUTUBE_API_KEY`: Your Google Cloud YouTube Data API v3 key.
   - `FRONTEND_ORIGIN`: Your Vercel frontend URL (e.g. `https://vaani-commitcrew.vercel.app`).
4. Click **Apply**.

### Option B: Manual Web Service on Render
1. Click **New +** > **Web Service** and connect `Vaani_CommitCrew`.
2. Configure:
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn main:app --host 0.0.0.0 --port $PORT --app-dir backend`
   - **Health Check Path**: `/`
3. Under **Environment Variables**, add:
   - `MOCK_MODE` = `false`
   - `ENABLE_BACKGROUND_WORKER` = `true`
   - `TELEGRAM_LIVE` = `true`
   - `FRONTEND_ORIGIN` = `https://<your-vercel-domain>.vercel.app`
   - (Plus your platform tokens: `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `YOUTUBE_API_KEY`)
4. Click **Create Web Service**.

---

## 3. Connecting Frontend to Backend
Once your Render backend is live (e.g., `https://vaani-backend.onrender.com`), go to your Vercel project:
1. Go to **Project Settings** > **Environment Variables**.
2. Update `VITE_API_URL` to your Render URL: `https://vaani-backend.onrender.com`.
3. Trigger a redeploy (**Deployments** > click `...` on latest deployment > **Redeploy**).

Your full-stack Vaani moderation console is now live!

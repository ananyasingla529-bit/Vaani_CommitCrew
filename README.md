# Vaani — Community Moderation Console

**Vaani** is a unified, institutional community moderation dashboard designed for educational institutions, universities, NGOs, and community managers to monitor, transliterate, and moderate cyber-bullying, harassment, and toxic speech across **Telegram**, **Discord**, and **YouTube**.

---

## Key Features

1. **Multi-Platform Unified Feed**
   - Ingests and normalizes messages from Telegram groups, Discord servers, and YouTube comment sections into a single standard schema.
   - Comprehensive filtering by platform, channel, severity, Romanized Indic language, toxicity category, and review status.
   - Fast full-text and entity search across original text, normalized transliterations, sender names, and targeted user handles.

2. **Context-Aware Moderator Slideout Panel**
   - Click any flagged message to inspect the **3 preceding conversational messages** for complete situational context.
   - **Transliterated / Normalized Text**: Automatically normalizes phonetic misspellings and obfuscated slurs (`k*tta`, `kameena`, `b@stard`, `chup kar bhos*`, `m@r ja`, etc.) into standardized Romanized text.
   - AI model classification rationale and targeted user entity extraction.
   - Direct workflow actions: **Dismiss**, **Mark as False Positive**, **Warn Sender**, and **Escalate**.

3. **Repeat Target & Pile-On Monitoring**
   - Automatically detects individuals repeatedly targeted across channels or platforms (e.g. `@priya_sharma_du`, `@rohit_tech_lead`, `@arjun_v98`).
   - Flags coordinated brigading and sudden pile-on campaigns with chronological incident timelines.

4. **Interactive Classification Sandbox (Try-it Panel)**
   - Test arbitrary sentences in Romanized Hindi, Hinglish, Punjabi, or English with live classification.
   - Pre-loaded with realistic benchmark examples including physical threats, obfuscated slurs, and nuanced false-positive praise metaphors (e.g. *"bhai tu to aag laga di stage pe!"*).

5. **Connected Sources & Administrative Consent Protocol**
   - Single input field with auto-detection for Telegram (`t.me/...`), Discord (`discord.gg/...`), and YouTube (`youtube.com/@...`).
   - Platform-specific authorization workflows (Telegram Bot invite with admin permissions, Discord OAuth2 bot scope, YouTube Google OAuth comment moderation scope).
   - Simulated polling and verification status badges (`Connected`, `Pending`, `Permission missing`).
   - **Privacy Guarantee**: Channels are only monitored with explicit administrative consent; only flagged items are stored, and human moderators always make the final decision.

6. **Moderator Alerts & Telegram Webhook**
   - Instant Telegram DM alerts for High-Severity threats containing message snippet, category, channel, and deep link to the dashboard item.
   - Batching of low-severity flags into scheduled daily digests.

---

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts (for analytics and distribution charts), Lucide Icons (no emoji anywhere in the UI).
- **Backend**: Python 3.10+ FastAPI, SQLite database with standard library `sqlite3` for zero-friction local persistence.
- **Connectors**: Modular `connectors/` directory with abstract `Connector` base class and implementations for Telegram, Discord, and YouTube.
- **Classification Engine**: Transliteration normalizer and phonetic rule classifier with clearly marked plug-in hook for fine-tuned IndicBERT, RoBERTa, or LLM inference.
- **Environment**: Zero-dependency `MOCK_MODE=True` (default ON) serving 45+ realistic multilingual messages across Hindi, Hinglish, Punjabi, and English.

---

## Quick Start (Run Locally)

The application is structured to run locally with **one command per service**:

### 1. Start the Backend API (FastAPI)

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```
*The backend API will start at `http://127.0.0.1:8000`. Automatic database seeding with 45+ realistic messages will execute on first launch.*

### 2. Start the Frontend Dashboard (React + Vite)

```bash
cd frontend
npm install
npm run dev -- --port 5173
```
*Open [http://localhost:5173](http://localhost:5173) in your browser.*

---

## Environment Configuration (`.env`)

A default `.env` is pre-configured with `MOCK_MODE=True` so that the full console runs out-of-the-box without requiring any third-party API keys:

```ini
# backend/.env
MOCK_MODE=True

# LLM Providers (Primary: Google Gemini, Secondary Fallback: Groq)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# LLM Daily Call Budget & Rate Limiter
LLM_DAILY_BUDGET=500
RATE_LIMIT_PER_MINUTE=60

# Telegram Bot Credentials (Optional when MOCK_MODE=True)
TELEGRAM_BOT_TOKEN=7192837461:AAFk9102834710928347_DEMO
TELEGRAM_MODERATOR_CHAT_ID=984729182

# Discord Bot Token (Optional when MOCK_MODE=True)
DISCORD_BOT_TOKEN=OTI4Mzc0NjE1MjQzMTA5Mjgz.DEMO_TOKEN
DISCORD_LIVE=False

# YouTube Data API v3 Key (Optional when MOCK_MODE=True)
YOUTUBE_API_KEY=AIzaSyDEMO_KEY_VAANI_MODERATION

# Database
DATABASE_URL=sqlite:///./vaani.db
PORT=8000
HOST=0.0.0.0
```

### How to Get LLM API Keys

Vaani utilizes a resilient two-tier architecture:
- **Tier 1**: Instant lexicon & rule-based engine. Clearly safe messages are immediately validated with **zero LLM calls** and zero API cost.
- **Tier 2**: Context-aware LLM chain (Google Gemini &rarr; Groq Llama &rarr; Rule Fallback) for nuanced Indic slang, subtle polite bullying, and threat verification.

#### 1. Google Gemini API Key (Primary Provider — Free Tier)
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** &rarr; **Create API key in new project**.
4. Copy the key and paste it as `GEMINI_API_KEY=...` in `backend/.env`.
5. Set `MOCK_MODE=False` in `backend/.env`.

#### 2. Groq API Key (Secondary Fallback Provider — High Speed Llama 3.3)
1. Go to the [Groq Cloud Console](https://console.groq.com/).
2. Sign up or log in.
3. Navigate to **API Keys** in the left sidebar and click **Create API Key**.
4. Copy the generated key and paste it as `GROQ_API_KEY=...` in `backend/.env`.

> [!NOTE]
> If any API call fails, encounters a rate limit, or exceeds `LLM_DAILY_BUDGET` (default 500), Vaani automatically falls back to the deterministic local rule engine without throwing any user-facing errors.

---

## Evaluation Benchmark Suite

Vaani contains a labeled dataset of 89 test cases across Devanagari, Gurmukhi, Romanized Hindi/Punjabi, Hinglish, leetspeak, false-positive metaphors, polite bullying, and self-harm hints in `backend/eval/eval_set.csv`.

To run the offline evaluation benchmark:
```bash
python backend/eval/run_eval.py
```
This prints precision, recall, F1-score, per-category, and per-language breakdowns, and exports `backend/eval/latest_summary.json`. The latest results are also exposed via REST at `GET /eval/summary`.


---

## Screenshot-Ready Demo Walkthrough Flow

Follow this step-by-step path to experience the entire moderation workflow:

### Step 1: Institutional Sign-In
1. Navigate to `http://localhost:5173/`.
2. Observe the calm, institutional authentication page with prefilled credentials:
   - **Email**: `moderator@vaani.org`
   - **Password**: `moderator123`
3. Click **Sign In to Moderation Console**.

### Step 2: Overview Dashboard & Analytics
1. Inspect the 4 high-level stat cards: **Messages Scanned** (18,450), **Messages Flagged** (45), **High-Severity Open** (21), and **Avg Review Time** (4.8 mins).
2. Review the 4 Recharts visualizations:
   - **Flags Over Time**: 7-day trend showing total flags vs high-severity spikes.
   - **Flags by Toxicity Category**: Breakdown across Threat, Harassment, Insult/Bullying, Hate speech, Sexual content.
   - **Flags by Romanized Language**: Distribution across Hindi (Romanized), Hinglish, Punjabi (Romanized), and English.
   - **Flags by Monitored Platform**: Volume across Telegram, Discord, and YouTube connectors.
3. Review the **Urgent Open Incidents Requiring Moderator Action** quick queue at the bottom.

### Step 3: Flagged Feed & Context Slideout Panel
1. Click **Flagged Feed** in the left sidebar.
2. Filter by:
   - **Severity**: Select `High Severity` (notices explicit threats and brigading).
   - **Platform**: Filter between `Telegram`, `Discord`, and `YouTube`.
   - **Category**: Select `Threat` or `Harassment`.
3. Click on the first message:
   `"@priya_sharma_du college aake dikha kal, tera vo haal karunga ki hospital me admit hona padega. m@r daloonga tujhe."`
4. The **Right-Side Detail Panel** slides open:
   - **Context Thread**: View the 3 preceding messages from Priya Sharma, Karan Malhotra, and Aman Gupta explaining the student election dispute.
   - **Normalized Text**: Inspect the transliterated output with obfuscated characters normalized.
   - **Model Rationale**: Read the classification explanation.
   - **Target User**: Observe the `@priya_sharma_du` badge.
5. Click **Warn Sender** or **Escalate** to update the message's status in real time.

### Step 4: Inspecting False Positives
1. In the Flagged Feed search bar, type `aag laga di` or filter status by `Dismissed`.
2. Click on the message:
   `"bhai tu to aag laga di stage pe! kya performance thi maza aa gaya yaar bilkul faad diya!"`
3. Inspect the model rationale:
   *`FALSE POSITIVE: Colloquial praise expressions "aag laga di" (set stage on fire) and "faad diya" used metaphorically for high artistic praise.`*

### Step 5: Connecting New Sources
1. Click **Connected Sources** in the sidebar.
2. Observe the 6 existing channels grouped by platform with live flag counts and status badges.
3. Paste a link into the input box:
   `https://t.me/delhi_tech_students`
4. Observe the instant platform recognition card identifying Telegram.
5. Click **Proceed to Authorization**:
   - Review the Telegram bot invite instructions (`t.me/VaaniTestbot?startgroup=true`).
6. Click **I Have Added the Bot (Verify Channel)**:
   - Watch the 3-step animated verification polling process.
   - The new channel will be verified and added to the list.

### Step 6: Repeat Targets & Pile-On Detection
1. Click **Repeat Targets** in the sidebar.
2. Observe the target card for **`@priya_sharma_du`** showing the red **Active Pile-on Detected** warning banner (targeted across Delhi University Student Forum Telegram, Campus Tech Discord, and YouTube debate comments).
3. Review the chronological incident timeline tracing every flagged incident against the user.
4. Click **Filter Feed for User** to view all related incidents in the Flagged Feed.

### Step 7: Interactive Try-It Sandbox
1. Click **Try-it Classifier** in the sidebar.
2. Click any of the preset buttons:
   - *"Direct Physical Threat (Hindi)"*
   - *"Obfuscated Slur (Hinglish)"*
   - *"False Positive Metaphor (Hindi)"*
   - *"Romanized Punjabi Threat"*
   - *"Benign Unix Command (`pkill -9`)"*
3. Or type your own Romanized Hindi / Hinglish sentence.
4. Click **Run POST /classify** to see the live classification result: category, severity, normalized transliteration, and classifier rationale.

### Step 8: Settings & Telegram Alert Test
1. Click **Settings** in the sidebar.
2. Inspect the alert toggles (Instant high-severity Telegram DM and daily digest).
3. Click **Dispatch Test Telegram Alert**:
   - A simulated high-severity alert payload is formatted and dispatched to the moderator webhook.
   - An instant green confirmation banner displays the dispatch status.

---

## Normalized Message Data Model

All messages from Telegram, Discord, and YouTube are normalized into this standard schema:

```typescript
interface FlaggedMessage {
  id: string;                                // Unique identifier (e.g., 'msg_001')
  platform: 'telegram' | 'discord' | 'youtube';
  source_id: string;                         // Remote platform channel ID
  channel_name: string;                      // Display name of channel
  sender_id: string;                         // Remote sender user ID
  sender_name: string;                       // Sender display name / handle
  text: string;                              // Raw text received
  normalized_text: string;                   // Transliterated / de-obfuscated text
  language: string;                          // 'Hindi (Romanized)', 'Hinglish', etc.
  timestamp: string;                         // ISO 8601 timestamp
  context: string[];                         // 3 messages preceding the flagged item
  category:                                  // Toxicity category
    | 'Insult/Bullying'
    | 'Harassment'
    | 'Hate speech'
    | 'Threat'
    | 'Sexual content'
    | 'Other';
  severity: 'low' | 'medium' | 'high';       // Severity classification
  explanation: string;                       // Model classification rationale
  target_user?: string | null;               // Extracted victim handle (if any)
  status: 'new' | 'reviewed' | 'dismissed' | 'escalated';
  reviewed_by?: string | null;               // Moderator email
  reviewed_at?: string | null;               // ISO timestamp of review
}
```

---

## Backend Connector Architecture

The backend connector module is located in `backend/connectors/`:

```
backend/
├── connectors/
│   ├── base.py       # Abstract Connector class (fetch_new_messages, normalize)
│   ├── telegram.py   # Telegram Connector (python-telegram-bot / getUpdates)
│   ├── discord.py    # Discord Connector (discord.py REST / Gateway)
│   └── youtube.py    # YouTube Connector (YouTube Data API v3 commentThreads)
├── services/
│   ├── classifier.py # Transliteration normalizer & model plug-in hook
│   └── alerts.py     # Telegram webhook dispatcher & digest batcher
├── database.py       # SQLite connection manager & query layer
├── models.py         # Pydantic schemas
├── seed_data.py      # 45+ realistic seed messages & sources
├── main.py           # FastAPI application
└── vaani.db          # Auto-generated SQLite database
```

### Production Machine Learning Plug-In Hook

To connect a custom fine-tuned transformer (e.g., IndicBERT, RoBERTa) or an LLM classification API (e.g., Gemini, OpenAI, Claude), edit the clearly marked function in [backend/services/classifier.py](file:///c:/Users/sunid/OneDrive/Documents/Vaani/backend/services/classifier.py):

```python
def classify_with_external_model(text: str, target_user: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Hook to plug in your production transformer or LLM inference endpoint.
    Return a dict conforming to ClassifyResponse schema, or None to fall back to rule engine.
    """
    # Example:
    # response = gemini_client.generate_content(...)
    # return parse_prediction(response)
    return None
```

---

## Privacy & Ethical Guarantees

Vaani is built on three core institutional safety principles:
1. **Administrative Consent**: Channels are only ingested if authorized community administrators have explicitly added the bot and granted moderation permissions.
2. **Minimal Storage**: Only messages flagged by the classifier as potentially violating community safety guidelines are retained; benign chatter is discarded.
3. **Human-in-the-Loop**: The classification engine recommends categories and severities, but a human community moderator always makes the decision to dismiss, warn, or escalate.


---

## External Platform Setup & Configuration Guide

### 1. Telegram Connector Setup (@BotFather)
1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, enter a display name (e.g. `Vaani Safety Bot`), and choose a username ending in `bot` (e.g. `vaani_safety_bot`).
3. Copy the HTTP API token into `backend/.env` as `TELEGRAM_BOT_TOKEN`.
4. **CRITICAL: Disable Group Privacy Mode**:
   - In `@BotFather`, send `/setprivacy`.
   - Select your bot (`@vaani_safety_bot`).
   - Choose **Disable**.
   - *Why?* By default, Telegram bots in group chats only receive commands or direct mentions. Disabling privacy mode allows the bot to monitor group conversation messages in real time for cyber-bullying detection.
5. Add your bot to your target student group as an **Administrator** with permissions to:
   - *Delete Messages* (for punitive actions)
   - *Ban/Restrict Users* (for escalation and muting)
6. To receive instant moderator alerts, start a direct message with the bot from your moderator account and set `TELEGRAM_MODERATOR_CHAT_ID` in `backend/.env`.

### 2. Discord Connector Setup (Discord Developer Portal)
1. Visit the [Discord Developer Portal](https://discord.com/developers/applications) and create a **New Application**.
2. Navigate to **Bot** > **Reset Token** and copy the bot token into `DISCORD_BOT_TOKEN`.
3. Under **Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT** (and Server Members Intent).
   - *Why?* Discord requires the Message Content intent for bots to read chat messages in channels.
4. Navigate to **OAuth2** > **URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Read Messages/View Channels`, `Send Messages`, `Manage Messages`, `Moderate Members`, `Kick Members`, `Ban Members`.
5. Invite the bot to your student Discord server using the generated URL.

### 3. Google YouTube Data API & OAuth Setup
1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable the **YouTube Data API v3** in APIs & Services.
3. Under **Credentials**, create an **API Key** and assign it to `YOUTUBE_API_KEY` in `backend/.env`.
4. For live chat moderation actions (deleting messages, banning users):
   - Configure the **OAuth Consent Screen** in **Testing Mode**.
   - Add your developer and moderator Google accounts as **Test Users**.
   - Add scope: `https://www.googleapis.com/auth/youtube.force-ssl`.
   - Generate an OAuth 2.0 access token and set `YOUTUBE_OAUTH_TOKEN` in `backend/.env`.

---

## Operations & Human-in-the-Loop Moderation API

Vaani provides complete auditability and student warning tracking:
- `GET /audit-log`: Review all human-in-the-loop decisions (`warn`, `dismiss`, `escalate`, `delete_and_ban`) with platform delivery outcomes.
- `GET /students/{sender_id}/history`: Review full disciplinary timeline, previous warnings, and violation records across platforms.
- `POST /auth/login`: Issue moderator JWT credentials using bcrypt verification (`MODERATOR_EMAIL` and `MODERATOR_PASSWORD_HASH`).
- `POST /ops/retention-cleanup`: Trigger automatic or manual data retention cleanup deleting messages older than `RETENTION_DAYS`.

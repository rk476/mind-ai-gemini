# M.I.N.D. (Machine Interface for Navigation & Diagnostics) — Autonomous QA Engineer

An **AI-powered autonomous web testing agent** built with Next.js, Google Gemini, Playwright, Redis, and MongoDB. The system behaves like a real QA engineer: it collects testing requirements through natural conversation, plans test workflows, executes browser tests autonomously, and generates highly detailed, interactive reports.

---

## Core Functionality Highlights

- **Conversational Requirement Gathering:** Talk or type directly to the Gemini AI Agent to explain what needs testing. The AI dynamically asks for URLs, login credentials, and specific workflows.
- **Autonomous Playwright Execution:** The agent writes and executes its own Playwright test steps in real-time. It navigates, clicks, types, and validates the DOM completely autonomously.
- **Real-Time Execution Streaming:** Watch the browser execute tests live. The UI streams SSE events to show current steps, execution status, and live screenshot thumbnails of what the headless browser sees.
- **Self-Healing Selectors:** If a class name or ID changes on the target website, the AI uses DOM analysis to locate the intended element and heal the test step automatically.
- **Visual AI Validation:** Uses **Gemini 2.0 Flash** to analyze "Before" and "After" screenshots of every test case. The AI visually confirms if the action (like a successful login or a popup appearing) actually occurred on the screen.
- **Detailed Interactive Reports:** After execution, view a comprehensive breakdown. See every single step, the exact millisecond duration, targeted elements, executed values, full session replay videos, console errors, network failures, and individual step screenshots.

---

## Architecture

```
User
 │
 Web Interface (Next.js — Mission Control UI)
 │
 ├── Voice + Text Conversation Layer
 │         │
 │   Gemini Requirement Agent (Flash) (Option to use Pro Models)
 │         │
 │   Gemini Test Planner Agent (Flash) (Option to use Pro Models)
 │         │
 │   Redis / BullMQ Queue
 │         │
 │   Browser Execution Engine (Playwright)
 │         │
 │   Screenshot + Video Recorder
 │         │
 │   Gemini Report Agent (Flash) (Option to use Pro Models)
 │         │
 │   Interactive QA Report UI
 │
 └── MongoDB (missions, test_runs, test_cases, test_steps)
```

### Multi-Agent Pipeline

| Agent | Model | Purpose |
|-------|-------|---------|
| **Requirement Agent** | Gemini Flash | Conversational requirement extraction |
| **Test Planner Agent** | Gemini Flash | Workflow planning and test case generation |
| **Browser Execution Engine** | Playwright + DOM Analyzer | Autonomous browser testing |
| **Report Agent** | Gemini Flash | AI storytelling and report generation |

---

## 🖥 UI — Mission Control

The interface is an **"AI Mission Control"** experience with a dark-themed, futuristic design utilizing a glassmorphism design system.

### App Phases

| Phase | View | Description |
|-------|------|-------------|
| **Launch** | Full-screen hero | Animated AI orb + "Launch Test Mission" button |
| **Conversation** | Three-panel layout | AI Avatar (20%) · Conversation (40%) · Browser Preview (40%) |
| **Execution** | Expanded browser | AI Avatar (15%) · Logs (25%) · Live Browser with WebRTC-style SSE streaming screenshots (60%) |
| **Results** | Dashboard | Pass/fail stats, AI insights, and a portal to the detailed Step-by-Step execution breakdown |

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** 20+
- **MongoDB** 7+ (or MongoDB Atlas)
- **Redis** 7+ (or Upstash Redis)
- **Google Gemini API Key** — get one at [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 1. Install Dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# ─── Required ──────────────────────────
DATABASE_URL=mongodb://localhost:27017/test-agent
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your-gemini-api-key

# ─── Gemini Models ─────────────────────
GEMINI_FLASH_MODEL=gemini-2.0-flash       # Fast reasoning
GEMINI_PRO_MODEL=gemini-1.5-pro           # Heavy reasoning

# ─── Application ───────────────────────
APP_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Start Database Services

```bash
# Start MongoDB and Redis (if using Docker)
docker compose -f docker/docker-compose.yml up mongo redis -d

# Create database indexes
npm run db:migrate
```

### 4. Run the Application

You can start both the Next.js UI and the Background Queue Worker concurrently using the `dev:all` command:

```bash
npm run dev:all
```
*Alternatively, you can run them in separate terminals using `npm run dev` and `npm run worker`.*

Open **http://localhost:3000** to see the Mission launch screen.

---

## Docker Production Deployment

This application includes a robust `Dockerfile` built on top of the official Playwright Ubuntu image to ensure that all required Chromium system dependencies (fonts, codecs, etc.) are perfectly pre-installed.

### 1. Build the Docker Image

The Dockerfile installs both the Next.js application and the background worker.

```bash
docker build -t browser-agent-next .
```

### 2. Run the Container

Provide your `.env` file to the container. The Docker entrypoint uses the `start:all` concurrently command to automatically boot both the web server and the BullMQ worker internally.

```bash
docker run -p 3000:3000 --env-file .env browser-agent-next
```

---

## Project Structure

```
/app                          Next.js App Router
  /page.tsx                   Main Mission Control page (state machine)
  /globals.css                Design system (glassmorphism, neon, orb)
  /mission-live/
    /[testId]/page.tsx        Detailed Execution Report Dashboard (Video, Steps, Logs)
  /api/
    /mission/                 Mission lifecycle APIs
      /[missionId]/stream/    Server-Sent Events (SSE) for Live Browser Previews
      /[missionId]/execute/   Trigger Playwright background job
    /test/[runId]/            Data aggregation APIs for test results
    /test/[runId]/video/      Internal streaming relay for local .webm session replays

/components/mission/          Mission Control UI components
  AiAvatar.tsx                Animated AI orb with state visuals
  ConversationPanel.tsx       Chat transcript + AI reasoning
  BrowserPreview.tsx          Live browser preview + streaming overlays
  DynamicInputPanel.tsx       Bottom input panel (URL, email, password)
  TestResults.tsx             Results dashboard with stats + links to full report

/lib/
  /ai/
    geminiClient.ts           Unified Gemini API client (Flash + Pro)
    requirementAgent.ts       Conversational requirement extraction
    testPlannerAgent.ts       Workflow planning agent
    screenshotAnalyzer.ts     Gemini Flash visual validation of screen states
  /db/
    db.ts                     MongoDB connection + collections
  /mcp/
    browserTools.ts           Playwright browser tool abstraction (clicks, typing, asserts)
    selectorEngine.ts         Self-healing selector engine
  /executor/
    testRunner.ts             Playwright browser execution engine & DOM capture
  /queue/
    queue.ts                  BullMQ job queue management (Redis)

/worker/
  worker.ts                   Background job processor for Playwright executions

Dockerfile                    Production-ready Playwright container definition
```

---

## Security & Safety

- **Internal IP Blocking:** Refuses to navigate to `localhost`, `10.x`, `192.168.x`, or `169.254.x` networks to prevent SSRF vulnerabilities.
- **Protocol Restriction:** Playwright is explicitly blocked from using the `file://` protocol.
- **Download Blocking:** The automated browser cannot trigger file downloads to the host machine.
- **Rate Limiting:** IP-based request throttling using Redis.
- **Execution Timeout:** Hard limits (e.g., 10 minutes) on browser context lifespans to prevent hanging zombie processes.

---

## NPM Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Start Next.js development server |
| `npm run worker` | `tsx worker/worker.ts` | Start background BullMQ worker |
| `npm run dev:all` | `concurrently ...` | Start Next.js & worker together (Dev) |
| `npm run build` | `next build` | Create production Next.js build |
| `npm run start` | `next start` | Start Next.js production server |
| `npm run start:all` | `concurrently ...` | Start Next.js & worker together (Prod) |
| `npm run typecheck` | `tsc --noEmit` | Run TypeScript type checking workflows |
| `npm run db:migrate` | `tsx lib/db/migrate.ts` | Initialize/Index MongoDB collections |

---

## License

Private — M.I.N.D. (Machine Interface for Navigation & Diagnostics)

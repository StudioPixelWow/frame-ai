# PixelManageAI System Audit — April 2026

## 1. Current Live App Status

### What EXISTS and WORKS
- **Next.js 15.3 app** with App Router, RTL Hebrew layout, dark/light theme
- **24 route pages** under `(dashboard)` group — all render, all visual shells with demo data
- **Landing page** with blue gradient hero, branding, CTAs
- **TopNav** with all 20+ route buttons
- **AI content generation pipeline** (fully implemented, deterministic):
  - Hook generation (4 styles, preset-aware)
  - CTA generation (5 goals)
  - Smart trimmer (15s/30s/45s with scoring)
  - B-roll suggestion engine
  - Variation generator (3 strategies)
- **Transcript analysis** (Anthropic Claude integration, file-based storage)
- **Highlight detection** (4 classifiers with pattern-based scoring)
- **Storage abstraction** (local filesystem + S3/R2 adapters)
- **Error handling framework** (22 error codes, recovery handlers)
- **Persistence/auto-save** for wizard state (serialization, migration, restore)
- **Render engine client** (submitRender, getRenderStatus, polling)
- **Queue architecture** (BullMQ definitions, worker factory — NOT wired)
- **Config/env validation** (25+ env vars, process-type validation)
- **Status machine** (draft → analysing → approved → rendering → complete)

### What EXISTS but is NOT CONNECTED
- Queue system (BullMQ/Redis) — types imported but packages not installed
- S3 adapter — code exists but no credentials or bucket configured
- Render worker — 10-step pipeline defined but no entry point
- Analysis worker — orchestration logic exists, no consumer process
- API client (browser-side) — calls endpoints that don't fully exist

### Remotion Renderer (separate project: pixelmanage-renderer)
- **Express server** on port 3002 with full API
- **Single composition**: PixelManageEdit (segments + subtitles overlay)
- **3 subtitle presets**: Pixel Premium, Pixel Performance, Pixel Social
- **4 formats**: 9:16, 16:9, 1:1, 4:5
- **Dynamic duration** from segment data
- **H.264 MP4 output** at 30fps
- **Python fallback** (ffmpeg-based renderer on port 3001)
- Endpoints: POST /preview-data, GET /api/render/:id, POST /api/upload

---

## 2. Approved Preview Status

The preview (`pixelmanageai-preview.html`, 49K lines) is a complete SPA with:
- **12 data collections** all persisted to localStorage
- **Full CRUD** on tasks, employees, payments, leads, clients, projects, campaigns, approvals, automations, assets, users
- **Modal-based editing** for every entity
- **Business workflows**: lead→client conversion, payment status transitions, approval flows, task assignment with workload tracking
- **Permission system**: 4 roles (admin/manager/editor/viewer) with 20+ granular permissions
- **Activity logging** across all modules
- **Statistics engine** with AI-generated business insights
- **Calendar** aggregating tasks, payments, leads, campaigns
- **Viral trend analysis** with content idea generation
- **Social campaign management** with post scheduling (Meta/TikTok integration stubs)

---

## 3. Functional Gaps

| Component | Preview Has | Live App Has | Gap |
|-----------|-----------|-------------|-----|
| Database | localStorage mock | Nothing | No persistence at all |
| Auth/Users | Role-based access | Nothing | No login, no roles |
| Project CRUD | Full modal-based | Demo data only | No create/edit/delete |
| Client CRUD | Full with sync | Demo data only | No mutations |
| Task CRUD | Kanban + assignment | Demo data only | No drag/drop, no save |
| Payment CRUD | Status transitions | Demo data only | No invoice management |
| Lead pipeline | Drag + convert | Demo data only | No lead→client flow |
| Employee CRUD | Full with workload | Demo data only | No team management |
| Campaign CRUD | Post scheduling | Demo data only | No campaign creation |
| Approval workflow | 3-state flow | Demo data only | No approve/reject |
| Automation engine | Rule toggle + log | Demo data only | No rule execution |
| Video upload | File upload | Nothing | No upload endpoint |
| Video wizard | Multi-step flow | Nothing | No creation workflow |
| Render trigger | Progress + output | Nothing | No render submission |
| Search/filter | Every page | Minimal | Most pages static |
| Toasts/feedback | Hebrew toasts | Nothing | No notification system |
| Modals | Every entity | Nothing | No modal framework |

---

## 4. Visual Gaps

| Element | Preview Design | Current Status |
|---------|---------------|----------------|
| Dashboard | Animated orbs, glassmorphism cards | ✅ Matching |
| Projects grid | Card layout with filters | ✅ Matching |
| Stats page | Charts, donut, bar charts | Partial (bars only, no canvas charts) |
| Calendar | Full month grid with events | ✅ Basic structure |
| Settings | Sidebar layout | ✅ Matching |
| Client detail | Tabbed view with history | ❌ Missing entirely |
| Project detail | Full review panel | ❌ Missing entirely |
| Project wizard | 4-step creation flow | ❌ Missing entirely |
| Campaign detail | Post grid + scheduling | ❌ Missing entirely |
| Lead pipeline | Drag-drop columns | ❌ Missing (has demo grid only) |
| Modals | Glassmorphic overlays | ❌ No modal system |

---

## 5. Missing System Modules

### CRITICAL (blocks the product from working)
1. **Data persistence layer** — no database, no schema, no migrations
2. **API endpoints for CRUD** — only transcript analysis route works
3. **Upload pipeline** — no file upload endpoint in Next.js
4. **Project creation wizard** — the core user flow doesn't exist
5. **Render submission** — can't trigger a video render from the app

### IMPORTANT (blocks professional use)
6. **Authentication** — no login, no sessions, no user management
7. **Modal/dialog system** — can't create or edit any entity
8. **Toast notification system** — no user feedback
9. **Real data binding** — all pages show hardcoded demo data
10. **Client detail view** — can't drill into a client record
11. **Project detail view** — can't review/approve a project

### ENHANCING (completes the product)
12. **Lead → client conversion workflow**
13. **Payment reminder/collection system**
14. **Automation rule execution engine**
15. **Activity logging across modules**
16. **Social media publishing integration**
17. **Analytics and reporting with real data**

---

## 6. Missing Video Workflow Stages

```
CURRENT STATE:
Upload ❌ → Inspect ⚠️ → Transcribe ⚠️ → Analyze ✅ → Generate ✅ → Approve ❌ → Render ⚠️ → Deliver ❌

DETAIL:
1. Upload video          ❌ No upload UI, no upload endpoint
2. Create project        ❌ No wizard, no project creation
3. Video inspection      ⚠️ ffprobe commands exist, not wired
4. Transcription         ⚠️ Provider interface exists, no actual ASR
5. Segment generation    ✅ Algorithm implemented
6. Transcript analysis   ✅ Claude integration works (file-based)
7. Content generation    ✅ Hooks, CTAs, trimmer, broll, variations
8. User review/edit      ❌ No review panel UI
9. User approval         ❌ No approval action
10. Render submission    ⚠️ Client API exists, no server endpoint
11. Remotion render      ✅ Works in pixelmanage-renderer
12. Output storage       ⚠️ S3 adapter exists, not configured
13. Delivery/download    ❌ No output viewing page
```

---

## 7. Recommended Implementation Order

### Phase 1: Data Layer (Foundation)
**Goal:** Every page can read/write real data

1. Install and configure a lightweight database (better-sqlite3 or Prisma + SQLite for dev)
2. Define schemas for: projects, clients, tasks, payments, leads, employees, users, campaigns
3. Create a shared data access layer (repository pattern)
4. Seed with demo data matching the preview
5. Build React context/hooks for data access from pages

### Phase 2: Core CRUD + UI Framework
**Goal:** Users can create, edit, delete entities

1. Build modal/dialog component system
2. Build toast notification system
3. Wire up Client CRUD (create, edit, list, detail view)
4. Wire up Project CRUD (create wizard, list, detail view)
5. Wire up Task CRUD (kanban board with drag, create, assign)
6. Wire up Payment CRUD (invoices, status transitions)
7. Wire up Lead pipeline (stages, drag, convert to client)
8. Wire up Employee management

### Phase 3: Video Pipeline (Core Product)
**Goal:** A user can upload video and get a rendered output

1. Build upload endpoint (multipart → local storage)
2. Build project creation wizard (4 steps matching preview)
3. Wire video inspection (ffprobe via child_process)
4. Wire transcription (Whisper API or mock for dev)
5. Connect transcript analysis → content generation
6. Build review/approval panel UI
7. Wire render submission → pixelmanage-renderer
8. Build render progress UI
9. Build output viewing/download page

### Phase 4: Business System Integration
**Goal:** End-to-end workflows work

1. Lead → Client conversion flow
2. Client → Project association
3. Project → Task/milestone creation
4. Payment tracking linked to projects
5. Activity logging across all mutations
6. Role-based access control
7. Settings persistence

### Phase 5: Polish & Advanced Features
1. Calendar with real data aggregation
2. Statistics with live computation
3. Automation rule execution
4. Campaign management
5. Client portal
6. Export/reporting

---

## 8. Highest-Priority Next Step

**Phase 1, Step 1: Install SQLite + define core schemas + build data hooks**

This unblocks EVERYTHING. Without data persistence, no page can do anything real. The approach:

- Use `better-sqlite3` (zero-config, no server needed, fast)
- Define 8 core tables with proper relationships
- Create a `src/lib/db/` module with typed queries
- Create React hooks (`useProjects()`, `useClients()`, etc.)
- Replace hardcoded demo data in all pages with real queries
- Seed database with preview-matching demo data

This single step transforms every page from a visual shell into a data-driven component.

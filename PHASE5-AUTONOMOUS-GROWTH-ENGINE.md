# Phase 5: Autonomous Growth Engine — Delivery Report

## 1. Database Structure

### New Tables

**`app_system_events`** — Stores all system events emitted by the event bus.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| type | text | Event type (e.g. `lead_created`, `deal_closed`) |
| payload | jsonb | Event-specific data |
| entityType | text | `lead`, `campaign`, `client`, `task`, `payment`, `approval`, `system` |
| entityId | text | ID of the related entity |
| source | text | `system`, `user`, `ai`, `automation` |
| processed | boolean | Whether the event has been handled |
| createdAt | timestamptz | Event timestamp |

**`app_audit_log`** — Full audit trail for compliance and debugging.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| userId | text | Acting user ID |
| userName | text | Acting user display name |
| userEmail | text | Acting user email |
| action | text | `create`, `update`, `delete`, `read`, `login`, `logout`, `export`, `import`, `approve`, `reject`, `automation_executed`, `system_event` |
| entityType | text | Entity category |
| entityId | text | Entity ID |
| entityName | text | Entity display name |
| ipAddress | text | Client IP |
| userAgent | text | Client user agent |
| changes | jsonb | `{ field: { old: value, new: value } }` |
| result | text | `success` or `failure` |
| errorMessage | text | Error details if failed |
| createdAt | timestamptz | Log timestamp |

### Supabase Migration SQL

```sql
-- System Events table
CREATE TABLE IF NOT EXISTS app_system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  processed BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_system_events_type ON app_system_events(type);
CREATE INDEX idx_system_events_entity ON app_system_events("entityType", "entityId");
CREATE INDEX idx_system_events_created ON app_system_events("createdAt" DESC);

-- Audit Log table
CREATE TABLE IF NOT EXISTS app_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "userName" TEXT,
  "userEmail" TEXT,
  action TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityName" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  changes JSONB DEFAULT '{}',
  result TEXT DEFAULT 'success',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_action ON app_audit_log(action);
CREATE INDEX idx_audit_log_entity ON app_audit_log("entityType", "entityId");
CREATE INDEX idx_audit_log_user ON app_audit_log("userId");
CREATE INDEX idx_audit_log_created ON app_audit_log("createdAt" DESC);
```

---

## 2. Event System

### Architecture

```
User Action / System Trigger
        │
        ▼
   emitEvent()          ← src/lib/events/event-bus.ts
        │
        ├─ Store event → POST /api/data/system-events → app_system_events
        │
        ├─ Run registered handlers (in-memory EventHandler[])
        │
        ├─ executeAutomation(event) → src/lib/automation/engine.ts
        │
        └─ logAudit() → POST /api/data/audit-log → app_audit_log
```

### 14 Event Types

| Event | When it fires |
|-------|---------------|
| `lead_created` | New lead is added |
| `lead_status_changed` | Lead moves through funnel |
| `lead_not_responded` | Lead has no response past threshold |
| `lead_assigned` | Lead is assigned to a rep |
| `campaign_performance_drop` | Campaign metrics decline |
| `creative_fatigue_detected` | Ad creative loses effectiveness |
| `competitor_shift_detected` | Competitor landscape changes |
| `deal_closed` | Lead converts to client |
| `deal_lost` | Lead is marked lost |
| `task_created` | New task is created |
| `task_completed` | Task is marked done |
| `payment_overdue` | Payment passes due date |
| `client_created` | New client is added |
| `approval_pending` | Item needs approval |

### Usage

```typescript
import { emitEvent } from '@/lib/events';

// When a lead is created:
await emitEvent(
  'lead_created',
  { leadName: lead.name, source: lead.source, value: lead.value },
  'lead',
  lead.id,
  'user'
);

// Register a custom handler:
import { onEvent } from '@/lib/events';
onEvent('deal_closed', async (event) => {
  // Custom logic when a deal closes
});
```

---

## 3. Automation Flow

### Pipeline

```
System Event arrives
        │
        ▼
Fetch active AutomationRules from /api/data/automation-rules
        │
        ▼
For each rule:
  1. Map rule.trigger → matching event types (TRIGGER_EVENT_MAP)
  2. Check if event.type is in the matching set
  3. Evaluate rule.conditions against event.payload (JSON match)
  4. Execute rule.action:
     ├─ create_task       → POST /api/data/employee-tasks
     ├─ assign_employee   → (logged, ready for integration)
     ├─ send_email        → (simulated, logged)
     ├─ send_whatsapp     → (simulated, logged)
     ├─ create_notification → POST /api/data/activities
     └─ push_to_approval_center → POST /api/data/approvals
  5. Update rule stats (lastTriggeredAt, triggerCount++)
  6. Audit log the execution
```

### Trigger → Event Mapping

| AutomationTrigger | Matching SystemEventTypes |
|---|---|
| `lead_status_changed` | lead_status_changed, lead_created, deal_closed, deal_lost |
| `task_created` | task_created |
| `task_status_changed` | task_completed |
| `payment_overdue` | payment_overdue |
| `project_created` | client_created |
| `proposal_sent` | lead_status_changed |

### Condition Evaluation

Rules can have JSON conditions that filter events:

```json
// Only fire for marketing leads:
{ "interestType": "marketing" }

// Only fire for high-value deals:
{ "value": 10000 }
```

Empty or invalid conditions = rule fires for all matching events.

---

## 4. AI Decision Layer

All decisions are **deterministic** — no external AI API calls. Located in `src/lib/ai/decisions.ts`.

### Lead Quality Analysis (`analyzeLeadQuality`)

Scores leads 0-100 based on: source quality, company info, proposal amount, campaign attribution, interest type, contact completeness. Returns score, level (high/medium/low), factors list, suggested action, urgency, and estimated value.

### Best Rep Selection (`selectBestRep`)

Scores employees by: current workload (fewer = better), skill match for the lead type, availability, past win rate. Returns ranked list.

### Message Suggestion (`suggestMessage`)

Returns channel, subject, body, and tone based on lead status. Hebrew templates for each funnel stage.

### Campaign Optimization (`suggestCampaignOptimization`)

Analyzes: ROI vs threshold, conversion rate, cost per lead, creative fatigue indicators. Returns recommendations with severity levels.

### Conversion Metrics (`computeConversionMetrics`)

Computes: totalLeads, wonLeads, closeRate, avgResponseTime, avgDealValue, totalRevenue, roiPerCampaign, closeRatePerSource.

API endpoint: `GET /api/data/conversion-metrics` — fetches leads + campaigns and returns computed metrics.

---

## 5. Files Delivered

### Core Infrastructure

| File | Purpose |
|------|---------|
| `src/lib/events/types.ts` | SystemEventType, SystemEvent, EventHandler types |
| `src/lib/events/event-bus.ts` | Central event bus: emit, store, handle, automate |
| `src/lib/events/index.ts` | Barrel export |
| `src/lib/automation/engine.ts` | Rule matching, condition eval, action execution |
| `src/lib/automation/index.ts` | Barrel export |
| `src/lib/ai/decisions.ts` | Deterministic AI decision service |
| `src/lib/audit/types.ts` | AuditEntry, AuditAction types |
| `src/lib/audit/logger.ts` | logAudit(), getAuditLog() functions |
| `src/lib/audit/index.ts` | Barrel export |

### API Routes

| Route | Methods | Table |
|-------|---------|-------|
| `/api/data/system-events` | GET, POST | app_system_events |
| `/api/data/audit-log` | GET, POST | app_audit_log |
| `/api/data/conversion-metrics` | GET | (computed from leads + campaigns) |

### Data Layer

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Added SystemEvent and AuditLog interfaces |
| `src/lib/db/collections.ts` | Added systemEvents and auditLog SupabaseCrud instances |
| `src/lib/api/use-entity.ts` | Added useSystemEvents() and useAuditLog() hooks |

### UI Pages

| File | Features |
|------|----------|
| `src/app/(dashboard)/automations/page.tsx` | Upgraded: real API data, Hebrew labels, recent activity feed, CRUD operations |
| `src/app/(dashboard)/activity/audit/page.tsx` | New: full audit log viewer with filters, search, expandable details |

---

## 6. Next Steps

### Immediate (Wire Events into Existing Flows)

1. **Add `emitEvent()` calls** to existing mutation handlers — when a lead is created/updated in the leads page, when a task is completed, when a payment status changes. This is the "plug in" step that activates the entire engine.

2. **Wire approval mode** — some automation rules should require human approval before executing. The `push_to_approval_center` action exists; add an `approvalMode` flag to AutomationRule so users can choose per-rule.

3. **Connect email/WhatsApp** — the `send_email` and `send_whatsapp` actions currently simulate. Connect them to your actual email service (Gmail API is already partially integrated) and WhatsApp Business API.

### Short-term

4. **Scheduled event checks** — add a cron/interval that checks for `lead_not_responded` (leads with no activity past 48h), `payment_overdue` (past due date), and `client_missing_monthly_gantt` conditions.

5. **Dashboard widgets** — add automation activity summary to the main dashboard and command center (event counts, automation execution rate, latest actions).

6. **Conversion metrics dashboard** — build a dedicated analytics page using the `/api/data/conversion-metrics` endpoint.

### Medium-term

7. **Real AI integration** — replace deterministic scoring with Claude API calls for lead analysis, message generation, and campaign recommendations.

8. **A/B testing framework** — track which automated actions produce better outcomes and self-optimize.

---

## 7. Terminal Commands

```bash
# 1. Create database tables (run in Supabase SQL Editor or via migration)
#    Copy the SQL from Section 1 above

# 2. Verify the new API routes work
curl http://localhost:3000/api/data/system-events
curl http://localhost:3000/api/data/audit-log
curl http://localhost:3000/api/data/conversion-metrics

# 3. Test event emission (from browser console)
import { emitEvent } from '@/lib/events';
await emitEvent('lead_created', { name: 'Test Lead', source: 'website' }, 'lead', 'test-123', 'user');

# 4. Run development server
npm run dev

# 5. Build for production
npm run build
```

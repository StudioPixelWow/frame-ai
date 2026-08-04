# פקודה מלאה — מערכת יצירת ויזואלים AI

## הוראות שימוש
העתק את כל הטקסט מתחת לקו ותשלח אותו כפקודה לקלוד בפרויקט החדש.

---

# COMMAND: Build Complete AI Visual Generation System

## CRITICAL RULES (apply to ENTIRE build)
- **Hebrew RTL UI only** — all user-facing text in Hebrew, `direction: 'rtl'`
- **100% inline `style={{}}`** — NO Tailwind, NO CSS modules
- **CSS variables for colors** — `--accent`, `--surface-raised`, `--border`, `--foreground`, `--neon-yellow` etc.
- **Toast API**: `toast("message", "type")` — NOT `toast.success()` or `toast.error()`
- **Supabase JSONB pattern**: rows are `{ id, data }` — extract with `rowToEntity<T>(row)` spreading `data` and attaching `id`
- **Single storage bucket**: `project-files` for all uploads
- **`ignoreBuildErrors: true`** in next.config.ts
- **`maxDuration = 300`** on all API routes (Vercel serverless 5-min limit)
- **NO fake data** — every value must come from real DB or real API calls
- **Logo is NEVER rendered by AI** — always composited programmatically with `sharp` after generation

---

## ARCHITECTURE OVERVIEW

### Pipeline Flow (7 stages)
```
1. Context Builder → loads Gantt item + client data
2. Brand Intelligence → aggregates colors, typography, assets, feedback, creative DNA from 7+ DB tables
3. Creative Director → GPT-4.1 produces CreativeStrategy with optimized image prompt
4. Image Generation → gpt-image-2 generates image(s), with brand assets as reference images
5. Quality Gate → GPT-4.1 vision validates result (single/refine only, skipped for initial 3-option)
6. Logo Compositing → sharp resizes logo to 35% width, places center-bottom with 3% margin
7. Upload + Persist → Supabase Storage + version records in DB
```

### User Flow
```
1. User opens Gantt item → clicks "צור ויזואל מלא"
2. Setup phase: choose platform size, click "AI בריף אוטומטי" to get 3 concepts, or write manually
3. Click "צור 3 אפשרויות" → system generates 3 options in parallel
4. Choosing phase: 3-column grid, each card has 3 buttons:
   - "צור התאמות גודל" → creates FB/IG/Story variants, saves to Gantt, marks approved
   - "שמור כגודל בודד" → saves single image, marks approved
   - "✏️ שלח הערות" → opens inline textarea for refinement notes
5. Complete phase: shows all variants with download links
```

### Bulk Flow (from monthly calendar)
```
1. Button "צור עיצובים גרפיים" in calendar header
2. Fetches all Gantt items without imageUrls
3. Processes items ONE BY ONE (avoids Vercel timeout)
4. For each: auto-brief → generate 3 options → PAUSE for user selection → save
5. Uses Promise-based pause: selectionResolverRef stores promise resolver
```

---

## DATABASE TABLES (create migration endpoint)

### Table: `ai_generation_sessions`
```sql
CREATE TABLE IF NOT EXISTS ai_generation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**JSONB `data` fields:**
```typescript
interface AIGenerationSession {
  id: string;
  clientId: string;
  ganttItemId: string;
  contextSnapshot: Record<string, any>;
  sizePreset: { label: string; width: number; height: number; platform: string; format: string };
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Table: `ai_generation_versions`
```sql
CREATE TABLE IF NOT EXISTS ai_generation_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**JSONB `data` fields:**
```typescript
interface AIGenerationVersion {
  id: string;
  sessionId: string;
  versionNumber: number; // 1, 2, 3 for initial; 11, 21, 31 after refine
  imageUrl: string;
  prompt: string;
  width: number;
  height: number;
  quality: string;
  status: 'generated' | 'selected' | 'rejected';
  durationMs: number;
  userInstruction: string;
  generationMode: 'initial' | 'single' | 'refine';
  creativeStrategy: CreativeStrategy | null;
  qualityAssessment: QualityAssessment | null;
  createdAt: string;
}
```

---

## FILES TO CREATE (in order)

### 1. `src/lib/services/visual-generation/generationContextBuilder.ts` (~300 lines)

**Purpose:** Load Gantt item + client data, assemble into `GenerationContext`.

```typescript
export interface GenerationContext {
  ganttItem: ClientGanttItem;
  clientName: string;
  businessField: string;
  logoUrl: string | null;
  brandColors: string[];
  creativeDna: CreativeDNA | null;
  brandProfile: BrandStyleProfile | null;
  monthTheme: string;
  campaignTag: string;
  platform: string;
  format: string;
  promptContext: string;
}

export async function buildGenerationContext(
  ganttItemId: string,
  clientId: string
): Promise<GenerationContext>
```

**Implementation notes:**
- Load Gantt item from JSONB table `app_client_gantt_items` filtered by ganttItemId
- Load client from `clients` table (direct columns, not JSONB)
- Load CreativeDNA from `app_creative_dna` filtered by clientId
- Load BrandStyleProfile from `app_brand_style_profiles` filtered by clientId
- Brand colors priority: CreativeDNA.colorPalette > BrandStyleProfile.primaryColors + secondaryColors
- `buildPromptContext()` assembles: brief title, brief content, client name, business field, month theme, campaign tag, creative DNA summary, brand colors, platform, format

---

### 2. `src/lib/services/visual-generation/brandIntelligenceService.ts` (~460 lines)

**Purpose:** Aggregate ALL brand data from 7+ tables into one `BrandIntelligence` object.

```typescript
export interface BrandIntelligence {
  primaryColors: string[];
  secondaryColors: string[];
  accentColors: string[];
  forbiddenColors: string[];
  preferredTypography: Record<string, any> | null;
  forbiddenTypography: Record<string, any> | null;
  visualPersonality: string;
  preferredVisualStyles: string[];
  rejectedVisualStyles: string[];
  preferredImageStyles: string[];
  rejectedImageStyles: string[];
  preferredLayouts: any[];
  rejectedLayouts: any[];
  logoUrl: string | null;
  brandBookUrl: string | null;
  approvedReferenceUrls: string[];
  rejectedReferenceUrls: string[];
  productImageUrls: string[];
  toneOfVoice: string;
  photographyStyle: string;
  graphicStyle: string;
  doNotUsePatterns: string[];
  likedStyles: string[];
  dislikedStyles: string[];
  brandRulesSummary: string;
}

export async function gatherBrandIntelligence(clientId: string): Promise<BrandIntelligence>
```

**Data sources (query ALL of these):**
1. `app_brand_style_profiles` → colors, typography, visual styles, layouts, avoidRules
2. `app_creative_dna` → tone, photography, graphic style, do-not-use patterns
3. `clients` table → `logo_url` (direct column)
4. `app_client_files` → brand_asset category files (Brand Kit uploads)
5. `app_brand_assets` → logo, brand guidelines, approved/rejected references, product images
6. `app_creative_feedback` → liked/disliked styles from previous generations
7. `app_creative_briefs` → past briefs for context

**Logo priority:** `clients.logo_url` > `app_brand_assets` logo asset

**Critical helper:** `buildBrandRulesSummary()` — generates human-readable brand rules from all data

---

### 3. `src/lib/services/visual-generation/creativeDirectorService.ts` (~310 lines)

**Purpose:** GPT-4.1 Creative Director — transforms brief + brand data into optimized image prompt.

```typescript
export interface CreativeStrategy {
  centralMessage: string;
  creativeIdea: string;
  informationHierarchy: string[];
  composition: string;
  lighting: string;
  cameraAngle: string;
  colorPalette: string[];
  style: string;
  mood: string;
  visualType: string;
  elementPlacement: string;
  luxuryLevel: number; // 1-10
  typographyStyle: string;
  immutableElements: string[];
  referenceNotes: string;
  optimizedImagePrompt: string; // THE ACTUAL PROMPT FOR gpt-image-2
  directorNotes: string;
}

export async function runCreativeDirector(
  context: GenerationContext,
  brandIntel: BrandIntelligence,
  userInstruction: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<CreativeDirectorResult>
```

**CRITICAL — System Prompt Rules (17 rules):**
1. Brand colors MUST dominate 60%+ of the image — use ONLY hex codes from brand kit
2. Logo: do NOT render in image — will be composited programmatically after generation
3. NO text/headlines in the image — text will be added as overlay later
4. Characters should wear brand-colored clothing
5. Premium quality: cinematic lighting, depth of field, studio-grade
6. Composition must leave space for logo at bottom center (bottom 15%)
7. Use brand typography style as visual reference
8. Match visual personality (e.g., "bold and modern" vs "elegant and refined")
9. Include approved reference styles, avoid rejected styles
10. Color harmony — ensure brand colors are complementary in the composition
11. No watermarks, stock photo aesthetics, or generic corporate imagery
12. Photography style must match brand DNA (e.g., documentary, lifestyle, studio)
13. Graphic elements should follow brand's graphic style
14. Aspect ratio must match the requested dimensions
15. Professional Israeli market targeting
16. The `optimizedImagePrompt` field is the most important output — maximize detail for gpt-image-2
17. Output as JSON with all 17 CreativeStrategy fields

**LLM config:** GPT-4.1, `response_format: { type: 'json_object' }`, `temperature: 0.7`, `max_tokens: 4000`

---

### 4. `src/lib/services/visual-generation/openaiImageProvider.ts` (~245 lines)

**Purpose:** Wrapper for OpenAI gpt-image-2 API — both generation and editing with reference images.

```typescript
export async function generateImage(params: {
  prompt: string;
  width?: number;
  height?: number;
  quality?: string;
  outputFormat?: string;
  n?: number;
}): Promise<ImageGenerationResult>

export async function editImage(params: {
  prompt: string;
  referenceImages: Buffer[];
  width?: number;
  height?: number;
  quality?: string;
  outputFormat?: string;
}): Promise<ImageGenerationResult>
```

**Implementation notes:**
- `generateImage()`: JSON POST to `https://api.openai.com/v1/images/generations`, model: `gpt-image-2`, response_format: `b64_json`, background: `opaque`
- `editImage()`: multipart/form-data POST to `https://api.openai.com/v1/images/edits`. Reference images appended as `image[]` fields (Blob from Buffer). Max 16 reference images.
- `clampDimension(value)`: clamp to 16..3840, round to multiple of 16
- `buildSize(w, h)`: format as `{w}x{h}`
- Error handling: parse OpenAI error response body, throw with status code and message

**CRITICAL — when to use which function:**
- If client has brand assets (logo + approved references) → use `editImage()` with assets as reference images
- If no brand assets → use `generateImage()` (text-to-image only)

---

### 5. `src/lib/services/visual-generation/visualQualityGate.ts` (~260 lines)

**Purpose:** Post-generation validation using GPT-4.1 vision.

```typescript
export interface QualityAssessment {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  shouldRetry: boolean;
  correctivePrompt: string;
  assessment: string;
}

export async function runQualityGate(
  imageBase64: string,
  strategy: CreativeStrategy,
  briefSummary: string
): Promise<QualityGateResult>
```

**Scoring:** >= 75 = passed. 10 evaluation criteria: brief alignment, visual concept, commercial quality, composition, brand colors, text quality, logo presence, aspect ratio, distortions, unwanted elements.

**CRITICAL — graceful degradation:** If API errors or returns invalid data, return `passed: true, score: 70`. Quality gate errors NEVER block image delivery.

**Usage:** Only for single/refine modes. SKIPPED for initial 3-option generation (too slow for parallel generation).

---

### 6. Logo Compositing Function (shared across routes)

```typescript
async function compositeLogoOnBase64(
  base64: string,
  logoUrl: string,
  fallbackWidth: number,
  fallbackHeight: number
): Promise<string> {
  // 1. Download logo from URL
  // 2. Get base image metadata (width, height) with sharp
  // 3. Resize logo to 35% of image width, maintaining aspect ratio
  // 4. Composite logo at center-bottom with 3% margin from bottom
  // 5. Return new base64 string
}
```

**Implementation with sharp:**
```typescript
import sharp from 'sharp';

const imgBuf = Buffer.from(base64, 'base64');
const meta = await sharp(imgBuf).metadata();
const w = meta.width || fallbackWidth;
const h = meta.height || fallbackHeight;

const logoRes = await fetch(logoUrl);
const logoBuf = Buffer.from(await logoRes.arrayBuffer());
const logoW = Math.round(w * 0.35);
const resizedLogo = await sharp(logoBuf)
  .resize(logoW, null, { fit: 'inside' })
  .png()
  .toBuffer();
const logoMeta = await sharp(resizedLogo).metadata();
const logoH = logoMeta.height || Math.round(logoW * 0.3);

const left = Math.round((w - logoW) / 2);
const top = Math.round(h - logoH - h * 0.03);

const result = await sharp(imgBuf)
  .composite([{ input: resizedLogo, left, top }])
  .png()
  .toBuffer();

return result.toString('base64');
```

---

### 7. API Routes

#### `POST /api/visual-generation/generate` (~780 lines)
- `maxDuration = 300`
- Request: `{ ganttItemId, clientId, instruction?, concepts?: string[], width?, height?, quality?, mode?: 'initial'|'refine'|'single' }`
- **Mode 'initial':** Generates 3 images in parallel. For each concept: run Creative Director separately, then generate image. Uses `MAX_RETRIES = 2` with backoff `3000 * (attempt + 1)` ms for transient errors (502, 503, 429).
- **Mode 'refine':** Single image with user notes appended to original prompt
- Fetch brand assets as Buffers: logo (1), approved references (up to 10), product images (up to 4)
- If references exist → `editImage()`, else → `generateImage()`
- Logo compositing after generation
- Upload to `project-files` bucket: `visual-generation/{clientId}/{sessionId}/{versionNumber}.png`

#### `POST /api/visual-generation/auto-brief` (~190 lines)
- `maxDuration = 60`
- Request: `{ ganttItemId, clientId }`
- GPT-4.1, temperature 0.8, max_tokens 1000
- System prompt: act as Creative Director, produce 3 GENUINELY DIFFERENT concepts in Hebrew
- Output format: `---CONCEPT1--- ... ---CONCEPT2--- ... ---CONCEPT3---`
- Parse by splitting on `---CONCEPT\d+---` regex
- ABSOLUTE COLOR RULE: only allowed hex codes from brand kit
- Response: `{ instruction: concepts[0], concepts: string[] }`

#### `POST /api/visual-generation/finalize` (~193 lines)
- `maxDuration = 120`
- Request: `{ versionId, ganttItemId, clientId }`
- Size variants with sharp `fit: 'cover'` (NOT `fit: 'contain'` — no black borders!):
  - Facebook: 1200×630
  - Instagram: 1080×1080
  - Story: 1080×1920
- Upload each variant to `visual-generation/{clientId}/{sessionId}/final_{key}.png`
- Save all URLs to Gantt item's `imageUrls` array
- Set Gantt item `status = 'approved'`

#### `POST /api/visual-generation/bulk-generate-item` (~980 lines)
- `maxDuration = 300`
- Request: `{ clientId, ganttItemId, action?, versionId?, notes? }`
- **action = 'generate':** auto-brief + generate 3 options, return versions
- **action = 'refine':** download original, build refinement prompt, editImage with original as reference, composite logo, upload, new version with `versionNumber = original * 10 + 1`
- **action = 'save-with-variants':** run finalize (FB/IG/Story)
- **action = 'save-single':** mark selected, save single URL to Gantt item
- GET handler: return items without imageUrls for a clientId

#### `GET/POST /api/visual-generation/sessions` (~92 lines)
- GET: load sessions by ganttItemId with attached versions
- POST: create new session

#### `GET/PATCH /api/visual-generation/versions` (~102 lines)
- GET: versions by sessionId sorted by versionNumber
- PATCH: update status to selected/rejected

---

### 8. Frontend Components

#### `VisualGenerationWorkspace.tsx` (~1460 lines)
Modal dialog triggered from Gantt detail panel. 4 phases: setup → choosing → finalizing → complete.

**Setup phase:**
- 6 platform size presets as clickable chips
- 3 separate concept textarea fields (NOT a single textarea)
- "AI בריף אוטומטי" button → calls auto-brief, fills 3 textareas
- Quality selector dropdown
- "צור 3 אפשרויות" button

**Choosing phase:**
- 3-column grid of generated images
- Each card has version badge (e.g., "אפשרות 1"), image, 3 buttons:
  - "צור התאמות גודל" (accent/cyan button) → handleChooseVersion
  - "שמור כגודל בודד" (ghost button) → handleSaveSingle
  - "✏️ שלח הערות" (ghost button) → toggles refine textarea

**Refine inline UI:**
- Textarea with placeholder "כתוב הערות לתיקון..."
- "שלח ויצר מחדש" button (yellow)
- During refine: button shows "מייצר מחדש... ({elapsed}s)" with live timer
- Timer via useEffect + setInterval counting seconds while isRefining=true

**Finalizing phase:**
- Animated pipeline stages with progress bar

**Complete phase:**
- "הויזואל מוכן לפרסום!" banner with green checkmark
- 4-column grid: original + FB + IG + Story with download links
- "סגור — המשימה מוכנה ✓" and "← חזור לבחירה" buttons

#### `BulkVisualGeneration.tsx` (~1030 lines)
Full-screen portal (createPortal to document.body) for batch processing.

**Key pattern — Promise-based pause for user selection:**
```typescript
const selectionResolverRef = useRef<(() => void) | null>(null);

function waitForSelection(): Promise<void> {
  return new Promise(resolve => {
    selectionResolverRef.current = resolve;
  });
}

// In processAllItems loop:
for (const item of items) {
  // ... generate 3 options ...
  await waitForSelection(); // PAUSES here until user picks
}

// When user clicks an option:
function handleSelectOption(itemId, versionId, mode) {
  // ... save the selection ...
  selectionResolverRef.current?.(); // RESUMES the loop
}
```

**Layout:** Left sidebar (260px) with item list + status icons. Main area with processing card, 3-option grid, and same 3-button pattern per card.

---

### 9. Gantt Integration

Add a button to the Gantt detail panel (the panel that opens when clicking a Gantt item):
```tsx
{/* Button to open visual generation workspace */}
<button onClick={() => setShowVisualGen(true)} style={{...}}>
  צור ויזואל מלא
</button>

{showVisualGen && (
  <VisualGenerationWorkspace
    open={showVisualGen}
    onClose={() => setShowVisualGen(false)}
    ganttItemId={selectedItem.id}
    clientId={clientId}
    itemTitle={selectedItem.title}
  />
)}
```

Add a "צור עיצובים גרפיים" button to the monthly calendar header:
```tsx
<button onClick={() => setShowBulkGen(true)} style={{...}}>
  צור עיצובים גרפיים
</button>

{showBulkGen && createPortal(
  <BulkVisualGeneration
    clientId={clientId}
    onClose={() => setShowBulkGen(false)}
    onComplete={() => { setShowBulkGen(false); refreshGantt(); }}
  />,
  document.body
)}
```

Show approved images in Gantt detail panel:
```tsx
{item.imageUrls?.length > 0 && (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {item.imageUrls.map((url, i) => (
      <img key={i} src={url} style={{ width: 120, borderRadius: 8 }} />
    ))}
  </div>
)}
```

---

## MISTAKES TO AVOID (learned the hard way)

1. **sharp `fit: 'contain'` creates black borders** → Use `fit: 'cover', position: 'centre'` for size variants
2. **MAX_RETRIES scoping bug** → Declare `const MAX_RETRIES = 2` at MODULE LEVEL (top of file), not inside a function. If it's inside `runGenerate()`, the `refine` block in `POST()` handler can't access it.
3. **Vercel 300s timeout for bulk** → Process items ONE AT A TIME with per-item API calls, not all at once
4. **createPortal for overlays** → BulkVisualGeneration must use `createPortal(document.body)` to bypass CSS containing block issues
5. **OpenAI transient 502s** → Always add retry logic for status 502, 503, 429 with exponential backoff
6. **User perceives long operations as "stuck"** → Add elapsed timer (seconds counter) to ALL buttons that trigger long operations
7. **Single textarea for 3 concepts doesn't work** → Use 3 SEPARATE textarea fields, one per concept
8. **Quality Gate slows 3-option generation** → Skip quality gate for initial mode (run it only for single/refine)
9. **Auto-brief invents colors** → Add ABSOLUTE COLOR RULE in auto-brief system prompt listing exact allowed hex codes
10. **Logo in AI prompt doesn't match real logo** → NEVER ask AI to generate the logo. Always composite with sharp AFTER generation
11. **gpt-image-2 editImage needs multipart/form-data** → Use Blob from Buffer for reference images, append as `image[]` fields
12. **Version numbering after refine produces confusing labels** → `versionNumber * 10 + 1` produces "אפשרות 11" from version 1. Consider using the original number or a different display strategy.

---

## ENVIRONMENT VARIABLES REQUIRED
```
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## NPM DEPENDENCIES
```
sharp@0.34.5
openai (or direct fetch to API)
```

## SUPABASE STORAGE
- Single bucket: `project-files` (must exist, public access)
- Upload path pattern: `visual-generation/{clientId}/{sessionId}/{filename}.png`

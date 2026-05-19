/**
 * FrameAI — Auto-Edit Pipeline for Podcast Clip Engine
 *
 * Orchestrates an 8-step pipeline that transforms raw clip data
 * and transcript segments into a fully-configured Remotion
 * composition, complete with subtitles, B-roll placements,
 * zoom keyframes, transitions, and audio enhancement settings.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AutoEditConfig {
  enableSubtitles: boolean;
  enableBroll: boolean;
  enableZoomFocus: boolean;
  enableTransitions: boolean;
  enableAudioEnhancement: boolean;
  viralStyle: string;
  outputFormat: '16:9' | '9:16' | '1:1' | '4:5';
  brandColors?: { primary: string; secondary: string; accent: string };
  logoUrl?: string;
}

export interface AutoEditResult {
  compositionProps: Record<string, unknown>;
  subtitles: Array<{ text: string; start: number; end: number }>;
  brollPlacements: Array<{ startTime: number; endTime: number; keyword: string }>;
  zoomKeyframes: Array<{ time: number; scale: number; focusX: number; focusY: number }>;
  transitions: Array<{ time: number; type: string; duration: number }>;
  audioConfig: { normalize: boolean; denoiseLevel: number; compressorRatio: number };
}

export interface ClipData {
  id: string;
  episodeId: string;
  startTime: number;
  endTime: number;
  videoUrl: string;
  audioUrl?: string;
  title?: string;
  topicTags?: string[];
  viralScore?: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
  words?: Array<{ word: string; start: number; end: number; confidence?: number }>;
}

/** Aspect-ratio dimension lookup. */
const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '4:5':  { width: 1080, height: 1350 },
};

// ── Step 1: Extract Segment ─────────────────────────────────────────────────

/**
 * Generates ffmpeg commands for extracting the clip segment from
 * the full-length source video/audio.
 */
export function extractSegment(
  clip: ClipData,
): { videoCommand: string; audioCommand?: string } {
  const duration = clip.endTime - clip.startTime;

  const videoCommand = [
    'ffmpeg',
    '-ss', String(clip.startTime),
    '-i', JSON.stringify(clip.videoUrl),
    '-t', String(duration),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-c:a', 'aac',
    '-y',
    JSON.stringify(`clip_${clip.id}.mp4`),
  ].join(' ');

  let audioCommand: string | undefined;
  if (clip.audioUrl) {
    audioCommand = [
      'ffmpeg',
      '-ss', String(clip.startTime),
      '-i', JSON.stringify(clip.audioUrl),
      '-t', String(duration),
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      JSON.stringify(`clip_${clip.id}_audio.m4a`),
    ].join(' ');
  }

  return { videoCommand, audioCommand };
}

// ── Step 2: Adapt Format ────────────────────────────────────────────────────

/**
 * Calculates crop, scale, and padding parameters so the source
 * footage fits the target aspect ratio cleanly.
 */
export function adaptFormat(
  outputFormat: AutoEditConfig['outputFormat'],
  sourceWidth = 1920,
  sourceHeight = 1080,
): { width: number; height: number; cropFilter: string; scaleFilter: string; padFilter: string } {
  const target = FORMAT_DIMENSIONS[outputFormat];
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = target.width / target.height;

  let cropFilter: string;
  let scaleFilter: string;
  let padFilter: string;

  if (Math.abs(sourceAspect - targetAspect) < 0.01) {
    // Aspect ratios match — simple scale
    cropFilter = 'none';
    scaleFilter = `scale=${target.width}:${target.height}`;
    padFilter = 'none';
  } else if (sourceAspect > targetAspect) {
    // Source is wider — crop sides
    const cropWidth = Math.round(sourceHeight * targetAspect);
    const offsetX = Math.round((sourceWidth - cropWidth) / 2);
    cropFilter = `crop=${cropWidth}:${sourceHeight}:${offsetX}:0`;
    scaleFilter = `scale=${target.width}:${target.height}`;
    padFilter = 'none';
  } else {
    // Source is taller — pad (letterbox) or crop top/bottom
    const cropHeight = Math.round(sourceWidth / targetAspect);
    const offsetY = Math.round((sourceHeight - cropHeight) / 2);
    cropFilter = `crop=${sourceWidth}:${cropHeight}:0:${offsetY}`;
    scaleFilter = `scale=${target.width}:${target.height}`;
    padFilter = 'none';
  }

  return { width: target.width, height: target.height, cropFilter, scaleFilter, padFilter };
}

// ── Step 3: Generate Subtitles ──────────────────────────────────────────────

/**
 * Builds a subtitle array from transcript segments that overlap
 * with the clip time range. Times are normalised to clip-relative
 * offsets (i.e. clip start = 0).
 */
export function generateSubtitles(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
): AutoEditResult['subtitles'] {
  return transcript
    .filter((seg) => seg.end > clipStart && seg.start < clipEnd)
    .map((seg) => ({
      text: seg.text.trim(),
      start: Math.max(0, seg.start - clipStart),
      end: Math.min(clipEnd - clipStart, seg.end - clipStart),
    }));
}

// ── Step 4: Place B-Roll ────────────────────────────────────────────────────

/** Keywords that commonly indicate good B-roll insertion opportunities. */
const BROLL_TRIGGER_PATTERNS = [
  'for example', 'like when', 'imagine', 'picture this',
  'look at', 'think about', 'let me show', 'consider',
  'the data', 'research shows', 'studies show',
];

/**
 * Identifies B-roll insertion points based on topic keywords and
 * common trigger phrases in the transcript.
 */
export function placeBroll(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  topicTags: string[] = [],
): AutoEditResult['brollPlacements'] {
  const placements: AutoEditResult['brollPlacements'] = [];
  const clipDuration = clipEnd - clipStart;

  // Minimum 3 seconds between B-roll placements
  let lastPlacementEnd = -3;

  for (const seg of transcript) {
    if (seg.end <= clipStart || seg.start >= clipEnd) continue;

    const relStart = Math.max(0, seg.start - clipStart);
    if (relStart - lastPlacementEnd < 3) continue;

    const textLower = seg.text.toLowerCase();

    // Check for trigger phrases
    const triggered = BROLL_TRIGGER_PATTERNS.some((p) => textLower.includes(p));
    // Check for topic-tag matches
    const matchedTag = topicTags.find((tag) => textLower.includes(tag.toLowerCase()));

    if (triggered || matchedTag) {
      const keyword = matchedTag ?? extractKeyword(seg.text);
      const duration = Math.min(2.5, clipDuration - relStart);
      if (duration > 0.5) {
        placements.push({
          startTime: relStart,
          endTime: relStart + duration,
          keyword,
        });
        lastPlacementEnd = relStart + duration;
      }
    }
  }

  return placements;
}

/** Extracts the most meaningful keyword from a text snippet. */
function extractKeyword(text: string): string {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'it', 'to', 'and', 'or', 'but',
    'in', 'on', 'at', 'for', 'of', 'with', 'that', 'this',
    'was', 'are', 'be', 'have', 'had', 'do', 'does', 'did',
    'i', 'you', 'he', 'she', 'we', 'they', 'me', 'us',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  return words[0] ?? 'general';
}

// ── Step 5: Generate Zoom Keyframes ─────────────────────────────────────────

/**
 * Creates zoom/pan keyframes based on speech emphasis cues.
 * Words with high confidence and longer duration are treated as
 * emphasis points that deserve a subtle zoom-in.
 */
export function generateZoomKeyframes(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  style: 'aggressive' | 'subtle' | 'none' = 'subtle',
): AutoEditResult['zoomKeyframes'] {
  if (style === 'none') return [];

  const keyframes: AutoEditResult['zoomKeyframes'] = [];
  const maxScale = style === 'aggressive' ? 1.35 : 1.15;
  const clipDuration = clipEnd - clipStart;

  // Always start at neutral
  keyframes.push({ time: 0, scale: 1.0, focusX: 0.5, focusY: 0.5 });

  // Find emphasis points from word-level data
  // IMPORTANT: enforce minimum 4-second gap between zooms to prevent
  // the "bump every second" effect that occurs with dense transcript words.
  const MIN_GAP_SEC = 4;
  let lastZoomTime = -MIN_GAP_SEC;

  for (const seg of transcript) {
    if (seg.end <= clipStart || seg.start >= clipEnd) continue;
    if (!seg.words || seg.words.length === 0) continue;

    for (const word of seg.words) {
      if (word.end <= clipStart || word.start >= clipEnd) continue;

      const wordDuration = word.end - word.start;
      // Longer words (spoken slowly) indicate emphasis — raised threshold to 0.6s
      if (wordDuration > 0.6) {
        const relTime = word.start - clipStart;

        // Skip if too close to the last zoom
        if (relTime - lastZoomTime < MIN_GAP_SEC) continue;

        const emphasisFactor = Math.min(1, (wordDuration - 0.6) / 0.6);
        const scale = 1.0 + (maxScale - 1.0) * emphasisFactor;

        keyframes.push({
          time: relTime,
          scale,
          focusX: 0.5,
          focusY: 0.4, // Slight upward focus for face framing
        });

        // Ease back to neutral
        keyframes.push({
          time: Math.min(relTime + 1.5, clipDuration),
          scale: 1.0,
          focusX: 0.5,
          focusY: 0.5,
        });

        lastZoomTime = relTime;
      }
    }
  }

  return keyframes;
}

// ── Step 6: Generate Transitions ────────────────────────────────────────────

/**
 * Adds intro and outro transitions based on the viral style.
 */
export function generateTransitions(
  clipDuration: number,
  style: string,
): AutoEditResult['transitions'] {
  const transitions: AutoEditResult['transitions'] = [];

  // Intro transition
  const introType = style === 'hormozi' ? 'zoom-in' : 'fade-in';
  const introDuration = style === 'hormozi' ? 0.3 : 0.8;
  transitions.push({ time: 0, type: introType, duration: introDuration });

  // Outro transition
  const outroType = style === 'hormozi' ? 'hard-cut' : 'fade-out';
  const outroDuration = style === 'hormozi' ? 0.15 : 0.6;
  transitions.push({
    time: clipDuration - outroDuration,
    type: outroType,
    duration: outroDuration,
  });

  return transitions;
}

// ── Step 7: Enhance Audio ───────────────────────────────────────────────────

/**
 * Builds an audio normalisation / enhancement config based on the
 * selected style and whether audio enhancement is enabled.
 */
export function enhanceAudio(
  enabled: boolean,
  style: string,
): AutoEditResult['audioConfig'] {
  if (!enabled) {
    return { normalize: false, denoiseLevel: 0, compressorRatio: 1 };
  }

  // More aggressive compression for high-energy styles
  const isHighEnergy = ['hormozi', 'tiktok', 'reels'].includes(style);

  return {
    normalize: true,
    denoiseLevel: isHighEnergy ? 0.6 : 0.4,
    compressorRatio: isHighEnergy ? 4 : 2.5,
  };
}

// ── Step 8: Build Composition Props ─────────────────────────────────────────

/**
 * Assembles all pipeline outputs into the final Remotion
 * composition props object, ready for rendering.
 */
export function buildCompositionProps(
  clip: ClipData,
  config: AutoEditConfig,
  format: ReturnType<typeof adaptFormat>,
  subtitles: AutoEditResult['subtitles'],
  brollPlacements: AutoEditResult['brollPlacements'],
  zoomKeyframes: AutoEditResult['zoomKeyframes'],
  transitions: AutoEditResult['transitions'],
  audioConfig: AutoEditResult['audioConfig'],
  ffmpegCommands: ReturnType<typeof extractSegment>,
): Record<string, unknown> {
  const clipDuration = clip.endTime - clip.startTime;
  const fps = 30;

  return {
    // Source
    clipId: clip.id,
    episodeId: clip.episodeId,
    videoUrl: clip.videoUrl,
    audioUrl: clip.audioUrl,

    // Dimensions
    width: format.width,
    height: format.height,
    fps,
    durationInFrames: Math.ceil(clipDuration * fps),

    // Filters
    cropFilter: format.cropFilter,
    scaleFilter: format.scaleFilter,
    padFilter: format.padFilter,

    // Features
    subtitles: config.enableSubtitles ? subtitles : [],
    brollPlacements: config.enableBroll ? brollPlacements : [],
    zoomKeyframes: config.enableZoomFocus ? zoomKeyframes : [],
    transitions: config.enableTransitions ? transitions : [],
    audioConfig,

    // Branding
    brandColors: config.brandColors ?? null,
    logoUrl: config.logoUrl ?? null,
    viralStyle: config.viralStyle,
    outputFormat: config.outputFormat,

    // FFmpeg extraction commands (for pre-processing)
    ffmpegCommands,
  };
}

// ── Pipeline Orchestrator ───────────────────────────────────────────────────

/**
 * Runs the full 8-step auto-edit pipeline and returns a complete
 * `AutoEditResult` ready for Remotion rendering.
 */
export async function runAutoEditPipeline(
  config: AutoEditConfig,
  clipData: ClipData,
  transcript: TranscriptSegment[],
): Promise<AutoEditResult> {
  const clipStart = clipData.startTime;
  const clipEnd = clipData.endTime;
  const clipDuration = clipEnd - clipStart;

  // 1. Extract segment (ffmpeg commands)
  const ffmpegCommands = extractSegment(clipData);

  // 2. Adapt format
  const format = adaptFormat(config.outputFormat);

  // 3. Generate subtitles
  const subtitles = config.enableSubtitles
    ? generateSubtitles(transcript, clipStart, clipEnd)
    : [];

  // 4. Place B-roll
  const brollPlacements = config.enableBroll
    ? placeBroll(transcript, clipStart, clipEnd, clipData.topicTags)
    : [];

  // 5. Zoom keyframes
  const zoomStyle = config.viralStyle === 'hormozi' ? 'aggressive' : 'subtle';
  const zoomKeyframes = config.enableZoomFocus
    ? generateZoomKeyframes(transcript, clipStart, clipEnd, zoomStyle)
    : [];

  // 6. Transitions
  const transitions = config.enableTransitions
    ? generateTransitions(clipDuration, config.viralStyle)
    : [];

  // 7. Audio enhancement
  const audioConfig = enhanceAudio(config.enableAudioEnhancement, config.viralStyle);

  // 8. Build composition props
  const compositionProps = buildCompositionProps(
    clipData,
    config,
    format,
    subtitles,
    brollPlacements,
    zoomKeyframes,
    transitions,
    audioConfig,
    ffmpegCommands,
  );

  return {
    compositionProps,
    subtitles,
    brollPlacements,
    zoomKeyframes,
    transitions,
    audioConfig,
  };
}

/**
 * GET /api/media/audio?trackId=t1&bpm=92&mood=warm&duration=30
 * Generates a simple procedural background music track as a WAV file.
 * This serves as a real audio source for the Remotion composition until
 * actual licensed music files are added.
 *
 * Each trackId generates a deterministic, unique audio pattern based on
 * its BPM and mood parameters.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "public/media/audio");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trackId = searchParams.get("trackId") || "default";
  const bpm = parseInt(searchParams.get("bpm") || "100");
  const mood = searchParams.get("mood") || "neutral";
  const durationSec = Math.min(180, parseInt(searchParams.get("duration") || "30"));

  // Check cache
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  // v2 suffix ensures old seedless cache files are ignored
  const cacheFile = path.join(CACHE_DIR, `${trackId}_v2.wav`);

  if (fs.existsSync(cacheFile)) {
    const buffer = fs.readFileSync(cacheFile);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Generate audio
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const buffer = generateProceduralAudio(numSamples, sampleRate, bpm, mood, trackId);

  // Write WAV file
  const wavBuffer = encodeWav(buffer, sampleRate);
  fs.writeFileSync(cacheFile, Buffer.from(wavBuffer));

  return new NextResponse(Buffer.from(wavBuffer), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

/** Simple deterministic pseudo-random from seed — returns 0..1 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Generate procedural audio based on parameters — each trackId produces unique audio */
function generateProceduralAudio(
  numSamples: number,
  sampleRate: number,
  bpm: number,
  mood: string,
  trackId: string
): Float32Array {
  const samples = new Float32Array(numSamples);
  const beatInterval = (60 / bpm) * sampleRate;

  // Deterministic seed from trackId — drives unique variations per track
  let seed = 0;
  for (let i = 0; i < trackId.length; i++) seed += trackId.charCodeAt(i) * (i + 1);
  const rng = seededRandom(seed);

  // Mood-based parameters
  const moodParams: Record<string, { baseFreq: number; harmonics: number; volume: number; warmth: number }> = {
    warm: { baseFreq: 220, harmonics: 3, volume: 0.15, warmth: 0.8 },
    uplifting: { baseFreq: 261, harmonics: 4, volume: 0.18, warmth: 0.6 },
    elegant: { baseFreq: 196, harmonics: 2, volume: 0.12, warmth: 0.9 },
    epic: { baseFreq: 146, harmonics: 5, volume: 0.2, warmth: 0.5 },
    dramatic: { baseFreq: 130, harmonics: 5, volume: 0.22, warmth: 0.4 },
    intense: { baseFreq: 174, harmonics: 4, volume: 0.2, warmth: 0.3 },
    touching: { baseFreq: 246, harmonics: 2, volume: 0.1, warmth: 0.9 },
    hopeful: { baseFreq: 293, harmonics: 3, volume: 0.14, warmth: 0.7 },
    calm: { baseFreq: 196, harmonics: 2, volume: 0.08, warmth: 0.95 },
    powerful: { baseFreq: 164, harmonics: 5, volume: 0.25, warmth: 0.3 },
    fast: { baseFreq: 196, harmonics: 4, volume: 0.2, warmth: 0.4 },
    dynamic: { baseFreq: 220, harmonics: 4, volume: 0.2, warmth: 0.5 },
    confident: { baseFreq: 220, harmonics: 3, volume: 0.16, warmth: 0.6 },
    exciting: { baseFreq: 261, harmonics: 4, volume: 0.2, warmth: 0.5 },
    reliable: { baseFreq: 196, harmonics: 2, volume: 0.12, warmth: 0.7 },
    refined: { baseFreq: 220, harmonics: 2, volume: 0.1, warmth: 0.85 },
    polished: { baseFreq: 246, harmonics: 2, volume: 0.11, warmth: 0.8 },
    fresh: { baseFreq: 329, harmonics: 3, volume: 0.15, warmth: 0.5 },
    tech: { baseFreq: 293, harmonics: 3, volume: 0.14, warmth: 0.4 },
    inspiring: { baseFreq: 261, harmonics: 4, volume: 0.18, warmth: 0.6 },
    determined: { baseFreq: 220, harmonics: 4, volume: 0.2, warmth: 0.5 },
    clean: { baseFreq: 329, harmonics: 1, volume: 0.08, warmth: 0.9 },
    ambient: { baseFreq: 174, harmonics: 2, volume: 0.06, warmth: 0.95 },
    catchy: { baseFreq: 329, harmonics: 3, volume: 0.2, warmth: 0.5 },
    viral: { baseFreq: 293, harmonics: 4, volume: 0.22, warmth: 0.4 },
    fun: { baseFreq: 349, harmonics: 3, volume: 0.2, warmth: 0.5 },
    neutral: { baseFreq: 220, harmonics: 3, volume: 0.15, warmth: 0.6 },
  };

  const params = moodParams[mood] || moodParams.neutral;

  // Seed-based frequency offset — shifts pitch uniquely per trackId
  const freqOffset = (rng() - 0.5) * 30; // ±15 Hz shift
  const base = params.baseFreq + freqOffset;

  // Seed-based chord progression variation
  // Standard intervals: unison, fifth, minor 6th, fourth
  // We add per-track variation to the ratios
  const chordRatios = [
    1.0,
    1.5 + (rng() - 0.5) * 0.08,
    1.2 + (rng() - 0.5) * 0.1,
    1.33 + (rng() - 0.5) * 0.08,
  ];

  // Seed-based progression order — shuffle chord order per track
  const progressionOrder = [0, 1, 2, 3];
  // Deterministic shuffle using rng
  for (let i = progressionOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [progressionOrder[i], progressionOrder[j]] = [progressionOrder[j], progressionOrder[i]];
  }

  const chordFreqs = progressionOrder.map(idx => base * chordRatios[idx]);

  // Seed-based rhythm variation
  const beatPulseWidth = 0.03 + rng() * 0.04; // 0.03 - 0.07
  const beatPulseFreq = 50 + rng() * 30; // 50 - 80 Hz
  const beatPulseVol = 0.05 + rng() * 0.08; // 0.05 - 0.13

  // Seed-based high melody note (unique melodic motif per track)
  const melodyEnabled = rng() > 0.3; // 70% chance of melody
  const melodyFreq = base * 2 * (1 + (rng() - 0.5) * 0.2); // octave up ± variation
  const melodyVol = params.volume * 0.2;
  const melodyBeats = [
    Math.floor(rng() * 4),
    Math.floor(rng() * 4) + 4,
    Math.floor(rng() * 4) + 8,
    Math.floor(rng() * 4) + 12,
  ]; // which beats within a 16-beat cycle get the melody

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beatPos = i / beatInterval;
    const chordIdx = Math.floor(beatPos / 4) % 4;
    const freq = chordFreqs[chordIdx];

    let sample = 0;

    // Fundamental + harmonics
    for (let h = 1; h <= params.harmonics; h++) {
      const harmVol = params.volume / (h * (1 + params.warmth));
      sample += Math.sin(2 * Math.PI * freq * h * t) * harmVol;
    }

    // Sub bass
    sample += Math.sin(2 * Math.PI * (freq / 2) * t) * params.volume * 0.3;

    // Beat pulse — per-track variation in width, freq, volume
    const beatPhase = (i % beatInterval) / beatInterval;
    if (beatPhase < beatPulseWidth) {
      sample += Math.sin(2 * Math.PI * beatPulseFreq * t) * beatPulseVol * (1 - beatPhase / beatPulseWidth);
    }

    // Melody motif — short notes on specific beats, unique per track
    if (melodyEnabled) {
      const beatInCycle = Math.floor(beatPos) % 16;
      if (melodyBeats.includes(beatInCycle)) {
        const notePhase = beatPos - Math.floor(beatPos);
        if (notePhase < 0.5) {
          const noteEnv = notePhase < 0.05 ? notePhase / 0.05 : 1 - (notePhase - 0.05) / 0.45;
          sample += Math.sin(2 * Math.PI * melodyFreq * t) * melodyVol * noteEnv;
        }
      }
    }

    // Fade in/out
    const fadeIn = Math.min(1, (i / sampleRate) / 1.5);
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 2));
    sample *= fadeIn * fadeOut;

    // Soft clip
    samples[i] = Math.max(-0.95, Math.min(0.95, sample));
  }

  return samples;
}

/** Encode Float32Array as WAV buffer */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

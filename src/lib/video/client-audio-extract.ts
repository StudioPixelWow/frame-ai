"use client";

/**
 * Client-side audio extraction for transcription.
 *
 * A video file is often far larger than Whisper's 25MB limit, even though the
 * audio track is tiny. We decode the file's audio in the browser (Web Audio API),
 * downmix to mono and resample to 16kHz, then encode a small 16-bit WAV — which
 * Whisper accepts. No extra dependencies, no CDN, no server ffmpeg needed.
 *
 * 16kHz mono 16-bit ≈ 1.9MB/min, so up to ~13 min fits under 25MB at 16kHz
 * (we auto-drop to 8kHz for longer clips to extend the ceiling to ~26 min).
 */
export async function extractAudioWav(file: Blob): Promise<Blob> {
  const AC: typeof AudioContext =
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AC) throw new Error("Web Audio API not available");

  const arrayBuf = await file.arrayBuffer();
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    try { await ctx.close(); } catch { /* noop */ }
  }

  // Pick sample rate so the result stays comfortably under 25MB.
  const minutes = decoded.duration / 60;
  const targetRate = minutes > 12 ? 8000 : 16000;

  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return encodeWav(rendered.getChannelData(0), targetRate);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);          // PCM chunk size
  view.setUint16(20, 1, true);           // format = PCM
  view.setUint16(22, 1, true);           // channels = mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

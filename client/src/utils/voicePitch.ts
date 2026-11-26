/**
 * Lightweight zero-dependency autocorrelation pitch (F0) estimator for 16 kHz PCM audio.
 * Filters out silence (RMS < 0.015) and non-human frequency ranges (< 70 Hz or > 360 Hz).
 */
export function estimatePitchHz(samples: Float32Array, sampleRate = 16000): number | null {
  if (samples.length < 256) {
    return null;
  }

  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);
  if (rms < 0.015) {
    return null;
  }

  const minLag = Math.floor(sampleRate / 360); // 360 Hz upper human F0
  const maxLag = Math.min(Math.floor(sampleRate / 70), Math.floor(samples.length / 2)); // 70 Hz lower human F0

  let bestLag = -1;
  let bestCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let normA = 0;
    let normB = 0;
    const len = samples.length - lag;
    for (let i = 0; i < len; i++) {
      const a = samples[i];
      const b = samples[i + lag];
      corr += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB);
    const normalized = denom > 0 ? corr / denom : 0;
    if (normalized > bestCorr) {
      bestCorr = normalized;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestCorr < 0.55) {
    return null;
  }

  return Math.round(sampleRate / bestLag);
}

export class UtterancePitchTracker {
  private pitches: number[] = [];

  pushFrame(samples: Float32Array, sampleRate = 16000): void {
    const f0 = estimatePitchHz(samples, sampleRate);
    if (f0 != null) {
      this.pitches.push(f0);
      if (this.pitches.length > 60) {
        this.pitches.shift();
      }
    }
  }

  flush(): { avgPitchHz: number; pitchStdHz: number } | null {
    if (this.pitches.length < 3) {
      this.pitches = [];
      return null;
    }
    const avg = this.pitches.reduce((a, b) => a + b, 0) / this.pitches.length;
    const variance =
      this.pitches.reduce((acc, p) => acc + (p - avg) * (p - avg), 0) / this.pitches.length;
    this.pitches = [];
    return {
      avgPitchHz: Math.round(avg),
      pitchStdHz: Math.round(Math.sqrt(variance)),
    };
  }
}

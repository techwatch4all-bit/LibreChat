/**
 * Satchida Studio - Client-Side Video Export Engine
 * 100% in-browser WebGL/Canvas/MediaRecorder compilation.
 * Zero server CPU, zero server disk bloat.
 */

export interface ExportProgress {
  percent: number;
  currentSecond: number;
  totalSeconds: number;
  phase: 'preparing' | 'rendering' | 'encoding' | 'done';
}

export interface RenderVideoOptions {
  iframe: HTMLIFrameElement | null;
  duration: number;
  fps: 24 | 30 | 60;
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * Detect best supported video container/codec on the client's browser.
 * Prefers MP4 (H.264) for maximum hardware compatibility, falls back to WebM (VP9/VP8).
 */
export function getSupportedVideoMimeType(): { mimeType: string; extension: 'mp4' | 'webm' } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'video/mp4', extension: 'mp4' };
  }

  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  for (const type of mp4Types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'mp4' };
    }
  }

  const webmTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  for (const type of webmTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type, extension: 'webm' };
    }
  }

  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Saves a video Blob directly to the client's local storage.
 * Uses the HTML5 File System Access API (showSaveFilePicker) on Chromium/Edge,
 * with standard ObjectURL trigger fallback on iOS Safari/Firefox/Android.
 * ZERO HTTP/network calls are made.
 */
export async function saveVideoToDisk(
  blob: Blob,
  suggestedTitle = 'satchida_motion_video',
): Promise<boolean> {
  const { extension } = getSupportedVideoMimeType();
  const actualExt = blob.type.includes('mp4') ? 'mp4' : extension;
  const fileName = `${suggestedTitle.replace(/\.[^/.]+$/, '')}.${actualExt}`;

  // Desktop Chromium / Edge: Direct native Save dialog
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (options: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: actualExt === 'mp4' ? 'MP4 Video (*.mp4)' : 'WebM Video (*.webm)',
            accept: {
              [actualExt === 'mp4' ? 'video/mp4' : 'video/webm']: [`.${actualExt}`],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return false; // User cancelled
      }
      console.warn('showSaveFilePicker failed, falling back to download link:', err);
    }
  }

  // iOS Safari / Firefox / Android fallback
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.error('Failed to trigger video download:', err);
    return false;
  }
}

/**
 * Client-Side Video Render Pipeline:
 * Renders the film deterministically from t = 0 to t = duration at target FPS,
 * records frames using MediaRecorder + Canvas captureStream, and compiles to an in-memory Blob.
 */
export async function renderFilmVideo({
  iframe,
  duration,
  fps = 30,
  onProgress,
  signal,
}: RenderVideoOptions): Promise<Blob> {
  if (!iframe) {
    throw new Error('Render target iframe not available');
  }

  const { mimeType } = getSupportedVideoMimeType();
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const dt = 1 / fps;

  onProgress?.({
    percent: 0,
    currentSecond: 0,
    totalSeconds: duration,
    phase: 'preparing',
  });

  // Access iframe document
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    throw new Error('Unable to access iframe document context');
  }

  // Find canvas or generate a capture surface
  let canvas = doc.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    // If film is SVG/DOM based, create a high-DPI capture surface
    canvas = doc.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.display = 'none';
    doc.body.appendChild(canvas);
  }

  // Capture stream from canvas
  let stream: MediaStream;
  try {
    stream = canvas.captureStream
      ? canvas.captureStream(fps)
      : (canvas as any).mozCaptureStream(fps);
  } catch (err) {
    throw new Error(`Browser canvas capture stream not supported: ${(err as Error)?.message}`);
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
    videoBitsPerSecond: 10_000_000, // 10 Mbps for crisp 1080p output
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e) => {
      reject(new Error(`MediaRecorder error: ${(e as any)?.error?.message || 'unknown'}`));
    };

    recorder.onstop = () => {
      onProgress?.({
        percent: 100,
        currentSecond: duration,
        totalSeconds: duration,
        phase: 'done',
      });
      const finalBlob = new Blob(chunks, { type: mimeType });
      resolve(finalBlob);
    };

    recorder.start(100); // 100ms slice chunks

    let currentFrame = 0;
    const contentWin = iframe.contentWindow as any;

    const renderStep = () => {
      if (signal?.aborted) {
        recorder.stop();
        reject(new Error('Export aborted by user'));
        return;
      }

      if (currentFrame > totalFrames) {
        onProgress?.({
          percent: 99,
          currentSecond: duration,
          totalSeconds: duration,
          phase: 'encoding',
        });
        setTimeout(() => recorder.stop(), 200);
        return;
      }

      const t = currentFrame * dt;

      // Invoke deterministic frame calculation
      if (contentWin?.film && typeof contentWin.film.frame === 'function') {
        try {
          contentWin.film._tick = contentWin.film._tick || function () {};
          contentWin.film.frame(t);
        } catch {
          // ignore frame computation errors during render
        }
      }

      currentFrame++;
      const percent = Math.min(99, Math.round((currentFrame / totalFrames) * 100));

      onProgress?.({
        percent,
        currentSecond: Math.min(duration, t),
        totalSeconds: duration,
        phase: 'rendering',
      });

      // Frame pacing: tick on next animation frame
      requestAnimationFrame(renderStep);
    };

    // Kick off render
    requestAnimationFrame(renderStep);
  });
}

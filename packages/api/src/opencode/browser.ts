import path from 'node:path';
import fs from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { logger } from '@librechat/data-schemas';
import type { WebSocket } from 'ws';

function resolveInRepoChromiumPath(): string | undefined {
  const inRepoRoot = path.resolve(__dirname, '../../../../browsers');
  const chromeExe = path.join(inRepoRoot, 'chromium-1234', 'chrome-win64', 'chrome.exe');
  if (fs.existsSync(chromeExe)) {
    return chromeExe;
  }
  return undefined;
}

export interface BrowserSessionState {
  readonly projectId: string;
  readonly userId: string;
  readonly profileDir: string;
  context: BrowserContext | null;
  page: Page | null;
  activeUrl: string;
  isRecording: boolean;
  recordingPath: string | null;
  screencastClients: Set<WebSocket>;
  lastActivity: number;
}

export interface BrowserElementInfo {
  tag: string;
  id?: string;
  classes?: string[];
  selector: string;
  text?: string;
  rect: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
}

export interface BrowserClickOptions {
  selector?: string;
  x?: number;
  y?: number;
}

export interface BrowserNavigateOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export class SandboxedBrowserManager {
  private sessions = new Map<string, BrowserSessionState>();
  private idleCheckInterval: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 mins

  constructor() {
    this.startIdleMonitor();
  }

  private startIdleMonitor() {
    if (this.idleCheckInterval) return;
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [projectId, session] of this.sessions.entries()) {
        if (now - session.lastActivity > this.IDLE_TIMEOUT_MS && session.screencastClients.size === 0) {
          logger.info(`[SandboxedBrowser] Disposing idle browser session for project ${projectId}`);
          void this.closeSession(projectId);
        }
      }
    }, 60 * 1000);
  }

  public async getOrCreateSession(params: {
    projectId: string;
    userId: string;
    projectRoot?: string;
    recordVideo?: boolean;
  }): Promise<BrowserSessionState> {
    const existing = this.sessions.get(params.projectId);
    if (existing && existing.context && existing.page && !existing.page.isClosed()) {
      existing.lastActivity = Date.now();
      return existing;
    }

    if (existing) {
      await this.closeSession(params.projectId);
    }

    // Determine sovereign storage path for browser profiles & recordings
    const baseDir = params.projectRoot || path.join(process.cwd(), 'vibe-apps', params.projectId);
    const profileDir = path.join(baseDir, '.satchida-browser-profile');
    const recordingsDir = path.join(baseDir, '.satchida-recordings');

    try {
      if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
      if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });
    } catch (e) {
      logger.warn(`[SandboxedBrowser] Failed to create directories:`, e);
    }

    const timestamp = Date.now();
    const recordingPath = path.join(recordingsDir, `recording-${params.projectId}-${timestamp}.webm`);

    logger.info(`[SandboxedBrowser] Spawning Chromium context for project ${params.projectId}`);

    const inRepoExecutable = resolveInRepoChromiumPath();
    const context = await chromium.launchPersistentContext(profileDir, {
      executablePath: inRepoExecutable,
      headless: true,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1.5,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SatchidaVibe/1.0',
      recordVideo: params.recordVideo !== false ? { dir: recordingsDir, size: { width: 1280, height: 800 } } : undefined,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
    });

    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    const state: BrowserSessionState = {
      projectId: params.projectId,
      userId: params.userId,
      profileDir,
      context,
      page,
      activeUrl: page.url() || 'about:blank',
      isRecording: params.recordVideo !== false,
      recordingPath,
      screencastClients: new Set<WebSocket>(),
      lastActivity: Date.now(),
    };

    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        state.activeUrl = frame.url();
        state.lastActivity = Date.now();
        this.broadcastState(state);
      }
    });

    page.on('close', () => {
      logger.info(`[SandboxedBrowser] Main page closed for project ${params.projectId}`);
      this.sessions.delete(params.projectId);
    });

    this.sessions.set(params.projectId, state);
    return state;
  }

  public getSession(projectId: string): BrowserSessionState | null {
    return this.sessions.get(projectId) || null;
  }

  public async navigate(projectId: string, options: BrowserNavigateOptions): Promise<{ url: string; title: string }> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }

    session.lastActivity = Date.now();
    await session.page.goto(options.url, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: 30000,
    });

    session.activeUrl = session.page.url();
    const title = await session.page.title();
    return { url: session.activeUrl, title };
  }

  public async click(projectId: string, options: BrowserClickOptions): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }

    session.lastActivity = Date.now();
    if (typeof options.x === 'number' && typeof options.y === 'number') {
      await session.page.mouse.click(options.x, options.y);
    } else if (options.selector) {
      await session.page.click(options.selector, { timeout: 10000 });
    } else {
      throw new Error('Must provide either selector or (x, y) coordinates for click');
    }
  }

  public async typeText(projectId: string, selector: string, text: string, pressEnter = false): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }

    session.lastActivity = Date.now();
    await session.page.fill(selector, text, { timeout: 10000 });
    if (pressEnter) {
      await session.page.keyboard.press('Enter');
    }
  }

  public async inspectDomSummary(projectId: string): Promise<string> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }

    session.lastActivity = Date.now();
    // Return token-pruned accessibility and interactive elements tree
    const summary = await session.page.evaluate(() => {
      const interactiveElements = document.querySelectorAll(
        'button, a, input, select, textarea, [role="button"], [role="link"], [role="checkbox"]'
      );
      const items: string[] = [];
      interactiveElements.forEach((el, index) => {
        if (index > 80) return; // limit to 80 items for context budgeting
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const name = (el as HTMLInputElement).name ? `[name="${(el as HTMLInputElement).name}"]` : '';
        const aria = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
        const type = (el as HTMLInputElement).type ? `[type="${(el as HTMLInputElement).type}"]` : '';
        const text = (el.textContent || (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40);

        items.push(`${tag}${id}${name}${type}${aria}: "${text}" (x:${Math.round(rect.x)}, y:${Math.round(rect.y)})`);
      });
      return items.join('\n');
    });

    return summary;
  }

  public async captureScreenshot(projectId: string): Promise<Buffer> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }
    session.lastActivity = Date.now();
    return await session.page.screenshot({ type: 'jpeg', quality: 85 });
  }

  public async startScreencast(projectId: string, ws: WebSocket): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`No active browser session for project ${projectId}`);
    }

    session.screencastClients.add(ws);
    session.lastActivity = Date.now();

    ws.on('close', () => {
      session.screencastClients.delete(ws);
    });

    // Handle user manual mouse/keyboard takeover from WebSocket
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type: string;
          x?: number;
          y?: number;
          key?: string;
          text?: string;
          button?: 'left' | 'right' | 'middle';
          deltaX?: number;
          deltaY?: number;
          url?: string;
        };

        if (session.page && !session.page.isClosed()) {
          session.lastActivity = Date.now();
          if (msg.type === 'mouse_click' && typeof msg.x === 'number' && typeof msg.y === 'number') {
            await session.page.mouse.click(msg.x, msg.y, { button: msg.button || 'left' });
          } else if (msg.type === 'mouse_move' && typeof msg.x === 'number' && typeof msg.y === 'number') {
            await session.page.mouse.move(msg.x, msg.y);
          } else if (msg.type === 'mouse_down' && typeof msg.x === 'number' && typeof msg.y === 'number') {
            await session.page.mouse.down({ button: msg.button || 'left' });
          } else if (msg.type === 'mouse_up' && typeof msg.x === 'number' && typeof msg.y === 'number') {
            await session.page.mouse.up({ button: msg.button || 'left' });
          } else if (msg.type === 'mouse_wheel' && typeof msg.deltaY === 'number') {
            await session.page.mouse.wheel(msg.deltaX || 0, msg.deltaY);
          } else if (msg.type === 'key_press' && msg.key) {
            await session.page.keyboard.press(msg.key);
          } else if (msg.type === 'type_text' && msg.text) {
            await session.page.keyboard.type(msg.text);
          } else if (msg.type === 'navigate' && msg.url) {
            await session.page.goto(msg.url, { waitUntil: 'domcontentloaded' });
          }
        }
      } catch (err) {
        logger.debug(`[SandboxedBrowser] Error handling client input:`, err);
      }
    });

    // Start CDP screencast session
    const cdpSession = await session.context?.newCDPSession(session.page);
    if (!cdpSession) return;

    cdpSession.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      try {
        await cdpSession.send('Page.screencastFrameAck', { sessionId });
        const payload = JSON.stringify({
          type: 'frame',
          data,
          metadata,
          url: session.activeUrl,
        });

        for (const client of session.screencastClients) {
          if (client.readyState === 1 /* OPEN */) {
            client.send(payload);
          }
        }
      } catch {
        /* ignore frame send errors */
      }
    });

    await cdpSession.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 80,
      maxWidth: 1280,
      maxHeight: 800,
      everyNthFrame: 1,
    });
  }

  public async closeSession(projectId: string): Promise<string | null> {
    const session = this.sessions.get(projectId);
    if (!session) return null;

    this.sessions.delete(projectId);

    for (const client of session.screencastClients) {
      try {
        client.close(1000, 'Browser session closed');
      } catch {
        /* ignore */
      }
    }
    session.screencastClients.clear();

    let recordedVideoPath: string | null = null;
    if (session.page && !session.page.isClosed()) {
      try {
        const video = session.page.video();
        if (video) {
          recordedVideoPath = await video.path();
        }
      } catch {
        /* ignore */
      }
    }

    try {
      if (session.context) {
        await session.context.close();
      }
    } catch (e) {
      logger.warn(`[SandboxedBrowser] Error closing browser context:`, e);
    }

    return recordedVideoPath;
  }

  private broadcastState(state: BrowserSessionState) {
    const payload = JSON.stringify({
      type: 'status',
      url: state.activeUrl,
      isRecording: state.isRecording,
    });
    for (const client of state.screencastClients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }
}

export const sandboxedBrowserManager: SandboxedBrowserManager = new SandboxedBrowserManager();

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import OpenFilmStudio, {
  isFilmArtifact,
  SATCHIDA_FILM_MIME,
} from '../OpenFilmStudio';
import type { Artifact } from '~/common';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/Providers/EditorContext', () => ({
  useCodeState: () => ({
    currentCode: '',
    setCurrentCode: jest.fn(),
  }),
}));

jest.mock('../exportEngine', () => {
  const actual = jest.requireActual('../exportEngine');
  return {
    ...actual,
    renderFilmVideo: jest.fn(
      ({ onProgress, signal }: any) =>
        new Promise((resolve, reject) => {
          onProgress?.({
            percent: 50,
            currentSecond: 5,
            totalSeconds: 10,
            phase: 'rendering',
          });
          const timer = setTimeout(() => {
            resolve(new Blob(['mock-video-bytes'], { type: 'video/mp4' }));
          }, 300);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Export aborted by user'));
          });
        }),
    ),
    saveVideoToDisk: jest.fn().mockResolvedValue(true),
  };
});

describe('OpenFilmStudio Component & Artifact Integration', () => {
  const sampleArtifact: Artifact = {
    id: 'film-123',
    title: 'Brand Kinetic Teaser',
    type: SATCHIDA_FILM_MIME,
    content: `<!DOCTYPE html><html><body><script>window.film={duration:12,frame:function(t){}};</script></body></html>`,
    lastUpdateTime: Date.now(),
  };

  it('correctly detects Satchida Film artifact types', () => {
    expect(isFilmArtifact(SATCHIDA_FILM_MIME)).toBe(true);
    expect(isFilmArtifact('application/vnd.librechat.film')).toBe(true);
    expect(isFilmArtifact('application/vnd.mermaid')).toBe(false);
    expect(isFilmArtifact(undefined)).toBe(false);
  });

  it('renders Studio UI with controls, multi-track timeline and aspect selectors', () => {
    render(<OpenFilmStudio artifact={sampleArtifact} />);

    // Studio Header & Title
    expect(screen.getByText('Satchida Studio')).toBeInTheDocument();
    expect(screen.getByText('Brand Kinetic Teaser')).toBeInTheDocument();

    // Aspect ratio buttons
    expect(screen.getByText('16:9')).toBeInTheDocument();
    expect(screen.getByText('9:16')).toBeInTheDocument();
    expect(screen.getByText('1:1')).toBeInTheDocument();

    // FPS buttons
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('60fps')).toBeInTheDocument();

    // Multi-track visual timeline
    expect(screen.getByText(/Shot 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Kinetic Typography/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio Sync Beat/i)).toBeInTheDocument();
  });

  it('suppresses dual chat box by keeping OpenFilm internal chat hidden in DOM', () => {
    render(<OpenFilmStudio artifact={sampleArtifact} />);

    const hiddenChat = screen.getByTestId('openfilm-hidden-side-chat');
    expect(hiddenChat).toBeInTheDocument();
    // Parent container must have hidden attributes
    const parentContainer = hiddenChat.parentElement;
    expect(parentContainer).toHaveStyle({
      display: 'none',
      visibility: 'hidden',
    });
  });

  it('allows toggling aspect ratios and updates selection', () => {
    render(<OpenFilmStudio artifact={sampleArtifact} />);

    const verticalReelBtn = screen.getByText('9:16');
    fireEvent.click(verticalReelBtn);

    expect(verticalReelBtn.closest('button')).toHaveClass('bg-purple-600');
  });

  it('renders transport playback buttons and allows play/pause toggle', () => {
    render(<OpenFilmStudio artifact={sampleArtifact} />);

    const playBtn = screen.getByTitle(/Play/i);
    expect(playBtn).toBeInTheDocument();

    fireEvent.click(playBtn);
    expect(screen.getByTitle(/Pause/i)).toBeInTheDocument();
  });

  it('renders Export and Save buttons and triggers export workflow', async () => {
    render(<OpenFilmStudio artifact={sampleArtifact} />);

    const saveBtn = screen.getByTitle(/Save film project/i);
    expect(saveBtn).toBeInTheDocument();

    const exportBtn = screen.getByTitle(/Client-Side Hardware Accelerated Video Render/i);
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    // Should display rendering progress dialog
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Rendering Video')).toBeInTheDocument();
    expect(screen.getByText(/100% Client-Side WebGL \/ Canvas/i)).toBeInTheDocument();

    // Cancel Render button
    const cancelBtn = screen.getByText('Cancel Render');
    expect(cancelBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(cancelBtn);
    });
  });
});

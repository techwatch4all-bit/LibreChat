import {
  getSupportedVideoMimeType,
  saveVideoToDisk,
  renderFilmVideo,
} from '../exportEngine';

describe('exportEngine - Client-Side Video Rendering & Persistence', () => {
  const originalMediaRecorder = global.MediaRecorder;

  afterEach(() => {
    global.MediaRecorder = originalMediaRecorder;
    jest.restoreAllMocks();
  });

  describe('getSupportedVideoMimeType', () => {
    it('returns MP4 if MediaRecorder supports MP4', () => {
      (global as any).MediaRecorder = {
        isTypeSupported: jest.fn((type: string) => type.includes('mp4')),
      };

      const result = getSupportedVideoMimeType();
      expect(result.extension).toBe('mp4');
      expect(result.mimeType).toContain('mp4');
    });

    it('falls back to WebM if MediaRecorder does not support MP4', () => {
      (global as any).MediaRecorder = {
        isTypeSupported: jest.fn((type: string) => type.includes('webm')),
      };

      const result = getSupportedVideoMimeType();
      expect(result.extension).toBe('webm');
      expect(result.mimeType).toContain('webm');
    });

    it('handles undefined MediaRecorder safely without crashing', () => {
      (global as any).MediaRecorder = undefined;
      const result = getSupportedVideoMimeType();
      expect(result).toBeDefined();
      expect(result.extension).toBe('mp4');
    });
  });

  describe('saveVideoToDisk', () => {
    it('saves via showSaveFilePicker when available in browser', async () => {
      const mockWritable = {
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const mockHandle = {
        createWritable: jest.fn().mockResolvedValue(mockWritable),
      };
      (window as any).showSaveFilePicker = jest.fn().mockResolvedValue(mockHandle);

      const blob = new Blob(['video-data'], { type: 'video/mp4' });
      const success = await saveVideoToDisk(blob, 'test_export');

      expect(success).toBe(true);
      expect((window as any).showSaveFilePicker).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedName: 'test_export.mp4',
        }),
      );
      expect(mockWritable.write).toHaveBeenCalledWith(blob);
      expect(mockWritable.close).toHaveBeenCalled();

      delete (window as any).showSaveFilePicker;
    });

    it('returns false when user cancels showSaveFilePicker', async () => {
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      (window as any).showSaveFilePicker = jest.fn().mockRejectedValue(abortError);

      const blob = new Blob(['video-data'], { type: 'video/mp4' });
      const success = await saveVideoToDisk(blob, 'cancelled_export');

      expect(success).toBe(false);
      delete (window as any).showSaveFilePicker;
    });

    it('falls back to anchor download tag when showSaveFilePicker is absent', async () => {
      delete (window as any).showSaveFilePicker;
      const clickSpy = jest.fn();
      const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            click: clickSpy,
            set href(val: string) {},
            set download(val: string) {},
          } as any;
        }
        return document.createElement(tagName);
      });
      const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const removeSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

      window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = jest.fn();

      const blob = new Blob(['dummy'], { type: 'video/webm' });
      const success = await saveVideoToDisk(blob, 'fallback_export');

      expect(success).toBe(true);
      expect(clickSpy).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('renderFilmVideo', () => {
    it('throws error if iframe is null', async () => {
      await expect(
        renderFilmVideo({
          iframe: null,
          duration: 5,
          fps: 30,
        }),
      ).rejects.toThrow('Render target iframe not available');
    });

    it('throws error if iframe document is unavailable', async () => {
      const mockIframe = {} as HTMLIFrameElement;
      await expect(
        renderFilmVideo({
          iframe: mockIframe,
          duration: 5,
          fps: 30,
        }),
      ).rejects.toThrow('Unable to access iframe document context');
    });
  });
});

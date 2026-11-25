import { renderHook } from '@testing-library/react';
import useDeviceLayout from '../useDeviceLayout';

function mockMediaQueries(matchesMap: Record<string, boolean>) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: Boolean(matchesMap[query]),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('useDeviceLayout', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('detects phone portrait', () => {
    mockMediaQueries({
      '(max-width: 639px)': true,
      '(min-width: 640px) and (max-width: 1023px)': false,
      '(orientation: portrait)': true,
    });

    const { result } = renderHook(() => useDeviceLayout());
    expect(result.current).toEqual({
      deviceClass: 'phone',
      orientation: 'portrait',
      isPhone: true,
      isTablet: false,
      isDesktop: false,
      isPortrait: true,
      isLandscape: false,
    });
  });

  it('detects phone landscape', () => {
    mockMediaQueries({
      '(max-width: 639px)': true,
      '(min-width: 640px) and (max-width: 1023px)': false,
      '(orientation: portrait)': false,
    });

    const { result } = renderHook(() => useDeviceLayout());
    expect(result.current.deviceClass).toBe('phone');
    expect(result.current.orientation).toBe('landscape');
    expect(result.current.isLandscape).toBe(true);
  });

  it('detects tablet portrait and landscape', () => {
    mockMediaQueries({
      '(max-width: 639px)': false,
      '(min-width: 640px) and (max-width: 1023px)': true,
      '(orientation: portrait)': true,
    });

    const { result: portrait } = renderHook(() => useDeviceLayout());
    expect(portrait.current.deviceClass).toBe('tablet');
    expect(portrait.current.isTablet).toBe(true);
    expect(portrait.current.isPortrait).toBe(true);

    mockMediaQueries({
      '(max-width: 639px)': false,
      '(min-width: 640px) and (max-width: 1023px)': true,
      '(orientation: portrait)': false,
    });

    const { result: landscape } = renderHook(() => useDeviceLayout());
    expect(landscape.current.deviceClass).toBe('tablet');
    expect(landscape.current.isLandscape).toBe(true);
  });

  it('detects desktop', () => {
    mockMediaQueries({
      '(max-width: 639px)': false,
      '(min-width: 640px) and (max-width: 1023px)': false,
      '(orientation: portrait)': false,
    });

    const { result } = renderHook(() => useDeviceLayout());
    expect(result.current.deviceClass).toBe('desktop');
    expect(result.current.isDesktop).toBe(true);
  });
});

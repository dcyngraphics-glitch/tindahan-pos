import { useState, useEffect } from 'react';

export type DeviceSize = 'mobile' | 'tablet' | 'desktop';

export function useDeviceSize(): DeviceSize {
  const [size, setSize] = useState<DeviceSize>(() => {
    // Read the viewport during the first render. Starting from a hard-coded 'mobile'
    // made every consumer act on the wrong breakpoint for one frame — App.tsx opened
    // the inventory sidebar on tablets before the resize listener corrected it.
    if (typeof window === 'undefined') return 'mobile';
    const width = window.innerWidth;
    if (width >= 1024) return 'desktop';
    if (width >= 768) return 'tablet';
    return 'mobile';
  });

  useEffect(() => {
    const checkSize = () => {
      const width = window.innerWidth;
      if (width >= 1024) setSize('desktop');
      else if (width >= 768) setSize('tablet');
      else setSize('mobile');
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  return size;
}

export function useIsAtLeast(breakpoint: 'tablet' | 'desktop'): boolean {
  const size = useDeviceSize();
  if (breakpoint === 'desktop') return size === 'desktop';
  return size === 'tablet' || size === 'desktop';
}
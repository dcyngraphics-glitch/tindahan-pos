import { useState, useCallback, useRef } from 'react';
import { useBarcodeScannerListener } from './useBarcodeScannerListener';

interface UseScannerDetectionReturn {
  isConnected: boolean;
  lastActivity: Date | null;
  testScanner: () => void;
  activityCount: number;
}

export function useScannerDetection(): UseScannerDetectionReturn {
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBarcodeScannerListener(() => {
    setLastActivity(new Date());
    setActivityCount(prev => prev + 1);
    setIsConnected(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsConnected(false), 5000);
  });

  const testScanner = useCallback(() => {
    setActivityCount(0);
    setIsConnected(false);
    setLastActivity(null);
  }, []);

  return { isConnected, lastActivity, testScanner, activityCount };
}

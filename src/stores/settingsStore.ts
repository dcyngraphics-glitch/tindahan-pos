import { create } from 'zustand';

interface ReceiptConfig {
  storeName: string;
  storeAddress: string;
  contactInfo: string;
  receiptHeader: string;
  receiptFooter: string;
}

interface SettingsState {
  darkMode: boolean;
  receiptConfig: ReceiptConfig;
  setDarkMode: (dark: boolean) => void;
  updateReceiptConfig: (config: Partial<ReceiptConfig>) => void;
}

const DEFAULT_RECEIPT: ReceiptConfig = {
  storeName: 'Tindahan ni Aling Puring',
  storeAddress: '123 Mabini St., Barangay San Jose',
  contactInfo: 'Tel: 0912-345-6789',
  receiptHeader: 'Sari-Sari Store Official Receipt',
  receiptFooter: 'Salamat po sa pagbili! Please come again.',
};

// Helper to safely parse JSON with prototype pollution protection
export function safeParseReceiptConfig(raw: string | null): ReceiptConfig {
  if (!raw) return DEFAULT_RECEIPT;
  try {
    const parsed = JSON.parse(raw);
    // Guard against prototype pollution and ensure object
    if (parsed && typeof parsed === 'object' && !Object.prototype.hasOwnProperty.call(parsed, '__proto__') && !Object.prototype.hasOwnProperty.call(parsed, 'constructor')) {
      return { ...DEFAULT_RECEIPT, ...parsed };
    }
    return DEFAULT_RECEIPT;
  } catch {
    return DEFAULT_RECEIPT;
  }
}

export const useSettingsStore = create<SettingsState>((set) => {
  // Load saved preferences from localStorage
  const savedDark = localStorage.getItem('tindahan_dark_mode') === 'true';
  const savedReceipt = localStorage.getItem('tindahan_receipt_config');
  const receiptConfig = safeParseReceiptConfig(savedReceipt);

  return {
    darkMode: savedDark,
    receiptConfig,
    setDarkMode: (darkMode) => {
      localStorage.setItem('tindahan_dark_mode', String(darkMode));
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      set({ darkMode });
    },
    updateReceiptConfig: (partial) => {
      set((state) => {
        const next = { ...state.receiptConfig, ...partial };
        localStorage.setItem('tindahan_receipt_config', JSON.stringify(next));
        return { receiptConfig: next };
      });
    },
  };
});

import { create } from 'zustand';

interface ReceiptConfig {
  storeName: string;
  storeAddress: string;
  contactInfo: string;
  receiptHeader: string;
  receiptFooter: string;
}

interface SettingsState {
  receiptConfig: ReceiptConfig;
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
  const savedReceipt = localStorage.getItem('tindahan_receipt_config');
  const receiptConfig = safeParseReceiptConfig(savedReceipt);

  return {
    receiptConfig,
    updateReceiptConfig: (partial) => {
      set((state) => {
        const next = { ...state.receiptConfig, ...partial };
        try {
          localStorage.setItem('tindahan_receipt_config', JSON.stringify(next));
        } catch {
          // localStorage unavailable (private browsing, storage quota) — keep in-memory only
        }
        return { receiptConfig: next };
      });
    },
  };
});

import type { GateNotice as Notice } from '../hooks/useAccessGate';

interface Props {
  notice: Notice;
  onDismiss: () => void;
}

const TONES = {
  info: {
    box: 'bg-sky-50 border-sky-300 text-sky-950',
    badge: 'bg-sky-200 text-sky-900',
    icon: 'ℹ️',
  },
  warn: {
    box: 'bg-amber-50 border-amber-400 text-amber-950',
    badge: 'bg-amber-200 text-amber-900',
    icon: '⚠️',
  },
  block: {
    box: 'bg-white border-red-500 text-slate-900',
    badge: 'bg-red-600 text-white',
    icon: '🔒',
  },
} as const;

/**
 * Renders a notice returned by /api/auth/validate. Text only — React escapes
 * title and body, so console-authored templates cannot inject markup here.
 */
export function GateNoticeBanner({ notice, onDismiss }: Props) {
  const tone = TONES[notice.severity] ?? TONES.info;

  if (notice.severity === 'block') {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="gate-notice-title"
        aria-describedby="gate-notice-body"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4"
      >
        <div className={`border-2 rounded-2xl shadow-2xl max-w-md w-full p-6 ${tone.box}`}>
          <p className={`inline-block text-xs font-black px-2 py-1 rounded-full mb-3 ${tone.badge}`}>
            {tone.icon} Store notice
          </p>
          <h2 id="gate-notice-title" className="text-lg font-black mb-2">{notice.title}</h2>
          <p id="gate-notice-body" className="text-sm whitespace-pre-wrap">{notice.body}</p>
          <p className="text-xs mt-4 opacity-70">This notice must be removed by the store owner.</p>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className={`fixed top-0 inset-x-0 z-[90] border-b-2 shadow-lg px-4 py-3 ${tone.box}`}>
      <div className="max-w-3xl mx-auto flex items-start gap-3">
        <span aria-hidden="true" className="text-lg leading-tight">{tone.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black">{notice.title}</p>
          <p className="text-sm whitespace-pre-wrap">{notice.body}</p>
        </div>
        {notice.dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="shrink-0 text-sm font-bold rounded-lg px-3 py-1.5 min-h-[44px] bg-black/10 hover:bg-black/20"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { MessageCircle, Sparkles, X } from 'lucide-react';

const capabilityChips = [
  'Why did this mismatch happen?',
  'Which orders should I claim today?',
  'Where is my money stuck?',
  'Is my commission rate correct?',
  'What return leakage am I missing?',
];

export default function EnhancedChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [notified, setNotified] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('reconeasy_ai_notify') === 'true';
  });

  const handleNotify = () => {
    setNotified(true);
    window.localStorage.setItem('reconeasy_ai_notify', 'true');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
      >
        <MessageCircle className="h-7 w-7" />
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs text-white animate-pulse">
          AI
        </div>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsOpen(false)}
      />

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-300 ease-out dark:border-slate-700 dark:bg-slate-800 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                ReconEasy AI
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                RIA — ReconEasy Intelligence Assistant
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30">
            <Sparkles className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>

          <span className="mb-4 inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
            Coming Soon
          </span>

          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
            AI-powered reconciliation assistant
          </h3>

          <p className="mb-8 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            RIA understands your rate cards, settlement cycles, and fee structures.
            It tells you where money leaked, why it leaked, what's recoverable,
            and what to act on first.
          </p>

          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {capabilityChips.map((capability) => (
              <span
                key={capability}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                {capability}
              </span>
            ))}
          </div>

          <button
            onClick={handleNotify}
            disabled={notified}
            className={`h-9 rounded-lg px-5 text-sm font-medium transition-all ${
              notified
                ? 'cursor-default border border-teal-200 bg-teal-50 text-teal-700'
                : 'bg-teal-600 text-white hover:bg-teal-700'
            }`}
          >
            {notified ? "✓ We'll notify you when it's ready" : 'Notify me when available'}
          </button>
        </div>

        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-700">
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            RIA is built specifically for Indian ecommerce reconciliation — not a generic AI.
          </p>
        </div>
      </div>
    </>
  );
}

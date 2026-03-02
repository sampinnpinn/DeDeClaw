import { useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  type,
  isVisible,
  duration = 2800,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [duration, isVisible, onClose]);

  if (!isVisible || !message) {
    return null;
  }

  const isSuccess = type === 'success';

  return (
    <div className="pointer-events-none fixed top-6 left-1/2 z-50 -translate-x-1/2">
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-lg ${
          isSuccess
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        {isSuccess ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
        <span>{message}</span>
      </div>
    </div>
  );
}

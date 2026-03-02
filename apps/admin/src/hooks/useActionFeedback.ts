import { useCallback, useState } from 'react';
import type { ToastType } from '@/components/Toast';

interface FeedbackState {
  isVisible: boolean;
  type: ToastType;
  message: string;
}

const defaultState: FeedbackState = {
  isVisible: false,
  type: 'success',
  message: '',
};

export const useActionFeedback = () => {
  const [feedback, setFeedback] = useState<FeedbackState>(defaultState);

  const showFeedback = useCallback((type: ToastType, message: string) => {
    setFeedback({
      isVisible: true,
      type,
      message,
    });
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedback(defaultState);
  }, []);

  return {
    feedback,
    showFeedback,
    closeFeedback,
  };
};

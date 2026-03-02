import { useState, useRef, ReactNode, useCallback } from 'react';

interface PageCache {
  [key: string]: ReactNode;
}

interface PageState {
  [key: string]: unknown;
}

export function usePageCache() {
  const [currentPage, setCurrentPage] = useState('chat');
  const pageCache = useRef<PageCache>({});
  const pageStates = useRef<PageState>({});

  const navigateTo = useCallback((pageId: string) => {
    setCurrentPage(pageId);
  }, []);

  const cachePage = useCallback((pageId: string, content: ReactNode) => {
    pageCache.current[pageId] = content;
  }, []);

  const getCachedPage = useCallback((pageId: string) => {
    return pageCache.current[pageId];
  }, []);

  const savePageState = useCallback((pageId: string, state: unknown) => {
    pageStates.current[pageId] = state;
  }, []);

  const getPageState = useCallback((pageId: string) => {
    return pageStates.current[pageId];
  }, []);

  const clearCache = useCallback((pageId?: string) => {
    if (pageId) {
      delete pageCache.current[pageId];
      delete pageStates.current[pageId];
    } else {
      pageCache.current = {};
      pageStates.current = {};
    }
  }, []);

  return {
    currentPage,
    navigateTo,
    cachePage,
    getCachedPage,
    savePageState,
    getPageState,
    clearCache,
  };
}

'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/src/api';

/** One retry for transient failures; never for 4xx (401 included) or aborted requests. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status !== null && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}

/** A QueryClient per mount (not a module singleton), so caches are never shared between tests. */
export function QueryProvider({ children, client }: { children: React.ReactNode; client?: QueryClient }) {
  const [defaultClient] = useState(createQueryClient);
  return <QueryClientProvider client={client ?? defaultClient}>{children}</QueryClientProvider>;
}

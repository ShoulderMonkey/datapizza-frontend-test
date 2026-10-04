import React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { QueryProvider } from '@/src/components/providers/QueryProvider';

/** Fresh QueryClient for every test: no cache shared, no retries, no lingering garbage-collection timers. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false } },
  });
}

export function renderWithProviders(ui: React.ReactElement, client: QueryClient = createTestQueryClient()): RenderResult {
  return render(<QueryProvider client={client}>{ui}</QueryProvider>);
}

'use client';

import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryProvider } from '@/src/components/providers/QueryProvider';
import { LoginForm } from '@/src/features/auth/components/LoginForm';
import { useSession } from '@/src/features/auth/hooks/useSession';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

/** Logout: empties the query cache, then clears the session (unmounting aborts any stream). */
function AuthenticatedApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const queryClient = useQueryClient();
  const handleLogout = useCallback(() => {
    queryClient.clear();
    onSignOut();
  }, [queryClient, onSignOut]);
  return <ChatWorkspace userId={userId} onLogout={handleLogout} />;
}

export default function HomePage() {
  const { userId, status, notice, signIn, signOut } = useSession();

  if (status === 'hydrating') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400"
      >
        Caricamento...
      </div>
    );
  }

  if (!userId) {
    return <LoginForm onLoginSuccess={signIn} notice={notice} />;
  }

  // QueryProvider is mounted only while authenticated: a new login always gets a fresh cache.
  return (
    <QueryProvider>
      <AuthenticatedApp userId={userId} onSignOut={signOut} />
    </QueryProvider>
  );
}

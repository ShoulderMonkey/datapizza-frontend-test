'use client';

import React from 'react';
import { QueryProvider } from '@/src/components/providers/QueryProvider';
import { LoginForm } from '@/src/features/auth/components/LoginForm';
import { useSession } from '@/src/features/auth/hooks/useSession';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

export default function HomePage() {
  const { userId, signIn, signOut } = useSession();

  if (!userId) {
    return <LoginForm onLoginSuccess={signIn} />;
  }

  return (
    <QueryProvider>
      <ChatWorkspace userId={userId} onLogout={signOut} />
    </QueryProvider>
  );
}

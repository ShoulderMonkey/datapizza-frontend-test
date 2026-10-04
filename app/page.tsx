'use client';

import React from 'react';
import { LoginForm } from '@/src/features/auth/components/LoginForm';
import { useSession } from '@/src/features/auth/hooks/useSession';
import { ChatWorkspace } from '@/src/features/chat/components/ChatWorkspace';

export default function HomePage() {
  const { userId, signIn, signOut } = useSession();

  if (!userId) {
    return <LoginForm onLoginSuccess={signIn} />;
  }

  return <ChatWorkspace userId={userId} onLogout={signOut} />;
}

'use client';

import React, { useState } from 'react';
import { authService } from '@/services/auth-service';
import { LoginForm } from '@/components/auth/LoginForm';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(() => authService.getStoredUserId());

  const handleLoginSuccess = (newUserId: string) => {
    setUserId(newUserId);
  };

  const handleLogout = () => {
    authService.logout();
    setUserId(null);
  };

  if (!userId) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return <ChatWorkspace userId={userId} onLogout={handleLogout} />;
}


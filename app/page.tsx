'use client';

import React, { useState } from 'react';
import { authService } from '@/services/auth-service';
import { LoginForm } from '@/components/auth/LoginForm';
import { ChatWorkspace } from '@/components/chat/ChatWorkspace';
import { BackendConfigModal } from '@/components/settings/BackendConfigModal';

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(() => authService.getStoredUserId());
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  const handleLoginSuccess = (newUserId: string) => {
    setUserId(newUserId);
  };

  const handleLogout = () => {
    authService.logout();
    setUserId(null);
  };

  if (!userId) {
    return (
      <>
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
          onOpenBackendConfig={() => setIsConfigOpen(true)}
        />
        <BackendConfigModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
        />
      </>
    );
  }

  return <ChatWorkspace userId={userId} onLogout={handleLogout} />;
}


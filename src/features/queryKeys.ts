/** Central TanStack Query keys. Invalidate by prefix (e.g. `queryKeys.chats.all`). */
export const queryKeys = {
  documents: {
    all: ['documents'] as const,
    list: () => ['documents', 'list'] as const,
  },
  chats: {
    all: ['chats'] as const,
    list: () => ['chats', 'list'] as const,
  },
  chat: {
    detail: (id: string) => ['chat', id] as const,
  },
};

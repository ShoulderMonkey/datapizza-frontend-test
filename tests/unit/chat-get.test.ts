import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/src/mocks/server';
import { chatService } from '@/src/api';

describe('chatService.getChat with the real backend shape', () => {
  it('turns a root-level {query, response, citations} record into a user and an assistant message', async () => {
    const citation = {
      document_id: 'doc-1',
      filename: 'a.pdf',
      page_number: 2,
      text_quote: 'frase citata',
      bounding_regions: [],
    };
    server.use(
      http.get('*/api/chat/:id', () =>
        HttpResponse.json({
          id: 'c3e4ccf3-0000-4000-8000-000000000001',
          user_id: 'u1',
          created_at: '2026-10-04T10:00:00Z',
          query: 'Che cosa dice il documento?',
          response: 'Dice <strong>tanto</strong>.',
          citations: [citation],
        })
      )
    );

    const chat = await chatService.getChat('c3e4ccf3-0000-4000-8000-000000000001');

    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[0]).toMatchObject({ role: 'user', content: 'Che cosa dice il documento?' });
    expect(chat.messages[1]).toMatchObject({ role: 'assistant', content: 'Dice <strong>tanto</strong>.' });
    expect(chat.messages[1].citations).toEqual([citation]);
  });
});

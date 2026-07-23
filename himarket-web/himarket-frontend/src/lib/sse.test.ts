import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleSSEStream } from './sse';

function mockResponse(...reads: Array<{ done: boolean; value?: Uint8Array }>) {
  const read = vi.fn();
  for (const result of reads) {
    read.mockResolvedValueOnce(result);
  }
  const releaseLock = vi.fn();

  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      body: {
        getReader: () => ({ read, releaseLock }),
      },
      ok: true,
    }),
  );

  return { read, releaseLock };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleSSEStream', () => {
  it('completes immediately when receiving a DONE event', async () => {
    const data = new TextEncoder().encode(
      'data: {"chatId":"chat-1","type":"DONE","usage":{"inputTokens":3}}\n\n',
    );
    const { read, releaseLock } = mockResponse({ done: false, value: data });
    const onComplete = vi.fn();

    await handleSSEStream('/chats', {}, { onComplete });

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith('', 'chat-1', { inputTokens: 3 });
    expect(read).toHaveBeenCalledOnce();
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it('completes an empty response when receiving the end marker', async () => {
    const data = new TextEncoder().encode(
      'data: {"chatId":"chat-1","type":"START"}\n\ndata: [DONE]\n\n',
    );
    const { releaseLock } = mockResponse({ done: false, value: data });
    const onComplete = vi.fn();

    await handleSSEStream('/chats', {}, { onComplete });

    expect(onComplete).toHaveBeenCalledWith('', 'chat-1');
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it('rejects when the stream closes without a terminal event', async () => {
    const { releaseLock } = mockResponse({ done: true });

    await expect(handleSSEStream('/chats', {}, {})).rejects.toThrow(
      'SSE stream ended before completion',
    );
    expect(releaseLock).toHaveBeenCalledOnce();
  });
});

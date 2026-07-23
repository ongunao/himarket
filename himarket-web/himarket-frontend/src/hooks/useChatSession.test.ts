import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatSession } from './useChatSession';

import type { IProductDetail } from '../lib/apis';
import type { SSEOptions } from '../lib/sse';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  handleSSEStream: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('antd', () => ({
  message: {
    error: mocks.showError,
  },
}));

vi.mock('../lib/apis', () => ({
  default: {
    createSession: mocks.createSession,
    getChatMessageStreamUrl: vi.fn(() => '/chats'),
  },
}));

vi.mock('../lib/sse', () => ({
  handleSSEStream: mocks.handleSSEStream,
}));

const model = {
  feature: {
    modelFeature: {
      enableMultiModal: false,
      model: 'model-1',
      webSearch: false,
    },
  },
  name: 'Model 1',
  productId: 'model-1',
} as IProductDetail;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useChatSession', () => {
  it('shows an error without adding a conversation when session creation fails', async () => {
    mocks.createSession.mockResolvedValue({ code: 'FAILED' });
    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.sendMessage(
        'Hello',
        [],
        false,
        false,
        new Map([[model.productId, model]]),
        model,
      );
    });

    expect(mocks.showError).toHaveBeenCalledTimes(1);
    expect(mocks.handleSSEStream).not.toHaveBeenCalled();
    expect(result.current.modelConversation).toEqual([]);
    expect(result.current.generating).toBe(false);
  });

  it('shows an error without adding a conversation when session creation is rejected', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.createSession.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.sendMessage(
        'Hello',
        [],
        false,
        false,
        new Map([[model.productId, model]]),
        model,
      );
    });

    expect(mocks.showError).toHaveBeenCalledTimes(1);
    expect(mocks.handleSSEStream).not.toHaveBeenCalled();
    expect(result.current.modelConversation).toEqual([]);
    expect(result.current.generating).toBe(false);
    consoleError.mockRestore();
  });

  it('finishes loading when regeneration is rejected', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.createSession.mockResolvedValue({ code: 'SUCCESS', data: { sessionId: 'session-1' } });
    mocks.handleSSEStream.mockImplementationOnce(
      async (_url: string, _options: RequestInit, callbacks: SSEOptions) => {
        callbacks.onChunk?.('Initial answer', 'chat-1');
        callbacks.onComplete?.('Initial answer', 'chat-1');
      },
    );
    const { result } = renderHook(() => useChatSession());
    const modelMap = new Map([[model.productId, model]]);

    await act(async () => {
      await result.current.sendMessage('Hello', [], false, false, modelMap, model);
    });

    const conversation = result.current.modelConversation[0]?.conversations[0];
    const question = conversation?.questions[0];
    if (!conversation || !question) {
      throw new Error('Expected the initial conversation');
    }
    mocks.handleSSEStream.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await result.current.regenerateMessage({
        content: question.content,
        conversationId: conversation.id,
        enableThinking: false,
        enableWebSearch: false,
        mcps: [],
        modelId: model.productId,
        modelMap,
        questionId: question.id,
      });
    });

    const updatedConversation = result.current.modelConversation[0]?.conversations[0];
    const updatedQuestion = updatedConversation?.questions[0];
    if (!updatedConversation || !updatedQuestion) {
      throw new Error('Expected the regenerated conversation');
    }
    expect(updatedConversation.loading).toBe(false);
    expect(updatedQuestion.answers).toHaveLength(2);
    expect(updatedQuestion.answers[1]?.errorMsg).toBeTruthy();
    expect(result.current.generating).toBe(false);
    consoleError.mockRestore();
  });

  it('updates the prepared answer when regeneration returns an error event', async () => {
    mocks.createSession.mockResolvedValue({ code: 'SUCCESS', data: { sessionId: 'session-1' } });
    mocks.handleSSEStream
      .mockImplementationOnce(
        async (_url: string, _options: RequestInit, callbacks: SSEOptions) => {
          callbacks.onChunk?.('Initial answer', 'chat-1');
          callbacks.onComplete?.('Initial answer', 'chat-1');
        },
      )
      .mockImplementationOnce(
        async (_url: string, _options: RequestInit, callbacks: SSEOptions) => {
          callbacks.onError?.('Provider error');
        },
      );
    const { result } = renderHook(() => useChatSession());
    const modelMap = new Map([[model.productId, model]]);

    await act(async () => {
      await result.current.sendMessage('Hello', [], false, false, modelMap, model);
    });

    const conversation = result.current.modelConversation[0]?.conversations[0];
    const question = conversation?.questions[0];
    if (!conversation || !question) {
      throw new Error('Expected the initial conversation');
    }

    await act(async () => {
      await result.current.regenerateMessage({
        content: question.content,
        conversationId: conversation.id,
        enableThinking: false,
        enableWebSearch: false,
        mcps: [],
        modelId: model.productId,
        modelMap,
        questionId: question.id,
      });
    });

    const updatedQuestion = result.current.modelConversation[0]?.conversations[0]?.questions[0];
    expect(updatedQuestion?.answers).toHaveLength(2);
    expect(updatedQuestion?.answers[1]?.errorMsg).toBe('Provider error');
  });

  it('finishes loading when generation is stopped before the first event', async () => {
    mocks.createSession.mockResolvedValue({ code: 'SUCCESS', data: { sessionId: 'session-1' } });
    let signal: AbortSignal | undefined;
    mocks.handleSSEStream.mockImplementationOnce(
      (
        _url: string,
        _options: RequestInit,
        _callbacks: SSEOptions,
        requestSignal?: AbortSignal,
      ) => {
        signal = requestSignal;
        return new Promise<void>((_resolve, reject) => {
          requestSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        });
      },
    );
    const { result } = renderHook(() => useChatSession());
    let request: Promise<void>;

    act(() => {
      request = result.current.sendMessage(
        'Hello',
        [],
        false,
        false,
        new Map([[model.productId, model]]),
        model,
      );
    });

    await waitFor(() => {
      expect(result.current.modelConversation[0]?.conversations[0]?.loading).toBe(true);
    });

    await act(async () => {
      result.current.handleStop();
      await request;
    });

    expect(signal?.aborted).toBe(true);
    expect(result.current.modelConversation[0]?.conversations[0]?.loading).toBe(false);
    expect(result.current.generating).toBe(false);
  });
});

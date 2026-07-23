// SSE stream response handler

import type { IGeneratedImage } from '../types';
import type { IToolCall, IToolResponse, IChatUsage } from './apis/chat';

// Chat Event Type
export type ChatEventType =
  | 'START' // Stream started
  | 'ASSISTANT' // Assistant response
  | 'THINKING' // Thinking process
  | 'IMAGE' // Generated image
  | 'TOOL_CALL' // Tool call request
  | 'TOOL_RESULT' // Tool execution result
  | 'DONE' // Stream completed
  | 'ERROR'; // Error occurred

// Chat Event Structure
export interface ChatEvent {
  chatId: string;
  type: ChatEventType;
  content?: string | IToolCall | IToolResponse | IGeneratedImage | null;
  usage?: IChatUsage;
  error?: string;
  message?: string;
}

export interface SSEOptions {
  onStart?: (chatId: string) => void;
  onChunk?: (content: string, chatId: string) => void;
  onThinking?: (content: string, chatId: string) => void;
  onImage?: (image: IGeneratedImage, chatId: string) => void;
  onToolCall?: (toolCall: IToolCall, chatId: string, usage?: IChatUsage) => void;
  onToolResponse?: (toolResponse: IToolResponse, chatId: string, usage?: IChatUsage) => void;
  onComplete?: (fullContent: string, chatId: string, usage?: IChatUsage) => void;
  onError?: (error: string, code?: string, httpStatus?: number) => void;
}

export async function handleSSEStream(
  url: string,
  options: RequestInit,
  callbacks: SSEOptions,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Accept: 'text/event-stream',
    },
    signal,
  });

  if (!response.ok) {
    const status = response.status;

    // Handle 403 error: clear token and redirect to login
    if (status === 403) {
      localStorage.removeItem('access_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return;
    }

    // Handle other HTTP errors via onError callback
    const errorMessage = `HTTP error! status: ${status}`;
    callbacks.onError?.(errorMessage, undefined, status);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is null');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let chatId = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        throw new Error('SSE stream ended before completion');
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();

          // Check if it's the end marker
          if (data === '[DONE]') {
            callbacks.onComplete?.(fullContent, chatId);
            return;
          }

          try {
            const event = JSON.parse(data) as ChatEvent;

            if (event.chatId && !chatId) {
              chatId = event.chatId;
            }

            switch (event.type) {
              case 'START':
                callbacks.onStart?.(event.chatId);
                break;

              case 'ASSISTANT':
                if (typeof event.content === 'string' && event.chatId) {
                  fullContent += event.content;
                  callbacks.onChunk?.(event.content, event.chatId);
                }
                break;

              case 'THINKING':
                if (typeof event.content === 'string' && event.chatId) {
                  callbacks.onThinking?.(event.content, event.chatId);
                }
                break;

              case 'IMAGE':
                if (event.content && typeof event.content === 'object' && event.chatId) {
                  const image = event.content as IGeneratedImage;
                  if (image.attachmentId) {
                    callbacks.onImage?.(image, event.chatId);
                  }
                }
                break;

              case 'TOOL_CALL':
                if (event.content && typeof event.content === 'object') {
                  callbacks.onToolCall?.(
                    event.content as IToolCall,
                    event.chatId,
                    event.usage || undefined,
                  );
                }
                break;

              case 'TOOL_RESULT':
                if (event.content && typeof event.content === 'object') {
                  callbacks.onToolResponse?.(
                    event.content as IToolResponse,
                    event.chatId,
                    event.usage || undefined,
                  );
                }
                break;

              case 'DONE':
                callbacks.onComplete?.(fullContent, event.chatId || chatId, event.usage);
                return;

              case 'ERROR':
                callbacks.onError?.(event.message || 'Network error, please retry', event.error);
                return;
            }
          } catch (error) {
            console.error('Failed to parse SSE message:', error, 'Data:', data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

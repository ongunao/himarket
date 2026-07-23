import { describe, expect, it } from 'vitest';

import { chatReducer } from './useChatReducer';

import type { IModelConversation } from '../types';

function createState(): IModelConversation[] {
  return [
    {
      conversations: [
        {
          id: 'conversation-1',
          loading: false,
          questions: [
            {
              activeAnswerIndex: 0,
              answers: [
                {
                  content: 'Completed answer',
                  errorMsg: '',
                  firstTokenTime: 10,
                  inputTokens: 20,
                  outputTokens: 30,
                  totalTime: 40,
                },
              ],
              content: 'Previous question',
              createdAt: '2026-07-22',
              id: 'question-1',
            },
          ],
        },
        {
          id: 'conversation-2',
          loading: true,
          questions: [
            {
              activeAnswerIndex: 1,
              answers: [
                {
                  content: 'Previous retry answer',
                  errorMsg: '',
                  firstTokenTime: 11,
                  inputTokens: 21,
                  outputTokens: 31,
                  totalTime: 41,
                },
                {
                  content: 'Partial answer',
                  errorMsg: '',
                  firstTokenTime: 12,
                  inputTokens: 22,
                  mcpToolCalls: [
                    {
                      arguments: '{"city":"Hangzhou"}',
                      id: 'tool-1',
                      name: 'getWeather',
                      type: 'function',
                    },
                  ],
                  mcpToolResponses: [
                    {
                      id: 'tool-1',
                      name: 'getWeather',
                      result: { temperature: 30 },
                    },
                  ],
                  messageChunks: [
                    { content: 'Reasoning', type: 'THINKING' },
                    { content: 'Partial answer', type: 'ASSISTANT' },
                    {
                      arguments: { city: 'Hangzhou' },
                      id: 'tool-1',
                      name: 'getWeather',
                      type: 'TOOL_CALL',
                    },
                    { attachmentId: 'attachment-1', type: 'IMAGE' },
                  ],
                  outputTokens: 32,
                  totalTime: 42,
                },
              ],
              content: 'Current question',
              createdAt: '2026-07-22',
              id: 'question-2',
            },
          ],
        },
      ],
      id: 'model-1',
      name: 'Model',
      sessionId: 'session-1',
    },
  ];
}

function getConversation(state: IModelConversation[], index: number) {
  const conversation = state[0]?.conversations[index];
  if (!conversation) {
    throw new Error(`Missing conversation at index ${index}`);
  }
  return conversation;
}

function getQuestion(conversation: IModelConversation['conversations'][0]) {
  const question = conversation.questions[0];
  if (!question) {
    throw new Error('Missing question');
  }
  return question;
}

describe('chatReducer error handling', () => {
  it('preserves streamed content and retry history on SEND_ERROR', () => {
    const state = createState();
    const originalQuestion = getQuestion(getConversation(state, 1));
    const next = chatReducer(state, {
      payload: {
        conversationId: 'conversation-2',
        errorMsg: 'Model request failed',
        fullContent: 'Partial answer',
        modelId: 'model-1',
        questionId: 'question-2',
      },
      type: 'SEND_ERROR',
    });

    const conversation = getConversation(next, 1);
    const question = getQuestion(conversation);
    expect(conversation.loading).toBe(false);
    expect(question.activeAnswerIndex).toBe(1);
    expect(question.answers).toHaveLength(2);
    expect(question.answers[0]).toEqual(originalQuestion.answers[0]);
    expect(question.answers[1]).toEqual({
      ...originalQuestion.answers[1],
      errorMsg: 'Model request failed',
    });
  });

  it('marks only the requested answer on GLOBAL_ERROR', () => {
    const state = createState();
    const previousConversation = getConversation(state, 0);
    const originalQuestion = getQuestion(getConversation(state, 1));
    const originalAnswer = originalQuestion.answers[1];
    if (!originalAnswer) {
      throw new Error('Missing active answer');
    }
    const next = chatReducer(state, {
      payload: {
        conversationId: 'conversation-2',
        errorMsg: 'Network error',
        modelId: 'model-1',
        questionId: 'question-2',
      },
      type: 'GLOBAL_ERROR',
    });

    const conversation = getConversation(next, 1);
    const question = getQuestion(conversation);
    expect(getConversation(next, 0)).toEqual(previousConversation);
    expect(conversation.loading).toBe(false);
    expect(question.answers).toHaveLength(2);
    expect(question.answers[1]).toEqual({
      ...originalAnswer,
      errorMsg: 'Network error',
    });
  });
});

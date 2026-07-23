import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Messages } from './Messages';

import type { IModelConversation } from '../../types';

function createConversations(loading: boolean): IModelConversation['conversations'] {
  return [
    {
      id: 'conversation-1',
      loading,
      questions: [
        {
          activeAnswerIndex: 0,
          answers: [
            {
              content: '',
              errorMsg: '',
              firstTokenTime: 0,
              inputTokens: 0,
              messageChunks: [
                { content: '**Reasoning details**\n\n- First consideration', type: 'THINKING' },
              ],
              outputTokens: 0,
              totalTime: 0,
            },
          ],
          content: 'Hello',
          createdAt: '2026-07-21T00:00:00Z',
          id: 'question-1',
        },
      ],
    },
  ];
}

describe('Messages thinking block', () => {
  it('renders thinking content as Markdown', () => {
    render(
      <Messages
        conversations={createConversations(true)}
        generating
        streamingQuestionId="question-1"
      />,
    );

    expect(screen.getByText('Reasoning details').tagName).toBe('STRONG');
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('First consideration')).toBeInTheDocument();
  });

  it('collapses completed thinking and allows reopening it', async () => {
    const conversations = createConversations(false);
    const { rerender } = render(
      <Messages conversations={conversations} generating streamingQuestionId="question-1" />,
    );

    expect(screen.getByText('Reasoning details')).toBeInTheDocument();

    rerender(<Messages conversations={conversations} generating={false} />);

    await waitFor(() => expect(screen.queryByText('Reasoning details')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '思考过程' }));
    expect(screen.getByText('Reasoning details')).toBeInTheDocument();
  });

  it('expands thinking when regenerating an earlier question', () => {
    const conversations = createConversations(false);
    const conversation = conversations[0];
    const firstQuestion = conversation?.questions[0];
    const firstAnswer = firstQuestion?.answers[0];
    if (!conversation || !firstQuestion || !firstAnswer) {
      throw new Error('Missing conversation');
    }
    conversation.questions.push({
      ...firstQuestion,
      answers: [{ ...firstAnswer, messageChunks: [] }],
      id: 'question-2',
    });

    render(<Messages conversations={conversations} generating streamingQuestionId="question-1" />);

    expect(screen.getByText('Reasoning details')).toBeInTheDocument();
  });
});

describe('Messages error state', () => {
  it('renders partial streamed content together with the error', () => {
    const conversations = createConversations(false);
    const answer = conversations[0]?.questions[0]?.answers[0];
    if (!answer) {
      throw new Error('Missing answer');
    }
    answer.content = 'Partial answer';
    answer.errorMsg = 'Model request failed';
    answer.messageChunks = [{ content: '**Partial answer**', type: 'ASSISTANT' }];

    render(<Messages conversations={conversations} generating={false} />);

    expect(screen.getByText('Partial answer').tagName).toBe('STRONG');
    expect(screen.getByText('Model request failed')).toBeInTheDocument();
  });
});

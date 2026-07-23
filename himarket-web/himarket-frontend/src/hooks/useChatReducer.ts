import type { IChatAttachment } from '../lib/apis';
import type {
  IChatMessageChunk,
  IGeneratedImage,
  IModelConversation,
  IMcpToolCall,
  IMcpToolResponse,
} from '../types';

// ============ Action Types ============

export type ChatAction =
  | { type: 'RESET' }
  | { type: 'CLEAR_LOADING' }
  | { type: 'SET_CONVERSATIONS'; payload: IModelConversation[] }
  | {
      type: 'ADD_CONVERSATION';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        content: string;
        attachments?: IChatAttachment[];
        sessionId?: string;
      };
    }
  | {
      type: 'APPEND_CHUNK';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        fullContent: string;
        chunk: string;
      };
    }
  | {
      type: 'APPEND_THINKING';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        content: string;
      };
    }
  | {
      type: 'ADD_IMAGE';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        fullContent: string;
        image: IGeneratedImage;
      };
    }
  | {
      type: 'ADD_TOOL_CALL';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        toolCall: IMcpToolCall;
      };
    }
  | {
      type: 'ADD_TOOL_RESPONSE';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        toolResponse: IMcpToolResponse;
      };
    }
  | {
      type: 'COMPLETE';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        fullContent: string;
        usage?: {
          firstByteTimeout?: number | null;
          elapsedTime?: number | null;
          inputTokens?: number;
          outputTokens?: number;
        };
      };
    }
  | {
      type: 'CHANGE_ACTIVE_ANSWER';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        direction: 'prev' | 'next';
      };
    }
  | {
      type: 'SET_LOADING';
      payload: {
        modelId: string;
        conversationId: string;
        loading: boolean;
      };
    }
  | {
      type: 'SET_NEW_QUESTION';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
      };
    }
  | {
      type: 'REGENERATE_CHUNK';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        fullContent: string;
        chunk: string;
      };
    }
  | {
      type: 'PREPARE_REGENERATE';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
      };
    }
  | {
      type: 'SEND_ERROR';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        errorMsg: string;
        fullContent: string;
      };
    }
  | {
      type: 'GLOBAL_ERROR';
      payload: {
        modelId: string;
        conversationId: string;
        questionId: string;
        errorMsg: string;
      };
    };

// ============ Helper: update a specific question within the state ============

function updateQuestion(
  state: IModelConversation[],
  modelId: string,
  conversationId: string,
  questionId: string,
  updater: (
    question: IModelConversation['conversations'][0]['questions'][0],
  ) => IModelConversation['conversations'][0]['questions'][0],
  conversationUpdater?: (
    con: IModelConversation['conversations'][0],
  ) => Partial<IModelConversation['conversations'][0]>,
): IModelConversation[] {
  return state.map((model) => {
    if (model.id !== modelId) return model;
    return {
      ...model,
      conversations: model.conversations.map((con) => {
        if (con.id !== conversationId) return con;
        const extraFields = conversationUpdater ? conversationUpdater(con) : {};
        return {
          ...con,
          ...extraFields,
          questions: con.questions.map((q) => (q.id === questionId ? updater(q) : q)),
        };
      }),
    };
  });
}

function appendMessageChunk(
  chunks: IChatMessageChunk[] | undefined,
  chunk: IChatMessageChunk,
): IChatMessageChunk[] | undefined {
  if ((chunk.type === 'ASSISTANT' || chunk.type === 'THINKING') && !chunk.content) {
    return chunks;
  }

  const next = [...(chunks || [])];
  const last = next[next.length - 1];
  if ((chunk.type === 'ASSISTANT' || chunk.type === 'THINKING') && last?.type === chunk.type) {
    next[next.length - 1] = {
      ...last,
      content: `${last.content || ''}${chunk.content || ''}`,
    };
    return next;
  }

  next.push(chunk);
  return next;
}

// ============ Reducer ============

export function chatReducer(state: IModelConversation[], action: ChatAction): IModelConversation[] {
  switch (action.type) {
    case 'RESET':
      return [];

    case 'CLEAR_LOADING':
      return state.map((model) => ({
        ...model,
        conversations: model.conversations.map((conversation) => ({
          ...conversation,
          loading: false,
        })),
      }));

    case 'SET_CONVERSATIONS':
      return action.payload;

    case 'ADD_CONVERSATION': {
      const { attachments, content, conversationId, modelId, questionId, sessionId } =
        action.payload;
      const newConversation = {
        id: conversationId,
        loading: true,
        questions: [
          {
            activeAnswerIndex: 0,
            answers: [
              {
                content: '',
                errorMsg: '',
                firstTokenTime: 0,
                inputTokens: 0,
                messageChunks: [],
                outputTokens: 0,
                totalTime: 0,
              },
            ],
            attachments,
            content,
            createdAt: new Date().toDateString(),
            id: questionId,
          },
        ],
      };

      if (state.length === 0) {
        return [
          {
            conversations: [newConversation],
            id: modelId,
            name: '-',
            sessionId: sessionId || '',
          },
        ];
      }

      return state.map((model) => {
        if (model.id !== modelId) return model;
        return {
          ...model,
          conversations: [...model.conversations, newConversation],
        };
      });
    }

    case 'APPEND_CHUNK': {
      const { chunk, conversationId, fullContent, modelId, questionId } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => {
          const lastIdx = question.answers.length - 1;
          return {
            ...question,
            answers: question.answers.map((answer, idx) =>
              idx === lastIdx
                ? {
                    ...answer,
                    content: fullContent,
                    messageChunks: appendMessageChunk(answer.messageChunks, {
                      content: chunk,
                      type: 'ASSISTANT',
                    }),
                  }
                : answer,
            ),
          };
        },
        () => ({ loading: false }),
      );
    }

    case 'APPEND_THINKING': {
      const { content, conversationId, modelId, questionId } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => {
        const lastIdx = question.answers.length - 1;
        return {
          ...question,
          answers: question.answers.map((answer, idx) =>
            idx === lastIdx
              ? {
                  ...answer,
                  messageChunks: appendMessageChunk(answer.messageChunks, {
                    content,
                    type: 'THINKING',
                  }),
                }
              : answer,
          ),
        };
      });
    }

    case 'ADD_IMAGE': {
      const { conversationId, fullContent, image, modelId, questionId } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => {
          const lastIdx = question.answers.length - 1;
          return {
            ...question,
            answers: question.answers.map((answer, idx) =>
              idx === lastIdx
                ? {
                    ...answer,
                    content: fullContent,
                    messageChunks: appendMessageChunk(answer.messageChunks, {
                      ...image,
                      type: 'IMAGE',
                    }),
                  }
                : answer,
            ),
          };
        },
        () => ({ loading: false }),
      );
    }

    case 'ADD_TOOL_CALL': {
      const { conversationId, modelId, questionId, toolCall } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => {
        const lastIdx = question.answers.length - 1;
        return {
          ...question,
          answers: question.answers.map((answer, idx) =>
            idx === lastIdx
              ? {
                  ...answer,
                  mcpToolCalls: [...(answer.mcpToolCalls || []), toolCall],
                  messageChunks: appendMessageChunk(answer.messageChunks, {
                    arguments: toolCall.arguments,
                    id: toolCall.id,
                    name: toolCall.name,
                    type: 'TOOL_CALL',
                  }),
                }
              : answer,
          ),
        };
      });
    }

    case 'ADD_TOOL_RESPONSE': {
      const { conversationId, modelId, questionId, toolResponse } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => {
        const lastIdx = question.answers.length - 1;
        return {
          ...question,
          answers: question.answers.map((answer, idx) =>
            idx === lastIdx
              ? {
                  ...answer,
                  mcpToolResponses: [...(answer.mcpToolResponses || []), toolResponse],
                  messageChunks: appendMessageChunk(answer.messageChunks, {
                    id: toolResponse.id,
                    name: toolResponse.name,
                    result: toolResponse.result,
                    type: 'TOOL_RESULT',
                  }),
                }
              : answer,
          ),
        };
      });
    }

    case 'COMPLETE': {
      const { conversationId, fullContent, modelId, questionId, usage } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => ({
          ...question,
          activeAnswerIndex: question.answers.length - 1,
          answers: question.answers.map((answer, idx) => {
            if (idx === question.answers.length - 1) {
              return {
                ...answer,
                content: fullContent,
                errorMsg: answer.errorMsg || '',
                firstTokenTime: usage?.firstByteTimeout || 0,
                inputTokens: usage?.inputTokens || 0,
                outputTokens: usage?.outputTokens || 0,
                totalTime: usage?.elapsedTime || 0,
              };
            }
            return answer;
          }),
        }),
        () => ({ loading: false }),
      );
    }

    case 'CHANGE_ACTIVE_ANSWER': {
      const { conversationId, direction, modelId, questionId } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => {
        let newIndex = question.activeAnswerIndex;
        if (direction === 'prev' && newIndex > 0) {
          newIndex -= 1;
        } else if (direction === 'next' && newIndex < question.answers.length - 1) {
          newIndex += 1;
        }
        return { ...question, activeAnswerIndex: newIndex };
      });
    }

    case 'SET_LOADING': {
      const { conversationId, loading, modelId } = action.payload;
      return state.map((model) => {
        if (model.id !== modelId) return model;
        return {
          ...model,
          conversations: model.conversations.map((con) => ({
            ...con,
            loading: con.id === conversationId ? loading : con.loading,
          })),
        };
      });
    }

    case 'SET_NEW_QUESTION': {
      const { conversationId, modelId, questionId } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => ({
        ...question,
        isNewQuestion: true,
      }));
    }

    case 'REGENERATE_CHUNK': {
      const { chunk, conversationId, fullContent, modelId, questionId } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => {
          const lastAnswerIdx = question.answers.length - 1;
          return {
            ...question,
            activeAnswerIndex: lastAnswerIdx,
            answers: question.answers.map((answer, idx) =>
              idx !== lastAnswerIdx
                ? answer
                : {
                    ...answer,
                    content: fullContent,
                    messageChunks: appendMessageChunk(answer.messageChunks, {
                      content: chunk,
                      type: 'ASSISTANT',
                    }),
                  },
            ),
          };
        },
        () => ({ loading: false }),
      );
    }

    case 'PREPARE_REGENERATE': {
      const { conversationId, modelId, questionId } = action.payload;
      return updateQuestion(state, modelId, conversationId, questionId, (question) => ({
        ...question,
        activeAnswerIndex: question.answers.length,
        answers: [
          ...question.answers,
          {
            content: '',
            errorMsg: '',
            firstTokenTime: 0,
            inputTokens: 0,
            mcpToolCalls: [],
            mcpToolResponses: [],
            messageChunks: [],
            outputTokens: 0,
            totalTime: 0,
          },
        ],
        isNewQuestion: true,
      }));
    }

    case 'SEND_ERROR': {
      const { conversationId, errorMsg, fullContent, modelId, questionId } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => {
          const lastIdx = question.answers.length - 1;
          return {
            ...question,
            activeAnswerIndex: lastIdx,
            answers: question.answers.map((answer, idx) =>
              idx === lastIdx
                ? {
                    ...answer,
                    content: fullContent || answer.content,
                    errorMsg,
                  }
                : answer,
            ),
          };
        },
        () => ({ loading: false }),
      );
    }

    case 'GLOBAL_ERROR': {
      const { conversationId, errorMsg, modelId, questionId } = action.payload;
      return updateQuestion(
        state,
        modelId,
        conversationId,
        questionId,
        (question) => {
          const lastIdx = question.answers.length - 1;
          return {
            ...question,
            activeAnswerIndex: lastIdx,
            answers: question.answers.map((answer, idx) =>
              idx === lastIdx ? { ...answer, errorMsg } : answer,
            ),
          };
        },
        () => ({ loading: false }),
      );
    }

    default:
      return state;
  }
}

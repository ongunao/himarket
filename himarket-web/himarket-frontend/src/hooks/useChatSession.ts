import { message as antdMessage } from 'antd';
import { useReducer, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { chatReducer, type ChatAction } from './useChatReducer';
import APIs, {
  type IProductConversations,
  type IProductDetail,
  type IChatAttachment,
} from '../lib/apis';
import { handleSSEStream } from '../lib/sse';
import { generateConversationId, generateQuestionId } from '../lib/uuid';

import type { SSEOptions } from '../lib/sse';
import type { IChatMessageChunk, IGeneratedImage, IMcpToolCall, IMcpToolResponse } from '../types';

// ============ SSE Callbacks Factory ============

interface SSEContext {
  modelId: string;
  conversationId: string;
  questionId: string;
  fullContentRef: { current: string };
  dispatch: React.Dispatch<ChatAction>;
  setIsMcpExecuting: (v: boolean) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMessageChunks(messageChunks?: string): {
  messageChunks?: IChatMessageChunk[];
  mcpToolCalls?: IMcpToolCall[];
  mcpToolResponses?: IMcpToolResponse[];
} {
  if (!messageChunks) {
    return {};
  }

  try {
    const messages = JSON.parse(messageChunks);
    if (!Array.isArray(messages)) {
      return {};
    }

    const mcpToolCalls: IMcpToolCall[] = [];
    const mcpToolResponses: IMcpToolResponse[] = [];
    const orderedChunks: IChatMessageChunk[] = [];

    for (const message of messages) {
      if (!isRecord(message)) {
        continue;
      }

      if (
        (message.type === 'ASSISTANT' || message.type === 'THINKING') &&
        typeof message.content === 'string'
      ) {
        orderedChunks.push({
          content: message.content,
          type: message.type,
        });
        continue;
      }

      if (message.type === 'IMAGE' && typeof message.attachmentId === 'string') {
        orderedChunks.push({
          attachmentId: message.attachmentId,
          type: 'IMAGE',
        });
        continue;
      }

      if (
        message.type === 'TOOL_CALL' &&
        typeof message.id === 'string' &&
        typeof message.name === 'string'
      ) {
        orderedChunks.push({
          arguments: message.arguments,
          id: message.id,
          name: message.name,
          type: 'TOOL_CALL',
        });
        mcpToolCalls.push({
          arguments: toArgumentString(message.arguments),
          id: message.id,
          name: message.name,
          type: 'function',
        });
        continue;
      }

      if (
        message.type === 'TOOL_RESULT' &&
        typeof message.id === 'string' &&
        typeof message.name === 'string'
      ) {
        orderedChunks.push({
          id: message.id,
          name: message.name,
          result: message.result,
          type: 'TOOL_RESULT',
        });
        mcpToolResponses.push({
          id: message.id,
          name: message.name,
          result: message.result ?? '',
        });
        continue;
      }
    }

    return {
      mcpToolCalls: mcpToolCalls.length > 0 ? mcpToolCalls : undefined,
      mcpToolResponses: mcpToolResponses.length > 0 ? mcpToolResponses : undefined,
      messageChunks: orderedChunks.length > 0 ? orderedChunks : undefined,
    };
  } catch {
    return {};
  }
}

function toArgumentString(input: unknown): string {
  return typeof input === 'string' ? input : JSON.stringify(input ?? {});
}

function createSSECallbacks(ctx: SSEContext): SSEOptions {
  const { conversationId, dispatch, fullContentRef, modelId, questionId, setIsMcpExecuting } = ctx;
  return {
    onChunk: (chunk: string) => {
      fullContentRef.current += chunk;
      dispatch({
        payload: {
          chunk,
          conversationId,
          fullContent: fullContentRef.current,
          modelId,
          questionId,
        },
        type: 'APPEND_CHUNK',
      });
    },
    onComplete: (_content: string, _chatId: string, usage) => {
      dispatch({
        payload: {
          conversationId,
          fullContent: fullContentRef.current,
          modelId,
          questionId,
          usage,
        },
        type: 'COMPLETE',
      });
    },
    onError: (errorMsg: string) => {
      dispatch({
        payload: {
          conversationId,
          errorMsg,
          fullContent: fullContentRef.current,
          modelId,
          questionId,
        },
        type: 'SEND_ERROR',
      });
    },
    onImage: (image: IGeneratedImage) => {
      dispatch({
        payload: {
          conversationId,
          fullContent: fullContentRef.current,
          image,
          modelId,
          questionId,
        },
        type: 'ADD_IMAGE',
      });
    },
    onThinking: (content: string) => {
      dispatch({
        payload: {
          content,
          conversationId,
          modelId,
          questionId,
        },
        type: 'APPEND_THINKING',
      });
    },
    onToolCall: (toolCall: IMcpToolCall) => {
      setIsMcpExecuting(true);
      dispatch({
        payload: { conversationId, modelId, questionId, toolCall },
        type: 'ADD_TOOL_CALL',
      });
    },
    onToolResponse: (toolResponse: IMcpToolResponse) => {
      setIsMcpExecuting(false);
      dispatch({
        payload: { conversationId, modelId, questionId, toolResponse },
        type: 'ADD_TOOL_RESPONSE',
      });
    },
  };
}

// ============ SSE Request Helper ============

async function executeSSERequest(
  messagePayload: Record<string, unknown>,
  abortController: AbortController,
  sseCallbacks: SSEOptions,
) {
  const streamUrl = APIs.getChatMessageStreamUrl();
  const accessToken = localStorage.getItem('access_token');
  await handleSSEStream(
    streamUrl,
    {
      body: JSON.stringify(messagePayload),
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
    sseCallbacks,
    abortController.signal,
  );
}

// ============ Hook ============

export function useChatSession() {
  const { t } = useTranslation('chat');
  const [state, dispatch] = useReducer(chatReducer, []);
  const [generating, setGenerating] = useState(false);
  const [isMcpExecuting, setIsMcpExecuting] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [streamingQuestionId, setStreamingQuestionId] = useState<string>();
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const abortControllerRef = useRef<AbortController>();

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = undefined;
    dispatch({ type: 'CLEAR_LOADING' });
    setGenerating(false);
    setIsMcpExecuting(false);
    setStreamingQuestionId(undefined);
  }, []);

  const handleNewChat = useCallback(() => {
    handleStop();
    dispatch({ type: 'RESET' });
    setCurrentSessionId(undefined);
  }, [handleStop]);

  const sendMessage = useCallback(
    async (
      content: string,
      mcps: IProductDetail[],
      enableWebSearch: boolean,
      enableThinking: boolean,
      modelMap: Map<string, IProductDetail>,
      selectedModel: IProductDetail,
      attachments: IChatAttachment[] = [],
    ) => {
      const modelId = state[0]?.id ?? selectedModel.productId;
      const conversationId = generateConversationId();
      const questionId = generateQuestionId();
      const abortController = new AbortController();
      let conversationAdded = false;
      abortControllerRef.current = abortController;

      try {
        setGenerating(true);

        let sessionId = currentSessionId;
        if (!sessionId) {
          const sessionResponse = await APIs.createSession({
            name: content.length > 20 ? content.substring(0, 20) + '...' : content,
            products: [modelId],
            talkType: 'MODEL',
          });
          if (sessionResponse.code !== 'SUCCESS' || !sessionResponse.data?.sessionId) {
            antdMessage.error(t('session.createFailed'));
            return;
          }
          sessionId = sessionResponse.data.sessionId;
          setCurrentSessionId(sessionId);
          setSidebarRefreshTrigger((prev) => prev + 1);
        }

        if (!sessionId) {
          antdMessage.error(t('session.missingId'));
          return;
        }

        const model = modelMap.get(modelId) ?? selectedModel;
        const messagePayload = {
          attachments: attachments.map((attachment) => ({
            attachmentId: attachment.attachmentId,
          })),
          conversationId,
          enableThinking: enableThinking && Boolean(model.feature?.modelFeature?.enableThinking),
          enableWebSearch: enableWebSearch && Boolean(model.feature?.modelFeature?.webSearch),
          mcpProducts: mcps.map((mcp) => mcp.productId),
          productId: modelId,
          question: content,
          questionId,
          sessionId,
          stream: true,
        };

        setStreamingQuestionId(questionId);
        dispatch({
          payload: {
            attachments,
            content,
            conversationId,
            modelId,
            questionId,
            sessionId,
          },
          type: 'ADD_CONVERSATION',
        });
        conversationAdded = true;

        const fullContentRef = { current: '' };
        await executeSSERequest(
          messagePayload,
          abortController,
          createSSECallbacks({
            conversationId,
            dispatch,
            fullContentRef,
            modelId,
            questionId,
            setIsMcpExecuting,
          }),
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          if (conversationAdded) {
            dispatch({
              payload: {
                conversationId,
                errorMsg: t('messages.networkError'),
                modelId,
                questionId,
              },
              type: 'GLOBAL_ERROR',
            });
          } else {
            antdMessage.error(t('messages.networkError'));
          }
          console.error('Failed to send message:', error);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = undefined;
          dispatch({ type: 'CLEAR_LOADING' });
          setGenerating(false);
          setIsMcpExecuting(false);
        }
        setStreamingQuestionId((value) => (value === questionId ? undefined : value));
      }
    },
    [currentSessionId, state, t],
  );

  const regenerateMessage = useCallback(
    async ({
      attachments = [],
      content,
      conversationId,
      enableThinking,
      enableWebSearch,
      mcps,
      modelId,
      modelMap,
      questionId,
    }: {
      modelId: string;
      conversationId: string;
      questionId: string;
      content: string;
      mcps: IProductDetail[];
      enableWebSearch: boolean;
      enableThinking?: boolean;
      modelMap: Map<string, IProductDetail>;
      attachments?: IChatAttachment[];
    }) => {
      setGenerating(true);
      setStreamingQuestionId(questionId);
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const isSupportWebSearch = modelMap.get(modelId)?.feature?.modelFeature?.webSearch || false;
      const isThinkingSupport =
        modelMap.get(modelId)?.feature?.modelFeature?.enableThinking || false;
      try {
        const messagePayload = {
          attachments: attachments.map((a) => ({ attachmentId: a.attachmentId })),
          conversationId,
          enableThinking: enableThinking ? isThinkingSupport : false,
          enableWebSearch: enableWebSearch ? isSupportWebSearch : false,
          mcpProducts: mcps.map((mcp) => mcp.productId),
          productId: modelId,
          question: content,
          questionId,
          sessionId: currentSessionId,
          stream: true,
        };

        dispatch({ payload: { conversationId, loading: true, modelId }, type: 'SET_LOADING' });
        dispatch({ payload: { conversationId, modelId, questionId }, type: 'SET_NEW_QUESTION' });
        // Keep streamed content and tool events separate from the previous answer.
        dispatch({
          payload: { conversationId, modelId, questionId },
          type: 'PREPARE_REGENERATE',
        });

        const fullContentRef = { current: '' };

        const sseCallbacks: SSEOptions = {
          ...createSSECallbacks({
            conversationId,
            dispatch,
            fullContentRef,
            modelId,
            questionId,
            setIsMcpExecuting,
          }),
          onChunk: (chunk: string) => {
            fullContentRef.current += chunk;
            dispatch({
              payload: {
                chunk,
                conversationId,
                fullContent: fullContentRef.current,
                modelId,
                questionId,
              },
              type: 'REGENERATE_CHUNK',
            });
          },
          onComplete: (_content: string, _chatId: string, usage) => {
            dispatch({
              payload: {
                conversationId,
                fullContent: fullContentRef.current,
                modelId,
                questionId,
                usage,
              },
              type: 'COMPLETE',
            });
          },
          onError: (errorMsg: string) => {
            dispatch({
              payload: {
                conversationId,
                errorMsg,
                fullContent: fullContentRef.current,
                modelId,
                questionId,
              },
              type: 'SEND_ERROR',
            });
          },
        };

        await executeSSERequest(messagePayload, abortController, sseCallbacks);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          dispatch({
            payload: {
              conversationId,
              errorMsg: t('messages.networkError'),
              modelId,
              questionId,
            },
            type: 'GLOBAL_ERROR',
          });
          console.error('Failed to generate message:', error);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = undefined;
          dispatch({ type: 'CLEAR_LOADING' });
          setGenerating(false);
          setIsMcpExecuting(false);
        }
        setStreamingQuestionId((value) => (value === questionId ? undefined : value));
      }
    },
    [currentSessionId, t],
  );

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      if (currentSessionId === sessionId) return;
      handleStop();

      try {
        setCurrentSessionId(sessionId);
        const response = await APIs.getConversationsV2(sessionId);

        if (response.code === 'SUCCESS' && response.data) {
          const model: IProductConversations | undefined = response.data[0];
          if (!model) {
            dispatch({ type: 'RESET' });
            return;
          }

          dispatch({
            payload: [
              {
                conversations: model.conversations.map((conversation) => ({
                  id: conversation.conversationId,
                  loading: false,
                  questions: conversation.questions.map((question) => {
                    const activeAnswerIndex = question.answers.length - 1;

                    return {
                      activeAnswerIndex,
                      answers: question.answers.map((answer) => {
                        const { mcpToolCalls, mcpToolResponses, messageChunks } =
                          parseMessageChunks(answer.messageChunks);

                        return {
                          content: answer.content,
                          errorMsg: '',
                          firstTokenTime: answer.usage?.firstByteTimeout || 0,
                          inputTokens: answer.usage?.inputTokens || 0,
                          mcpToolCalls,
                          mcpToolResponses,
                          messageChunks,
                          outputTokens: answer.usage?.outputTokens || 0,
                          totalTime: answer.usage?.elapsedTime || 0,
                        };
                      }),
                      attachments: question.attachments,
                      content: question.content,
                      createdAt: question.createdAt,
                      id: question.questionId,
                      isNewQuestion: false,
                    };
                  }),
                })),
                id: model.productId,
                name: '-',
                sessionId,
              },
            ],
            type: 'SET_CONVERSATIONS',
          });
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
        antdMessage.error(t('session.loadHistoryFailed'));
      }
    },
    [currentSessionId, handleStop, t],
  );

  const onChangeActiveAnswer = useCallback(
    (modelId: string, conversationId: string, questionId: string, direction: 'prev' | 'next') => {
      dispatch({
        payload: { conversationId, direction, modelId, questionId },
        type: 'CHANGE_ACTIVE_ANSWER',
      });
    },
    [],
  );

  return {
    currentSessionId,
    dispatch,
    generating,
    handleNewChat,
    handleSelectSession,
    handleStop,
    isMcpExecuting,
    modelConversation: state,
    onChangeActiveAnswer,
    regenerateMessage,
    sendMessage,
    setCurrentSessionId,
    sidebarRefreshTrigger,
    streamingQuestionId,
  };
}

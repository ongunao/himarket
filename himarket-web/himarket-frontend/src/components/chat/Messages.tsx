import {
  CopyOutlined,
  ReloadOutlined,
  LeftOutlined,
  RightOutlined,
  DownCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { message, Tooltip } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductIconRenderer } from '../icon/ProductIconRenderer';
import MarkdownRender from '../MarkdownRender';
import { AttachmentPreview, type PreviewAttachment } from './AttachmentPreview';
import { McpToolCallPanel } from './McpToolCallPanel';
import { copyToClipboard } from '../../lib/utils';

import type {
  IChatMessageChunk,
  IGeneratedImage,
  IModelConversation,
  IMcpToolCall,
  IMcpToolResponse,
} from '../../types';

interface MessageListProps {
  conversations: IModelConversation['conversations'];
  generating: boolean;
  streamingQuestionId?: string;
  modelName?: string;
  modelIcon?: string;
  onRefresh?: (
    msg: IModelConversation['conversations'][0],
    quest: IModelConversation['conversations'][0]['questions'][0],
    isLast: boolean,
  ) => void;
  onChangeVersion?: (
    conversationId: string,
    questionId: string,
    direction: 'prev' | 'next',
  ) => void;
  autoScrollEnabled?: boolean;
  onEditImage?: (image: IGeneratedImage) => void;
}

export function Messages({
  autoScrollEnabled = true,
  conversations,
  generating,
  modelIcon,
  modelName = 'AI Assistant',
  onChangeVersion,
  onEditImage,
  onRefresh,
  streamingQuestionId,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  }, [conversations, autoScrollEnabled]);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pb-5 pt-4 sm:px-5">
      <div className="space-y-6">
        {conversations.map((conversation, conversationIndex) => {
          return conversation.questions.map((question, questionIndex) => {
            const activeAnswer = question.answers[question.activeAnswerIndex];
            const isLast =
              conversationIndex === conversations.length - 1 &&
              questionIndex === conversation.questions.length - 1;
            return (
              <Message
                activeAnswer={activeAnswer}
                conversation={conversation}
                isLast={isLast}
                isNewChat={question.isNewQuestion !== false}
                isStreaming={generating && question.id === streamingQuestionId}
                key={question.id}
                modelIcon={modelIcon}
                modelName={modelName}
                onChangeVersion={onChangeVersion}
                onEditImage={onEditImage}
                onRefresh={onRefresh}
                question={question}
              />
            );
          });
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function Message({
  activeAnswer,
  conversation,
  isLast,
  isNewChat,
  isStreaming,
  modelIcon,
  modelName,
  onChangeVersion,
  onEditImage,
  onRefresh,
  question,
}: {
  conversation: IModelConversation['conversations'][0];
  question: IModelConversation['conversations'][0]['questions'][0];
  activeAnswer?: IModelConversation['conversations'][0]['questions'][0]['answers'][0];
  modelIcon?: string;
  modelName?: string;
  isNewChat?: boolean;
  isLast: boolean;
  isStreaming: boolean;
  onChangeVersion?: (
    conversationId: string,
    questionId: string,
    direction: 'prev' | 'next',
  ) => void;
  onEditImage?: (image: IGeneratedImage) => void;
  onRefresh?: (
    msg: IModelConversation['conversations'][0],
    quest: IModelConversation['conversations'][0]['questions'][0],
    isLast: boolean,
  ) => void;
}) {
  const { t } = useTranslation('chat');
  const contentRef = useRef<HTMLDivElement>(null);

  const [expandedContent, setExpandedContent] = useState(() => {
    // Initial state will be updated after first render
    return true;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const questionAttachments = question.attachments || [];
  const hasAnswerContent = Boolean(
    activeAnswer?.content ||
    activeAnswer?.messageChunks?.length ||
    activeAnswer?.mcpToolCalls?.length ||
    activeAnswer?.mcpToolResponses?.length,
  );

  const handleCopy = async (content: string, messageId: string) => {
    copyToClipboard(content).then(() => {
      message.success(t('messages.copied'));
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const formatTime = (ms?: number) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  useEffect(() => {
    // Check content height after render and update expanded state if needed
    if (contentRef.current) {
      const height = contentRef.current.getBoundingClientRect().height;
      if (height < 160) {
        setExpandedContent(false);
      }
    }
  }, [activeAnswer?.content]);

  return (
    <div key={question.id}>
      <div className="flex justify-end">
        <div className="flex max-w-[88%] flex-col items-end gap-2 sm:max-w-[78%]">
          {questionAttachments.length > 0 && (
            <AttachmentPreview
              attachments={questionAttachments as PreviewAttachment[]}
              className="mb-1 justify-end"
            />
          )}
          <div className="flex items-center rounded-[16px] rounded-tr-md bg-colorPrimarySoftHover px-4 py-3 text-[#4F5665]">
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed tracking-normal">
              {question.content}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        {/* 消息内容区域 */}
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-[8px]">
              <ProductIconRenderer className="h-full w-full object-cover" iconType={modelIcon} />
            </div>
            <div className="text-sm font-medium leading-5 text-gray-600">{modelName}</div>
          </div>
          <div className="rounded-[18px] bg-white/55 px-4 py-4 backdrop-blur-[2px] sm:px-5">
            <div
              className={`${!isNewChat && expandedContent ? 'max-h-40 overflow-hidden' : 'overflow-auto'} relative text-[15px] leading-[1.72] text-gray-700`}
              ref={contentRef}
            >
              {!isNewChat && expandedContent && (
                <button
                  className="bottom-mask flex justify-center items-end cursor-pointer absolute -bottom-px h-14 w-full border-0 bg-transparent"
                  onClick={() => setExpandedContent(false)}
                  style={{
                    background:
                      'linear-gradient(rgba(255, 255, 255, .15) 9%, rgba(255, 255, 255, .96) 100%)',
                  }}
                  type="button"
                >
                  <DownCircleOutlined className="text-gray-500 mb-2" />
                </button>
              )}
              <div className="space-y-3">
                {(!activeAnswer?.errorMsg || hasAnswerContent) && (
                  <AnswerBody
                    activeAnswer={activeAnswer}
                    isStreaming={isStreaming}
                    loading={conversation.loading}
                    onEditImage={onEditImage}
                  />
                )}
                {activeAnswer?.errorMsg && (
                  <div className="flex items-center gap-2 text-red-500">
                    <span>{activeAnswer.errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 统计信息和功能按钮 - 只在有内容或错误时显示 */}
          {
            <div className="mt-2 flex items-center gap-1.5 px-1">
              {/* Token 统计图标 - hover 显示详情 */}
              <Tooltip
                color="#ffffff"
                overlayInnerStyle={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  color: '#333',
                }}
                overlayStyle={{ maxWidth: 'none' }}
                title={
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                    <span>
                      {t('messages.firstToken')}: {formatTime(activeAnswer?.firstTokenTime)}
                    </span>
                    <span>
                      {t('messages.totalTime')}: {formatTime(activeAnswer?.totalTime)}
                    </span>
                    <span>
                      {t('messages.inputTokens')}: {activeAnswer?.inputTokens ?? '-'}
                    </span>
                    <span>
                      {t('messages.outputTokens')}: {activeAnswer?.outputTokens ?? '-'}
                    </span>
                  </div>
                }
              >
                <button className="rounded-md p-1.5 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600">
                  <BarChartOutlined className="text-sm" />
                </button>
              </Tooltip>

              {/* 复制 */}
              <Tooltip
                color="#ffffff"
                overlayInnerStyle={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  color: '#333',
                }}
                placement="top"
                title={t('messages.copy')}
              >
                <button
                  aria-label={t('messages.copy')}
                  className={`rounded-md p-1.5 transition-colors duration-200 ${copiedId === question.id ? 'text-colorPrimary' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'} `}
                  onClick={() => handleCopy(activeAnswer?.content || '', question.id)}
                >
                  <CopyOutlined className="text-sm" />
                </button>
              </Tooltip>

              {/* 重新生成 */}
              <Tooltip
                color="#ffffff"
                overlayInnerStyle={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  color: '#333',
                }}
                placement="top"
                title={t('messages.regenerate')}
              >
                <button
                  aria-label={t('messages.regenerate')}
                  className="rounded-md p-1.5 text-gray-400 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => {
                    onRefresh?.(conversation, question, isLast);
                  }}
                >
                  <ReloadOutlined className="text-sm" />
                </button>
              </Tooltip>

              {/* 版本切换按钮 - 仅在有多个版本时显示 */}
              {question.answers?.length > 1 && (
                <div className="ml-1 inline-flex items-center gap-0.5 rounded-[8px] px-0.5">
                  <button
                    aria-label={t('messages.previousVersion')}
                    className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors duration-200 ${
                      question.activeAnswerIndex === 0
                        ? 'cursor-not-allowed text-gray-300'
                        : 'text-gray-400 hover:bg-white/70 hover:text-gray-700'
                    } `}
                    disabled={question.activeAnswerIndex === 0}
                    onClick={() => onChangeVersion?.(conversation.id, question.id, 'prev')}
                  >
                    <LeftOutlined className="text-xs" />
                  </button>
                  <span className="min-w-[42px] px-1 text-center text-[13px] font-medium leading-7 tabular-nums text-gray-500">
                    {(question.activeAnswerIndex ?? 0) + 1}
                    <span className="mx-1 text-gray-300">/</span>
                    <span className="text-gray-400">{question.answers.length}</span>
                  </span>
                  <button
                    aria-label={t('messages.nextVersion')}
                    className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors duration-200 ${
                      question.activeAnswerIndex === question.answers.length - 1
                        ? 'cursor-not-allowed text-gray-300'
                        : 'text-gray-400 hover:bg-white/70 hover:text-gray-700'
                    } `}
                    disabled={question.activeAnswerIndex === question.answers.length - 1}
                    onClick={() => onChangeVersion?.(conversation.id, question.id, 'next')}
                  >
                    <RightOutlined className="text-xs" />
                  </button>
                </div>
              )}
            </div>
          }
        </div>
      </div>
    </div>
  );
}

function AnswerBody({
  activeAnswer,
  isStreaming,
  loading,
  onEditImage,
}: {
  activeAnswer?: IModelConversation['conversations'][0]['questions'][0]['answers'][0];
  isStreaming: boolean;
  loading: boolean;
  onEditImage?: (image: IGeneratedImage) => void;
}) {
  const chunks = activeAnswer?.messageChunks;
  if (chunks && chunks.length > 0) {
    return (
      <div className="space-y-3">
        <MessageChunks chunks={chunks} isStreaming={isStreaming} onEditImage={onEditImage} />
        {loading && <LoadingIndicator />}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {activeAnswer?.mcpToolCalls && activeAnswer.mcpToolCalls.length > 0 && (
          <McpToolCallPanel
            toolCalls={activeAnswer.mcpToolCalls}
            toolResponses={activeAnswer.mcpToolResponses}
          />
        )}
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <>
      {activeAnswer?.mcpToolCalls && activeAnswer.mcpToolCalls.length > 0 && (
        <div className="mb-3">
          <McpToolCallPanel
            toolCalls={activeAnswer.mcpToolCalls}
            toolResponses={activeAnswer.mcpToolResponses}
          />
        </div>
      )}
      <MarkdownRender
        content={activeAnswer?.content || ''}
        imageStyle="card"
        onEditImage={onEditImage}
        variant="chat"
      />
    </>
  );
}

function MessageChunks({
  chunks,
  isStreaming,
  onEditImage,
}: {
  chunks: IChatMessageChunk[];
  isStreaming: boolean;
  onEditImage?: (image: IGeneratedImage) => void;
}) {
  return (
    <>
      {chunks.map((chunk, index) => {
        if (chunk.type === 'ASSISTANT') {
          return chunk.content ? (
            <MarkdownRender
              content={chunk.content}
              imageStyle="card"
              key={`assistant-${index}`}
              onEditImage={onEditImage}
              variant="chat"
            />
          ) : null;
        }

        if (chunk.type === 'THINKING') {
          return chunk.content ? (
            <ThinkingBlock
              content={chunk.content}
              isStreaming={isStreaming && index === chunks.length - 1}
              key={`thinking-${index}`}
            />
          ) : null;
        }

        if (chunk.type === 'IMAGE') {
          return chunk.attachmentId ? (
            <MarkdownRender
              content={`![](/api/v1/attachments/${chunk.attachmentId})`}
              imageStyle="card"
              key={`image-${chunk.attachmentId}`}
              onEditImage={onEditImage}
              variant="chat"
            />
          ) : null;
        }

        if (chunk.type === 'TOOL_CALL') {
          const toolCall = toToolCall(chunk);
          if (!toolCall) {
            return null;
          }

          const toolResponse = findToolResponse(chunks, chunk);
          return (
            <McpToolCallPanel
              key={`tool-call-${chunk.id || index}`}
              toolCalls={[toolCall]}
              toolResponses={toolResponse ? [toolResponse] : []}
            />
          );
        }

        return null;
      })}
    </>
  );
}

function ThinkingBlock({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  const { t } = useTranslation('chat');
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    setExpanded(isStreaming);
  }, [isStreaming]);

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E6EAF1] bg-[#F6F8FC]/90 text-sm text-gray-500">
      <button
        aria-expanded={expanded}
        className="flex min-h-9 w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors hover:bg-white/55"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
          {isStreaming && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-colorPrimary" />
          )}
          {t('messages.thinking')}
        </span>
        <RightOutlined
          aria-hidden="true"
          className={`text-[10px] text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-[#E8ECF3] px-3.5 py-3">
          <MarkdownRender content={content} variant="thinking" />
        </div>
      )}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex items-center gap-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-colorPrimary"
          style={{ animation: 'bounceStrong 1s infinite', animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-colorPrimary"
          style={{ animation: 'bounceStrong 1s infinite', animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-colorPrimary"
          style={{ animation: 'bounceStrong 1s infinite', animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}

function toToolCall(chunk: IChatMessageChunk): IMcpToolCall | null {
  if (!chunk.id || !chunk.name) {
    return null;
  }

  return {
    arguments:
      typeof chunk.arguments === 'string' ? chunk.arguments : JSON.stringify(chunk.arguments ?? {}),
    id: chunk.id,
    name: chunk.name,
    type: 'function',
  };
}

function findToolResponse(
  chunks: IChatMessageChunk[],
  toolCall: IChatMessageChunk,
): IMcpToolResponse | undefined {
  const response = chunks.find((chunk) => chunk.type === 'TOOL_RESULT' && chunk.id === toolCall.id);
  if (!response?.id || !response.name) {
    return undefined;
  }

  return {
    id: response.id,
    name: response.name,
    result: response.result,
  };
}

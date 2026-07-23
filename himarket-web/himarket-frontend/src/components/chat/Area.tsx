import { message } from 'antd';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { InputBox } from './InputBox';
import McpModal from './McpModal';
import { Messages } from './Messages';
import { ModelSelector } from './ModelSelector';
import { SuggestedQuestions } from './SuggestedQuestions';
import useCategories from '../../hooks/useCategories';
import useProducts from '../../hooks/useProducts';
import APIs from '../../lib/apis';
import { safeJSONParse } from '../../lib/utils';

import type {
  IGetPrimaryConsumerResp,
  IProductDetail,
  ISubscription,
  IChatAttachment,
  ModelCategory,
} from '../../lib/apis';
import type { IGeneratedImage, IModelConversation } from '../../types';

interface ChatAreaProps {
  modelConversations: IModelConversation[];
  currentSessionId?: string;
  selectedModel?: IProductDetail;
  generating: boolean;
  streamingQuestionId?: string;
  isMcpExecuting: boolean;
  onChangeActiveAnswer: (
    modelId: string,
    conversationId: string,
    questionId: string,
    direction: 'prev' | 'next',
  ) => void;
  onSendMessage: (
    message: string,
    mcps: IProductDetail[],
    enableWebSearch: boolean,
    enableThinking: boolean,
    modelMap: Map<string, IProductDetail>,
    attachments: IChatAttachment[],
  ) => void;
  onSelectProduct: (product: IProductDetail) => void;
  handleGenerateMessage: (ids: {
    modelId: string;
    conversationId: string;
    questionId: string;
    content: string;
    mcps: IProductDetail[];
    enableWebSearch: boolean;
    enableThinking?: boolean;
    modelMap: Map<string, IProductDetail>;
    attachments?: IChatAttachment[];
  }) => void;

  chatType?: ModelCategory;
  onStop?: () => void;
}

export function ChatArea(props: ChatAreaProps) {
  const {
    chatType = 'TEXT',
    currentSessionId,
    generating,
    handleGenerateMessage,
    isMcpExecuting,
    modelConversations,
    onChangeActiveAnswer,
    onSelectProduct,
    onSendMessage,
    onStop,
    selectedModel,
    streamingQuestionId,
  } = props;
  const { t } = useTranslation('chat');

  const activeConversation = modelConversations[0];
  const activeModelId = activeConversation?.id ?? selectedModel?.productId ?? '';

  const {
    data: mcpList,
    get: getMcpList,
    loading: mcpListLoading,
    set: setMcpList,
  } = useProducts({ type: 'MCP_SERVER' });
  const { data: modelList, loading: modelsLoading } = useProducts({
    ['modelFilter.category']: chatType,
    type: 'MODEL_API',
  });
  const { data: categories, loading: categoriesLoading } = useCategories({
    addAll: true,
    type: 'MODEL_API',
  });
  const { data: mcpCategories } = useCategories({ addAll: true, type: 'MCP_SERVER' });

  const primaryConsumer = useRef<IGetPrimaryConsumerResp>();

  const [addedMcps, setAddedMcps] = useState<IProductDetail[]>([]);
  const addedMcpsRef = useRef<IProductDetail[]>([]);
  const [mcpSubscripts, setMcpSubscripts] = useState<ISubscription[]>([]);
  const [modelSubscriptions, setModelSubscriptions] = useState<ISubscription[]>([]);
  const [mcpEnabled, setMcpEnabled] = useState(() => {
    return safeJSONParse(window.localStorage.getItem('mcpEnabled') || 'false', false);
  });

  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [sourceImage, setSourceImage] = useState<IGeneratedImage>();

  // 处理滚动事件，检测用户是否手动向上滚动
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { clientHeight, scrollHeight, scrollTop } = target;
    // 距离底部的阈值（像素）
    const threshold = 100;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < threshold;

    if (isAtBottom) {
      // 用户滚动到底部，恢复自动滚动
      setAutoScrollEnabled(true);
    } else {
      // 用户向上滚动，禁用自动滚动
      setAutoScrollEnabled(false);
    }
  }, []);

  const handleMcpFilter = useCallback(
    (id: string) => {
      if (id === 'added') {
        setMcpList(addedMcps);
      } else {
        getMcpList({
          categoryIds: ['all', 'added'].includes(id) ? [] : [id],
          type: 'MCP_SERVER',
        });
      }
    },
    [addedMcps, setMcpList, getMcpList],
  );

  const handleMcpSearch = useCallback(
    (id: string, name: string) => {
      if (id === 'added') {
        setAddedMcps(() => addedMcpsRef.current.filter((mcp) => mcp.name.includes(name)));
      } else {
        getMcpList({
          categoryIds: ['all', 'added'].includes(id) ? [] : [id],
          name,
          type: 'MCP_SERVER',
        });
      }
    },
    [getMcpList],
  );

  const toggleMcpModal = useCallback(() => {
    setShowMcpModal((v) => !v);
  }, []);

  const handleAddMcp = useCallback(
    (product: IProductDetail) => {
      setAddedMcps((v) => {
        if (v.length === 10) {
          message.error(t('mcp.maxAdded'));
          return v;
        }
        const res = [product, ...v];
        addedMcpsRef.current = res;
        return res;
      });
    },
    [t],
  );

  const handleRemoveMcp = useCallback((product: IProductDetail) => {
    setAddedMcps((v) => {
      const res = v.filter((i) => i.productId !== product.productId);
      addedMcpsRef.current = res;
      return res;
    });
  }, []);

  const handleRemoveAll = useCallback(() => {
    setAddedMcps([]);
    addedMcpsRef.current = [];
  }, []);

  const handleQuickSubscribe = useCallback(
    (product: IProductDetail) => {
      if (!primaryConsumer.current) return;
      APIs.subscribeProduct(primaryConsumer.current.consumerId, product.productId)
        .then(({ data }) => {
          if (data) {
            message.success(t('mcp.subscribeSuccess'));
            APIs.getConsumerSubscriptions(data.consumerId, { size: 1000 }).then(({ data }) => {
              setMcpSubscripts(data.content);
            });
          } else {
            message.error(t('mcp.subscribeFailed'));
          }
        })
        .catch(() => {
          message.error(t('mcp.subscribeFailed'));
        });
    },
    [t],
  );

  const handleMcpEnable = (enable: boolean) => {
    localStorage.setItem('mcpEnabled', JSON.stringify(enable));
    setMcpEnabled(enable);
  };

  const subscribedModelList = useMemo(() => {
    const modelApiSubs = modelSubscriptions.filter(
      (s) => s.status === 'APPROVED' && s.productType === 'MODEL_API',
    );
    if (modelApiSubs.length === 0) {
      return modelList;
    }
    const approvedProductIds = new Set(modelApiSubs.map((s) => s.productId));
    return modelList.filter((m) => approvedProductIds.has(m.productId));
  }, [modelList, modelSubscriptions]);

  const modelMap = useMemo(() => {
    const m = new Map<string, IProductDetail>();
    subscribedModelList.forEach((model) => {
      m.set(model.productId, model);
    });
    if (selectedModel) {
      m.set(selectedModel.productId, selectedModel);
    }
    return m;
  }, [selectedModel, subscribedModelList]);

  const currentModel = modelMap.get(activeModelId);
  const selectedModelFallback =
    selectedModel?.productId === activeModelId ? selectedModel : undefined;
  const showWebSearch = currentModel?.feature?.modelFeature?.webSearch || false;
  const enableMultiModal = currentModel?.feature?.modelFeature?.enableMultiModal || false;
  const showThinking = currentModel?.feature?.modelFeature?.enableThinking || false;

  useEffect(() => {
    APIs.getPrimaryConsumer().then(({ data }) => {
      primaryConsumer.current = data;
      APIs.getConsumerSubscriptions(data.consumerId, { size: 1000 }).then(({ data }) => {
        setMcpSubscripts(data.content);
        setModelSubscriptions(data.content.filter((s: ISubscription) => s.status === 'APPROVED'));
      });
    });
  }, []);

  useEffect(() => {
    setSourceImage(undefined);
  }, [activeModelId, chatType, currentSessionId]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 flex min-h-14 items-center px-4 py-2.5 sm:px-5">
        <ModelSelector
          categories={categories}
          categoriesLoading={categoriesLoading}
          loading={modelsLoading}
          modelList={subscribedModelList}
          onSelectModel={onSelectProduct}
          selectedModel={currentModel ?? selectedModelFallback}
          selectedModelId={activeModelId}
        />
      </div>

      {activeConversation ? (
        <>
          <div className="min-h-0 flex-1 overflow-auto" onScroll={handleScroll}>
            <Messages
              autoScrollEnabled={autoScrollEnabled}
              conversations={activeConversation.conversations}
              generating={generating}
              modelIcon={currentModel?.icon?.value}
              modelName={currentModel?.name}
              onChangeVersion={(...args) => onChangeActiveAnswer(activeConversation.id, ...args)}
              onEditImage={setSourceImage}
              onRefresh={(conversation, question, isLast) => {
                setAutoScrollEnabled(isLast);
                handleGenerateMessage({
                  attachments: question.attachments,
                  content: question.content,
                  conversationId: conversation.id,
                  enableThinking,
                  enableWebSearch,
                  mcps: mcpEnabled ? addedMcps : [],
                  modelId: activeConversation.id,
                  modelMap,
                  questionId: question.id,
                });
              }}
              streamingQuestionId={streamingQuestionId}
            />
          </div>
          <div className="p-4 pt-3">
            <div className="mx-auto max-w-[1040px]">
              <InputBox
                addedMcps={addedMcps}
                enableMultiModal={enableMultiModal}
                isLoading={generating}
                isMcpExecuting={isMcpExecuting}
                mcpEnabled={mcpEnabled}
                onClearSourceImage={() => setSourceImage(undefined)}
                onMcpClick={toggleMcpModal}
                onSendMessage={(content, attachments) => {
                  setAutoScrollEnabled(true);
                  onSendMessage(
                    content,
                    mcpEnabled ? addedMcps : [],
                    enableWebSearch,
                    enableThinking,
                    modelMap,
                    attachments,
                  );
                  setSourceImage(undefined);
                }}
                onStop={onStop}
                onThinkingEnable={setEnableThinking}
                onWebSearchEnable={setEnableWebSearch}
                showThinking={showThinking}
                showWebSearch={showWebSearch}
                sourceImage={sourceImage}
                thinkingEnabled={enableThinking}
                webSearchEnabled={enableWebSearch}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-10">
          <div className="w-full max-w-[920px]">
            <div className="mb-9 text-center">
              <h1 className="mb-2 text-[26px] font-medium leading-tight text-gray-800">
                <span className="text-gray-700">{t('area.emptyTitle')}</span>{' '}
                <span className="hi-chat-brand-glow font-semibold text-[#818CF8]">HiChat</span>
              </h1>
            </div>

            <div className="mb-7">
              <InputBox
                addedMcps={addedMcps}
                enableMultiModal={enableMultiModal}
                isLoading={generating}
                isMcpExecuting={isMcpExecuting}
                mcpEnabled={mcpEnabled}
                onClearSourceImage={() => setSourceImage(undefined)}
                onMcpClick={toggleMcpModal}
                onSendMessage={(c, a) => {
                  setAutoScrollEnabled(true);
                  onSendMessage(
                    c,
                    mcpEnabled ? addedMcps : [],
                    enableWebSearch,
                    enableThinking,
                    modelMap,
                    a,
                  );
                  setSourceImage(undefined);
                }}
                onStop={onStop}
                onThinkingEnable={setEnableThinking}
                onWebSearchEnable={setEnableWebSearch}
                showThinking={showThinking}
                showWebSearch={showWebSearch}
                sourceImage={sourceImage}
                thinkingEnabled={enableThinking}
                webSearchEnabled={enableWebSearch}
              />
            </div>

            <SuggestedQuestions
              onSelectQuestion={(content) => {
                setAutoScrollEnabled(true);
                onSendMessage(
                  content,
                  mcpEnabled ? addedMcps : [],
                  enableWebSearch,
                  enableThinking,
                  modelMap,
                  [],
                );
              }}
            />
          </div>
        </div>
      )}
      <McpModal
        added={addedMcps}
        categories={mcpCategories}
        data={mcpList}
        enabled={mcpEnabled}
        mcpLoading={mcpListLoading}
        onAdd={handleAddMcp}
        onClose={() => setShowMcpModal(false)}
        onEnabled={handleMcpEnable}
        onFilter={handleMcpFilter}
        onQuickSubscribe={handleQuickSubscribe}
        onRemove={handleRemoveMcp}
        onRemoveAll={handleRemoveAll}
        onSearch={handleMcpSearch}
        open={showMcpModal}
        subscripts={mcpSubscripts}
      />
    </div>
  );
}

import { message as antdMessage } from 'antd';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { ChatArea } from '../components/chat/Area';
import { Sidebar } from '../components/chat/Sidebar';
import { Layout } from '../components/Layout';
import { WelcomeView } from '../components/WelcomeView';
import { useAuth } from '../hooks/useAuth';
import { useChatSession } from '../hooks/useChatSession';
import APIs, { type IProductDetail, type IChatAttachment, type ModelCategory } from '../lib/apis';

function getModelCategory(product: IProductDetail): ModelCategory {
  return product.modelConfig?.modelAPIConfig.modelCategory?.toLowerCase() === 'image'
    ? 'Image'
    : 'TEXT';
}

function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const { t } = useTranslation('chat');
  const [selectedModel, setSelectedModel] = useState<IProductDetail>();
  const [chatType, setChatType] = useState<ModelCategory>('TEXT');

  const {
    currentSessionId,
    generating,
    handleNewChat,
    handleSelectSession,
    handleStop,
    isMcpExecuting,
    modelConversation,
    onChangeActiveAnswer,
    regenerateMessage,
    sendMessage,
    sidebarRefreshTrigger,
    streamingQuestionId,
  } = useChatSession();

  // 从 location.state 接收选中的产品，或者加载默认第一个模型
  useEffect(() => {
    if (!isLoggedIn) return;

    const state = location.state as { selectedProduct?: IProductDetail } | null;
    if (state?.selectedProduct) {
      setSelectedModel(state.selectedProduct);
      setChatType(getModelCategory(state.selectedProduct));
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    if (selectedModel && getModelCategory(selectedModel) === chatType) {
      return;
    }

    let cancelled = false;
    const loadDefaultModel = async () => {
      try {
        const response = await APIs.getProducts({
          ['modelFilter.category']: chatType,
          page: 1,
          size: 1,
          type: 'MODEL_API',
        });
        if (cancelled) return;

        if (response.code === 'SUCCESS' && response.data?.content?.length > 0) {
          setSelectedModel(response.data.content[0]);
        } else {
          setSelectedModel(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load default model:', error);
        }
      }
    };

    loadDefaultModel();
    return () => {
      cancelled = true;
    };
  }, [chatType, isLoggedIn, location.pathname, location.state, navigate, selectedModel]);

  const handleSendMessage = async (
    content: string,
    mcps: IProductDetail[],
    enableWebSearch: boolean,
    enableThinking: boolean,
    modelMap: Map<string, IProductDetail>,
    attachments: IChatAttachment[] = [],
  ) => {
    if (!selectedModel) {
      antdMessage.error(t('page.selectModelFirst'));
      return;
    }
    await sendMessage(
      content,
      mcps,
      enableWebSearch,
      enableThinking,
      modelMap,
      selectedModel,
      attachments,
    );
  };

  const handleGenerateMessage = async (params: {
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
    await regenerateMessage(params);
  };

  const handleSelectProduct = (product: IProductDetail) => {
    setSelectedModel(product);
    handleNewChat();
  };

  const handleSelectChatSession = async (sessionId: string, productIds: string[]) => {
    await handleSelectSession(sessionId);

    const productId = productIds[0];
    if (!productId) return;

    try {
      const response = await APIs.getProduct({ id: productId });
      if (response.code === 'SUCCESS' && response.data) {
        setSelectedModel(response.data);
        setChatType(getModelCategory(response.data));
      }
    } catch (error) {
      console.error('Failed to load session model:', error);
    }
  };

  return (
    <Layout backgroundVariant="chat">
      {!isLoggedIn ? (
        <WelcomeView type="chat" />
      ) : (
        <div className="flex h-[calc(100dvh-76px)] min-h-0 gap-4 bg-transparent py-4">
          <div className="hidden h-full lg:block">
            <Sidebar
              currentSessionId={currentSessionId}
              onNewChat={handleNewChat}
              onSelectSession={handleSelectChatSession}
              onSelectType={(type) => {
                setSelectedModel(undefined);
                setChatType(type);
                handleNewChat();
              }}
              refreshTrigger={sidebarRefreshTrigger}
              selectedType={chatType}
            />
          </div>
          <ChatArea
            chatType={chatType}
            currentSessionId={currentSessionId}
            generating={generating}
            handleGenerateMessage={handleGenerateMessage}
            isMcpExecuting={isMcpExecuting}
            modelConversations={modelConversation}
            onChangeActiveAnswer={onChangeActiveAnswer}
            onSelectProduct={handleSelectProduct}
            onSendMessage={handleSendMessage}
            onStop={handleStop}
            selectedModel={selectedModel}
            streamingQuestionId={streamingQuestionId}
          />
        </div>
      )}
    </Layout>
  );
}

export default Chat;

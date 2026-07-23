import { Divider, Popover, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Check, Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import APIs, { type IProductDetail, type IMcpTool } from '../../lib/apis';
import { getIconString } from '../../lib/iconUtils';
import { ProductIconRenderer } from '../icon/ProductIconRenderer';

interface McpCardProps {
  data: IProductDetail;
  isSubscribed?: boolean;
  isAdded?: boolean;
  onAdd?: (product: IProductDetail) => void;
  onRemove?: (product: IProductDetail) => void;
  onQuickSubscribe?: (product: IProductDetail) => void;
  onShowMore?: (product: IProductDetail) => void;
  moreLoading?: boolean;
}

function McpCard(props: McpCardProps) {
  const {
    data,
    isAdded = false,
    isSubscribed = false,
    onAdd,
    onQuickSubscribe,
    onRemove,
    onShowMore,
  } = props;
  const { t } = useTranslation('chat');
  const { t: tSquare } = useTranslation('square');

  const [toolsLoading, setToolsLoading] = useState(false);
  const [tools, setTools] = useState<IMcpTool[]>([]);
  const [popoverVisible, setPopoverVisible] = useState(false);

  // 加载工具列表
  const loadTools = async () => {
    if (tools.length > 0) return; // 已加载过则不重复加载

    setToolsLoading(true);
    try {
      const resp = await APIs.getMcpTools({ productId: data.productId });
      if (resp.data?.tools) {
        setTools(resp.data.tools);
      }
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
    } finally {
      setToolsLoading(false);
    }
  };

  // 当 Popover 打开时加载工具列表
  const handleVisibleChange = (visible: boolean) => {
    setPopoverVisible(visible);
    if (visible) {
      loadTools();
      onShowMore?.(data);
    }
  };

  const handleAdd = () => {
    if (isAdded) {
      onRemove?.(data);
    } else {
      onAdd?.(data);
    }
  };

  const handleQuickSubscribe = () => {
    onQuickSubscribe?.(data);
  };

  const updatedAt = dayjs(data.updatedAt || data.createAt).format('YYYY-MM-DD');
  const canAdd = isSubscribed || data.subscribable === false;
  const subscriptionStatus = isSubscribed
    ? t('mcpCard.subscribed')
    : data.subscribable === false
      ? t('mcpCard.noSubscriptionRequired')
      : t('mcpCard.notSubscribed');

  return (
    <div
      className={`
        group relative flex h-[152px] w-full flex-col overflow-hidden rounded-xl border
        bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFF_100%)] p-4
        shadow-[0_6px_20px_rgba(31,42,68,0.05)]
        transition-all duration-200 ease-out
        hover:-translate-y-0.5 hover:border-[#C6D1E3] hover:shadow-[0_14px_34px_rgba(31,42,68,0.09)]
        border-[#DDE4EF]
      `}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#EDF1F7] bg-[#F3F6FF]">
            <ProductIconRenderer
              className="h-full w-full object-cover"
              iconType={getIconString(data.icon, data.name)}
            />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold leading-tight text-gray-950">
              {data.name}
            </h3>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-xs leading-snug text-gray-500">
                {tSquare('updatedAt')} {updatedAt}
              </p>
              <span className="max-w-24 flex-shrink-0 truncate rounded-[6px] bg-[#F3F6FA] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-gray-500">
                {subscriptionStatus}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <Popover
            content={
              <div className="max-h-96 w-80 overflow-y-auto">
                {toolsLoading ? (
                  // 骨架屏
                  <div className="space-y-3">
                    <Skeleton.Input active size="small" style={{ width: 100 }} />
                    {[1, 2, 3].map((i) => (
                      <div key={i}>
                        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
                        {i < 3 && <Divider style={{ margin: '12px 0' }} />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    {/* 顶部标题 */}
                    <div className="mb-3 text-base font-medium">
                      {t('mcpCard.toolsWithCount', { count: tools.length })}
                    </div>

                    {/* 工具列表 */}
                    {tools.length === 0 ? (
                      <div className="text-sm text-gray-400">{t('mcpCard.noTools')}</div>
                    ) : (
                      <div className="space-y-3">
                        {tools.map((tool, index) => (
                          <div key={tool.name}>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">{tool.name}</div>
                              <div className="text-xs leading-relaxed text-gray-500">
                                {tool.description || t('mcpCard.noDescription')}
                              </div>
                            </div>
                            {index < tools.length - 1 && <Divider style={{ margin: '12px 0' }} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            }
            onOpenChange={handleVisibleChange}
            open={popoverVisible}
            placement="bottom"
            trigger="click"
          >
            <button
              aria-label={t('mcpCard.toolsWithCount', { count: tools.length })}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all duration-200 hover:bg-[#F3F6FA] hover:text-gray-700 group-focus-within:opacity-100 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              type="button"
            >
              <Ellipsis aria-hidden="true" size={17} strokeWidth={1.8} />
            </button>
          </Popover>

          {canAdd ? (
            <button
              aria-label={isAdded ? t('mcpCard.remove') : t('mcpCard.add')}
              aria-pressed={isAdded}
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                isAdded
                  ? 'border-colorPrimary bg-colorPrimary text-white'
                  : 'border-[#B8C1CF] bg-white hover:border-colorPrimary'
              }`}
              onClick={handleAdd}
              type="button"
            >
              {isAdded && <Check aria-hidden="true" size={10} strokeWidth={3} />}
            </button>
          ) : (
            <button
              className="h-7 flex-shrink-0 rounded-[7px] bg-colorPrimarySoft px-2.5 text-xs font-semibold text-colorPrimary transition-colors hover:bg-colorPrimarySoftHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/20 active:translate-y-px"
              onClick={handleQuickSubscribe}
              title={t('mcpCard.quickSubscribe')}
              type="button"
            >
              {t('mcpCard.subscribe')}
            </button>
          )}
        </div>
      </div>

      <p className="line-clamp-2 h-11 flex-none overflow-hidden text-sm leading-[22px] text-gray-600">
        {data.description || t('mcpCard.noDescription')}
      </p>
    </div>
  );
}

export default McpCard;

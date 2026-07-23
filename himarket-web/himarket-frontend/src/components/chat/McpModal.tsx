import {
  CloseOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Input, Modal, Skeleton, Switch, type ModalProps } from 'antd';
import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import McpCard from './McpCard';

import type { ICategory, IProductDetail, ISubscription } from '../../lib/apis';

interface McpModal extends ModalProps {
  categories: ICategory[];
  data: IProductDetail[];
  added: IProductDetail[];
  onFilter: (id: string) => void;
  onSearch: (categorieId: string, name: string) => void;
  mcpLoading?: boolean;
  onAdd: (product: IProductDetail) => void;
  onRemove: (product: IProductDetail) => void;
  onRemoveAll: () => void;
  subscripts: ISubscription[];
  enabled?: boolean;
  onEnabled: (enabled: boolean) => void;
  onClose: () => void;
  onQuickSubscribe?: (product: IProductDetail) => void;
}

function McpModal(props: McpModal) {
  const {
    added,
    categories,
    data,
    enabled,
    mcpLoading,
    onAdd,
    onClose,
    onEnabled,
    onFilter,
    onQuickSubscribe,
    onRemove,
    onRemoveAll,
    onSearch,
    subscripts,
    ...modalProps
  } = props;
  const { t } = useTranslation('chat');
  const [searchText, setSearchText] = useState('');
  const [active, setActive] = useState('all');
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);
  const categoryListRef = useRef<HTMLDivElement>(null);

  const scbscriptsIds = useMemo(() => {
    return subscripts.map((v) => v.productId);
  }, [subscripts]);

  const addedIds = useMemo(() => {
    return added.map((v) => v.productId);
  }, [added]);

  const filteredData = useMemo(() => {
    if (active === 'added') {
      return added;
    }
    return data;
  }, [data, active, added]);

  const updateCategoryScrollState = useCallback(() => {
    const categoryList = categoryListRef.current;
    if (!categoryList) return;

    setCanScrollCategoriesLeft(categoryList.scrollLeft > 1);
    setCanScrollCategoriesRight(
      categoryList.scrollLeft + categoryList.clientWidth < categoryList.scrollWidth - 1,
    );
  }, []);

  useEffect(() => {
    if (!modalProps.open) return;

    const frame = requestAnimationFrame(updateCategoryScrollState);
    const categoryList = categoryListRef.current;
    const resizeObserver = new ResizeObserver(updateCategoryScrollState);
    if (categoryList) {
      resizeObserver.observe(categoryList);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [categories, modalProps.open, updateCategoryScrollState]);

  return (
    <Modal
      {...modalProps}
      closable={false}
      footer={null}
      keyboard
      maskClosable={false}
      onCancel={onClose}
      width="min(1160px, calc(100vw - 64px))"
    >
      <div className="flex h-[min(74vh,760px)] flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-0.5 pb-3">
          <h2 className="truncate text-[17px] font-semibold leading-6 text-gray-700">
            {t('mcpModal.title')}
          </h2>
          <button
            aria-label={t('close', { ns: 'common' })}
            className="ml-auto flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px] border-0 bg-transparent text-gray-400 transition-colors hover:bg-[#F2F3F7] hover:text-gray-700"
            onClick={onClose}
            type="button"
          >
            <CloseOutlined />
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5 pb-2.5 sm:flex-row sm:items-center">
          <Input
            allowClear
            className="h-9 w-full flex-shrink-0 rounded-[8px] border-[#E1E5EC] bg-[#F8F9FB] shadow-none transition-colors hover:border-[#D1D7E0] focus-within:border-colorPrimarySoftBorder focus-within:bg-white focus-within:ring-2 focus-within:ring-colorPrimary/10 sm:w-[320px] lg:w-[360px]"
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(evt) => {
              if (evt.code === 'Enter') {
                onSearch(active, (evt.target as HTMLInputElement).value.trim());
              }
            }}
            placeholder={t('mcpModal.searchPlaceholder')}
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
          />

          <div className="flex h-9 flex-shrink-0 items-center gap-2 rounded-[8px] bg-[#F3F5F8] px-2.5">
            <span className="text-xs font-medium text-gray-500">{t('mcpModal.enabled')}</span>
            <Switch checked={enabled} onChange={() => onEnabled(!enabled)} size="small" />
          </div>

          <div className="flex items-center gap-1">
            <button
              className={`h-9 flex-shrink-0 rounded-[8px] px-3 text-xs font-medium transition-colors active:scale-[0.98] ${
                active === 'added'
                  ? 'bg-colorPrimarySoft text-colorPrimary'
                  : 'bg-[#F3F5F8] text-gray-500 hover:bg-colorPrimarySoftHover hover:text-gray-800'
              }`}
              onClick={() => {
                setActive('added');
                onFilter('added');
              }}
              type="button"
            >
              {t('mcpModal.addedCount', { count: added.length })}
            </button>
            {active === 'added' && added.length > 0 && (
              <button
                aria-label={t('mcpModal.removeAll')}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] text-gray-400 transition-colors hover:bg-[#F2F3F7] hover:text-gray-700"
                onClick={onRemoveAll}
                title={t('mcpModal.removeAll')}
                type="button"
              >
                <Trash2 aria-hidden="true" size={14} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1 pb-3">
          {canScrollCategoriesLeft && (
            <button
              aria-label={t('modelSelector.previousCategories')}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[7px] text-gray-400 transition-colors hover:bg-colorPrimarySoftHover hover:text-colorPrimary"
              onClick={() => categoryListRef.current?.scrollBy({ behavior: 'smooth', left: -240 })}
              type="button"
            >
              <LeftOutlined className="text-[10px]" />
            </button>
          )}
          <div
            className="scrollbar-hide flex min-w-0 flex-1 gap-1 overflow-x-auto"
            onScroll={updateCategoryScrollState}
            ref={categoryListRef}
          >
            {categories.map((item) => (
              <button
                className={`h-8 flex-shrink-0 rounded-[7px] px-2.5 text-xs font-medium transition-colors active:scale-[0.98] ${
                  active === item.categoryId
                    ? 'bg-colorPrimarySoft text-colorPrimary'
                    : 'text-gray-500 hover:bg-colorPrimarySoftHover hover:text-gray-800'
                }`}
                key={item.categoryId}
                onClick={(event) => {
                  setActive(item.categoryId);
                  onFilter(item.categoryId);
                  event.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest',
                  });
                }}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>
          {canScrollCategoriesRight && (
            <button
              aria-label={t('modelSelector.nextCategories')}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[7px] text-gray-400 transition-colors hover:bg-colorPrimarySoftHover hover:text-colorPrimary"
              onClick={() => categoryListRef.current?.scrollBy({ behavior: 'smooth', left: 240 })}
              type="button"
            >
              <RightOutlined className="text-[10px]" />
            </button>
          )}
        </div>

        <section
          className="min-h-0 min-w-0 flex-1 overflow-hidden border-t border-[#EDF0F4] pt-3"
          data-sign-name="mcp-list"
        >
          <div className="h-full overflow-hidden">
            {mcpLoading ? (
              <div className="grid h-full content-start gap-3 overflow-y-auto pb-1 pr-1 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    className="flex h-[152px] flex-col rounded-xl border border-[#DDE4EF] bg-white p-4 shadow-[0_6px_20px_rgba(31,42,68,0.04)]"
                    key={index}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <Skeleton.Avatar active shape="square" size={44} />
                      <div className="flex flex-1 flex-col gap-2">
                        <Skeleton.Input active size="small" style={{ height: 18, width: '70%' }} />
                        <Skeleton.Input active size="small" style={{ height: 12, width: 92 }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Skeleton active paragraph={{ rows: 3 }} title={false} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredData.length === 0 ? (
              <Empty
                active={active}
                onViewAll={() => {
                  setActive('all');
                  onFilter('all');
                }}
              />
            ) : (
              <div
                className="grid h-full content-start gap-3 overflow-y-auto pb-1 pr-1 lg:grid-cols-2 xl:grid-cols-3"
                data-sign-name="mcp-card-grid"
              >
                {filteredData.map((item) => (
                  <McpCard
                    data={item}
                    isAdded={addedIds.includes(item.productId)}
                    isSubscribed={scbscriptsIds.includes(item.productId)}
                    key={item.productId}
                    onAdd={onAdd}
                    onQuickSubscribe={onQuickSubscribe}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

function Empty({ active, onViewAll }: { active: string; onViewAll: () => void }) {
  const { t } = useTranslation('chat');
  const isAddedView = active === 'added';

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <InboxOutlined className="text-base text-gray-400" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
          <span className="text-[#858D9B]">
            {t(isAddedView ? 'mcpModal.noAddedServers' : 'mcpModal.noServers')}
          </span>
          {isAddedView && (
            <button
              className="font-medium text-colorPrimary transition-colors hover:text-colorPrimaryHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/15"
              onClick={onViewAll}
              type="button"
            >
              {t('mcpModal.viewAll')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default McpModal;

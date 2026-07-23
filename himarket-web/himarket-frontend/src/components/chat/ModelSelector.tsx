import {
  CheckOutlined,
  DownOutlined,
  InboxOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Dropdown } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProductIconRenderer } from '../icon/ProductIconRenderer';

import type { ICategory, IProductDetail } from '../../lib/apis';

interface ModelSelectorProps {
  selectedModelId: string;
  selectedModel?: IProductDetail;
  onSelectModel: (model: IProductDetail) => void;
  modelList?: IProductDetail[];
  loading?: boolean;
  categories: ICategory[];
  categoriesLoading?: boolean;
}

export function ModelSelector({
  categories = [],
  categoriesLoading = false,
  loading = false,
  modelList = [],
  onSelectModel,
  selectedModel,
  selectedModelId,
}: ModelSelectorProps) {
  const { t } = useTranslation('chat');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [canScrollCategoriesLeft, setCanScrollCategoriesLeft] = useState(false);
  const [canScrollCategoriesRight, setCanScrollCategoriesRight] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryListRef = useRef<HTMLDivElement>(null);

  const currentModel =
    modelList.find((model) => model.productId === selectedModelId) ?? selectedModel;

  const filteredModels = modelList.filter((model) => {
    const matchesCategory =
      activeCategory === 'all' ||
      model.categories.some((category) => category.categoryId === activeCategory);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      normalizedQuery === '' ||
      model.name.toLowerCase().includes(normalizedQuery) ||
      model.description.toLowerCase().includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isOpen]);

  const updateCategoryScrollState = useCallback(() => {
    const categoryList = categoryListRef.current;
    if (!categoryList) return;

    setCanScrollCategoriesLeft(categoryList.scrollLeft > 1);
    setCanScrollCategoriesRight(
      categoryList.scrollLeft + categoryList.clientWidth < categoryList.scrollWidth - 1,
    );
  }, []);

  useEffect(() => {
    if (!isOpen || categoriesLoading) return;

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
  }, [categories, categoriesLoading, isOpen, updateCategoryScrollState]);

  const handleModelSelect = (model: IProductDetail) => {
    onSelectModel(model);
    setIsOpen(false);
    setSearchQuery('');
  };

  const dropdownContent = (
    <div className="w-[min(352px,calc(100vw-32px))] overflow-hidden rounded-[10px] border border-[#D9E0E9] bg-white shadow-[0_16px_38px_rgba(31,42,68,0.14)]">
      <div className="border-b border-[#EDF0F4] p-2.5">
        <div className="mb-2 px-0.5">
          <span className="text-sm font-semibold text-gray-900">{t('modelSelector.title')}</span>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-[8px] border border-[#DDE3EB] bg-[#FAFBFC] px-2.5 transition-colors focus-within:border-colorPrimarySoftBorder focus-within:bg-white focus-within:ring-2 focus-within:ring-colorPrimary/10">
          <SearchOutlined className="text-xs text-gray-400" />
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('modelSelector.searchPlaceholder')}
            ref={searchInputRef}
            value={searchQuery}
          />
        </label>

        {categoriesLoading ? (
          <div className="mt-2 flex gap-1.5 overflow-hidden">
            {[56, 72, 64].map((width) => (
              <span
                className="h-7 flex-shrink-0 animate-pulse rounded-[7px] bg-gray-100"
                key={width}
                style={{ width }}
              />
            ))}
          </div>
        ) : (
          categories.length > 1 && (
            <div className="mt-2 flex min-w-0 items-center gap-1">
              {canScrollCategoriesLeft && (
                <button
                  aria-label={t('modelSelector.previousCategories')}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] text-gray-400 transition-colors hover:bg-colorPrimary/10 hover:text-colorPrimary"
                  onClick={() =>
                    categoryListRef.current?.scrollBy({ behavior: 'smooth', left: -180 })
                  }
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
                {categories.map((category) => {
                  const active = category.categoryId === activeCategory;
                  return (
                    <button
                      className={`h-7 flex-shrink-0 rounded-[7px] px-2.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-colorPrimarySoft text-colorPrimary'
                          : 'text-gray-500 hover:bg-colorPrimarySoftHover hover:text-gray-800'
                      }`}
                      key={category.categoryId}
                      onClick={(event) => {
                        setActiveCategory(category.categoryId);
                        event.currentTarget.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                          inline: 'nearest',
                        });
                      }}
                      type="button"
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
              {canScrollCategoriesRight && (
                <button
                  aria-label={t('modelSelector.nextCategories')}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] text-gray-400 transition-colors hover:bg-colorPrimary/10 hover:text-colorPrimary"
                  onClick={() =>
                    categoryListRef.current?.scrollBy({ behavior: 'smooth', left: 180 })
                  }
                  type="button"
                >
                  <RightOutlined className="text-[10px]" />
                </button>
              )}
            </div>
          )
        )}
      </div>

      <div className="scrollbar-thin-soft max-h-[420px] overflow-y-auto p-1.5">
        {loading ? (
          <div className="space-y-1">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                className="flex h-11 animate-pulse items-center gap-2.5 rounded-[8px] px-2.5"
                key={item}
              >
                <span className="h-6 w-6 rounded-[7px] bg-gray-100" />
                <span className="h-3.5 flex-1 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredModels.map((model) => (
              <button
                className={`flex h-11 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/20 ${
                  model.productId === selectedModelId
                    ? 'bg-colorPrimarySoft text-gray-950'
                    : 'text-gray-700 hover:bg-[#F5F7FA] hover:text-gray-950'
                }`}
                key={model.productId}
                onClick={() => handleModelSelect(model)}
                type="button"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-[7px]">
                  <ProductIconRenderer
                    className="h-full w-full object-cover"
                    iconType={model.icon?.value}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{model.name}</span>
                {model.productId === selectedModelId && (
                  <CheckOutlined className="flex-shrink-0 text-xs text-colorPrimary" />
                )}
              </button>
            ))}
            {filteredModels.length === 0 && (
              <div className="flex min-h-28 flex-col items-center justify-center px-5 py-5 text-center">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F4F6F8] text-gray-400">
                  <InboxOutlined className="text-base" />
                </span>
                <div className="text-xs font-medium text-gray-500">
                  {t('modelSelector.noModels')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-w-0">
      <Dropdown
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSearchQuery('');
          }
        }}
        open={isOpen}
        placement="bottomLeft"
        popupRender={() => dropdownContent}
        trigger={['click']}
      >
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className="flex h-9 max-w-[320px] items-center gap-2 rounded-[9px] border border-transparent bg-[#F1F3F7] px-2.5 text-[#4F5A6A] shadow-[0_3px_10px_rgba(55,68,94,0.045)] transition-colors hover:bg-[#E9EDF3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/15"
          type="button"
        >
          {currentModel && (
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-[7px]">
              <ProductIconRenderer
                className="h-full w-full object-cover"
                iconType={currentModel.icon?.value}
              />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
            {currentModel?.name || t('modelSelector.selectModel')}
          </span>
          <DownOutlined
            className={`flex-shrink-0 text-[10px] text-gray-500 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </Dropdown>
    </div>
  );
}

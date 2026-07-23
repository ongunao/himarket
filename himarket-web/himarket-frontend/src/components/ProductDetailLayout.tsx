import { ArrowLeftOutlined } from '@ant-design/icons';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Layout } from './Layout';
import { DetailSkeleton } from './loading';
import { ProductHeader } from './ProductHeader';

import type { ProductHeaderHandle } from './ProductHeader';
import type { IProductIcon, IMCPConfig, IAgentConfig } from '../lib/apis/typing';
import type { ReactNode, Ref } from 'react';

export interface ProductDetailHeaderProps {
  name: string;
  description: string;
  icon?: IProductIcon;
  defaultIcon?: string;
  mcpConfig?: IMCPConfig;
  agentConfig?: IAgentConfig;
  updatedAt?: string;
  productType?: 'REST_API' | 'MCP_SERVER' | 'AGENT_API' | 'MODEL_API' | 'AGENT_SKILL';
  subscribable?: boolean;
  ref?: Ref<ProductHeaderHandle>;
  onSubscriptionStatusChange?: (subscribed: boolean) => void;
}

export interface ProductDetailLayoutProps {
  appearance?: 'default' | 'agent' | 'mcp' | 'model' | 'api' | 'skill' | 'worker';
  leftContent: ReactNode;
  rightContent: ReactNode;
  headerProps?: ProductDetailHeaderProps;
  loading?: boolean;
  error?: string;
  onBack?: () => void;
}

export function ProductDetailLayout({
  appearance = 'default',
  error,
  headerProps,
  leftContent,
  loading,
  onBack,
  rightContent,
}: ProductDetailLayoutProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'header']);
  const isMarketAppearance = appearance !== 'default';
  const breadcrumbs = {
    agent: { label: t('header:tabs.agents'), path: '/agents' },
    api: { label: t('header:tabs.apis'), path: '/apis' },
    mcp: { label: t('header:tabs.mcp'), path: '/mcp' },
    model: { label: t('header:tabs.models'), path: '/models' },
    skill: { label: t('header:tabs.skills'), path: '/skills' },
    worker: { label: t('header:tabs.workers'), path: '/workers' },
  };
  const breadcrumb = appearance === 'default' ? null : breadcrumbs[appearance];
  const detailGridClassName =
    appearance === 'api'
      ? 'gap-4 2xl:grid-cols-[minmax(0,1fr)_390px]'
      : appearance === 'agent'
        ? 'gap-4 xl:grid-cols-[minmax(0,1fr)_360px]'
        : isMarketAppearance
          ? 'gap-4 xl:grid-cols-[minmax(0,1fr)_390px]'
          : 'gap-5 xl:grid-cols-[minmax(0,1fr)_390px]';
  const desktopDetailClassName =
    appearance === 'api'
      ? {
          left: '2xl:order-1',
          right: '2xl:sticky 2xl:top-24 2xl:order-2 2xl:self-start',
        }
      : {
          left: 'xl:order-1',
          right: 'xl:sticky xl:top-24 xl:order-2 xl:self-start',
        };

  if (loading) {
    return (
      <Layout backgroundVariant={isMarketAppearance ? 'market' : 'default'}>
        <div
          className={`mx-auto w-full max-w-[1480px] ${
            isMarketAppearance ? 'px-4 py-4 sm:px-6 sm:py-5' : 'py-5 sm:py-7'
          }`}
        >
          <DetailSkeleton />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout backgroundVariant={isMarketAppearance ? 'market' : 'default'}>
        <div className="p-8">
          <Alert description={error} message={t('errorTitle')} showIcon type="error" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundVariant={isMarketAppearance ? 'market' : 'default'}>
      <div
        className={`mx-auto w-full max-w-[1480px] ${
          isMarketAppearance ? 'px-4 py-4 sm:px-6 sm:py-5' : 'py-5 sm:py-7'
        }`}
      >
        <div className={isMarketAppearance ? 'mb-4' : 'mb-5'}>
          {breadcrumb ? (
            <nav
              aria-label={t('back')}
              className="mb-4 flex h-9 min-w-0 items-center gap-3 px-1 text-sm"
            >
              <button
                className="font-medium text-[#778190] transition-colors hover:text-[#4B5668] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/20"
                onClick={onBack || (() => navigate(breadcrumb.path))}
                type="button"
              >
                {breadcrumb.label}
              </button>
              <span aria-hidden="true" className="text-[#A3ABB7]">
                /
              </span>
              <span className="min-w-0 truncate font-medium text-[#303A4A]">
                {headerProps?.name}
              </span>
            </nav>
          ) : (
            <button
              className="mb-4 inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-medium text-gray-600 transition-all duration-200 hover:bg-white/80 hover:text-gray-950 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/30 active:translate-y-px"
              onClick={onBack || (() => navigate(-1))}
              type="button"
            >
              <ArrowLeftOutlined className="text-xs" />
              <span>{t('back')}</span>
            </button>
          )}

          {headerProps && <ProductHeader {...headerProps} appearance={appearance} />}
        </div>

        <div className={`grid grid-cols-1 xl:items-start ${detailGridClassName}`}>
          <div
            className={`${isMarketAppearance ? 'order-1' : 'order-2'} min-w-0 ${desktopDetailClassName.left}`}
          >
            {leftContent}
          </div>
          <div
            className={`${isMarketAppearance ? 'order-2' : 'order-1'} min-w-0 ${desktopDetailClassName.right}`}
          >
            {rightContent}
          </div>
        </div>
      </div>
    </Layout>
  );
}

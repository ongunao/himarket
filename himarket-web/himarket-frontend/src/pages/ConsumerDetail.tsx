import { Alert, Skeleton, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { AuthConfig, SubscriptionManager } from '../components/consumer';
import { Layout } from '../components/Layout';
import APIs, { type IConsumer, type ISubscription } from '../lib/apis';
import request from '../lib/request';
import { formatDateTime } from '../lib/utils';

import '../styles/table.css';
import './ConsumerDetail.css';

import type { ApiResponse } from '../types';

function ConsumerDetailPage() {
  const { t } = useTranslation('consumer');
  const { consumerId } = useParams();
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [consumer, setConsumer] = useState<IConsumer>();
  const [subscriptions, setSubscriptions] = useState<ISubscription[]>([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [refreshIndex, setRefreshIndex] = useState(0);

  const fetchSubscriptions = async (consumerId: string) => {
    setSubscriptionsLoading(true);
    try {
      const response = await APIs.getConsumerSubscriptions(consumerId);
      if (response?.code === 'SUCCESS' && response?.data) {
        const subscriptionsData = response.data.content || [];
        setSubscriptions(subscriptionsData);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!consumerId) return;

    const fetchConsumerDetail = async () => {
      try {
        const response = await APIs.getConsumer({ id: consumerId });
        if (response?.code === 'SUCCESS' && response?.data) {
          setConsumer(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch consumer detail:', error);
        setError(t('detail.loadFailedDescription'));
      }
    };

    fetchConsumerDetail();
  }, [consumerId, t]);

  useEffect(() => {
    if (consumerId) {
      fetchSubscriptions(consumerId);
    }
  }, [consumerId, refreshIndex]);

  if (error) {
    return (
      <Layout backgroundVariant="market">
        <Alert
          className="mx-auto my-8 max-w-[1280px]"
          description={error}
          message={t('detail.loadFailed')}
          showIcon
          type="error"
        />
      </Layout>
    );
  }

  return (
    <Layout backgroundVariant="market">
      {consumer ? (
        <div className="consumer-detail-page mx-auto min-h-[calc(100dvh-96px)] w-full max-w-[1920px] py-5 sm:py-6">
          <nav
            aria-label={t('listTitle')}
            className="flex min-w-0 items-center gap-3 px-1 text-sm font-medium text-[#858B9A]"
          >
            <Link className="transition-colors hover:text-[#625DE2]" to="/consumers">
              {t('listTitle')}
            </Link>
            <span aria-hidden="true" className="text-[#B3B7C2]">
              /
            </span>
            <span className="truncate text-[#454D5D]">{consumer.name}</span>
          </nav>

          <header className="mt-5 flex items-center gap-4 border-b border-[#DEE1E9] px-1 pb-6">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[12px] border border-white/70 bg-white/60 text-xl text-[#666F80] backdrop-blur-sm">
              <span aria-hidden="true" className="font-semibold">
                {consumer.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-[26px] font-semibold leading-9 text-[#303747]">
                {consumer.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#737C8E]">
                {consumer.createAt && (
                  <span>
                    {t('detail.createdAt')} {formatDateTime(consumer.createAt)}
                  </span>
                )}
                {consumer.description && (
                  <>
                    {consumer.createAt && (
                      <span aria-hidden="true" className="h-3 w-px bg-[#CDD1DA]" />
                    )}
                    <span className="max-w-[80ch] truncate">{consumer.description}</span>
                  </>
                )}
              </div>
            </div>
          </header>

          <section className="mt-5 overflow-hidden rounded-[12px] border border-[#DEE1E9] bg-white/[0.58] backdrop-blur-[14px]">
            <Tabs
              activeKey={activeTab}
              className="consumer-detail-tabs"
              items={[
                {
                  children: (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                      <AuthConfig consumerId={consumerId ?? ''} />
                    </div>
                  ),
                  key: 'basic',
                  label: t('detail.basicInfo'),
                },
                {
                  children: (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                      <SubscriptionManager
                        consumerId={consumerId ?? ''}
                        loading={subscriptionsLoading}
                        onRefresh={() => setRefreshIndex((v) => v + 1)}
                        onSubscriptionsChange={async (searchParams) => {
                          if (consumerId) {
                            setSubscriptionsLoading(true);
                            try {
                              const params = new URLSearchParams();
                              if (searchParams?.productName) {
                                params.append('productName', searchParams.productName);
                              }
                              if (searchParams?.status) {
                                params.append('status', searchParams.status);
                              }

                              const queryString = params.toString();
                              const url = `/consumers/${consumerId}/subscriptions${queryString ? `?${queryString}` : ''}`;

                              const response: ApiResponse<{
                                content: ISubscription[];
                                totalElements: number;
                              }> = await request.get(url);
                              if (response?.code === 'SUCCESS' && response?.data) {
                                const subscriptionsData = response.data.content || [];
                                setSubscriptions(subscriptionsData);
                              }
                            } catch (error) {
                              console.error('Failed to fetch subscriptions:', error);
                            } finally {
                              setSubscriptionsLoading(false);
                            }
                          }
                        }}
                        subscriptions={subscriptions}
                      />
                    </div>
                  ),
                  key: 'authorization',
                  label: t('detail.subscriptions'),
                },
              ]}
              onChange={setActiveTab}
            />
          </section>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[1280px] py-8">
          <div className="rounded-[12px] border border-[#DEE1E9] bg-white/55 p-6 backdrop-blur-sm">
            <Skeleton active avatar paragraph={{ rows: 2 }} title={{ width: 220 }} />
          </div>
        </div>
      )}
    </Layout>
  );
}

export default ConsumerDetailPage;

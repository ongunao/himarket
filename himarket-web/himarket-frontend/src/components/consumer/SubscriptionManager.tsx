import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Button, Input, message, Modal, Popconfirm, Select, Table, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import request from '../../lib/request';
import { ProductTypeMap } from '../../lib/statusUtils';
import { portalModalStyles } from '../../lib/styles';
import { formatDateTime } from '../../lib/utils';

import type { ISubscription } from '../../lib/apis';
import type { ApiResponse, Product } from '../../types';
import type { Subscription } from '../../types/consumer';

interface SubscriptionManagerProps {
  consumerId: string;
  subscriptions: ISubscription[];
  onSubscriptionsChange: (searchParams?: { productName: string; status: string }) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function SubscriptionManager({
  consumerId,
  loading = false,
  onRefresh,
  onSubscriptionsChange,
  subscriptions,
}: SubscriptionManagerProps) {
  const { t } = useTranslation(['consumer', 'common']);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [subscriptionSearch, setSubscriptionSearch] = useState({ productName: '', status: '' });
  const [searchInput, setSearchInput] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleSearch = () => {
    const newSearch = { ...subscriptionSearch, productName: searchInput };
    setSubscriptionSearch(newSearch);
    onSubscriptionsChange({
      productName: searchInput,
      status: newSearch.status,
    });
  };

  const handleClearSearch = () => {
    const emptySearch = { productName: '', status: '' };
    setSubscriptionSearch(emptySearch);
    onSubscriptionsChange({ productName: '', status: '' });
  };

  const filterProducts = (allProducts: Product[]) => {
    const subscribedProductIds = subscriptions.map((sub) => sub.productId);

    return allProducts.filter((product) => !subscribedProductIds.includes(product.productId));
  };

  const openProductModal = async () => {
    setProductModalVisible(true);
    setProductLoading(true);
    try {
      const response: ApiResponse<{ content: Product[] }> = await request.get(
        '/products?page=0&size=100',
      );
      if (response?.code === 'SUCCESS' && response?.data) {
        const allProducts = response.data.content || [];
        const filtered = filterProducts(allProducts);
        setFilteredProducts(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      // message.error('Failed to fetch products');
    } finally {
      setProductLoading(false);
    }
  };

  const handleSubscribeProducts = async () => {
    if (!selectedProduct) {
      message.warning(t('subscription.selectProductWarning'));
      return;
    }

    setSubscribeLoading(true);
    try {
      await request.post(`/consumers/${consumerId}/subscriptions`, { productId: selectedProduct });
      message.success(t('subscription.subscribeSuccess'));
      setProductModalVisible(false);
      setSelectedProduct('');
      onSubscriptionsChange();
    } catch (error) {
      console.error('Subscribe failed:', error);
      // message.error('Subscribe failed');
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handleUnsubscribe = async (productId: string) => {
    try {
      await request.delete(`/consumers/${consumerId}/subscriptions/${productId}`);
      message.success(t('subscription.unsubscribeSuccess'));
      onSubscriptionsChange();
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      // message.error('Unsubscribe failed');
    }
  };

  const subscriptionColumns = [
    {
      dataIndex: 'productName',
      key: 'productName',
      render: (productName: Product['productName']) => productName || '-',
      title: t('subscription.productName'),
    },
    {
      dataIndex: 'productType',
      key: 'productType',
      render: (productType: Product['productType']) => {
        return ProductTypeMap[productType] || productType || '-';
      },
      title: t('subscription.productType'),
    },
    {
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const isApproved = status === 'APPROVED';
        return (
          <div className="flex items-center">
            {isApproved ? (
              <CheckCircleFilled className="mr-2 text-green-500" style={{ fontSize: '10px' }} />
            ) : (
              <ClockCircleOutlined className="mr-2 text-orange-500" style={{ fontSize: '10px' }} />
            )}
            <span className="text-[#505B6E]">
              {status === 'APPROVED'
                ? t('subscription.approved')
                : status === 'PENDING'
                  ? t('subscription.pending')
                  : status}
            </span>
          </div>
        );
      },
      title: t('subscription.status'),
    },
    {
      dataIndex: 'createAt',
      key: 'createAt',
      render: (date: string) => (date ? formatDateTime(date) : '-'),
      title: t('subscription.subscribedAt'),
    },
    {
      key: 'action',
      render: (record: Subscription) => (
        <Popconfirm
          onConfirm={() => handleUnsubscribe(record.productId)}
          title={t('subscription.unsubscribeConfirm')}
        >
          <Button
            aria-label={t('subscription.unsubscribeAction')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#E0525E] shadow-none hover:!bg-red-50 hover:!text-[#D94350]"
            danger
            icon={<DeleteOutlined />}
            type="text"
          />
        </Popconfirm>
      ),
      title: t('subscription.action'),
    },
  ];

  const safeSubscriptions = Array.isArray(subscriptions) ? subscriptions : [];

  return (
    <>
      <div className="consumer-subscription-manager">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              className="h-9 w-fit rounded-[8px] border-none px-3.5 text-sm font-medium shadow-none"
              icon={<PlusOutlined />}
              onClick={openProductModal}
              type="primary"
            >
              {t('subscription.subscribe')}
            </Button>
            <Input
              allowClear
              className="h-10 w-full max-w-[360px] rounded-[9px] border-[#E0E2EA] bg-white/[0.72] shadow-none hover:border-[#D4D7E1] focus-within:border-colorPrimary/25 focus-within:bg-white"
              onChange={handleSearchChange}
              onClear={handleClearSearch}
              onPressEnter={handleSearch}
              placeholder={t('subscription.searchPlaceholder')}
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchInput}
            />
          </div>
          <Tooltip title={t('refresh')}>
            <Button
              aria-label={t('refresh')}
              className="h-10 w-10 rounded-[9px] border-[#E1E3EB] bg-white/55 text-[#697386] shadow-none hover:!border-[#D4D7E1] hover:!bg-white/90 hover:!text-[#4F596B]"
              icon={<ReloadOutlined />}
              onClick={onRefresh}
            />
          </Tooltip>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-[#E1E3EB] bg-white/35">
          <Table
            className="consumer-detail-table"
            columns={subscriptionColumns}
            dataSource={safeSubscriptions}
            loading={loading}
            locale={{ emptyText: t('subscription.empty') }}
            pagination={false}
            rowKey={(record) => record.productId}
            size="small"
          />
        </div>
      </div>

      <Modal
        cancelButtonProps={{ disabled: subscribeLoading }}
        cancelText={t('common:cancel')}
        centered
        className="portal-modal"
        confirmLoading={subscribeLoading}
        okButtonProps={{ disabled: !selectedProduct }}
        okText={t('subscription.confirmSubscribe')}
        onCancel={() => {
          if (!subscribeLoading) {
            setProductModalVisible(false);
            setSelectedProduct('');
          }
        }}
        onOk={handleSubscribeProducts}
        open={productModalVisible}
        styles={portalModalStyles}
        title={t('subscription.selectTitle')}
        width={460}
      >
        <div className="pb-1">
          <div className="mb-2 text-xs font-medium text-[#697386]">
            {t('subscription.selectLabel')}
          </div>
          <Select
            className="w-full"
            filterOption={(input, option) => {
              const product = filteredProducts.find((p) => p.productId === option?.value);
              if (!product) return false;

              const searchText = input.toLowerCase();
              return (
                product.name?.toLowerCase().includes(searchText) ||
                product.description?.toLowerCase().includes(searchText)
              );
            }}
            loading={productLoading}
            notFoundContent={productLoading ? t('common:loading') : t('subscription.noProducts')}
            onChange={setSelectedProduct}
            placeholder={t('subscription.selectPlaceholder')}
            showSearch={true}
            value={selectedProduct}
          >
            {filteredProducts.map((product) => (
              <Select.Option key={product.productId} value={product.productId}>
                {product.name}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>
    </>
  );
}

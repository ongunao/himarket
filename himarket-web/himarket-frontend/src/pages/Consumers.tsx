import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Input, Pagination, Select, Table, Tooltip, type TableColumnType } from 'antd';
import { message, Modal } from 'antd';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Layout } from '../components/Layout';
import { getConsumers, deleteConsumer, createConsumer } from '../lib/apis';
import APIs, { type IConsumer, type IGetPrimaryConsumerResp } from '../lib/apis';
import { portalConfirmProps, portalModalStyles } from '../lib/styles';
import { formatDateTime } from '../lib/utils';

import './Consumers.css';

function ConsumersPage() {
  const { t } = useTranslation(['consumer', 'common']);
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId');

  const [consumers, setConsumers] = useState<IConsumer[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchName, setSearchName] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({ description: '', name: '' });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [primaryConsumer, setPrimaryConsumer] = useState<IGetPrimaryConsumerResp>();

  const [consumersForSelect, setConsumersForSelect] = useState<IConsumer[]>([]);
  const [showModifyPrimaryConsumerModal, setShowModifyPrimaryConsumerModal] = useState(false);
  const [selectedPrimaryConsumer, setSelectedPrimaryConsumer] = useState('');

  const fetchConsumers = useCallback(
    async (searchKeyword?: string, targetPage?: number) => {
      setLoading(true);
      try {
        const res = await getConsumers({
          name: searchKeyword || '',
          page: targetPage || page,
          size: pageSize,
        });
        setConsumers(res.data?.content || []);
        setTotal(res.data?.totalElements || 0);
      } catch {
        // message.error('Failed to fetch consumers');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  ); // refreshIndex is intentionally excluded to prevent unnecessary re-fetches

  const fetchConsumersForSelect = async (
    searchKeyword?: string,
    targetPage?: number,
    size = 100,
    isRefresh = false,
  ) => {
    try {
      const res = await APIs.getConsumers({
        name: searchKeyword || '',
        page: targetPage,
        size: size,
      });
      if (res?.data?.content) {
        if (searchKeyword || isRefresh) {
          setConsumersForSelect(res.data.content);
        } else {
          setConsumersForSelect((v) => [...v, ...res.data.content]);
        }
      }
    } catch {
      // message.error('Failed to fetch consumers');
    }
  };

  const getPrimaryConsumer = () => {
    APIs.getPrimaryConsumer().then(({ data }) => {
      if (data) {
        setPrimaryConsumer(data);
      }
    });
  };

  useEffect(() => {
    fetchConsumers(searchName);
  }, [page, pageSize, fetchConsumers, refreshIndex, searchName]);

  const handleSearch = useCallback(
    async (searchValue?: string) => {
      const actualSearchValue = searchValue !== undefined ? searchValue : searchInput;
      setSearchName(actualSearchValue);
      setPage(1);
      await fetchConsumers(actualSearchValue, 1);
    },
    [searchInput, fetchConsumers],
  );

  const handleDelete = (record: IConsumer) => {
    Modal.confirm({
      ...portalConfirmProps,
      cancelText: t('common:cancel'),
      content: t('deleteConfirm', { name: record.name }),
      icon: <DeleteOutlined className="portal-confirm-danger-icon" />,
      okText: t('deleteAction'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteConsumer(record.consumerId);
          message.success(t('deleteSuccess'));
          await fetchConsumers(searchName);
        } catch {
          // message.error('Delete failed');
        }
      },
      title: t('deleteAction'),
    });
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      message.warning(t('nameRequired'));
      return;
    }
    setAddLoading(true);
    try {
      await createConsumer({ description: addForm.description, name: addForm.name });
      message.success(t('addSuccess'));
      setAddModalOpen(false);
      setAddForm({ description: '', name: '' });
      await fetchConsumers(searchName);
    } catch {
      // message.error('Add failed');
    } finally {
      setAddLoading(false);
    }
  };

  const handleConfirmModifyPrimaryConsumer = () => {
    APIs.putPrimaryConsumer(selectedPrimaryConsumer)
      .then(({ code }) => {
        if (code === 'SUCCESS') {
          message.success(t('updateSuccess'));
          setShowModifyPrimaryConsumerModal(false);
          getPrimaryConsumer();
        }
      })
      .catch(() => {
        message.error(t('updateFailed'));
      });
  };

  const columns: TableColumnType<IConsumer>[] = [
    {
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            className="min-w-0 truncate text-sm font-semibold text-[#625DE2] no-underline transition-colors hover:text-[#514BCB] hover:no-underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25"
            title={name}
            to={`/consumers/${record.consumerId}`}
          >
            {name}
          </Link>
          {record.consumerId === primaryConsumer?.consumerId && (
            <button
              className="inline-flex h-7 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-[7px] bg-[#EFEDFB] px-2.5 text-xs font-medium text-[#655F83] transition-colors hover:bg-[#E8E5F8] hover:text-[#514A75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25"
              onClick={() => {
                setShowModifyPrimaryConsumerModal(true);
                setSelectedPrimaryConsumer(primaryConsumer?.consumerId || '');
                fetchConsumersForSelect(undefined, 1, 1000, true);
              }}
              type="button"
            >
              <span>{t('defaultConsumer')}</span>
              <EditOutlined />
            </button>
          )}
        </div>
      ),
      title: t('columns.consumer'),
      width: '24%',
    },
    {
      dataIndex: 'createAt',
      key: 'createAt',
      render: (date: string) => (
        <span className="text-sm tabular-nums text-[#566176]">
          {date ? formatDateTime(date) : '-'}
        </span>
      ),
      title: t('columns.createdAt'),
      width: '22%',
    },
    {
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <span className="block truncate text-sm text-[#505B6E]">{description || '-'}</span>
      ),
      title: t('columns.description'),
      width: '44%',
    },
    {
      align: 'center',
      key: 'action',
      render: (_: unknown, record: IConsumer) => (
        <Button
          aria-label={t('deleteAction')}
          className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#E0525E] shadow-none hover:!bg-red-50 hover:!text-[#D94350] disabled:!bg-transparent disabled:!text-gray-300"
          danger
          disabled={record.consumerId === primaryConsumer?.consumerId}
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
          type="text"
        />
      ),
      title: t('columns.action'),
      width: '10%',
    },
  ];

  useEffect(() => {
    getPrimaryConsumer();
  }, []);

  return (
    <Layout backgroundVariant="market">
      <div className="w-full py-4 sm:py-6">
        <section className="min-h-[calc(100dvh-128px)] rounded-[14px] border border-[#E1E3EB] bg-white/[0.62] p-4 backdrop-blur-[14px] sm:p-6">
          <header className="mb-5">
            <h1 className="m-0 text-[24px] font-semibold leading-8 text-[#303747]">
              {productId ? t('productSubscriptionsTitle') : t('listTitle')}
            </h1>
          </header>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              {!productId && (
                <Button
                  className="h-9 w-fit rounded-[8px] border-none px-3.5 text-sm font-medium shadow-none"
                  icon={<PlusOutlined />}
                  onClick={() => setAddModalOpen(true)}
                  type="primary"
                >
                  {t('addConsumer')}
                </Button>
              )}
              <Input
                allowClear
                className="h-10 w-full max-w-[360px] rounded-[9px] border-[#E0E2EA] bg-white/[0.72] shadow-none hover:border-[#D4D7E1] focus-within:border-colorPrimary/25 focus-within:bg-white"
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={() => handleSearch()}
                placeholder={t('searchPlaceholder')}
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchInput}
              />
            </div>
            <Tooltip title={t('refresh')}>
              <Button
                aria-label={t('refresh')}
                className="h-10 w-10 rounded-[9px] border-[#E1E3EB] bg-white/55 text-[#697386] shadow-none hover:!border-[#D4D7E1] hover:!bg-white/90 hover:!text-[#4F596B]"
                icon={<ReloadOutlined />}
                onClick={() => setRefreshIndex((v) => v + 1)}
              />
            </Tooltip>
          </div>

          <div className="overflow-hidden rounded-[10px] border border-[#E1E3EB] bg-white/45">
            <Table
              className="consumer-management-table"
              columns={columns}
              dataSource={consumers}
              loading={loading}
              pagination={false}
              rowKey="consumerId"
              scroll={{ x: 840 }}
            />
          </div>
          <div className="flex min-h-16 w-full items-center justify-end px-1 py-4">
            <Pagination
              {...{
                current: page,
                onChange: (p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                },
                pageSize,
                showQuickJumper: true,
                showSizeChanger: true,
                showTotal: (total) => t('total', { total }),
                total,
              }}
            />
          </div>
        </section>

        <Modal
          cancelText={t('common:cancel')}
          centered
          className="portal-modal"
          confirmLoading={addLoading}
          okText={t('modal.submit')}
          onCancel={() => {
            setAddModalOpen(false);
            setAddForm({ description: '', name: '' });
          }}
          onOk={handleAdd}
          open={addModalOpen}
          styles={portalModalStyles}
          title={t('modal.addTitle')}
          width={460}
        >
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-[#697386]">
              <span className="mr-1 text-red-500">*</span>
              {t('columns.consumer')}
            </div>
            <Input
              className="h-10"
              disabled={addLoading}
              maxLength={50}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('modal.namePlaceholder')}
              value={addForm.name}
            />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-[#697386]">
              {t('columns.description')}
            </div>
            <Input.TextArea
              className="resize-none"
              disabled={addLoading}
              maxLength={64}
              onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('modal.descriptionPlaceholder')}
              rows={3}
              value={addForm.description}
            />
          </div>
        </Modal>
      </div>
      <Modal
        cancelText={t('common:cancel')}
        centered
        className="portal-modal"
        okButtonProps={{ disabled: !selectedPrimaryConsumer }}
        okText={t('common:confirm')}
        onCancel={() => setShowModifyPrimaryConsumerModal(false)}
        onOk={handleConfirmModifyPrimaryConsumer}
        open={showModifyPrimaryConsumerModal}
        styles={portalModalStyles}
        title={t('primaryConsumer.title')}
        width={460}
      >
        <div className="pb-1">
          <div className="mb-2 text-xs font-medium text-[#697386]">{t('columns.consumer')}</div>
          <Select
            className="w-full"
            filterOption={(input, option) => {
              return (option?.label ?? '').toLowerCase().includes(input.toLowerCase());
            }}
            onChange={setSelectedPrimaryConsumer}
            options={consumersForSelect.map((v) => ({ label: v.name, value: v.consumerId }))}
            showSearch
            value={selectedPrimaryConsumer || undefined}
          />
        </div>
      </Modal>
    </Layout>
  );
}

export default ConsumersPage;

import { EditOutlined, PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Form, Input, message, Modal, Popconfirm, Segmented, Select, Table } from 'antd';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import request from '../../lib/request';
import { portalModalStyles } from '../../lib/styles';

import type { ApiResponse } from '../../types';
import type {
  ConsumerCredentialResult,
  CreateCredentialParam,
  ConsumerCredential,
  HMACCredential,
  APIKeyCredential,
} from '../../types/consumer';

interface AuthConfigProps {
  consumerId: string;
}

export function AuthConfig({ consumerId }: AuthConfigProps) {
  const { t } = useTranslation(['consumer', 'common']);
  const [currentSource, setCurrentSource] = useState<string>('Default');
  const [currentKey, setCurrentKey] = useState<string>('Authorization');
  const [currentConfig, setCurrentConfig] = useState<ConsumerCredentialResult | null>(null);

  const [credentialType, setCredentialType] = useState<'API_KEY' | 'HMAC'>('API_KEY');
  const [credentialModalVisible, setCredentialModalVisible] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(false);

  const [sourceModalVisible, setSourceModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<string>('Default');
  const [editingKey, setEditingKey] = useState<string>('Authorization');

  const [sourceForm] = Form.useForm();
  const [credentialForm] = Form.useForm();

  const [activeTab, setActiveTab] = useState<string>('API_KEY');

  const fetchCurrentConfig = React.useCallback(async () => {
    try {
      const response: ApiResponse<ConsumerCredentialResult> = await request.get(
        `/consumers/${consumerId}/credentials`,
      );
      if (response.code === 'SUCCESS' && response.data) {
        const config = response.data;
        setCurrentConfig(config);
        if (config.apiKeyConfig) {
          setCurrentSource(config.apiKeyConfig.source || 'Default');
          setCurrentKey(config.apiKeyConfig.key || 'Authorization');
        }
      }
    } catch (error) {
      console.error('Failed to fetch credential config:', error);
    }
  }, [consumerId]);

  useEffect(() => {
    fetchCurrentConfig();
  }, [consumerId, fetchCurrentConfig]);

  const handleCreateCredential = async () => {
    try {
      const values = await credentialForm.validateFields();
      setCredentialLoading(true);

      const currentResponse: ApiResponse<ConsumerCredentialResult> = await request.get(
        `/consumers/${consumerId}/credentials`,
      );
      let currentConfig: ConsumerCredentialResult = {};

      if (currentResponse.code === 'SUCCESS' && currentResponse.data) {
        currentConfig = currentResponse.data;
      }

      const param: CreateCredentialParam = {
        ...currentConfig,
      };

      if (credentialType === 'API_KEY') {
        const newCredential: ConsumerCredential = {
          apiKey:
            values.generationMethod === 'CUSTOM'
              ? values.customApiKey
              : generateRandomCredential('apiKey'),
          mode: values.generationMethod,
        };
        param.apiKeyConfig = {
          ...currentConfig.apiKeyConfig,
          credentials: [...(currentConfig.apiKeyConfig?.credentials || []), newCredential],
        };
      } else if (credentialType === 'HMAC') {
        const newCredential: ConsumerCredential = {
          ak:
            values.generationMethod === 'CUSTOM'
              ? values.customAccessKey
              : generateRandomCredential('accessKey'),
          mode: values.generationMethod,
          sk:
            values.generationMethod === 'CUSTOM'
              ? values.customSecretKey
              : generateRandomCredential('secretKey'),
        };
        param.hmacConfig = {
          ...currentConfig.hmacConfig,
          credentials: [...(currentConfig.hmacConfig?.credentials || []), newCredential],
        };
      }

      const response: ApiResponse<ConsumerCredentialResult> = await request.put(
        `/consumers/${consumerId}/credentials`,
        param,
      );
      if (response?.code === 'SUCCESS') {
        message.success(t('auth.credentialAdded'));
        setCredentialModalVisible(false);
        resetCredentialForm();
        await fetchCurrentConfig();
      }
    } catch (error) {
      console.error('Failed to create credential:', error);
    } finally {
      setCredentialLoading(false);
    }
  };

  const handleDeleteCredential = async (credentialType: string, credential: ConsumerCredential) => {
    try {
      const currentResponse: ApiResponse<ConsumerCredentialResult> = await request.get(
        `/consumers/${consumerId}/credentials`,
      );
      let currentConfig: ConsumerCredentialResult = {};

      if (currentResponse.code === 'SUCCESS' && currentResponse.data) {
        currentConfig = currentResponse.data;
      }

      const param: CreateCredentialParam = {
        ...currentConfig,
      };

      if (credentialType === 'API_KEY') {
        param.apiKeyConfig = {
          credentials: currentConfig.apiKeyConfig?.credentials?.filter(
            (cred) => cred.apiKey !== (credential as APIKeyCredential).apiKey,
          ),
          key: currentConfig.apiKeyConfig?.key || 'Authorization',
          source: currentConfig.apiKeyConfig?.source || 'Default',
        };
      } else if (credentialType === 'HMAC') {
        param.hmacConfig = {
          credentials: currentConfig.hmacConfig?.credentials?.filter(
            (cred) => cred.ak !== (credential as HMACCredential).ak,
          ),
        };
      }

      const response: ApiResponse<ConsumerCredentialResult> = await request.put(
        `/consumers/${consumerId}/credentials`,
        param,
      );
      if (response?.code === 'SUCCESS') {
        message.success(t('auth.credentialDeleted'));
        await fetchCurrentConfig();
      }
    } catch (error) {
      console.error('Failed to delete credential:', error);
    }
  };

  const handleCopyCredential = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const success = document.execCommand('copy');
      if (success) {
        message.success(t('auth.copied'));
      }
    } catch (err) {
      console.warn(err);
      // Ignore
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const resetCredentialForm = () => {
    credentialForm.resetFields();
  };

  const handleEditSource = async (source: string, key: string) => {
    try {
      const currentResponse: ApiResponse<ConsumerCredentialResult> = await request.get(
        `/consumers/${consumerId}/credentials`,
      );
      let currentConfig: ConsumerCredentialResult = {};

      if (currentResponse.code === 'SUCCESS' && currentResponse.data) {
        currentConfig = currentResponse.data as ConsumerCredentialResult;
      }

      const param: CreateCredentialParam = {};

      if (currentConfig.apiKeyConfig) {
        param.apiKeyConfig = {
          credentials: currentConfig.apiKeyConfig.credentials,
          key: source === 'Default' ? 'Authorization' : key,
          source: source,
        };
      } else {
        param.apiKeyConfig = {
          credentials: [],
          key: source === 'Default' ? 'Authorization' : key,
          source: source,
        };
      }

      const response: ApiResponse<ConsumerCredentialResult> = await request.put(
        `/consumers/${consumerId}/credentials`,
        param,
      );
      if (response?.code === 'SUCCESS') {
        message.success(t('auth.sourceUpdated'));
        const updatedResponse: ApiResponse<ConsumerCredentialResult> = await request.get(
          `/consumers/${consumerId}/credentials`,
        );
        if (updatedResponse.code === 'SUCCESS' && updatedResponse.data) {
          const updatedConfig = updatedResponse.data;
          if (updatedConfig.apiKeyConfig) {
            setCurrentSource(updatedConfig.apiKeyConfig.source || 'Default');
            setCurrentKey(updatedConfig.apiKeyConfig.key || 'Authorization');
          }
        }
        setSourceModalVisible(false);
        await fetchCurrentConfig();
      }
    } catch (error) {
      console.error('Failed to update credential source:', error);
    }
  };

  const openSourceModal = () => {
    const initSource = currentSource;
    const initKey = initSource === 'Default' ? 'Authorization' : currentKey;
    setEditingSource(initSource);
    setEditingKey(initKey);
    sourceForm.setFieldsValue({ key: initKey, source: initSource });
    setSourceModalVisible(true);
  };

  const openCredentialModal = () => {
    credentialForm.resetFields();
    credentialForm.setFieldsValue({
      customAccessKey: '',
      customApiKey: '',
      customSecretKey: '',
      generationMethod: 'SYSTEM',
    });
    setCredentialModalVisible(true);
  };

  const generateRandomCredential = (type: 'apiKey' | 'accessKey' | 'secretKey'): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

    if (type === 'apiKey') {
      const apiKey = Array.from({ length: 32 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join('');
      const setValue = () => {
        try {
          credentialForm.setFieldsValue({ customApiKey: apiKey });
        } catch (error) {
          console.error('Failed to set API Key:', error);
        }
      };
      if (credentialForm.getFieldValue('customApiKey') !== undefined) {
        setValue();
      } else {
        setTimeout(setValue, 100);
      }
      return apiKey;
    } else {
      const ak = Array.from({ length: 32 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join('');
      const sk = Array.from({ length: 64 }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length)),
      ).join('');
      const setValue = () => {
        try {
          credentialForm.setFieldsValue({
            customAccessKey: ak,
            customSecretKey: sk,
          });
        } catch (error) {
          console.error('Failed to set AK/SK:', error);
        }
      };
      if (credentialForm.getFieldValue('customAccessKey') !== undefined) {
        setValue();
      } else {
        setTimeout(setValue, 100);
      }
      return type === 'accessKey' ? ak : sk;
    }
  };

  const maskSecretKey = (secretKey: string): string => {
    if (!secretKey || secretKey.length < 8) return secretKey;
    return (
      secretKey.substring(0, 4) +
      '*'.repeat(secretKey.length - 8) +
      secretKey.substring(secretKey.length - 4)
    );
  };

  const apiKeyColumns = [
    {
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (apiKey: string) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <code
            className="block max-w-[720px] truncate rounded-[6px] bg-[#F3F3F7] px-2.5 py-1.5 text-xs font-medium text-[#4F596B]"
            title={apiKey}
          >
            {apiKey}
          </code>
          <Button
            aria-label={t('auth.copyCredential')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#625DE2] shadow-none hover:!bg-[#EFEDFB] hover:!text-[#514BCB]"
            icon={<CopyOutlined className="text-colorPrimary" />}
            onClick={() => handleCopyCredential(apiKey)}
            size="small"
            type="text"
          />
        </div>
      ),
      title: <span className="text-[#737373]">API Key</span>,
    },
    {
      key: 'action',
      render: (record: ConsumerCredential) => (
        <Popconfirm
          onConfirm={() => handleDeleteCredential('API_KEY', record)}
          title={t('auth.deleteApiKeyConfirm')}
        >
          <Button
            aria-label={t('auth.deleteCredential')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#E0525E] shadow-none hover:!bg-red-50 hover:!text-[#D94350]"
            danger
            icon={<DeleteOutlined />}
            type="text"
          />
        </Popconfirm>
      ),
      title: <span className="text-[#737373]">{t('auth.action')}</span>,
      width: 72,
    },
  ];

  const hmacColumns = [
    {
      dataIndex: 'ak',
      key: 'ak',
      render: (ak: string) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <code
            className="block max-w-[420px] truncate rounded-[6px] bg-[#F3F3F7] px-2.5 py-1.5 text-xs font-medium text-[#4F596B]"
            title={ak}
          >
            {ak}
          </code>
          <Button
            aria-label={t('auth.copyCredential')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#625DE2] shadow-none hover:!bg-[#EFEDFB] hover:!text-[#514BCB]"
            icon={<CopyOutlined className="text-colorPrimary" />}
            onClick={() => handleCopyCredential(ak)}
            size="small"
            type="text"
          />
        </div>
      ),
      title: 'Access Key',
    },
    {
      dataIndex: 'sk',
      key: 'sk',
      render: (sk: string) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <code
            className="block max-w-[520px] truncate rounded-[6px] bg-[#F3F3F7] px-2.5 py-1.5 text-xs font-medium text-[#4F596B]"
            title={maskSecretKey(sk)}
          >
            {maskSecretKey(sk)}
          </code>
          <Button
            aria-label={t('auth.copyCredential')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#625DE2] shadow-none hover:!bg-[#EFEDFB] hover:!text-[#514BCB]"
            icon={<CopyOutlined className="text-colorPrimary" />}
            onClick={() => handleCopyCredential(sk)}
            size="small"
            type="text"
          />
        </div>
      ),
      title: 'Secret Key',
    },
    {
      key: 'action',
      render: (record: ConsumerCredential) => (
        <Popconfirm
          onConfirm={() => handleDeleteCredential('HMAC', record)}
          title={t('auth.deleteHmacConfirm')}
        >
          <Button
            aria-label={t('auth.deleteCredential')}
            className="h-8 w-8 rounded-[7px] border-0 p-0 text-[#E0525E] shadow-none hover:!bg-red-50 hover:!text-[#D94350]"
            danger
            icon={<DeleteOutlined />}
            size="small"
            type="text"
          />
        </Popconfirm>
      ),
      title: t('auth.action'),
      width: 72,
    },
  ];

  const switchBtnOptions = useMemo(() => {
    return [
      { label: 'API Key', value: 'API_KEY' },
      { label: 'HMAC', value: 'HMAC' },
      { label: 'JWT', value: 'JWT' },
    ];
  }, []);

  return (
    <div className="consumer-auth-config">
      <div className="flex items-center">
        <Segmented
          className="consumer-auth-methods"
          onChange={(value) => setActiveTab(String(value))}
          options={switchBtnOptions}
          value={activeTab}
        />
      </div>
      <div className="mt-5">
        {activeTab === 'API_KEY' && (
          <div>
            <div className="mb-4">
              <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[#E3E4EB] bg-[#F8F8FB]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-sm font-medium text-[#596275]">
                    {t('auth.credentialSource')}
                  </span>
                  <code className="truncate rounded-[6px] bg-white/70 px-2.5 py-1 text-xs text-[#697386]">
                    {currentSource === 'Default'
                      ? 'Authorization: Bearer <token>'
                      : `${currentSource}: ${currentKey}`}
                  </code>
                </div>
                <Button
                  className="h-8 w-fit rounded-[7px] border-0 px-2.5 text-[#625DE2] shadow-none hover:!bg-[#EFEDFB] hover:!text-[#514BCB]"
                  icon={<EditOutlined />}
                  onClick={openSourceModal}
                  size="small"
                  type="text"
                >
                  {t('auth.edit')}
                </Button>
              </div>

              <Button
                className="h-9 rounded-[8px] border-none px-3.5 text-sm font-medium shadow-none"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCredentialType('API_KEY');
                  openCredentialModal();
                }}
                type="primary"
              >
                {t('auth.addCredential')}
              </Button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#E1E3EB] bg-white/35">
              <Table
                className="consumer-detail-table"
                columns={apiKeyColumns}
                dataSource={currentConfig?.apiKeyConfig?.credentials || []}
                locale={{ emptyText: t('auth.apiKeyEmpty') }}
                pagination={false}
                rowKey={(record) => record.apiKey || Math.random().toString()}
              />
            </div>
          </div>
        )}
        {activeTab === 'HMAC' && (
          <div>
            <div className="mb-4">
              <Button
                className="h-9 rounded-[8px] border-none px-3.5 text-sm font-medium shadow-none"
                icon={<PlusOutlined />}
                onClick={() => {
                  setCredentialType('HMAC');
                  openCredentialModal();
                }}
                type="primary"
              >
                {t('auth.addAkSk')}
              </Button>
            </div>
            <div className="overflow-hidden rounded-[10px] border border-[#E1E3EB] bg-white/35">
              <Table
                className="consumer-detail-table"
                columns={hmacColumns}
                dataSource={currentConfig?.hmacConfig?.credentials || []}
                locale={{ emptyText: t('auth.hmacEmpty') }}
                pagination={false}
                rowKey={(record) => record.ak || record.sk || Math.random().toString()}
                size="small"
              />
            </div>
          </div>
        )}
        {activeTab === 'JWT' && (
          <div className="rounded-[10px] border border-dashed border-[#DDE0E8] bg-white/25 py-12 text-center text-sm text-[#858B9A]">
            {t('auth.jwtComingSoon')}
          </div>
        )}
      </div>

      <Modal
        cancelText={t('common:cancel')}
        centered
        className="portal-modal"
        confirmLoading={credentialLoading}
        okText={t('auth.add')}
        onCancel={() => {
          setCredentialModalVisible(false);
          resetCredentialForm();
        }}
        onOk={handleCreateCredential}
        open={credentialModalVisible}
        styles={portalModalStyles}
        title={t('auth.createCredentialTitle', {
          type: credentialType === 'API_KEY' ? 'API Key' : 'AK/SK',
        })}
        width={460}
      >
        <Form
          form={credentialForm}
          initialValues={{
            customAccessKey: '',
            customApiKey: '',
            customSecretKey: '',
            generationMethod: 'SYSTEM',
          }}
        >
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-[#697386]">
              <span className="text-red-500 mr-1">*</span>
              <span>{t('auth.generationMethod')}</span>
            </div>
            <Form.Item
              className="mb-0"
              name="generationMethod"
              rules={[{ message: t('auth.generationMethodRequired'), required: true }]}
            >
              <Segmented
                block
                options={[
                  { label: t('auth.systemGenerated'), value: 'SYSTEM' },
                  { label: t('auth.custom'), value: 'CUSTOM' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.generationMethod !== curr.generationMethod}
          >
            {({ getFieldValue }) => {
              const method = getFieldValue('generationMethod');
              if (method === 'CUSTOM') {
                return (
                  <>
                    {credentialType === 'API_KEY' && (
                      <div className="mb-4">
                        <div className="mb-2 text-xs font-medium text-[#697386]">
                          <span className="text-red-500 mr-1">*</span>
                          <span>{t('auth.credential')}</span>
                        </div>
                        <Form.Item
                          className="mb-2"
                          name="customApiKey"
                          rules={[
                            { message: t('auth.customApiKeyRequired'), required: true },
                            {
                              message: t('auth.allowedCredentialChars'),
                              pattern: /^[A-Za-z0-9_-]+$/,
                            },
                            { message: t('auth.apiKeyMin'), min: 8 },
                            { max: 128, message: t('auth.apiKeyMax') },
                          ]}
                        >
                          <Input
                            className="h-10"
                            maxLength={128}
                            placeholder={t('auth.credentialPlaceholder')}
                          />
                        </Form.Item>
                        <div className="text-xs text-gray-500">{t('auth.credentialHelp')}</div>
                      </div>
                    )}
                    {credentialType === 'HMAC' && (
                      <>
                        <div className="mb-4">
                          <div className="mb-2 text-xs font-medium text-[#697386]">
                            <span className="text-red-500 mr-1">*</span>
                            <span>Access Key</span>
                          </div>
                          <Form.Item
                            className="mb-2"
                            name="customAccessKey"
                            rules={[
                              { message: t('auth.customAccessKeyRequired'), required: true },
                              {
                                message: t('auth.allowedCredentialChars'),
                                pattern: /^[A-Za-z0-9_-]+$/,
                              },
                              { message: t('auth.accessKeyMin'), min: 8 },
                              { max: 128, message: t('auth.accessKeyMax') },
                            ]}
                          >
                            <Input
                              className="h-10"
                              maxLength={128}
                              placeholder={t('auth.accessKeyPlaceholder')}
                            />
                          </Form.Item>
                          <div className="text-xs text-gray-500">{t('auth.credentialHelp')}</div>
                        </div>
                        <div className="mb-4">
                          <div className="mb-2 text-xs font-medium text-[#697386]">
                            <span className="text-red-500 mr-1">*</span>
                            <span>Secret Key</span>
                          </div>
                          <Form.Item
                            className="mb-2"
                            name="customSecretKey"
                            rules={[
                              { message: t('auth.customSecretKeyRequired'), required: true },
                              {
                                message: t('auth.allowedCredentialChars'),
                                pattern: /^[A-Za-z0-9_-]+$/,
                              },
                              { message: t('auth.secretKeyMin'), min: 8 },
                              { max: 128, message: t('auth.secretKeyMax') },
                            ]}
                          >
                            <Input
                              className="h-10"
                              maxLength={128}
                              placeholder={t('auth.secretKeyPlaceholder')}
                            />
                          </Form.Item>
                          <div className="text-xs text-gray-500">{t('auth.credentialHelp')}</div>
                        </div>
                      </>
                    )}
                  </>
                );
              } else if (method === 'SYSTEM') {
                return (
                  <div className="rounded-[8px] bg-[#F5F6F9] px-3 py-2.5 text-sm text-[#737C8C]">
                    <span>{t('auth.systemGenerationHint')}</span>
                  </div>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        cancelText={t('common:cancel')}
        centered
        className="portal-modal"
        okText={t('auth.save')}
        onCancel={() => {
          const initSource = currentSource;
          const initKey = initSource === 'Default' ? 'Authorization' : currentKey;
          setEditingSource(initSource);
          setEditingKey(initKey);
          sourceForm.resetFields();
          setSourceModalVisible(false);
        }}
        onOk={async () => {
          try {
            const values = await sourceForm.validateFields();
            setEditingSource(values.source);
            setEditingKey(values.key);
            await handleEditSource(values.source, values.key);
          } catch {
            // Ignore validation errors.
          }
        }}
        open={sourceModalVisible}
        styles={portalModalStyles}
        title={t('auth.editSourceTitle')}
        width={460}
      >
        <Form
          form={sourceForm}
          initialValues={{ key: editingKey, source: editingSource }}
          layout="vertical"
        >
          <Form.Item
            label={t('auth.source')}
            name="source"
            rules={[{ message: t('auth.sourceRequired'), required: true }]}
          >
            <Select
              className="w-full rounded-lg"
              onChange={(value) => {
                const nextKey = value === 'Default' ? 'Authorization' : '';
                sourceForm.setFieldsValue({ key: nextKey });
              }}
            >
              <Select.Option value="Header">Header</Select.Option>
              <Select.Option value="QueryString">QueryString</Select.Option>
              <Select.Option value="Default">{t('auth.defaultSource')}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.source !== curr.source}>
            {({ getFieldValue }) =>
              getFieldValue('source') !== 'Default' ? (
                <Form.Item
                  label={t('auth.keyName')}
                  name="key"
                  rules={[
                    {
                      message: t('auth.keyRequired'),
                      required: true,
                    },
                    {
                      message: t('auth.keyPattern'),
                      pattern: /^[A-Za-z0-9-_]+$/,
                    },
                  ]}
                >
                  <Input className="h-10" placeholder={t('auth.keyPlaceholder')} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

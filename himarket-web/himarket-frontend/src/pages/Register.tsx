import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Form, Input, Button, message } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { Layout } from '../components/Layout';
import request from '../lib/request';

const Register: React.FC = () => {
  const { t } = useTranslation('register');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // const location = useLocation()
  // const searchParams = new URLSearchParams(location.search)
  // const portalId = searchParams.get('portalId') || ''

  const handleRegister = async (values: {
    username: string;
    password: string;
    confirmPassword: string;
  }) => {
    setLoading(true);
    try {
      // 这里需要根据实际API调整
      await request.post('/developers', {
        password: values.password,
        username: values.username,
      });
      message.success(t('registerSuccess'));
      // 注册成功后跳转到登录页
      navigate('/login');
    } catch {
      message.error(t('registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout backgroundVariant="market">
      <div className="flex min-h-[calc(100dvh-96px)] w-full items-center justify-center py-8 sm:py-12">
        <div className="mx-4 w-full max-w-[440px]">
          <div className="rounded-[14px] border border-[#E1E3EB] bg-white/[0.66] p-6 shadow-[0_12px_40px_rgba(67,72,104,0.06)] backdrop-blur-[18px] sm:p-8">
            <div className="mb-7">
              <h1 className="m-0 flex items-baseline text-[28px] font-semibold leading-9 text-[#303747] antialiased">
                <span className="text-colorPrimary">{t('greeting')}</span>
                <span>{t('hello')}</span>
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-[#737C8E]">{t('welcomeMessage')}</p>
            </div>

            <Form
              autoComplete="off"
              className="[&_.ant-form-item-explain-error]:text-xs"
              layout="vertical"
              name="register"
              onFinish={handleRegister}
              size="large"
            >
              <Form.Item
                className="!mb-4"
                name="username"
                rules={[
                  { message: t('usernameRequired'), required: true },
                  { message: t('usernameMinLength'), min: 3 },
                ]}
              >
                <Input
                  autoComplete="username"
                  className="h-11 rounded-[8px] border-[#DDE0E8] bg-white/65 px-3 shadow-none hover:border-[#CBC8EA] focus-within:border-[#8A84EE] focus-within:shadow-[0_0_0_3px_rgba(104,99,235,0.10)]"
                  placeholder={t('usernamePlaceholder')}
                  prefix={<UserOutlined className="mr-1 text-[#969DAB]" />}
                />
              </Form.Item>

              <Form.Item
                className="!mb-4"
                name="password"
                rules={[
                  { message: t('passwordRequired'), required: true },
                  { message: t('passwordMinLength'), min: 6 },
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  className="h-11 rounded-[8px] border-[#DDE0E8] bg-white/65 px-3 shadow-none hover:border-[#CBC8EA] focus-within:border-[#8A84EE] focus-within:shadow-[0_0_0_3px_rgba(104,99,235,0.10)]"
                  placeholder={t('passwordPlaceholder')}
                  prefix={<LockOutlined className="mr-1 text-[#969DAB]" />}
                />
              </Form.Item>

              <Form.Item
                className="!mb-5"
                dependencies={['password']}
                name="confirmPassword"
                rules={[
                  { message: t('confirmPasswordRequired'), required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('passwordMismatch')));
                    },
                  }),
                ]}
              >
                <Input.Password
                  autoComplete="new-password"
                  className="h-11 rounded-[8px] border-[#DDE0E8] bg-white/65 px-3 shadow-none hover:border-[#CBC8EA] focus-within:border-[#8A84EE] focus-within:shadow-[0_0_0_3px_rgba(104,99,235,0.10)]"
                  placeholder={t('confirmPasswordPlaceholder')}
                  prefix={<LockOutlined className="mr-1 text-[#969DAB]" />}
                />
              </Form.Item>

              <Form.Item className="!mb-0">
                <Button
                  className="h-11 w-full rounded-[8px] border-0 bg-[#6863EB] text-sm font-medium shadow-none hover:!bg-[#5D58DE]"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  type="primary"
                >
                  {loading ? t('registering') : t('register')}
                </Button>
              </Form.Item>
            </Form>

            <div className="mt-5 text-center text-sm text-[#737C8E]">
              {t('hasAccount')}
              <Link
                className="ml-1 font-medium text-[#6863E3] transition-colors hover:text-[#514BCB]"
                to="/login"
              >
                {t('loginLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Register;

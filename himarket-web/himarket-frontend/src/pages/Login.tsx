import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, message } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import aliyunIcon from '../assets/aliyun.png';
import githubIcon from '../assets/github.png';
import googleIcon from '../assets/google.png';
import { Layout } from '../components/Layout';
import APIs from '../lib/apis';
import request from '../lib/request';

import type { IIdpProvider } from '../lib/apis';

const oidcIcons: Record<string, React.ReactNode> = {
  aliyun: <img alt="Aliyun" className="h-5 w-5 object-contain" src={aliyunIcon} />,
  github: <img alt="GitHub" className="h-5 w-5 object-contain" src={githubIcon} />,
  google: <img alt="Google" className="h-5 w-5 object-contain" src={googleIcon} />,
};

const Login: React.FC = () => {
  const { t } = useTranslation('login');
  const [providers, setProviders] = useState<IIdpProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 使用OidcController的接口获取OIDC提供商
    APIs.getOidcProviders()
      .then(({ data }) => {
        console.warn('OIDC providers response:', data);
        setProviders(data);
      })
      .catch((error) => {
        console.error('Failed to fetch OIDC providers:', error);
        setProviders([]);
      });
  }, []);

  // 账号密码登录
  const handlePasswordLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await request.post('/developers/login', {
        password: values.password,
        username: values.username,
      });
      // 登录成功后跳转到首页并携带access_token
      if (res && res.data && res.data.access_token) {
        message.success(t('loginSuccess'), 1);
        localStorage.setItem('access_token', res.data.access_token);

        // 检查URL中是否有returnUrl参数
        const returnUrl = searchParams.get('returnUrl');
        if (returnUrl) {
          navigate(decodeURIComponent(returnUrl));
        } else {
          navigate('/');
        }
      } else {
        message.error(t('loginFailedNoToken'));
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        message.error(error.response?.data.message || t('loginFailedCheckCredentials'));
      } else {
        message.error(t('loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 跳转到 OIDC 授权 - 对接OidcController
  const handleOidcLogin = (provider: string) => {
    // 获取API前缀配置
    const apiPrefix = request.defaults.baseURL || '/api/v1';

    // 构建授权URL - 对接 /developers/oidc/authorize
    const authUrl = new URL(`${window.location.origin}${apiPrefix}/developers/oidc/authorize`);
    authUrl.searchParams.set('provider', provider);

    console.warn('Redirecting to OIDC authorization:', authUrl.toString());

    // 跳转到OIDC授权服务器
    window.location.href = authUrl.toString();
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
              name="login"
              onFinish={handlePasswordLogin}
              size="large"
            >
              <Form.Item
                className="!mb-4"
                name="username"
                rules={[{ message: t('usernameRequired'), required: true }]}
              >
                <Input
                  autoComplete="username"
                  className="h-11 rounded-[8px] border-[#DDE0E8] bg-white/65 px-3 shadow-none hover:border-[#CBC8EA] focus-within:border-[#8A84EE] focus-within:shadow-[0_0_0_3px_rgba(104,99,235,0.10)]"
                  placeholder={t('usernamePlaceholder')}
                  prefix={<UserOutlined className="mr-1 text-[#969DAB]" />}
                />
              </Form.Item>

              <Form.Item
                className="!mb-5"
                name="password"
                rules={[{ message: t('passwordRequired'), required: true }]}
              >
                <Input.Password
                  autoComplete="current-password"
                  className="h-11 rounded-[8px] border-[#DDE0E8] bg-white/65 px-3 shadow-none hover:border-[#CBC8EA] focus-within:border-[#8A84EE] focus-within:shadow-[0_0_0_3px_rgba(104,99,235,0.10)]"
                  placeholder={t('passwordPlaceholder')}
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
                  {loading ? t('loggingIn') : t('login')}
                </Button>
              </Form.Item>
            </Form>

            {providers.length > 0 && (
              <div className="my-5 flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-[#E4E5EB]" />
                <span className="text-xs text-[#8A91A0]">{t('or')}</span>
                <span className="h-px flex-1 bg-[#E4E5EB]" />
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {providers.length === 0
                ? null
                : providers.map((provider) => (
                    <Button
                      className="flex h-10 w-full items-center justify-center rounded-[8px] border-[#E0E2EA] bg-white/40 text-sm font-medium text-[#424A5A] shadow-none hover:!border-[#D0CEE8] hover:!bg-white/65 hover:!text-[#424A5A]"
                      icon={oidcIcons[provider.provider.toLowerCase()]}
                      key={provider.provider}
                      onClick={() => handleOidcLogin(provider.provider)}
                    >
                      {t('loginWithProvider', { provider: provider.name || provider.provider })}
                    </Button>
                  ))}
            </div>

            <div className="mt-5 text-center text-sm text-[#737C8E]">
              {t('noAccount')}
              <Link
                className="ml-1 font-medium text-[#6863E3] transition-colors hover:text-[#514BCB]"
                to="/register"
              >
                {t('registerLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Login;

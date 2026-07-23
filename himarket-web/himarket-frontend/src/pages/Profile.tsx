import {
  CalendarOutlined,
  IdcardOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, message, Skeleton } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { Layout } from '../components/Layout';
import { notifyAuthInvalidated } from '../hooks/useAuth';
import APIs, { type IDeveloperInfo } from '../lib/apis';
import { clearCachedUserInfo } from '../lib/userInfoCache';
import { formatDateTime } from '../lib/utils';

type ProfileSection = 'identity' | 'profile' | 'security';

const getInitials = (name: string) => {
  if (!name) return 'U';
  if (/[\u4e00-\u9fa5]/.test(name)) {
    return name.charAt(0);
  }
  return name.charAt(0).toUpperCase();
};

const Profile: React.FC = () => {
  const { t } = useTranslation('profile');
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const [developerInfo, setDeveloperInfo] = useState<IDeveloperInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  useEffect(() => {
    APIs.getDeveloperInfo()
      .then((response) => {
        setDeveloperInfo(response.data || null);
      })
      .catch(() => {
        setDeveloperInfo(null);
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, []);

  const handleChangePassword = async (values: { newPassword: string; oldPassword: string }) => {
    setChangePasswordLoading(true);
    try {
      await APIs.changeDeveloperPassword(values);
      message.success(t('changePasswordSuccess'), 1);
      localStorage.removeItem('access_token');
      clearCachedUserInfo();
      notifyAuthInvalidated();
      navigate('/login');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const displayName = developerInfo?.username || developerInfo?.email || t('unknownDeveloper');
  const displayEmail = developerInfo?.email;
  const avatar = developerInfo?.avatarUrl;
  const loadingProfile = profileLoading;

  const navItems = [
    { icon: <UserOutlined />, key: 'profile' as const, label: t('profileInfo') },
    { icon: <SafetyCertificateOutlined />, key: 'security' as const, label: t('accountSecurity') },
    {
      comingSoon: true,
      icon: <IdcardOutlined />,
      key: 'identity' as const,
      label: t('thirdPartyAccounts'),
    },
  ];

  const profileFacts = [
    {
      icon: <UserOutlined />,
      label: t('username'),
      value: developerInfo?.username || t('notSet'),
    },
    {
      icon: <MailOutlined />,
      label: t('email'),
      value: displayEmail || t('notSet'),
    },
    {
      icon: <CalendarOutlined />,
      label: t('joinedAt'),
      value: developerInfo?.createAt ? formatDateTime(developerInfo.createAt) : '-',
    },
  ];

  const renderProfileContent = () => (
    <>
      <div>
        <h2 className="m-0 text-[18px] font-semibold leading-7 text-[#303747]">
          {t('profileInfo')}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#737C8E]">{t('profileInfoDescription')}</p>
      </div>

      {loadingProfile ? (
        <Skeleton active className="mt-6" paragraph={{ rows: 6 }} />
      ) : (
        <dl className="mt-6 overflow-hidden rounded-[10px] border border-[#E1E3EB] bg-white/30">
          {profileFacts.map((item) => (
            <div
              className="grid min-w-0 gap-2 border-b border-[#E6E7ED] px-4 py-4 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center"
              key={item.label}
            >
              <dt className="flex items-center gap-2 text-sm font-medium text-[#697386]">
                <span className="text-[15px] text-[#8A91A0]">{item.icon}</span>
                <span>{item.label}</span>
              </dt>
              <dd className="m-0 truncate text-sm font-medium text-[#404858]">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );

  const renderSecurityContent = () => (
    <>
      <div>
        <h2 className="m-0 text-[18px] font-semibold leading-7 text-[#303747]">
          {t('accountSecurity')}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#737C8E]">{t('passwordDescription')}</p>
      </div>

      <ChangePasswordForm loading={changePasswordLoading} onSubmit={handleChangePassword} />
    </>
  );

  const renderIdentityContent = () => (
    <>
      <div>
        <h2 className="m-0 text-[18px] font-semibold leading-7 text-[#303747]">
          {t('thirdPartyAccounts')}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-[#737C8E]">{t('thirdPartyDescription')}</p>
      </div>

      <div className="mt-6 rounded-[10px] border border-dashed border-[#DDE0E8] bg-white/25 px-6 py-12 text-center">
        <div className="inline-flex rounded-[7px] bg-[#EEEFF4] px-3 py-1.5 text-xs font-medium text-[#7A8292]">
          {t('comingSoon')}
        </div>
      </div>
    </>
  );

  const renderActiveContent = () => {
    if (activeSection === 'security') return renderSecurityContent();
    if (activeSection === 'identity') return renderIdentityContent();
    return renderProfileContent();
  };

  return (
    <Layout backgroundVariant="market">
      <div className="w-full py-4 sm:py-6">
        <section className="min-h-[calc(100dvh-128px)] rounded-[14px] border border-[#E1E3EB] bg-white/[0.62] p-4 backdrop-blur-[14px] sm:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="m-0 text-[24px] font-semibold leading-8 text-[#303747]">{t('title')}</h1>
            <Button
              className="h-9 w-fit rounded-[8px] border-0 bg-[#EFEDFB] px-3.5 text-sm font-medium text-[#625DE2] shadow-none hover:!bg-[#E8E5F8] hover:!text-[#514BCB]"
              icon={<TeamOutlined />}
              onClick={() => navigate('/consumers')}
            >
              {t('manageConsumers')}
            </Button>
          </div>

          <div className="grid w-full gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="min-w-0">
              <div className="rounded-[12px] border border-[#E1E3EB] bg-white/38 p-4">
                {loadingProfile ? (
                  <div>
                    <Skeleton.Avatar active size={64} />
                    <Skeleton active className="mt-4" paragraph={{ rows: 2 }} />
                  </div>
                ) : (
                  <div className="mb-6 flex items-center gap-3">
                    {avatar ? (
                      <img
                        alt={displayName}
                        className="h-12 w-12 rounded-[10px] object-cover"
                        src={avatar}
                      />
                    ) : (
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[10px] border border-white/70 bg-white/65 text-lg font-semibold text-[#5F687A]">
                        {getInitials(displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-[#303747]">
                        {displayName}
                      </div>
                      {displayEmail && (
                        <div className="mt-1 truncate text-xs text-[#858C9B]">{displayEmail}</div>
                      )}
                      <div className="mt-2 inline-flex rounded-[6px] bg-[#EDF6F1] px-2 py-0.5 text-[11px] font-medium text-[#4F7A63]">
                        {t('activeAccount')}
                      </div>
                    </div>
                  </div>
                )}

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = activeSection === item.key;

                    return (
                      <button
                        className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[#EFEDFB] text-[#4D5262]'
                            : 'text-[#646D7E] hover:bg-white/65 hover:text-[#404858]'
                        }`}
                        key={item.key}
                        onClick={() => setActiveSection(item.key)}
                        type="button"
                      >
                        <span
                          className={`text-base ${isActive ? 'text-[#625DE2]' : 'text-[#7D8594]'}`}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.comingSoon && (
                          <span className="rounded-[5px] bg-[#EEEFF4] px-1.5 py-0.5 text-[10px] font-medium text-[#858C9B]">
                            {t('comingSoon')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <main className="min-h-[420px] min-w-0 rounded-[12px] border border-[#E1E3EB] bg-white/38 p-5 sm:p-6">
              {renderActiveContent()}
            </main>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Profile;

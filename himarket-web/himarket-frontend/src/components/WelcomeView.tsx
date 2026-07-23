import { Button } from 'antd';
import { Code2, LockKeyhole, Paperclip, Plus, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

interface WelcomeViewProps {
  type: 'chat' | 'coding';
}

export function WelcomeView({ type }: WelcomeViewProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('welcome');

  const isChatType = type === 'chat';
  const namespace = isChatType ? 'chat' : 'coding';
  const productName = isChatType ? 'Chat' : 'Coding';

  return (
    <div className="flex min-h-[calc(100dvh-76px)] w-full items-center justify-center px-4 py-10">
      <section className="w-full max-w-[860px]">
        <header className="text-center">
          <h1 className="m-0 text-[34px] font-semibold leading-[44px] text-[#303747] antialiased">
            <span className="text-colorPrimary">Hi</span>
            {productName}
          </h1>
          <p className="mt-2 text-base leading-7 text-[#737C8E]">{t(`${namespace}.subtitle`)}</p>
        </header>

        <div className="mx-auto mt-8 max-w-[760px] rounded-[14px] border border-[#DFE2E9] bg-white/[0.58] p-4 shadow-[0_12px_40px_rgba(67,72,104,0.05)] backdrop-blur-[18px] sm:p-5">
          <div className="min-h-[88px] text-left text-sm text-[#9AA1AE] sm:text-base">
            {t(`${namespace}.placeholder`)}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 text-[#858D9C]">
              {isChatType ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px]">
                  <Plus aria-hidden="true" size={18} strokeWidth={1.8} />
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px]">
                  <Paperclip aria-hidden="true" size={18} strokeWidth={1.8} />
                </span>
              )}
              <span className="flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[#EFEDFB] px-2.5 text-[#6F69DF]">
                {isChatType ? (
                  <Paperclip aria-hidden="true" size={16} strokeWidth={1.8} />
                ) : (
                  <Code2 aria-hidden="true" size={16} strokeWidth={1.8} />
                )}
                <span className="text-xs font-medium">
                  {isChatType ? 'MCP' : t('coding.workspace')}
                </span>
              </span>
              <span className="ml-1 hidden min-w-0 items-center gap-1.5 text-xs text-[#7F8796] sm:flex">
                <LockKeyhole aria-hidden="true" size={14} strokeWidth={1.8} />
                <span className="truncate">{t(`${namespace}.loginHint`)}</span>
              </span>
            </div>
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#D9DDF6] text-white">
              <Send aria-hidden="true" size={17} strokeWidth={1.8} />
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button
            className="h-10 rounded-[8px] border-0 bg-[#6863EB] px-5 text-sm font-medium shadow-none hover:!bg-[#5D58DE]"
            onClick={() => login()}
            type="primary"
          >
            {t(`${namespace}.cta`)}
          </Button>
          <Button
            className="h-10 rounded-[8px] border-[#DFE1E8] bg-white/45 px-5 text-sm font-medium text-[#555E6F] shadow-none hover:!border-[#CFCCE8] hover:!bg-white/65 hover:!text-[#4943C7]"
            onClick={() => navigate('/register')}
          >
            {t('register')}
          </Button>
        </div>
      </section>
    </div>
  );
}

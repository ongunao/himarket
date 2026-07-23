import { ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Tip } from '../icon';

const questionKeys = [
  'reactHooks',
  'typescriptType',
  'tailwindBestPractices',
  'viteEnv',
  'reactRouter',
  'customHook',
  'antdTheme',
  'bundleSize',
  'stateReducer',
];

interface SuggestedQuestionsProps {
  onSelectQuestion: (question: string) => void;
}

function getRandomQuestions(count: number): string[] {
  const shuffled = [...questionKeys].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function SuggestedQuestions({ onSelectQuestion }: SuggestedQuestionsProps) {
  const { t } = useTranslation('chat');
  const [displayedQuestions, setDisplayedQuestions] = useState(() => {
    return getRandomQuestions(3);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setDisplayedQuestions(getRandomQuestions(3));
      setIsRefreshing(false);
    }, 300);
  };

  return (
    <div className="mx-auto max-w-[720px]">
      {/* 标题和刷新按钮 */}
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-600">{t('suggestions.title')}</h3>
        <button
          className="rounded-full p-1.5 text-gray-500 transition-all duration-200 hover:bg-[#E5E9F0] hover:text-gray-800"
          onClick={handleRefresh}
          title={t('suggestions.refresh')}
          type="button"
        >
          <ReloadOutlined
            className={`text-xs transition-transform duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* 问题列表 */}
      <div className="flex flex-col divide-y divide-[#D1D7E1] border-y border-[#D1D7E1]">
        {displayedQuestions.map((questionKey, index) => {
          const question = t(`suggestions.questions.${questionKey}`);

          return (
            <button
              className={`
              min-h-[52px] w-full cursor-pointer px-3 py-3 text-left
              transition-all duration-200 ease-out
              hover:bg-[#E7EAF1]/80
              active:scale-[0.98]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/20
              group
              ${isRefreshing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
            `}
              key={`${questionKey}-${index}`}
              onClick={() => onSelectQuestion(question)}
              style={{ animationDelay: `${index * 100}ms` }}
              type="button"
            >
              <p className="flex items-center gap-2 text-sm leading-6 text-gray-700 transition-colors duration-200 group-hover:text-gray-950">
                <Tip className="flex-shrink-0 fill-colorPrimary" />
                {question}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { DownloadOutlined } from '@ant-design/icons';
import { ArrowUpRight } from 'lucide-react';

import { ProductIconRenderer } from '../icon/ProductIconRenderer';

interface SkillCardProps {
  appearance?: 'default' | 'market';
  icon: string;
  name: string;
  description: string;
  updatedAt: string;
  author?: string;
  authorPrefix: string;
  skillTags?: string[] | null;
  downloadCount?: number | null;
  onClick?: () => void;
}

export function SkillCard({
  appearance = 'default',
  author,
  authorPrefix,
  description,
  downloadCount,
  icon,
  name,
  onClick,
  skillTags = [],
  updatedAt,
}: SkillCardProps) {
  const normalizedSkillTags = Array.isArray(skillTags) ? skillTags : [];
  const formattedAuthor = author ? `@${author.replace(/^@+/, '')}` : undefined;
  const isMarketAppearance = appearance === 'market';

  return (
    <button
      className={`
        group border p-4
        cursor-pointer
        transition-all duration-200 ease-out
        active:scale-[0.98] active:duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25 focus-visible:ring-offset-2
        relative
        overflow-hidden
        h-[176px]
        flex flex-col
        w-full text-left
        ${
          isMarketAppearance
            ? 'rounded-[10px] border-[#E1E3EB] bg-[#FCFCFE] shadow-none hover:border-[#CDD0DC] hover:bg-white'
            : 'rounded-xl border-[#DDE4EF] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFF_100%)] shadow-[0_6px_20px_rgba(31,42,68,0.05)] hover:-translate-y-0.5 hover:border-[#C6D1E3] hover:shadow-[0_14px_34px_rgba(31,42,68,0.09)]'
        }
      `}
      onClick={onClick}
      type="button"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[10px] ${
              isMarketAppearance ? 'bg-[#F1F0F8]' : 'border border-[#EDF1F7] bg-[#F3F6FF]'
            }`}
          >
            <ProductIconRenderer className="h-full w-full object-cover" iconType={icon} />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-base leading-tight transition-colors ${
                isMarketAppearance ? 'font-semibold text-gray-800' : 'font-bold text-gray-950'
              }`}
            >
              {name}
            </h3>
            <div className="mt-1 flex min-w-0 max-w-full items-center gap-3 text-xs leading-snug text-gray-500">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex-shrink-0 truncate">{updatedAt}</span>
                {formattedAuthor && (
                  <span className="min-w-0 max-w-[132px] truncate">
                    {authorPrefix}{' '}
                    <span className="font-semibold text-[#566176]">{formattedAuthor}</span>
                  </span>
                )}
              </div>
              <span className="ml-auto inline-flex flex-shrink-0 items-center gap-1.5">
                <DownloadOutlined className="text-[11px] text-gray-400" />
                <span className="tabular-nums">{(downloadCount ?? 0).toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-gray-400 opacity-0 transition-all duration-200 group-hover:bg-[#F3F6FA] group-hover:text-gray-700 group-hover:opacity-100 group-focus-visible:bg-[#F3F6FA] group-focus-visible:text-gray-700 group-focus-visible:opacity-100">
          <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} />
        </span>
      </div>

      <div className="mb-3 flex min-h-6 flex-wrap items-center gap-2">
        {normalizedSkillTags.slice(0, 3).map((tag) => (
          <span
            className={`inline-flex min-h-6 items-center rounded-[6px] px-2 text-xs font-semibold text-[#566176] ${
              isMarketAppearance ? 'bg-[#F1F0F8]' : 'border border-[#E4EAF3] bg-[#F8FAFD]'
            }`}
            key={tag}
          >
            {tag}
          </span>
        ))}
        {normalizedSkillTags.length > 3 && (
          <span
            className={`inline-flex min-h-6 items-center rounded-[6px] px-2 text-xs font-semibold text-[#566176] ${
              isMarketAppearance ? 'bg-[#F1F0F8]' : 'border border-[#E4EAF3] bg-[#F8FAFD]'
            }`}
          >
            +{normalizedSkillTags.length - 3}
          </span>
        )}
      </div>

      <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-gray-600">{description}</p>
    </button>
  );
}

import { InboxOutlined } from '@ant-design/icons';

import MarkdownRender from './MarkdownRender';
import { parseSkillMd } from '../lib/skillMdUtils';

interface ProductOverviewProps {
  appearance?: 'default' | 'market';
  className?: string;
  content?: string | null;
  emptyText: string;
  loading?: boolean;
  showFrontmatterTable?: boolean;
}

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

function renderContent(content: string, showFrontmatterTable: boolean) {
  if (!showFrontmatterTable) {
    return <MarkdownRender content={content} />;
  }

  const { body, frontmatter } = parseSkillMd(content);
  const frontmatterEntries = Object.entries(frontmatter);

  return (
    <div className="text-sm">
      {frontmatterEntries.length > 0 && (
        <table className="mb-6 w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f6f8fa]">
              {frontmatterEntries.map(([key]) => (
                <th
                  className="border border-[#d0d7de] px-3 py-1.5 text-left font-semibold text-[#1f2328]"
                  key={key}
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {frontmatterEntries.map(([key, value]) => (
                <td
                  className="border border-[#d0d7de] px-3 py-1.5 align-top text-[#1f2328]"
                  key={key}
                >
                  {value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      <MarkdownRender content={body} />
    </div>
  );
}

export function ProductOverview({
  appearance = 'default',
  className,
  content,
  emptyText,
  loading = false,
  showFrontmatterTable = false,
}: ProductOverviewProps) {
  const isMarketAppearance = appearance === 'market';
  const hasContent = Boolean(content?.trim());
  const rootClassName = classNames(
    'scrollbar-thin-soft overflow-y-auto overscroll-contain',
    className ??
      (hasContent
        ? isMarketAppearance
          ? 'max-h-[clamp(520px,calc(100dvh-280px),1080px)] min-h-[340px] pr-2'
          : 'max-h-[clamp(520px,calc(100dvh-280px),1080px)] min-h-[420px] pr-2'
        : isMarketAppearance
          ? 'min-h-[200px]'
          : 'min-h-[240px]'),
  );

  if (loading) {
    return (
      <div className={rootClassName}>
        <div className="flex min-h-[160px] items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-colorPrimary" />
        </div>
      </div>
    );
  }

  if (!hasContent || !content) {
    return (
      <div className={rootClassName}>
        <div
          className={
            isMarketAppearance
              ? 'flex min-h-[200px] flex-col items-center justify-center py-10'
              : 'flex min-h-[240px] flex-col items-center justify-center rounded-[12px] border border-dashed border-[#DDE5F0] bg-[#FBFCFE] py-12'
          }
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isMarketAppearance ? 'mb-2.5 bg-[#F1F3F7]' : 'mb-2 bg-gray-100'
            }`}
          >
            <InboxOutlined
              className={
                isMarketAppearance ? 'text-base text-[#98A1AF]' : 'text-base text-gray-400'
              }
            />
          </div>
          <div
            className={
              isMarketAppearance ? 'text-sm font-medium text-[#7D8796]' : 'text-sm text-gray-500'
            }
          >
            {emptyText}
          </div>
        </div>
      </div>
    );
  }

  return <div className={rootClassName}>{renderContent(content, showFrontmatterTable)}</div>;
}

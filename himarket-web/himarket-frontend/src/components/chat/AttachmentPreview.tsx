import {
  CloseCircleFilled,
  FileImageOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import { isAxiosError } from 'axios';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { type IAttachment, getAttachment } from '../../lib/apis';
import { File as FileIcon } from '../icon';

export type PreviewAttachment = Partial<IAttachment> & { attachmentId: string; url?: string };
type AttachmentLoadState = 'expired' | 'failed' | 'loading' | 'ready';

interface AttachmentPreviewProps {
  attachments: PreviewAttachment[];
  onRemove?: (id: string) => void;
  isUploading?: boolean;
  className?: string;
  itemClassName?: string;
}

function getAttachmentLoadFailure(error: unknown): AttachmentLoadState {
  return isAxiosError(error) && error.response?.status === 404 ? 'expired' : 'failed';
}

const AttachmentItem = ({
  file,
  itemClassName,
  onRemove,
}: {
  file: PreviewAttachment;
  onRemove?: (id: string) => void;
  itemClassName: string;
}) => {
  const { t } = useTranslation('common');
  const [details, setDetails] = useState<PreviewAttachment>(file);
  const [imgSrc, setImgSrc] = useState<string | undefined>(file.url);
  const [loadState, setLoadState] = useState<AttachmentLoadState>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const { attachmentId, mimeType, name, size, type, url } = file;

  useEffect(() => {
    const currentFile = { attachmentId, mimeType, name, size, type, url };
    const needsFetch = !type || (type === 'IMAGE' && !url);
    setDetails(currentFile);
    setImgSrc(url);

    if (!needsFetch) {
      setLoadState('ready');
      return;
    }

    let active = true;
    setLoadState('loading');
    getAttachment(attachmentId, { suppressErrorMessage: true })
      .then((response) => {
        if (!active) return;

        if (response.code !== 'SUCCESS' || !response.data) {
          setLoadState('failed');
          return;
        }

        setDetails((current) => ({ ...current, ...response.data }));
        if (response.data.type === 'IMAGE') {
          if (!response.data.data) {
            setLoadState('failed');
            return;
          }
          setImgSrc(`data:${response.data.mimeType};base64,${response.data.data}`);
        }
        setLoadState('ready');
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadState(getAttachmentLoadFailure(error));
        }
      });

    return () => {
      active = false;
    };
  }, [attachmentId, loadAttempt, mimeType, name, size, type, url]);

  if (loadState === 'loading') {
    return (
      <div
        aria-label={t('attachment.loading')}
        className={`flex h-16 w-[160px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white/55 ${itemClassName}`}
        role="status"
      >
        <LoadingOutlined className="text-colorPrimary" />
      </div>
    );
  }

  if (loadState === 'expired' || loadState === 'failed') {
    const isImage = details.type === 'IMAGE' || file.type === 'IMAGE';
    const title = t(
      loadState === 'expired'
        ? isImage
          ? 'attachment.imageExpired'
          : 'attachment.fileExpired'
        : isImage
          ? 'attachment.imageLoadFailed'
          : 'attachment.fileLoadFailed',
    );

    return (
      <div
        className={`group relative flex h-16 w-[160px] flex-shrink-0 items-center gap-2 rounded-[10px] bg-white/60 p-3 ring-1 ring-[#E8EBF0] ${itemClassName}`}
      >
        {onRemove && (
          <button
            className="absolute right-1.5 top-1.5 hidden cursor-pointer border-0 bg-transparent p-0 leading-none group-hover:block"
            onClick={() => onRemove(details.attachmentId)}
            type="button"
          >
            <CloseCircleFilled className="text-[#AAB1BD] hover:text-[#7D8695]" />
          </button>
        )}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#F1F3F7] text-[#98A1AF]">
          {isImage ? <FileImageOutlined className="text-lg" /> : <FileIcon />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[#626B7A]">{title}</div>
          {loadState === 'failed' && (
            <div className="mt-0.5 truncate text-xs text-[#98A1AF]">
              {t('attachment.loadFailedHint')}
            </div>
          )}
        </div>
        {loadState === 'failed' && (
          <Tooltip title={t('attachment.retry')}>
            <button
              aria-label={t('attachment.retry')}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center border-0 bg-transparent text-[#7D8695] transition-colors hover:text-colorPrimary focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              type="button"
            >
              <ReloadOutlined />
            </button>
          </Tooltip>
        )}
      </div>
    );
  }

  if (details.type === 'IMAGE' && imgSrc) {
    return (
      <div
        className={`relative group rounded-[10px] w-16 h-16 overflow-hidden flex-shrink-0 ${itemClassName}`}
      >
        {onRemove && (
          <button
            className="absolute cursor-pointer hidden group-hover:block top-2 right-2 leading-none z-10 bg-transparent border-0 p-0"
            onClick={() => onRemove(details.attachmentId)}
            type="button"
          >
            <CloseCircleFilled className="text-white/80 hover:text-white drop-shadow-md" />
          </button>
        )}
        <img
          alt={details.name}
          className="w-full h-full object-cover"
          onError={() => setLoadState('failed')}
          src={imgSrc}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative group rounded-[10px] p-3 bg-white/80 hover:bg-white/50 transition-colors flex items-center w-[160px] gap-2 h-16 ${itemClassName}`}
      style={{
        boxShadow: '0px 4px 12px 0px rgba(118, 94, 252, 0.15)',
      }}
    >
      {onRemove && (
        <button
          className="absolute cursor-pointer hidden group-hover:block top-2 right-2 leading-none bg-transparent border-0 p-0"
          onClick={() => onRemove(details.attachmentId)}
          type="button"
        >
          <CloseCircleFilled className="text-ring-light" />
        </button>
      )}
      <div
        className="flex min-w-10 w-10 h-10 items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: 'var(--gradient-iondigo-500)' }}
      >
        <FileIcon className="fill-indigo-500" />
      </div>
      <div className="flex flex-col justify-between min-w-0 flex-1">
        <div
          className="text-sm text-accent-dark font-medium text-ellipsis overflow-hidden whitespace-nowrap"
          title={details.name || details.attachmentId}
        >
          {details.name || details.attachmentId}
        </div>
        <span className="text-xs text-accent-dark">
          {details.name ? details.name.split('.').pop() : ''}
        </span>
      </div>
    </div>
  );
};

export function AttachmentPreview({
  attachments,
  className = '',
  isUploading = false,
  itemClassName = '',
  onRemove,
}: AttachmentPreviewProps) {
  if ((!attachments || attachments.length === 0) && !isUploading) return null;

  return (
    <div className={`flex items-center gap-1 overflow-x-auto scrollbar-hide ${className}`}>
      {attachments?.map((file) => (
        <AttachmentItem
          file={file}
          itemClassName={itemClassName}
          key={file.attachmentId}
          onRemove={onRemove}
        />
      ))}
      {isUploading && (
        <div className="flex items-center justify-center p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200 min-w-[60px] h-16">
          <LoadingOutlined className="text-colorPrimary" />
        </div>
      )}
    </div>
  );
}

import {
  CheckOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  ExpandOutlined,
  FileImageOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import { isAxiosError } from 'axios';
import { type ReactNode, isValidElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github.css';
import 'github-markdown-css/github-markdown-light.css';
import './MarkdownRender.css';

import { getAttachment } from '../lib/apis/chat';
import { copyToClipboard } from '../lib/utils';

import type { IGeneratedImage } from '../types';

interface MarkdownRenderProps {
  content: string;
  imageStyle?: 'default' | 'card';
  onEditImage?: (image: IGeneratedImage) => void;
  variant?: 'document' | 'chat' | 'thinking' | 'product-description';
}

interface CodeBlockProps {
  children: ReactNode;
  copiedLabel: string;
  copyLabel: string;
}

interface ImageRendererProps {
  alt?: string;
  downloadLabel: string;
  editImageLabel: string;
  generatedImageLabel: string;
  imageExpiredLabel: string;
  imageLoadFailedHint: string;
  imageLoadFailedLabel: string;
  imageStyle: 'default' | 'card';
  loadingLabel: string;
  onEditImage?: (image: IGeneratedImage) => void;
  retryLabel: string;
  src?: string;
  viewOriginalLabel: string;
}

interface MarkdownAstNode {
  children?: MarkdownAstNode[];
  type: string;
  value?: string;
}

const ATTACHMENT_PATH_PREFIX = '/api/v1/attachments/';
type ImageLoadState = 'expired' | 'failed' | 'loading' | 'ready';

const IMAGE_TOOLTIP_STYLE = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  color: '#333',
};

function getImageLoadFailure(error: unknown): ImageLoadState {
  return isAxiosError(error) && error.response?.status === 404 ? 'expired' : 'failed';
}

function remarkHtmlBreaks() {
  return (tree: MarkdownAstNode) => {
    const replaceBreaks = (node: MarkdownAstNode) => {
      if (!node.children) return;

      node.children = node.children.flatMap((child) => {
        const html = child.type === 'html' ? child.value?.trim() : undefined;
        const breakTags = html?.match(/<br\s*\/?>/gi);
        if (breakTags && html?.replace(/<br\s*\/?>/gi, '').trim() === '') {
          return breakTags.map(() => ({ type: 'break' }));
        }

        replaceBreaks(child);
        return [child];
      });
    };

    replaceBreaks(tree);
  };
}

function getTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getTextFromNode).join('');
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextFromNode(node.props.children);
  }

  return '';
}

function CodeBlock({ children, copiedLabel, copyLabel }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = getTextFromNode(children).replace(/\n$/, '');

    await copyToClipboard(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="himarket-code-block">
      <button
        aria-label={copied ? copiedLabel : copyLabel}
        className="himarket-code-copy"
        onClick={handleCopy}
        title={copied ? copiedLabel : copyLabel}
        type="button"
      >
        {copied ? <CheckOutlined /> : <CopyOutlined />}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

function ImageRenderer({
  alt,
  downloadLabel,
  editImageLabel,
  generatedImageLabel,
  imageExpiredLabel,
  imageLoadFailedHint,
  imageLoadFailedLabel,
  imageStyle,
  loadingLabel,
  onEditImage,
  retryLabel,
  src,
  viewOriginalLabel,
}: ImageRendererProps) {
  const attachmentId = src?.startsWith(ATTACHMENT_PATH_PREFIX)
    ? src.slice(ATTACHMENT_PATH_PREFIX.length).split(/[?#]/)[0]
    : undefined;
  const [resolvedSrc, setResolvedSrc] = useState(attachmentId ? undefined : src);
  const [loadState, setLoadState] = useState<ImageLoadState>(
    attachmentId ? 'loading' : src ? 'ready' : 'failed',
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!attachmentId) {
      setResolvedSrc(src);
      setLoadState(src ? 'ready' : 'failed');
      return;
    }

    let active = true;
    setResolvedSrc(undefined);
    setLoadState('loading');
    getAttachment(attachmentId, { suppressErrorMessage: true })
      .then((response) => {
        if (active && response.code === 'SUCCESS' && response.data?.data) {
          setResolvedSrc(`data:${response.data.mimeType};base64,${response.data.data}`);
          setLoadState('ready');
        } else if (active) {
          setLoadState('failed');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setResolvedSrc(undefined);
          setLoadState(getImageLoadFailure(error));
        }
      });
    return () => {
      active = false;
    };
  }, [attachmentId, loadAttempt, src]);

  const handleImageError = () => {
    setResolvedSrc(undefined);
    setLoadState('failed');
  };

  const handleRetry = () => {
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (imageStyle !== 'card') {
    return resolvedSrc ? (
      <img
        alt={alt || ''}
        className="my-4 max-w-full rounded-lg"
        onError={handleImageError}
        src={resolvedSrc}
      />
    ) : (
      <div
        aria-live="polite"
        className="my-4 flex min-h-28 max-w-md flex-col items-center justify-center rounded-[12px] bg-[#F4F6F9] px-6 py-5 text-center"
        role="status"
      >
        {loadState === 'loading' ? (
          <LoadingOutlined className="text-xl text-[#98A1AF]" />
        ) : (
          <>
            <FileImageOutlined className="mb-2 text-2xl text-[#98A1AF]" />
            <span className="text-sm font-medium text-[#626B7A]">
              {loadState === 'expired' ? imageExpiredLabel : imageLoadFailedLabel}
            </span>
          </>
        )}
      </div>
    );
  }

  const handleDownload = () => {
    if (resolvedSrc) {
      const link = document.createElement('a');
      link.href = resolvedSrc;
      link.download = alt || 'image.png';
      link.click();
    }
  };

  const handleViewOriginal = () => {
    if (resolvedSrc) {
      const imageWindow = window.open('', '_blank');
      if (!imageWindow) return;

      imageWindow.opener = null;
      imageWindow.document.title = viewOriginalLabel;
      imageWindow.document.body.style.cssText =
        'margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a1a;';
      const image = imageWindow.document.createElement('img');
      image.src = resolvedSrc;
      image.alt = alt || '';
      image.style.cssText = 'max-width:100%;max-height:100vh;object-fit:contain;';
      imageWindow.document.body.appendChild(image);
    }
  };

  return (
    <div className="my-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {resolvedSrc ? (
        <button
          className="relative flex w-full cursor-pointer items-center justify-center border-0 bg-[#F7F9FC] p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25"
          onClick={handleViewOriginal}
          style={{ aspectRatio: '16 / 10' }}
          type="button"
        >
          <img
            alt={alt || ''}
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
            onError={handleImageError}
            src={resolvedSrc}
          />
        </button>
      ) : (
        <div
          aria-live="polite"
          className="relative flex w-full flex-col items-center justify-center bg-[#F4F6F9] px-6 text-center"
          role="status"
          style={{ aspectRatio: '16 / 10' }}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-white/75 text-[#98A1AF] ring-1 ring-[#E8EBF0]">
            {loadState === 'loading' ? (
              <LoadingOutlined className="text-xl" />
            ) : (
              <FileImageOutlined className="text-2xl" />
            )}
          </div>
          {loadState === 'loading' ? (
            <span className="text-sm text-[#8B94A3]">{loadingLabel}</span>
          ) : (
            <>
              <span className="text-sm font-medium text-[#626B7A]">
                {loadState === 'expired' ? imageExpiredLabel : imageLoadFailedLabel}
              </span>
              {loadState === 'failed' && (
                <span className="mt-1 text-xs text-[#98A1AF]">{imageLoadFailedHint}</span>
              )}
              {loadState === 'failed' && (
                <button
                  className="mt-3 flex items-center gap-1.5 border-0 bg-transparent px-2 py-1 text-xs text-colorPrimary transition-colors hover:text-colorPrimaryHover focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25"
                  onClick={handleRetry}
                  type="button"
                >
                  <ReloadOutlined />
                  <span>{retryLabel}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 text-gray-500">
          <FileImageOutlined />
          <span className="text-sm">{generatedImageLabel}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {attachmentId && resolvedSrc && onEditImage && (
            <button
              className="flex h-8 items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-3 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25 active:scale-[0.98]"
              onClick={() =>
                onEditImage({
                  attachmentId,
                })
              }
              type="button"
            >
              <EditOutlined className="text-xs" />
              <span>{editImageLabel}</span>
            </button>
          )}
          <Tooltip
            color="#ffffff"
            overlayInnerStyle={IMAGE_TOOLTIP_STYLE}
            placement="top"
            title={downloadLabel}
          >
            <button
              aria-label={downloadLabel}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!resolvedSrc}
              onClick={handleDownload}
              type="button"
            >
              <DownloadOutlined className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip
            color="#ffffff"
            overlayInnerStyle={IMAGE_TOOLTIP_STYLE}
            placement="top"
            title={viewOriginalLabel}
          >
            <button
              aria-label={viewOriginalLabel}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!resolvedSrc}
              onClick={handleViewOriginal}
              type="button"
            >
              <ExpandOutlined className="text-sm" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function isVideoUrl(url?: string): boolean {
  if (!url) {
    return false;
  }
  const normalizedUrl = (url.split('?')[0] ?? '').toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogg)$/.test(normalizedUrl);
}

const MarkdownRender = ({
  content,
  imageStyle = 'default',
  onEditImage,
  variant = 'document',
}: MarkdownRenderProps) => {
  const { t } = useTranslation('common');
  const generatedImageLabel = t('markdown.generatedImage');
  const generatedVideoLabel = t('markdown.generatedVideo');
  const downloadLabel = t('markdown.download');
  const editImageLabel = t('markdown.editImage');
  const imageExpiredLabel = t('attachment.imageExpired');
  const imageLoadFailedHint = t('attachment.loadFailedHint');
  const imageLoadFailedLabel = t('attachment.imageLoadFailed');
  const attachmentLoadingLabel = t('attachment.loading');
  const retryLabel = t('attachment.retry');
  const openOriginalLabel = t('markdown.openOriginal');
  const viewOriginalLabel = t('markdown.viewOriginal');
  const isProductDescription = variant === 'product-description';
  const isThinking = variant === 'thinking';
  const isChat = variant === 'chat' || isThinking;

  return (
    <div
      className={`markdown-body himarket-markdown-body ${
        isChat
          ? `himarket-markdown-chat ${isThinking ? 'himarket-markdown-thinking' : ''}`
          : isProductDescription
            ? 'himarket-markdown-product-description'
            : ''
      }`}
      style={{
        backgroundColor: 'transparent',
        color: isProductDescription ? '#596273' : isThinking ? '#667085' : '#24292e',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        fontSize: isProductDescription || isThinking ? '14px' : '16px',
        lineHeight: isProductDescription || isThinking ? '1.72' : '1.5',
      }}
    >
      <ReactMarkdown
        components={{
          a: ({ children, href }) => {
            if (!isVideoUrl(href)) {
              return <a href={href}>{children}</a>;
            }

            const handleDownload = () => {
              const link = document.createElement('a');
              link.href = href || '';
              link.download = 'video.mp4';
              link.click();
            };

            const handleViewOriginal = () => {
              if (href) {
                window.open(href, '_blank');
              }
            };

            return (
              <div className="my-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <video
                  className="block aspect-video w-full bg-black object-contain"
                  controls
                  preload="metadata"
                  src={href}
                />
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
                  <span className="text-sm text-gray-500">{generatedVideoLabel}</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                      onClick={handleDownload}
                      type="button"
                    >
                      <DownloadOutlined className="text-xs" />
                      <span>{downloadLabel}</span>
                    </button>
                    <button
                      className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                      onClick={handleViewOriginal}
                      type="button"
                    >
                      <ExpandOutlined className="text-xs" />
                      <span>{openOriginalLabel}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          },
          img: ({ alt, src }) => (
            <ImageRenderer
              alt={alt}
              downloadLabel={downloadLabel}
              editImageLabel={editImageLabel}
              generatedImageLabel={generatedImageLabel}
              imageExpiredLabel={imageExpiredLabel}
              imageLoadFailedHint={imageLoadFailedHint}
              imageLoadFailedLabel={imageLoadFailedLabel}
              imageStyle={imageStyle}
              loadingLabel={attachmentLoadingLabel}
              onEditImage={onEditImage}
              retryLabel={retryLabel}
              src={src}
              viewOriginalLabel={viewOriginalLabel}
            />
          ),
          pre: ({ children }) => (
            <CodeBlock copiedLabel={t('copied')} copyLabel={t('copyCode')}>
              {children}
            </CodeBlock>
          ),
        }}
        rehypePlugins={[rehypeHighlight]}
        remarkPlugins={[remarkGfm, remarkHtmlBreaks]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRender;

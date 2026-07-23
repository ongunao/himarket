import {
  DownloadOutlined,
  CopyOutlined,
  CheckOutlined,
  FileFilled,
  FileTextOutlined,
  FolderOpenOutlined,
  CodeOutlined,
  EyeOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Select, Tag, Tooltip } from 'antd';
import hljs from 'highlight.js';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';

import { ProductIconRenderer } from '../components/icon/ProductIconRenderer';
import { Layout } from '../components/Layout';
import { SkillWorkerDetailSkeleton } from '../components/loading';
import MarkdownRender from '../components/MarkdownRender';
import 'highlight.js/styles/github.css';
import { ProductDetailTabLabel, ProductDetailTabs } from '../components/ProductDetailTabs';
import { ProductOverview } from '../components/ProductOverview';
import SkillFileTree from '../components/skill/SkillFileTree';
import APIs from '../lib/apis';
import {
  getWorkerFileTree,
  getWorkerFileContent,
  getWorkerVersions,
  getWorkerPackageUrl,
  getWorkerCliInfo,
} from '../lib/apis/workerTemplateApi';
import { getIconString } from '../lib/iconUtils';
import { buildNacosCliCommand } from '../lib/nacosCliCommand';
import { copyToClipboard } from '../lib/utils';
import { formatSkillAuthor, getSelectedSkillVersionAuthor } from '../lib/utils/skillVersionInfo';

import type { IProductDetail } from '../lib/apis';
import type { SkillFileTreeNode } from '../lib/apis/cliProvider';
import type { IWorkerConfig } from '../lib/apis/typing';
import type {
  WorkerFileTreeNode,
  WorkerFileContent,
  WorkerVersion,
  WorkerCliInfo,
} from '../lib/apis/workerTemplateApi';

function inferLanguage(path: string): string {
  const fileName = path.split('/').pop()?.toLowerCase() ?? '';
  if (fileName === 'dockerfile') return 'dockerfile';
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    bash: 'bash',
    c: 'c',
    cfg: 'ini',
    cpp: 'cpp',
    css: 'css',
    go: 'go',
    h: 'c',
    hpp: 'cpp',
    html: 'xml',
    ini: 'ini',
    java: 'java',
    js: 'javascript',
    json: 'json',
    jsx: 'javascript',
    kt: 'kotlin',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    sh: 'bash',
    sql: 'sql',
    swift: 'swift',
    toml: 'ini',
    ts: 'typescript',
    tsx: 'typescript',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return map[ext] ?? 'plaintext';
}

function WorkerDetail() {
  const { i18n, t } = useTranslation('workerDetail');
  const { t: tHeader } = useTranslation('header');
  const { workerProductId } = useParams<{ workerProductId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<IProductDetail>();
  const [workerConfig, setWorkerConfig] = useState<IWorkerConfig>();

  const [fileTree, setFileTree] = useState<WorkerFileTreeNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<WorkerFileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [treeWidth, setTreeWidth] = useState(224);
  const isDragging = useRef(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'file'>('overview');
  const [overviewContent, setOverviewContent] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [versions, setVersions] = useState<WorkerVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | undefined>();

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = treeWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setTreeWidth(Math.min(520, Math.max(160, startWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const loadVersionContent = useCallback(
    async (version?: string) => {
      if (!workerProductId) return;
      try {
        const filesRes = await getWorkerFileTree(workerProductId, version).catch(() => null);
        if (
          filesRes?.code === 'SUCCESS' &&
          Array.isArray(filesRes.data) &&
          filesRes.data.length > 0
        ) {
          setFileTree(filesRes.data);
          // Default select manifest.json
          setSelectedFilePath('manifest.json');
          setFileLoading(true);
          getWorkerFileContent(workerProductId, 'manifest.json', version)
            .then((r) => {
              if (r.code === 'SUCCESS' && r.data) setFileContent(r.data);
            })
            .catch(() => {})
            .finally(() => setFileLoading(false));
          // Fetch AGENTS.md for Overview tab: check root and config/ subdirectory
          const findAgentsMd = (nodes: WorkerFileTreeNode[]): WorkerFileTreeNode | null => {
            for (const n of nodes) {
              if (n.type === 'file' && (n.path === 'AGENTS.md' || n.path === 'config/AGENTS.md'))
                return n;
              if (n.children) {
                const f = findAgentsMd(n.children);
                if (f) return f;
              }
            }
            return null;
          };
          const agentsMdNode = findAgentsMd(filesRes.data);
          if (agentsMdNode) {
            setOverviewLoading(true);
            getWorkerFileContent(workerProductId, agentsMdNode.path, version)
              .then((r) => {
                setOverviewContent(r.code === 'SUCCESS' && r.data ? r.data.content : null);
              })
              .catch(() => setOverviewContent(null))
              .finally(() => setOverviewLoading(false));
          } else {
            setOverviewContent(null);
          }
        } else {
          setFileTree([]);
          setFileContent(null);
          setSelectedFilePath(undefined);
          setOverviewContent(null);
        }
      } catch {
        setFileTree([]);
      }
    },
    [workerProductId],
  );

  useEffect(() => {
    const fetchDetail = async () => {
      if (!workerProductId) return;
      setLoading(true);
      setError('');
      try {
        const [productRes, versionsRes, cliInfoRes] = await Promise.all([
          APIs.getProduct({ id: workerProductId }),
          getWorkerVersions(workerProductId).catch(() => null),
          getWorkerCliInfo(workerProductId).catch(() => null),
        ]);
        if (productRes.code === 'SUCCESS' && productRes.data) {
          setData(productRes.data);
          if (productRes.data.workerConfig) {
            setWorkerConfig(productRes.data.workerConfig);
          }
        } else {
          setError(productRes.message || t('dataLoadFailed'));
        }

        // Set CLI download info
        if (cliInfoRes?.code === 'SUCCESS' && cliInfoRes.data) {
          setCliInfo(cliInfoRes.data);
        }

        // Only show online (published) versions in frontend
        const onlineVersions =
          versionsRes?.code === 'SUCCESS' && Array.isArray(versionsRes.data)
            ? versionsRes.data.filter((v: WorkerVersion) => v.status === 'online')
            : [];
        setVersions(onlineVersions);

        // Prefer the backend-labeled latest version; otherwise keep the existing list order.
        const defaultVersion =
          onlineVersions.find((version: WorkerVersion) => version.isLatest)?.version ??
          onlineVersions[0]?.version;
        setSelectedVersion(defaultVersion);

        // Load file tree for the default version
        if (defaultVersion) {
          await loadVersionContent(defaultVersion);
        }
      } catch (err) {
        console.error('API请求失败:', err);
        setError(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [workerProductId, t, loadVersionContent]);

  const handleSelectFile = useCallback(
    async (path: string) => {
      if (!workerProductId) return;
      setSelectedFilePath(path);
      setMdRawMode(true);
      setFileLoading(true);
      try {
        const res = await getWorkerFileContent(workerProductId, path, selectedVersion);
        if (res.code === 'SUCCESS' && res.data) {
          setFileContent(res.data);
        }
      } catch {
        setFileContent(null);
      } finally {
        setFileLoading(false);
      }
    },
    [workerProductId, selectedVersion],
  );

  const handleVersionChange = useCallback(
    async (version: string) => {
      setSelectedVersion(version);
      setFileContent(null);
      setSelectedFilePath(undefined);
      await loadVersionContent(version);
    },
    [loadVersionContent],
  );

  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedHiclaw, setCopiedHiclaw] = useState(false);
  const [copiedNl, setCopiedNl] = useState(false);
  const [copiedHttp, setCopiedHttp] = useState(false);
  const [cliInfo, setCliInfo] = useState<WorkerCliInfo | null>(null);
  const [mdRawMode, setMdRawMode] = useState(true);
  const [hiclawPlatform, setHiclawPlatform] = useState<'unix' | 'windows'>('unix');
  const [installMethod, setInstallMethod] = useState<'nl' | 'script'>('nl');

  const handleDownload = useCallback(() => {
    if (!workerProductId) return;
    const a = document.createElement('a');
    a.href = getWorkerPackageUrl(workerProductId, selectedVersion);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [workerProductId, selectedVersion]);

  const handleTabChange = useCallback((key: string) => {
    if (key === 'overview' || key === 'file') {
      setActiveTab(key);
    }
  }, []);

  if (loading) {
    return (
      <Layout backgroundVariant="market">
        <SkillWorkerDetailSkeleton />
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout backgroundVariant="market">
        <div className="p-8">
          <Alert
            description={error || t('workerNotExist')}
            message={t('error')}
            showIcon
            type="error"
          />
        </div>
      </Layout>
    );
  }

  const { description, name } = data;
  const workerTags = Array.isArray(workerConfig?.tags) ? workerConfig.tags : [];
  const hasFiles = fileTree.length > 0;
  const latestVersion = versions.find((v) => v.isLatest)?.version;
  const selectedWorkerVersion = versions.find((v) => v.version === selectedVersion);
  const workerDownloadCount = Math.max(
    workerConfig?.downloadCount ?? 0,
    selectedWorkerVersion?.downloadCount ?? 0,
  );
  const selectedAuthorLabel = formatSkillAuthor(
    getSelectedSkillVersionAuthor(versions, selectedVersion),
  );
  const formattedUpdatedAt = data.updatedAt
    ? new Date(data.updatedAt)
        .toLocaleDateString(i18n.language, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '.')
    : undefined;
  const updatedAtLabel = data.updatedAt
    ? t('updatedAt', {
        date: formattedUpdatedAt,
      })
    : undefined;
  const headerMetaItems = [
    updatedAtLabel,
    selectedAuthorLabel ? `${t('author')} ${selectedAuthorLabel}` : undefined,
  ].filter(Boolean);

  const renderFilePreview = () => {
    if (!selectedFilePath) {
      return (
        <div className="flex h-full items-center justify-center bg-[#FBFCFE] text-gray-400">
          <div className="text-center">
            <FileFilled className="mb-3 text-5xl text-gray-300" />
            <p className="text-sm text-gray-400">{t('clickFileToView')}</p>
          </div>
        </div>
      );
    }
    if (fileLoading) {
      return (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-colorPrimary" />
        </div>
      );
    }
    if (!fileContent) {
      return <div className="text-gray-400 text-center py-16 text-sm">{t('fileLoadFailed')}</div>;
    }
    if (fileContent.encoding === 'base64') {
      return (
        <div className="text-gray-400 text-center py-16 text-sm">{t('binaryNotSupported')}</div>
      );
    }
    const displayContent = fileContent.content.trimEnd();
    if (selectedFilePath.endsWith('.md')) {
      const highlighted = (() => {
        try {
          if (hljs.getLanguage('markdown')) {
            return hljs.highlight(displayContent, { language: 'markdown' }).value;
          }
          return hljs.highlightAuto(displayContent).value;
        } catch {
          return displayContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
      })();
      const lineCount = displayContent.split('\n').length;
      const codeFont = "'Menlo', 'Monaco', 'Courier New', monospace";
      return (
        <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {/* Toggle button - floats top-right */}
          <div className="absolute right-3 top-2 z-20">
            <Tooltip title={mdRawMode ? t('renderPreview') : t('sourceCode')}>
              <button
                className="flex items-center gap-1 rounded-[7px] border border-[#E8EDF5] bg-white/90 px-2 py-1 text-xs font-medium text-gray-500 shadow-sm transition-colors hover:bg-[#F7F9FC] hover:text-gray-700"
                onClick={() => setMdRawMode(!mdRawMode)}
                type="button"
              >
                {mdRawMode ? <EyeOutlined /> : <CodeOutlined />}
                <span>{mdRawMode ? t('previewMode') : t('sourceMode')}</span>
              </button>
            </Tooltip>
          </div>
          {mdRawMode ? (
            <div className="flex min-h-0 flex-1 overflow-auto overscroll-contain">
              <div
                className="sticky left-0 z-10 flex-shrink-0 select-none bg-white py-3 pl-4 pr-3 text-right"
                style={{
                  borderRight: '1px solid #E8EEF6',
                  fontFamily: codeFont,
                  fontSize: '13px',
                  lineHeight: '20px',
                }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div className="text-gray-300" key={i}>
                    {i + 1}
                  </div>
                ))}
              </div>
              <pre
                className="m-0 flex-1 bg-white py-3 pl-5 pr-4"
                style={{
                  alignSelf: 'flex-start',
                  fontFamily: codeFont,
                  fontSize: '13px',
                  lineHeight: '20px',
                  minHeight: '100%',
                  overflow: 'visible',
                }}
              >
                <code
                  className="hljs language-markdown"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                  style={{ overflow: 'visible', padding: 0 }}
                />
              </pre>
            </div>
          ) : (
            <ProductOverview
              className="flex-1 px-6 pb-6 pt-8"
              content={fileContent.content}
              emptyText={t('noContent')}
              showFrontmatterTable
            />
          )}
        </div>
      );
    }
    const lang = inferLanguage(selectedFilePath);
    const highlighted = (() => {
      try {
        if (lang && lang !== 'plaintext' && hljs.getLanguage(lang)) {
          return hljs.highlight(displayContent, { language: lang }).value;
        }
        return hljs.highlightAuto(displayContent).value;
      } catch {
        return displayContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
    })();

    const lineCount = displayContent.split('\n').length;
    const codeFont = "'Menlo', 'Monaco', 'Courier New', monospace";

    return (
      <div className="h-full min-h-0 flex-1 overflow-auto overscroll-contain bg-white">
        <div className="flex min-h-full">
          <div
            className="sticky left-0 z-10 flex-shrink-0 select-none bg-white py-3 pl-4 pr-3 text-right"
            style={{
              borderRight: '1px solid #E8EEF6',
              fontFamily: codeFont,
              fontSize: '13px',
              lineHeight: '20px',
            }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div className="text-gray-300" key={i}>
                {i + 1}
              </div>
            ))}
          </div>
          <pre
            className="m-0 flex-1 bg-white py-3 pl-5 pr-4"
            style={{
              alignSelf: 'flex-start',
              fontFamily: codeFont,
              fontSize: '13px',
              lineHeight: '20px',
              minHeight: '100%',
              overflow: 'visible',
              whiteSpace: 'pre',
              wordBreak: 'normal',
            }}
          >
            <code
              className="hljs"
              dangerouslySetInnerHTML={{ __html: highlighted }}
              style={{ background: 'transparent', overflow: 'visible', padding: 0 }}
            />
          </pre>
        </div>
      </div>
    );
  };

  return (
    <Layout backgroundVariant="market">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        {/* Page header */}
        <div className="flex-shrink-0">
          <nav
            aria-label={t('back')}
            className="mb-4 flex h-9 min-w-0 items-center gap-3 px-1 text-sm"
          >
            <button
              className="font-medium text-[#778190] transition-colors hover:text-[#4B5668] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colorPrimary/20"
              onClick={() => navigate('/workers')}
              type="button"
            >
              {tHeader('tabs.workers')}
            </button>
            <span aria-hidden="true" className="text-[#A3ABB7]">
              /
            </span>
            <span className="min-w-0 truncate font-medium text-[#303A4A]">{name}</span>
          </nav>

          <div className="border-b border-[#E2E6ED] px-1 pb-4 pt-1">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#F1F3F7]">
                    <ProductIconRenderer
                      className="h-full w-full object-cover"
                      iconType={getIconString(data.icon, name)}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-semibold leading-tight text-[#303A4A]">{name}</h1>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#778190]">
                      {headerMetaItems.map((item, index) => (
                        <span className="min-w-0 truncate" key={`${item}-${index}`}>
                          {item}
                        </span>
                      ))}
                      <span className="inline-flex flex-shrink-0 items-center gap-1.5">
                        <DownloadOutlined className="text-xs text-gray-400" />
                        <span className="tabular-nums">{workerDownloadCount.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {description && (
                <MarkdownRender content={description} variant="product-description" />
              )}

              {workerTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {workerTags.map((tag) => (
                    <span
                      className="inline-flex min-h-6 items-center rounded-[6px] bg-[#F1F0F8] px-2 text-xs font-semibold text-[#566176]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col gap-5 xl:flex-row">
          {/* Left: file viewer with Overview / File tabs */}
          <div className="min-w-0 flex-1">
            <ProductDetailTabs
              activeKey={activeTab}
              appearance="worker"
              cardClassName="flex flex-col"
              fillHeight
              items={[
                {
                  children: (
                    <ProductOverview
                      appearance="market"
                      className="h-[calc(100dvh-280px)] min-h-[520px] max-h-[760px]"
                      content={overviewContent}
                      emptyText={t('noAgentsMd')}
                      loading={overviewLoading}
                      showFrontmatterTable
                    />
                  ),
                  key: 'overview',
                  label: (
                    <ProductDetailTabLabel icon={<FileTextOutlined />}>
                      {t('overviewTab')}
                    </ProductDetailTabLabel>
                  ),
                },
                {
                  children: (
                    <div className="flex h-[calc(100dvh-280px)] min-h-[520px] max-h-[760px] overflow-hidden rounded-[10px] border border-[#E8EEF6]">
                      {/* File tree */}
                      <div
                        className="scrollbar-thin-soft flex-shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain border-r border-[#E8EEF6] bg-[#FBFCFE] p-2"
                        style={{ width: treeWidth }}
                      >
                        {hasFiles ? (
                          <SkillFileTree
                            nodes={fileTree as unknown as SkillFileTreeNode[]}
                            onSelect={handleSelectFile}
                            selectedPath={selectedFilePath}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-400">
                            {t('noFiles')}
                          </div>
                        )}
                      </div>
                      {/* Drag handle */}
                      <div
                        aria-hidden="true"
                        aria-orientation="vertical"
                        className="w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-colorPrimary/20"
                        onMouseDown={handleDragStart}
                        role="separator"
                      />
                      {/* File preview */}
                      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        {renderFilePreview()}
                      </div>
                    </div>
                  ),
                  key: 'file',
                  label: (
                    <ProductDetailTabLabel icon={<FolderOpenOutlined />}>
                      {t('fileTab')}
                    </ProductDetailTabLabel>
                  ),
                },
              ]}
              onChange={handleTabChange}
              style={{ height: 'calc(100vh - 280px)', minHeight: 520 }}
            />
          </div>

          {/* Right sidebar: download card */}
          <div className="order-1 w-full flex-shrink-0 xl:order-2 xl:sticky xl:top-24 xl:w-[390px] xl:self-start">
            <div className="overflow-hidden rounded-[12px] border border-[#E0E5ED] bg-white/70 backdrop-blur-xl">
              {/* Card header: title + version selector */}
              <div className="border-b border-[#E6EAF0] bg-white/35 p-3">
                <div className="mb-1.5 text-xs font-semibold text-gray-500">{t('version')}</div>
                <div className="flex items-center gap-2">
                  <Select
                    className="h-8 min-w-0 flex-1 [&_.ant-select-selection-item]:!leading-8 [&_.ant-select-selection-placeholder]:!leading-8 [&_.ant-select-selection-search-input]:!h-8 [&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!rounded-[9px] [&_.ant-select-selector]:!border-[#DDE5F0]"
                    disabled={versions.length === 0}
                    onChange={handleVersionChange}
                    options={versions.map((v) => ({
                      label: (
                        <div className="flex items-center gap-1.5">
                          <span>{v.version}</span>
                          {v.version === latestVersion && (
                            <Tag className="!m-0 !text-xs !px-1.5 !py-0 !leading-5" color="blue">
                              latest
                            </Tag>
                          )}
                        </div>
                      ),
                      value: v.version,
                    }))}
                    placeholder={t('noVersion')}
                    size="middle"
                    value={selectedVersion}
                  />
                  <Tooltip color="#111827" title={t('downloadWorkerPackage')}>
                    <Button
                      aria-label={t('downloadWorkerPackage')}
                      className="!h-8 !rounded-[9px] !border-[#DDE5F0] !px-2.5 !text-xs !font-medium !text-gray-600 hover:!border-colorPrimary/40 hover:!text-colorPrimary"
                      disabled={versions.length === 0}
                      icon={<DownloadOutlined />}
                      onClick={handleDownload}
                    >
                      {t('downloadPackage')}
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* AgentTeams install */}
              {cliInfo && (
                <div className="border-b border-[#E8EEF6] px-4 py-3">
                  <div className="mb-3 flex items-center gap-1.5">
                    <CloudUploadOutlined className="text-[13px] text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">
                      {t('installToHiClaw')}
                    </span>
                  </div>

                  {/* 安装方式切换 Tab */}
                  <div className="mb-3 flex rounded-[10px] border border-[#E8EDF5] bg-[#F7F9FC] p-1">
                    <button
                      className={`flex-1 rounded-[8px] py-2 text-xs font-medium transition-all ${
                        installMethod === 'nl'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setInstallMethod('nl')}
                      type="button"
                    >
                      {t('naturalLanguage')}
                    </button>
                    <button
                      className={`flex-1 rounded-[8px] py-2 text-xs font-medium transition-all ${
                        installMethod === 'script'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                      onClick={() => setInstallMethod('script')}
                      type="button"
                    >
                      {t('scriptCommand')}
                    </button>
                  </div>

                  {/* 自然语言面板 */}
                  {installMethod === 'nl' && (
                    <div>
                      <div className="relative rounded-[12px] border border-dashed border-[#DDE5F0] bg-[#FBFCFE] py-3 pl-4 pr-10">
                        <Tooltip color="#111827" title={t('nlInstallHint')}>
                          <div className="cursor-help text-sm leading-6 text-gray-700">
                            {t('nlImportCommand', { name: cliInfo.resourceName })}
                          </div>
                        </Tooltip>
                        <Button
                          aria-label={t('copyCommand')}
                          className="absolute right-2 top-2.5 z-10 !h-6 !w-6 !min-w-6 !p-0 !text-gray-400 hover:!text-colorPrimary [&_.anticon]:!text-xs"
                          icon={
                            copiedNl ? (
                              <CheckOutlined className="text-green-500" />
                            ) : (
                              <CopyOutlined />
                            )
                          }
                          onClick={() => {
                            const text = t('nlImportCommand', { name: cliInfo.resourceName });
                            copyToClipboard(text).then(() => {
                              setCopiedNl(true);
                              setTimeout(() => setCopiedNl(false), 2000);
                            });
                          }}
                          size="small"
                          title={t('copyCommand')}
                          type="text"
                        />
                      </div>
                    </div>
                  )}

                  {/* 脚本命令面板 */}
                  {installMethod === 'script' && (
                    <div>
                      <div className="mb-2 flex gap-2">
                        <button
                          className={`rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors ${
                            hiclawPlatform === 'unix'
                              ? 'bg-colorPrimary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          onClick={() => setHiclawPlatform('unix')}
                          type="button"
                        >
                          Linux / Mac
                        </button>
                        <button
                          className={`rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors ${
                            hiclawPlatform === 'windows'
                              ? 'bg-colorPrimary text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          onClick={() => setHiclawPlatform('windows')}
                          type="button"
                        >
                          Windows
                        </button>
                      </div>
                      <div className="relative overflow-hidden rounded-[12px] border border-[#172033] bg-[#111827] py-2.5 pl-3 pr-9">
                        <Button
                          aria-label={t('copyCommand')}
                          className="absolute right-2 top-2 z-10 !h-6 !w-6 !min-w-6 !p-0 !text-gray-400 hover:!text-white [&_.anticon]:!text-xs"
                          icon={
                            copiedHiclaw ? (
                              <CheckOutlined className="text-green-400" />
                            ) : (
                              <CopyOutlined />
                            )
                          }
                          onClick={() => {
                            const version = selectedVersion || 'v1';
                            const encodedName = encodeURIComponent(cliInfo.resourceName);
                            const hostPart = cliInfo.nacosPort
                              ? `${cliInfo.nacosHost}:${cliInfo.nacosPort}`
                              : cliInfo.nacosHost;
                            const selectedVersionInfo = versions.find((v) => v.version === version);
                            const isLatest = selectedVersionInfo?.isLatest ?? false;
                            const isDefaultHost = cliInfo.nacosHost === 'market.hiclaw.io';
                            const canOmitPackage = isDefaultHost && isLatest;
                            const versionPath = isLatest ? '' : `/${version}`;
                            const packageUrl = `nacos://${hostPart}/${cliInfo.namespace}/${encodedName}${versionPath}`;
                            const packageArg = canOmitPackage ? '' : ` --package "${packageUrl}"`;
                            const cmd =
                              hiclawPlatform === 'unix'
                                ? `curl -fsSL https://higress.ai/hiclaw/import.sh | bash -s -- worker --name "${cliInfo.resourceName}"${packageArg}`
                                : `irm https://higress.ai/hiclaw/import.ps1 -OutFile import.ps1; .\\import.ps1 worker --name "${cliInfo.resourceName}"${packageArg}`;
                            copyToClipboard(cmd).then(() => {
                              setCopiedHiclaw(true);
                              setTimeout(() => setCopiedHiclaw(false), 2002);
                            });
                          }}
                          size="small"
                          title={t('copyCommand')}
                          type="text"
                        />
                        <code
                          className="break-all text-[12px] leading-5 text-gray-100"
                          style={{ fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace" }}
                        >
                          {(() => {
                            const version = selectedVersion || 'v1';
                            const encodedName = encodeURIComponent(cliInfo.resourceName);
                            const hostPart = cliInfo.nacosPort
                              ? `${cliInfo.nacosHost}:${cliInfo.nacosPort}`
                              : cliInfo.nacosHost;
                            const selectedVersionInfo = versions.find((v) => v.version === version);
                            const isLatest = selectedVersionInfo?.isLatest ?? false;
                            const isDefaultHost = cliInfo.nacosHost === 'market.hiclaw.io';
                            const canOmitPackage = isDefaultHost && isLatest;
                            const versionPath = isLatest ? '' : `/${version}`;
                            const packageUrl = `nacos://${hostPart}/${cliInfo.namespace}/${encodedName}${versionPath}`;
                            const packageArg = canOmitPackage ? '' : ` --package "${packageUrl}"`;
                            return hiclawPlatform === 'unix'
                              ? `curl -fsSL https://higress.ai/hiclaw/import.sh | bash -s -- worker --name "${cliInfo.resourceName}"${packageArg}`
                              : `irm https://higress.ai/hiclaw/import.ps1 -OutFile import.ps1; .\\import.ps1 worker --name "${cliInfo.resourceName}"${packageArg}`;
                          })()}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Nacos CLI command */}
              {cliInfo && (
                <div className="border-b border-[#E8EEF6] px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <CodeOutlined className="text-[13px] text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">{t('npxDownload')}</span>
                  </div>
                  <div className="relative overflow-hidden rounded-[12px] border border-[#172033] bg-[#111827] py-2.5 pl-3 pr-9">
                    <Button
                      aria-label={t('copyCommand')}
                      className="absolute right-2 top-2 z-10 !h-6 !w-6 !min-w-6 !p-0 !text-gray-400 hover:!text-white [&_.anticon]:!text-xs"
                      icon={
                        copiedCmd ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />
                      }
                      onClick={() => {
                        const selectedVersionInfo = versions.find(
                          (v) => v.version === selectedVersion,
                        );
                        const isLatest = selectedVersionInfo?.isLatest ?? false;
                        const cmd = buildNacosCliCommand({
                          command: 'agentspec-get',
                          resourceName: cliInfo.resourceName,
                          server: cliInfo,
                          version: isLatest ? undefined : selectedVersion,
                        });
                        copyToClipboard(cmd).then(() => {
                          setCopiedCmd(true);
                          setTimeout(() => setCopiedCmd(false), 2000);
                        });
                      }}
                      size="small"
                      title={t('copyCommand')}
                      type="text"
                    />
                    <code
                      className="break-all text-[12px] leading-5 text-gray-100"
                      style={{ fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace" }}
                    >
                      {(() => {
                        const selectedVersionInfo = versions.find(
                          (v) => v.version === selectedVersion,
                        );
                        const isLatest = selectedVersionInfo?.isLatest ?? false;
                        return buildNacosCliCommand({
                          command: 'agentspec-get',
                          resourceName: cliInfo.resourceName,
                          server: cliInfo,
                          version: isLatest ? undefined : selectedVersion,
                        });
                      })()}
                    </code>
                  </div>
                </div>
              )}

              {/* HTTP download */}
              {cliInfo && (
                <div className="px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <CloudUploadOutlined className="text-[13px] text-gray-400" />
                    <span className="text-xs font-semibold text-gray-600">{t('httpDownload')}</span>
                  </div>
                  <div className="relative overflow-hidden rounded-[12px] border border-[#172033] bg-[#111827] py-2.5 pl-3 pr-9">
                    <Button
                      aria-label={t('copyDownloadUrl')}
                      className="absolute right-2 top-2 z-10 !h-6 !w-6 !min-w-6 !p-0 !text-gray-400 hover:!text-white disabled:!opacity-50 [&_.anticon]:!text-xs"
                      disabled={!selectedVersion}
                      icon={
                        copiedHttp ? <CheckOutlined className="text-green-400" /> : <CopyOutlined />
                      }
                      onClick={() => {
                        const versionParam = selectedVersion
                          ? `?version=${encodeURIComponent(selectedVersion)}`
                          : '';
                        const url = `${window.location.origin}/api/v1/workers/${workerProductId}/download${versionParam}`;
                        copyToClipboard(url).then(() => {
                          setCopiedHttp(true);
                          setTimeout(() => setCopiedHttp(false), 2000);
                        });
                      }}
                      size="small"
                      title={t('copyDownloadUrl')}
                      type="text"
                    />
                    <code
                      className="break-all text-[12px] leading-5 text-gray-100"
                      style={{ fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace" }}
                    >
                      {(() => {
                        const versionParam = selectedVersion
                          ? `?version=${encodeURIComponent(selectedVersion)}`
                          : '';
                        return `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/workers/${workerProductId}/download${versionParam}`;
                      })()}
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default WorkerDetail;

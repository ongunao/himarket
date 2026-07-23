import {
  PlusOutlined,
  DownOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CheckOutlined,
  CloseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { message as antdMessage, Spin, Dropdown, Modal } from 'antd';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import './SessionSidebar.css';
import {
  getCodingSessions,
  deleteCodingSession,
  updateCodingSession,
  type ICodingSession,
} from '../../lib/apis/codingSession';
import { portalConfirmProps } from '../../lib/styles';

import type { MenuProps } from 'antd';

export interface SessionSidebarProps {
  activeCliSessionId: string | null;
  agentSupportsLoadSession: boolean;
  onLoadSession: (
    cliSessionId: string,
    cwd: string,
    title: string,
    platformSessionId: string,
    providerKey: string,
  ) => void;
  onNewSession: () => void;
  /** External trigger to refresh the session list (increment to trigger) */
  refreshTrigger?: number;
  /** Whether the sidebar should be collapsed by default. Changes to this prop will sync the collapsed state. */
  defaultCollapsed?: boolean;
}

interface SessionItem {
  id: string;
  sessionId: string;
  cliSessionId: string;
  title: string;
  cwd: string;
  providerKey: string;
  modelName?: string;
  timestamp: Date;
}

function toSessionItems(sessions: ICodingSession[], untitledSession: string): SessionItem[] {
  return sessions.map((s) => ({
    cliSessionId: s.cliSessionId,
    cwd: s.cwd,
    id: s.sessionId,
    modelName: s.modelName || undefined,
    providerKey: s.providerKey || '',
    sessionId: s.sessionId,
    timestamp: new Date(s.updatedAt || s.createdAt),
    title: s.title || untitledSession,
  }));
}

function categorizeByTime(sessions: SessionItem[]) {
  const now = new Date();
  const today: SessionItem[] = [];
  const last7Days: SessionItem[] = [];
  const last30Days: SessionItem[] = [];

  sessions.forEach((session) => {
    const diffInDays = Math.floor(
      (now.getTime() - session.timestamp.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 0) {
      today.push(session);
    } else if (diffInDays <= 7) {
      last7Days.push(session);
    } else if (diffInDays <= 30) {
      last30Days.push(session);
    }
  });

  return { last30Days, last7Days, today };
}

export function SessionSidebar({
  activeCliSessionId,
  agentSupportsLoadSession,
  defaultCollapsed = true,
  onLoadSession,
  onNewSession,
  refreshTrigger,
}: SessionSidebarProps) {
  const { t } = useTranslation('coding');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Sync collapsed state when the page transitions (e.g. welcome → conversation)
  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const [expandedSections, setExpandedSections] = useState({
    last30Days: false,
    last7Days: false,
    today: true,
  });
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [originalName, setOriginalName] = useState('');

  // 检测操作系统
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // 获取会话列表
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCodingSessions({ page: 1, size: 50 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = res.data as any;
      const list: ICodingSession[] = Array.isArray(data.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : [];
      setSessions(toSessionItems(list, t('sidebar.untitledSession')));
    } catch (err) {
      console.error('[SessionSidebar] Failed to fetch sessions:', err);
      antdMessage.error(t('sidebar.fetchSessionsFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  // 监听快捷键 Shift + Command/Ctrl + O
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.shiftKey &&
        (isMac ? event.metaKey : event.ctrlKey) &&
        event.key.toLowerCase() === 'o'
      ) {
        event.preventDefault();
        onNewSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMac, onNewSession]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 开始编辑会话名称
  const handleStartEdit = (sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditingName(currentName);
    setOriginalName(currentName);
  };

  // 保存会话名称
  const handleSaveEdit = async (sessionId: string) => {
    const trimmedName = editingName.trim();

    if (!trimmedName) {
      antdMessage.error(t('sidebar.sessionNameRequired'));
      return;
    }

    if (trimmedName === originalName) {
      handleCancelEdit();
      return;
    }

    try {
      const response = await updateCodingSession(sessionId, {
        title: trimmedName,
      });
      if (response.code === 'SUCCESS') {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionId ? { ...session, title: trimmedName } : session,
          ),
        );
        antdMessage.success(t('sidebar.renameSuccess'));
        setEditingSessionId(null);
        setEditingName('');
        setOriginalName('');
      } else {
        throw new Error(t('sidebar.renameFailed'));
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
      antdMessage.error(t('sidebar.renameFailed'));
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingName('');
    setOriginalName('');
  };

  // 处理键盘事件
  const handleEditKeyDown = (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(sessionId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // 删除会话
  const handleDeleteSession = (sessionId: string, sessionName: string) => {
    Modal.confirm({
      ...portalConfirmProps,
      cancelText: t('sidebar.cancel'),
      content: t('sidebar.deleteConfirm', { name: sessionName }),
      icon: <DeleteOutlined className="portal-confirm-danger-icon" />,
      okText: t('sidebar.delete'),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteCodingSession(sessionId);
          setSessions((prev) => prev.filter((session) => session.id !== sessionId));
          antdMessage.success(t('sidebar.deleteSuccess'));

          // 如果删除的是当前活跃会话，触发新建
          const deletedSession = sessions.find((s) => s.id === sessionId);
          if (deletedSession?.cliSessionId === activeCliSessionId) {
            onNewSession();
          }
        } catch (error) {
          console.error('Failed to delete session:', error);
          antdMessage.error(t('sidebar.deleteFailed'));
        }
      },
      title: t('sidebar.deleteTitle'),
    });
  };

  // 渲染会话菜单
  const getSessionMenu = (session: SessionItem): MenuProps => ({
    items: [
      {
        icon: <EditOutlined />,
        key: 'rename',
        label: t('sidebar.rename'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          handleStartEdit(session.id, session.title);
        },
      },
      {
        danger: true,
        icon: <DeleteOutlined />,
        key: 'delete',
        label: t('sidebar.delete'),
        onClick: ({ domEvent }) => {
          domEvent.stopPropagation();
          handleDeleteSession(session.id, session.title);
        },
      },
    ],
  });

  const { last30Days, last7Days, today } = categorizeByTime(sessions);

  const renderSessionGroup = (
    title: string,
    groupSessions: SessionItem[],
    sectionKey: keyof typeof expandedSections,
  ) => {
    if (groupSessions.length === 0) return null;

    return (
      <div className="mb-1">
        <button
          className="sticky top-0 z-10 flex w-full cursor-pointer items-center justify-between rounded-[8px] border-0 bg-[#F1F3F7] px-3 py-1.5 text-left text-xs font-medium text-[#737B89] transition-colors duration-200 hover:bg-[#E9EDF3]"
          onClick={() => toggleSection(sectionKey)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleSection(sectionKey);
            }
          }}
          type="button"
        >
          <span>{title}</span>
          <span
            className={`
              transition-transform duration-300 ease-in-out
              ${expandedSections[sectionKey] ? 'rotate-0' : '-rotate-90'}
            `}
          >
            <DownOutlined className="text-xs" />
          </span>
        </button>
        <div
          className={`
            overflow-auto transition-all duration-300 ease-in-out sidebar-level-1
            ${expandedSections[sectionKey] ? 'opacity-100 mt-1' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="space-y-0.5">
            {groupSessions.map((session, index) => {
              const isActive = session.cliSessionId === activeCliSessionId;
              return (
                <div
                  className={`
                    min-h-9 rounded-[8px] px-3 py-2 text-sm text-mainTitle
                    transition-colors duration-200 ease-in-out
                    ${
                      isActive
                        ? 'bg-colorPrimarySoft font-medium text-gray-900'
                        : agentSupportsLoadSession || activeCliSessionId === null
                          ? 'cursor-pointer text-gray-600 hover:bg-colorPrimarySoftHover hover:text-gray-900'
                          : 'text-gray-600 opacity-60'
                    }
                  `}
                  key={session.id}
                  style={{
                    animation: expandedSections[sectionKey]
                      ? 'slideIn 300ms ease-out forwards'
                      : 'none',
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  {editingSessionId === session.id ? (
                    /* 编辑模式 */
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <input
                        autoFocus
                        className="flex-1 max-w-[70%] px-2 py-1 text-sm border border-colorPrimary rounded focus:outline-none focus:ring-1 focus:ring-colorPrimary"
                        onBlur={() => {
                          handleCancelEdit();
                        }}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                        type="text"
                        value={editingName}
                      />
                      <button
                        className="flex-shrink-0 p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit(session.id);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        title={t('sidebar.save')}
                      >
                        <CheckOutlined className="text-sm" />
                      </button>
                      <button
                        className="flex-shrink-0 p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        title={t('sidebar.cancel')}
                      >
                        <CloseOutlined className="text-sm" />
                      </button>
                    </div>
                  ) : (
                    /* 正常模式 */
                    <button
                      className="group border-0 bg-transparent w-full text-left px-0 py-0"
                      onClick={() => {
                        if (activeCliSessionId !== null && !agentSupportsLoadSession) return;
                        onLoadSession(
                          session.cliSessionId,
                          session.cwd,
                          session.title,
                          session.sessionId,
                          session.providerKey,
                        );
                      }}
                      type="button"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate flex-1">{session.title}</span>
                        <Dropdown
                          classNames={{
                            root: 'coding-session-menu-dropdown',
                          }}
                          menu={getSessionMenu(session)}
                          placement="bottomRight"
                          popupRender={(menu) => (
                            <div className="bg-white/80 backdrop-blur-xl rounded-[10px] shadow-lg border border-white/40 overflow-hidden">
                              {menu}
                            </div>
                          )}
                          trigger={['click']}
                        >
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-colorPrimary hover:bg-gray-200 rounded transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            title={t('sidebar.moreActions')}
                          >
                            <MoreOutlined className="text-base" />
                          </button>
                        </Dropdown>
                      </div>
                      {(session.providerKey || session.modelName) && (
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">
                          {[session.providerKey, session.modelName].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ========== 收起态 ========== */
  if (collapsed) {
    return (
      <div
        className={`coding-session--sidebar mr-4 flex w-[72px] flex-shrink-0 self-start flex-col rounded-[16px] bg-[#F1F3F7] shadow-[0_10px_28px_rgba(55,68,94,0.05)] transition-all duration-300 ease-in-out ${sessions.length > 0 ? 'h-full min-h-0' : ''}`}
      >
        <div className="p-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-transparent bg-[#F5F6FA] transition-colors hover:bg-[#F0F2F7]"
            onClick={onNewSession}
            title={t('sidebar.newSession')}
            type="button"
          >
            <PlusOutlined className="text-sm" />
          </button>
        </div>
        <div className="flex-1" />
        <div className="px-4 pb-4 pt-2">
          <button
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] text-gray-600 transition-colors hover:bg-[#E3E8EF]"
            onClick={() => setCollapsed(false)}
            title={t('sidebar.expandSidebar')}
            type="button"
          >
            <MenuUnfoldOutlined />
          </button>
        </div>
      </div>
    );
  }

  /* ========== 展开态 ========== */
  return (
    <div
      className={`coding-session--sidebar mr-4 flex w-[260px] flex-shrink-0 self-start flex-col rounded-[16px] bg-[#F1F3F7] shadow-[0_10px_28px_rgba(55,68,94,0.05)] transition-all duration-300 ease-in-out ${sessions.length > 0 ? 'h-full min-h-0' : ''}`}
    >
      <div className="p-4">
        <button
          className="group flex h-10 w-full items-center justify-between overflow-hidden text-nowrap rounded-[10px] border border-transparent bg-[#F5F6FA] px-3 transition-colors duration-200 ease-in-out hover:bg-[#F0F2F7]"
          onClick={onNewSession}
          type="button"
        >
          <div className="flex items-center gap-2">
            <PlusOutlined className="text-sm" />
            <span className="text-sm font-semibold text-[#4F5A6A]">{t('sidebar.newSession')}</span>
          </div>
          <kbd className="font-sans text-[13px] leading-none text-[#8D96A5] opacity-70 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            {isMac ? '⇧⌘O' : 'Shift Ctrl O'}
          </kbd>
        </button>
      </div>

      <div className="mx-4 mb-2 h-px bg-[#D9DFE8]" />

      {/* 历史会话列表 */}
      <div
        className={`sidebar-content px-4 pb-4 ${sessions.length > 0 ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">{t('sidebar.noHistory')}</div>
        ) : (
          <>
            {renderSessionGroup(t('sidebar.today'), today, 'today')}
            {renderSessionGroup(t('sidebar.last7Days'), last7Days, 'last7Days')}
            {renderSessionGroup(t('sidebar.last30Days'), last30Days, 'last30Days')}
          </>
        )}
      </div>

      {/* 不支持会话恢复的提示 */}
      {!agentSupportsLoadSession && activeCliSessionId !== null && sessions.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-gray-400 text-center">
          {t('sidebar.restoreUnsupported')}
        </div>
      )}

      <div className="px-4 pb-4 pt-2">
        <button
          className="flex w-full items-center justify-start gap-2 overflow-hidden text-nowrap rounded-[8px] px-3 py-2 text-gray-600 transition-colors hover:bg-[#E3E8EF]"
          onClick={() => setCollapsed(true)}
          title={t('sidebar.collapseSidebar')}
          type="button"
        >
          <MenuFoldOutlined />
          <span className="text-sm">{t('sidebar.collapseSidebar')}</span>
        </button>
      </div>
    </div>
  );
}

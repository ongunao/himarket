import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Modal } from 'antd';
import { useTranslation } from 'react-i18next';

import { portalModalStyles } from '../../lib/styles';

import type { JsonRpcId, PermissionRequest } from '../../types/coding-protocol';

interface PermissionDialogProps {
  permission: { id: JsonRpcId; request: PermissionRequest };
  onRespond: (requestId: JsonRpcId, optionId: string) => void;
}

export function PermissionDialog({ onRespond, permission }: PermissionDialogProps) {
  const { t } = useTranslation('coding');
  const { id, request } = permission;
  const toolCall = request.toolCall;

  return (
    <Modal
      centered
      className="portal-modal"
      closable={false}
      footer={request.options.map((option) => (
        <Button
          key={option.optionId}
          onClick={() => onRespond(id, option.optionId)}
          type={option.kind.startsWith('allow') ? 'primary' : 'default'}
        >
          {option.name}
        </Button>
      ))}
      keyboard={false}
      mask={{ closable: false }}
      open
      styles={portalModalStyles}
      title={
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-colorPrimary" />
          {t('permission.title')}
        </span>
      }
      width={460}
    >
      <div className="space-y-3">
        {toolCall.title && (
          <div className="text-sm font-medium leading-6 text-gray-700">{toolCall.title}</div>
        )}

        {toolCall.rawInput?.command !== undefined && toolCall.rawInput?.command !== null && (
          <div className="rounded-[8px] bg-[#F6F7FA] px-3 py-2.5">
            <div className="mb-1 text-xs font-medium text-gray-500">{t('permission.command')}</div>
            <code className="block max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-gray-700">
              {String(toolCall.rawInput.command)}
            </code>
          </div>
        )}

        {toolCall.rawInput?.description !== undefined &&
          toolCall.rawInput?.description !== null && (
            <div className="text-sm leading-6 text-gray-500">
              {String(toolCall.rawInput.description)}
            </div>
          )}
      </div>
    </Modal>
  );
}

import type { ModalFuncProps, ModalProps } from 'antd';

export const portalModalStyles: ModalProps['styles'] = {
  container: {
    background: 'rgba(255, 255, 255, 0.98)',
    border: '1px solid rgba(218, 223, 232, 0.9)',
    borderRadius: '12px',
    boxShadow: '0 20px 52px rgba(49, 57, 78, 0.15)',
    overflow: 'hidden',
    padding: 0,
  },
  mask: {
    backdropFilter: 'blur(2px)',
    background: 'rgba(43, 48, 63, 0.3)',
  },
};

export const portalConfirmProps: ModalFuncProps = {
  centered: true,
  className: 'portal-confirm',
  focusable: { autoFocusButton: 'cancel' },
  styles: {
    ...portalModalStyles,
    body: {
      padding: '22px 24px 20px',
    },
  },
  width: 420,
};

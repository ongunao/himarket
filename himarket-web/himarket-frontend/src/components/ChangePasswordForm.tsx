import { KeyOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChangePasswordFormValues {
  confirmPassword: string;
  newPassword: string;
  oldPassword: string;
}

interface ChangePasswordFormProps {
  loading?: boolean;
  onSubmit: (values: { newPassword: string; oldPassword: string }) => Promise<void> | void;
}

export function ChangePasswordForm({ loading = false, onSubmit }: ChangePasswordFormProps) {
  const { t } = useTranslation('profile');
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [editing, setEditing] = useState(false);
  const oldPassword = Form.useWatch('oldPassword', form);
  const newPassword = Form.useWatch('newPassword', form);
  const confirmPassword = Form.useWatch('confirmPassword', form);

  const canSubmit =
    !!oldPassword &&
    !!newPassword &&
    !!confirmPassword &&
    newPassword.length >= 6 &&
    newPassword.length <= 32 &&
    newPassword === confirmPassword;

  const handleFinish = async (values: ChangePasswordFormValues) => {
    await onSubmit({
      newPassword: values.newPassword,
      oldPassword: values.oldPassword,
    });
    form.resetFields();
    setEditing(false);
  };

  const handleCancel = () => {
    form.resetFields();
    setEditing(false);
  };

  return (
    <section className="mt-5">
      <div className="flex min-h-16 flex-col gap-3 rounded-[10px] border border-[#E1E3EB] bg-white/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium text-[#4D5565]">{t('passwordPanelTitle')}</div>
        {!editing && (
          <Button
            className="h-9 w-fit rounded-[8px] border-0 px-3.5 text-sm font-medium shadow-none transition-transform active:scale-[0.98]"
            onClick={() => setEditing(true)}
            type="primary"
          >
            {t('changePassword')}
          </Button>
        )}
      </div>

      {editing && (
        <div className="mt-4 rounded-[10px] border border-[#E1E3EB] bg-white/25 p-4 sm:p-5">
          <Form
            className="max-w-[460px] [&_.ant-form-item]:!mb-3"
            form={form}
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item
              name="oldPassword"
              rules={[{ message: t('currentPasswordRequired'), required: true }]}
            >
              <Input.Password
                autoComplete="current-password"
                className="h-10 rounded-[8px] border-[#E0E2EA] bg-white/70"
                placeholder={t('currentPassword')}
                prefix={<LockOutlined className="text-[#949BA8]" />}
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              rules={[
                { message: t('newPasswordRequired'), required: true },
                { message: t('passwordMinLength'), min: 6 },
                { max: 32, message: t('passwordMaxLength') },
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                className="h-10 rounded-[8px] border-[#E0E2EA] bg-white/70"
                placeholder={t('newPassword')}
                prefix={<KeyOutlined className="text-[#949BA8]" />}
              />
            </Form.Item>

            <Form.Item
              className="!mb-1"
              dependencies={['newPassword']}
              name="confirmPassword"
              rules={[
                { message: t('confirmPasswordRequired'), required: true },
                ({ getFieldValue }) => ({
                  validator(_, value: string | undefined) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                autoComplete="new-password"
                className="h-10 rounded-[8px] border-[#E0E2EA] bg-white/70"
                placeholder={t('confirmPassword')}
                prefix={<SafetyCertificateOutlined className="text-[#949BA8]" />}
              />
            </Form.Item>
            <div className="mb-3 text-xs text-[#858C9B]">{t('passwordReloginHint')}</div>

            <div className="flex justify-start gap-2 pt-2">
              <Button
                className="h-9 min-w-20 rounded-[8px] px-3 shadow-none transition-transform active:scale-[0.98]"
                disabled={!canSubmit || loading}
                htmlType="submit"
                loading={loading}
                type="primary"
              >
                {t('savePassword')}
              </Button>
              <Button
                className="h-9 min-w-20 rounded-[8px] border-[#E0E2EA] bg-white/55 px-3 text-[#626B7C] shadow-none"
                disabled={loading}
                onClick={handleCancel}
              >
                {t('cancelChangePassword')}
              </Button>
            </div>
          </Form>
        </div>
      )}
    </section>
  );
}

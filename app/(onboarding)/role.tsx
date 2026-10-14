import { PlaceholderScreen } from '@/design/components/PlaceholderScreen';
import { useLanguage } from '@/i18n';
import { useSettings } from '@/store/settings';
import React from 'react';

export default function RoleRoute(): React.ReactElement {
  const { t } = useLanguage();
  const setRole = useSettings((s) => s.setRole);
  return (
    <PlaceholderScreen
      name="(onboarding)/role"
      actions={[
        {
          label: t('onboarding.role_elder'),
          onPress: () => {
            void setRole('elder');
          },
        },
        {
          label: t('onboarding.role_caregiver'),
          onPress: () => {
            void setRole('caregiver');
          },
        },
      ]}
    />
  );
}

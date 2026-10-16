import { PlaceholderScreen } from '@/design/components/PlaceholderScreen';
import { useLanguage } from '@/i18n';
import { useSession } from '@/store/session';
import React from 'react';

// Stub: creating an account only sets a saved flag. Prompt 6.2 adds the real form and Supabase.
// No navigation here: once the flag is set, the gate moves the user to their home screen.
export default function AccountRoute(): React.ReactElement {
  const { t } = useLanguage();
  const setHasSession = useSession((s) => s.setHasSession);
  return (
    <PlaceholderScreen
      name="(onboarding)/account"
      actions={[
        {
          label: t('ui.create_account'),
          onPress: () => {
            void setHasSession(true);
          },
        },
      ]}
    />
  );
}

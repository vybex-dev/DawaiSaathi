import { PlaceholderScreen } from '@/design/components/PlaceholderScreen';
import { useSettings } from '@/store/settings';
import React from 'react';

export default function LanguageRoute(): React.ReactElement {
  const setLanguage = useSettings((s) => s.setLanguage);
  return (
    <PlaceholderScreen
      name="(onboarding)/language"
      actions={[
        {
          label: 'English',
          onPress: () => {
            void setLanguage('en');
          },
        },
        {
          label: 'हिन्दी',
          onPress: () => {
            void setLanguage('hi');
          },
        },
      ]}
    />
  );
}

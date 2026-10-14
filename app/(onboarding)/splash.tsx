import { PlaceholderScreen } from '@/design/components/PlaceholderScreen';
import { useLanguage } from '@/i18n';
import { useSession } from '@/store/session';
import React, { useEffect } from 'react';

export default function SplashRoute(): React.ReactElement {
  const markSplashDone = useSession((s) => s.markSplashDone);
  const { t } = useLanguage();

  useEffect(() => {
    const id = setTimeout(markSplashDone, 1000);
    return () => clearTimeout(id);
  }, [markSplashDone]);

  return (
    <PlaceholderScreen
      name="(onboarding)/splash"
      actions={[{ label: t('ui.continue'), onPress: markSplashDone }]}
    />
  );
}

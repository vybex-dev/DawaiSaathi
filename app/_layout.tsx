import { createSettingsRepo, ensureSettingsTable } from '@/data/settingsRepo';
import { AppErrorBoundary } from '@/design/components/AppErrorBoundary';
import { isOnboardingTarget, useGate, useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import React, { Suspense, useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const DATABASE_NAME = 'dawai.db';

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('load_failed');
}

function RootNavigator(): React.ReactElement {
  const { target } = useGate();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={isOnboardingTarget(target)}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={target === 'elder'}>
        <Stack.Screen name="(elder)" />
      </Stack.Protected>
      <Stack.Protected guard={target === 'caregiver'}>
        <Stack.Screen name="(caregiver)" />
      </Stack.Protected>
    </Stack>
  );
}

function Bootstrap(): React.ReactElement | null {
  const db = useSQLiteContext();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });
  const [loadError, setLoadError] = useState<Error | null>(null);
  const { ready } = useGate();

  useEffect(() => {
    let cancelled = false;
    const repo = createSettingsRepo(db);
    repo
      .readRows()
      .then((rows) => {
        if (cancelled) {
          return;
        }
        useSettings.getState().hydrateFrom(rows, repo);
        useSession.getState().hydrateFrom(rows, repo);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(toError(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const appReady = fontsLoaded && ready;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [appReady]);

  const fatal = fontError ?? loadError;
  if (fatal) {
    throw fatal;
  }
  if (!appReady) {
    return null;
  }
  return <RootNavigator />;
}

export default function RootLayout(): React.ReactElement {
  const [attempt, setAttempt] = useState(0);
  return (
    <AppErrorBoundary key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
      <Suspense fallback={null}>
        <SQLiteProvider
          databaseName={DATABASE_NAME}
          assetSource={{ assetId: require('../assets/catalog.db') }}
          onInit={ensureSettingsTable}
          useSuspense
        >
          <Bootstrap />
        </SQLiteProvider>
      </Suspense>
    </AppErrorBoundary>
  );
}

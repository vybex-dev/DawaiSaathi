import { isOnboardingTarget, useGate } from '@/store/session';
import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout(): React.ReactElement | null {
  const { target, splashDone } = useGate();
  // The root layout removes this group the moment onboarding completes; render nothing meanwhile.
  if (!isOnboardingTarget(target)) {
    return null;
  }
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', gestureEnabled: false }}>
      <Stack.Protected guard={!splashDone}>
        <Stack.Screen name="splash" />
      </Stack.Protected>
      <Stack.Protected guard={splashDone && target === 'language'}>
        <Stack.Screen name="language" />
      </Stack.Protected>
      <Stack.Protected guard={splashDone && target === 'role'}>
        <Stack.Screen name="role" />
      </Stack.Protected>
      <Stack.Protected guard={splashDone && target === 'account'}>
        <Stack.Screen name="account" />
      </Stack.Protected>
    </Stack>
  );
}

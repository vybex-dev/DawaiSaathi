import { Stack } from 'expo-router';
import React from 'react';

export default function ElderLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}

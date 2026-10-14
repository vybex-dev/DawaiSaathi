import { Stack } from 'expo-router';
import React from 'react';

export default function CaregiverLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}

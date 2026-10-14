// Throwaway root layout for Phase 1.1. Prompt 1.2 replaces it with the real
// shell (fonts, database provider, error boundary, onboarding gate).
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

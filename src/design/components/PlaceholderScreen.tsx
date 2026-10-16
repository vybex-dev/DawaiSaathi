import type { Language } from '@/data/settingsRepo';
import { useLanguage } from '@/i18n';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DevControls } from './DevControls';

// Temporary: colours and sizes are hard-coded here and replaced by tokens in Prompt 5.1.
// Delete this file once real screens exist.

type Weight = 'regular' | 'semibold' | 'bold';

const FONTS: Record<Language, Record<Weight, string>> = {
  en: { regular: 'Inter_400Regular', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' },
  hi: {
    regular: 'NotoSansDevanagari_400Regular',
    semibold: 'NotoSansDevanagari_600SemiBold',
    bold: 'NotoSansDevanagari_700Bold',
  },
};

export interface PlaceholderAction {
  label: string;
  onPress: () => void;
}

interface PlaceholderScreenProps {
  name: string;
  next?: Href;
  actions?: readonly PlaceholderAction[];
  showDevTools?: boolean;
}

export function PlaceholderScreen({
  name,
  next,
  actions,
  showDevTools = false,
}: PlaceholderScreenProps): React.ReactElement {
  const router = useRouter();
  const { language, t } = useLanguage();
  const font = FONTS[language];

  const resolved: readonly PlaceholderAction[] =
    actions ??
    (next !== undefined ? [{ label: t('ui.continue'), onPress: () => router.navigate(next) }] : []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={[styles.caption, { fontFamily: font.regular }]}>{t('app.name')}</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { fontFamily: font.bold }, language === 'hi' && styles.titleHi]}
        >
          {name}
        </Text>
        {showDevTools ? <DevControls /> : null}
      </View>
      <View style={styles.footer}>
        {resolved.map((action, index) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.button,
              index === 0 ? styles.primary : styles.secondary,
              pressed && (index === 0 ? styles.primaryPressed : styles.secondaryPressed),
            ]}
          >
            <Text
              style={[
                styles.buttonLabel,
                { fontFamily: font.semibold },
                index === 0 ? styles.primaryLabel : styles.secondaryLabel,
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF7' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  caption: { fontSize: 15, lineHeight: 22, color: '#5C5C5C' },
  title: { fontSize: 28, lineHeight: 36, color: '#1A1A1A', marginTop: 8 },
  titleHi: { lineHeight: 40 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  button: {
    minHeight: 60,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  primary: { backgroundColor: '#0F6E6A' },
  primaryPressed: { backgroundColor: '#0B5754' },
  secondary: { borderWidth: 1, borderColor: '#5C5C5C', backgroundColor: '#FFFFFF' },
  secondaryPressed: { backgroundColor: '#F0F0EB' },
  buttonLabel: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  primaryLabel: { color: '#FFFFFF' },
  secondaryLabel: { color: '#1A1A1A' },
});

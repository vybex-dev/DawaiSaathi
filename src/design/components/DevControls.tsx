import type { Language } from '@/data/settingsRepo';
import { useLanguage } from '@/i18n';
import { resetForDev } from '@/store/session';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Development-only helpers so a fresh install can be re-tested in seconds. Renders nothing in release. */
export function DevControls(): React.ReactElement | null {
  const { language, setLanguage } = useLanguage();
  if (!__DEV__) {
    return null;
  }
  const next: Language = language === 'en' ? 'hi' : 'en';
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dev: switch language to ${next}`}
        onPress={() => {
          void setLanguage(next);
        }}
        style={styles.button}
      >
        <Text style={styles.label}>{`Dev: language → ${next}`}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dev: reset onboarding"
        onPress={() => {
          void resetForDev();
        }}
        style={styles.button}
      >
        <Text style={styles.label}>Dev: reset onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, marginTop: 24 },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#5C5C5C',
    borderStyle: 'dashed',
    borderRadius: 16,
  },
  label: { fontSize: 15, lineHeight: 22, color: '#1A1A1A' },
});

import { wipeUserData } from '@/data/db';
import { createSettingsRepo, type Language } from '@/data/settingsRepo';
import { useRepositories } from '@/hooks/useRepositories';
import { useLanguage } from '@/i18n';
import { resetForDev } from '@/store/session';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

/** Dev-only database check: counts, add a fake medicine, wipe user data. No real data involved. */
function DbDebug(): React.ReactElement {
  const db = useSQLiteContext();
  const repos = useRepositories();
  const [summary, setSummary] = useState('DB: reading…');

  const readSummary = useCallback(async (): Promise<string> => {
    const [medicines, scanCache, catalog, settings] = await Promise.all([
      repos.medicines.count(),
      repos.scanCache.count(),
      repos.catalog.count(),
      createSettingsRepo(db).readRows(),
    ]);
    return `medicines ${medicines} · scan cache ${scanCache} · settings ${settings.length} · catalogue ${catalog}`;
  }, [db, repos]);

  const refresh = useCallback(async () => {
    try {
      setSummary(`DB: ${await readSummary()}`);
    } catch {
      setSummary('DB: could not read counts');
    }
  }, [readSummary]);

  useEffect(() => {
    let cancelled = false;
    readSummary()
      .then((text) => {
        if (!cancelled) {
          setSummary(`DB: ${text}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary('DB: could not read counts');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readSummary]);

  const addTestMedicine = async (): Promise<void> => {
    try {
      await repos.medicines.add({
        brand: 'Dev test medicine',
        ingredients: [{ name: 'paracetamol', strength: '500 mg' }],
        strength: '500 mg',
        form: 'tablet',
        confidence: 1,
        confirmed: true,
      });
    } catch {
      console.warn('dev_add_failed');
    }
    await refresh();
  };

  const wipe = async (): Promise<void> => {
    try {
      await wipeUserData(db);
      Alert.alert('Dev: user data wiped', await readSummary());
      // Put the in-memory stores back in step with the emptied tables. Sends you to onboarding.
      await resetForDev();
    } catch {
      console.warn('dev_wipe_failed');
    }
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{summary}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dev: add test medicine"
        onPress={() => {
          void addTestMedicine();
        }}
        style={styles.button}
      >
        <Text style={styles.label}>Dev: add test medicine</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dev: wipe user data"
        onPress={() => {
          void wipe();
        }}
        style={styles.button}
      >
        <Text style={styles.label}>Dev: wipe user data</Text>
      </Pressable>
    </View>
  );
}

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
      <DbDebug />
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

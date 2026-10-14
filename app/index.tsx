// Throwaway placeholder for Phase 1.1 so the development build shows something.
// The wording is hard-coded only because the i18n layer arrives in Prompt 1.2.
import { StyleSheet, Text, View } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Dawai Saathi
      </Text>
      <Text style={styles.body}>Skeleton is running.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FAFAF7',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  body: { fontSize: 18, color: '#1A1A1A' },
});

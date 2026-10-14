import { useLanguage } from '@/i18n';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface FallbackProps {
  onRetry: () => void;
}

function ErrorFallback({ onRetry }: FallbackProps): React.ReactElement {
  const { t } = useLanguage();
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{t('ui.error_generic')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.retry')}
        onPress={onRetry}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>{t('ui.retry')}</Text>
      </Pressable>
    </View>
  );
}

interface Props {
  children: React.ReactNode;
  onRetry: () => void;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Name only: never log messages or content.
    console.error(`app_error_boundary:${error.name}`);
    SplashScreen.hideAsync().catch(() => undefined);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return <ErrorFallback onRetry={this.props.onRetry} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF7',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  message: { fontSize: 22, lineHeight: 32, color: '#1A1A1A' },
  button: {
    minHeight: 60,
    borderRadius: 28,
    backgroundColor: '#0F6E6A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  buttonLabel: { fontSize: 20, lineHeight: 28, color: '#FFFFFF', fontWeight: '600' },
});

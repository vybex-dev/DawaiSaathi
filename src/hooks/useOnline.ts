import { useNetworkState } from 'expo-network';
import { isOnline } from './online';

export function useOnline(): boolean {
  return isOnline(useNetworkState());
}

import { isOnline } from '@/hooks/online';

describe('isOnline', () => {
  it('is true when connected and reachable', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('is false when not connected', () => {
    expect(isOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
  });

  it('is false when connected but the internet is unreachable', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('treats unknown state as online', () => {
    expect(isOnline({})).toBe(true);
  });
});

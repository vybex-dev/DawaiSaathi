export interface NetworkLike {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

/** Pure. Unknown (undefined) counts as online so the offline label never flashes at start. */
export function isOnline(state: NetworkLike): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

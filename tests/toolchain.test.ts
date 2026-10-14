// Sample test: proves Jest, TypeScript and the "@/" alias work together.
import { parseEnv } from '@/config/env';

describe('toolchain', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves the @/ alias to src/', () => {
    expect(typeof parseEnv).toBe('function');
  });
});

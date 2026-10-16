import { createRepositories, type Repositories } from '@/data/repositories';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

/** Repositories bound to the app's single database. Screens use this, never raw SQL. */
export function useRepositories(): Repositories {
  const db = useSQLiteContext();
  return useMemo(() => createRepositories(db), [db]);
}

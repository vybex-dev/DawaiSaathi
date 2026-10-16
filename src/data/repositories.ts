import { createCatalogRepo, type CatalogRepo } from '@/data/catalogRepo';
import type { Db } from '@/data/db';
import { createMedicinesRepo, type MedicinesRepo } from '@/data/medicinesRepo';
import { createScanCacheRepo, type ScanCacheRepo } from '@/data/scanCacheRepo';

export interface Repositories {
  medicines: MedicinesRepo;
  scanCache: ScanCacheRepo;
  catalog: CatalogRepo;
}

/** One place that wires the repositories to a database. Settings has its own repo (settingsRepo.ts). */
export function createRepositories(db: Db): Repositories {
  return {
    medicines: createMedicinesRepo(db),
    scanCache: createScanCacheRepo(db),
    catalog: createCatalogRepo(db),
  };
}

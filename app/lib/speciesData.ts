/**
 * Species list bundled at build time — avoids dev-server fetch hangs on /data/*.json.
 */
import speciesJson from '@/public/data/species/species.json';

export type SpeciesJsonRow = {
  taxa: string;
  id: number;
  commonName?: string;
  genusSpecies?: string;
  scientificName?: string;
  family?: string;
  status?: string;
  iucn?: string;
  iucnGlobal?: string;
  endemism?: string;
  albertineRiftEndemic?: string;
  origin?: string;
};

export type SpeciesBundle = {
  total: number;
  species: SpeciesJsonRow[];
};

export function loadSpeciesFromBundle(): SpeciesBundle {
  return speciesJson as SpeciesBundle;
}

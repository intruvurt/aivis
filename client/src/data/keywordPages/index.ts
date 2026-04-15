import type { KeywordPage, KeywordCluster } from "./types";
import { CLUSTER_META } from "./types";
import { platformPages } from "./platforms";
import { problemPages } from "./problems";
import { problemExtendedPages } from "./problemsExtended";
import { signalPages } from "./signals";
import { industryPages } from "./industries";
import { comparePages } from "./compare";
import { problemRawPages } from "./problemsRaw";

/** Every keyword page across all clusters (145 total). */
export const ALL_KEYWORD_PAGES: KeywordPage[] = [
  ...platformPages,
  ...problemPages,
  ...problemExtendedPages,
  ...problemRawPages,
  ...signalPages,
  ...industryPages,
  ...comparePages,
];

const slugIndex = new Map<string, KeywordPage>();
const clusterIndex = new Map<KeywordCluster, KeywordPage[]>();

for (const page of ALL_KEYWORD_PAGES) {
  const key = `${page.cluster}/${page.slug}`;
  slugIndex.set(key, page);

  let list = clusterIndex.get(page.cluster);
  if (!list) {
    list = [];
    clusterIndex.set(page.cluster, list);
  }
  list.push(page);
}

/** Retrieve a single page by cluster + slug.  O(1). */
export function getPageBySlug(
  cluster: KeywordCluster,
  slug: string,
): KeywordPage | undefined {
  return slugIndex.get(`${cluster}/${slug}`);
}

/** All pages belonging to one cluster. */
export function getPagesByCluster(cluster: KeywordCluster): KeywordPage[] {
  return clusterIndex.get(cluster) ?? [];
}

/** Flat list of every slug string (no cluster prefix). */
export function getAllSlugs(): string[] {
  return ALL_KEYWORD_PAGES.map((p) => p.slug);
}

/** Re-export helpers the template needs. */
export { CLUSTER_META };
export type { KeywordPage, KeywordCluster };

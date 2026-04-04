export interface SearchLocaleProfile {
  region: string;
  language: string;
  ddgRegion: string;
  bingMarket: string;
  bingLanguage: string;
  braveCountry: string;
  wikipediaLanguage: string;
}

const DEFAULT_LOCALE: SearchLocaleProfile = {
  region: 'us',
  language: 'en',
  ddgRegion: 'wt-wt',
  bingMarket: 'en-US',
  bingLanguage: 'en-US',
  braveCountry: 'US',
  wikipediaLanguage: 'en',
};

const HOST_SUFFIX_LOCALES: Array<{ suffixes: string[]; locale: SearchLocaleProfile }> = [
  {
    suffixes: ['co.uk', 'uk'],
    locale: { region: 'uk', language: 'en', ddgRegion: 'uk-en', bingMarket: 'en-GB', bingLanguage: 'en-GB', braveCountry: 'GB', wikipediaLanguage: 'en' },
  },
  {
    suffixes: ['com.au', 'au'],
    locale: { region: 'au', language: 'en', ddgRegion: 'au-en', bingMarket: 'en-AU', bingLanguage: 'en-AU', braveCountry: 'AU', wikipediaLanguage: 'en' },
  },
  {
    suffixes: ['ca'],
    locale: { region: 'ca', language: 'en', ddgRegion: 'ca-en', bingMarket: 'en-CA', bingLanguage: 'en-CA', braveCountry: 'CA', wikipediaLanguage: 'en' },
  },
  {
    suffixes: ['de'],
    locale: { region: 'de', language: 'de', ddgRegion: 'de-de', bingMarket: 'de-DE', bingLanguage: 'de-DE', braveCountry: 'DE', wikipediaLanguage: 'de' },
  },
  {
    suffixes: ['fr'],
    locale: { region: 'fr', language: 'fr', ddgRegion: 'fr-fr', bingMarket: 'fr-FR', bingLanguage: 'fr-FR', braveCountry: 'FR', wikipediaLanguage: 'fr' },
  },
  {
    suffixes: ['es'],
    locale: { region: 'es', language: 'es', ddgRegion: 'es-es', bingMarket: 'es-ES', bingLanguage: 'es-ES', braveCountry: 'ES', wikipediaLanguage: 'es' },
  },
  {
    suffixes: ['com.br', 'br'],
    locale: { region: 'br', language: 'pt', ddgRegion: 'br-pt', bingMarket: 'pt-BR', bingLanguage: 'pt-BR', braveCountry: 'BR', wikipediaLanguage: 'pt' },
  },
  {
    suffixes: ['pt'],
    locale: { region: 'pt', language: 'pt', ddgRegion: 'pt-pt', bingMarket: 'pt-PT', bingLanguage: 'pt-PT', braveCountry: 'PT', wikipediaLanguage: 'pt' },
  },
  {
    suffixes: ['it'],
    locale: { region: 'it', language: 'it', ddgRegion: 'it-it', bingMarket: 'it-IT', bingLanguage: 'it-IT', braveCountry: 'IT', wikipediaLanguage: 'it' },
  },
  {
    suffixes: ['nl'],
    locale: { region: 'nl', language: 'nl', ddgRegion: 'nl-nl', bingMarket: 'nl-NL', bingLanguage: 'nl-NL', braveCountry: 'NL', wikipediaLanguage: 'nl' },
  },
  {
    suffixes: ['co.jp', 'jp'],
    locale: { region: 'jp', language: 'ja', ddgRegion: 'jp-jp', bingMarket: 'ja-JP', bingLanguage: 'ja-JP', braveCountry: 'JP', wikipediaLanguage: 'ja' },
  },
  {
    suffixes: ['in'],
    locale: { region: 'in', language: 'en', ddgRegion: 'in-en', bingMarket: 'en-IN', bingLanguage: 'en-IN', braveCountry: 'IN', wikipediaLanguage: 'en' },
  },
  {
    suffixes: ['mx'],
    locale: { region: 'mx', language: 'es', ddgRegion: 'mx-es', bingMarket: 'es-MX', bingLanguage: 'es-MX', braveCountry: 'MX', wikipediaLanguage: 'es' },
  },
  {
    suffixes: ['com.tr', 'tr'],
    locale: { region: 'tr', language: 'tr', ddgRegion: 'tr-tr', bingMarket: 'tr-TR', bingLanguage: 'tr-TR', braveCountry: 'TR', wikipediaLanguage: 'tr' },
  },
  {
    suffixes: ['pl'],
    locale: { region: 'pl', language: 'pl', ddgRegion: 'pl-pl', bingMarket: 'pl-PL', bingLanguage: 'pl-PL', braveCountry: 'PL', wikipediaLanguage: 'pl' },
  },
  {
    suffixes: ['se'],
    locale: { region: 'se', language: 'sv', ddgRegion: 'se-sv', bingMarket: 'sv-SE', bingLanguage: 'sv-SE', braveCountry: 'SE', wikipediaLanguage: 'sv' },
  },
];

export function inferSearchLocaleProfile(targetUrl: string): SearchLocaleProfile {
  const raw = String(targetUrl || '').trim();
  if (!raw) return DEFAULT_LOCALE;

  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const matched = HOST_SUFFIX_LOCALES.find((entry) => entry.suffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)));
    return matched?.locale || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
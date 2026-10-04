export type MarketplaceLink = {
  platform: string; shop: string; url: string; productId?: string; title?: string;
  observedStatus?: string; checkedAt?: string;
};
type ListingRecord = {
  marketplaceLinks?: MarketplaceLink[]; listingUrl?: string; listingStatus?: string;
  listingPublishedDate?: string; inventoryStatus?: string; listingMatchStatus?: string;
};

export function bunjangUrl(value?: string): string {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && (url.hostname === 'bunjang.co.kr' || url.hostname.endsWith('.bunjang.co.kr')) ? url.href : '';
  } catch { return ''; }
}

export function marketplaceLinks(item: ListingRecord): MarketplaceLink[] {
  const seen = new Set<string>();
  const links = (item.marketplaceLinks || []).filter(link => {
    const url = bunjangUrl(link.url);
    if (link.platform !== '번개장터' || !url || seen.has(url)) return false;
    seen.add(url); return true;
  });
  const legacyUrl = bunjangUrl(item.listingUrl);
  if (legacyUrl && !seen.has(legacyUrl)) links.push({ platform: '번개장터', shop: '', url: legacyUrl });
  return links;
}

export function registrationState(item: ListingRecord): '등록완료' | '미등록' | '확인 필요' {
  const links = marketplaceLinks(item);
  if (links.some(link => link.observedStatus !== '판매완료') ||
      (item.inventoryStatus === '판매완료' && links.length) || item.listingStatus === '등록완료') return '등록완료';
  // The original ledger's "미등록" alone does not establish that all shops were checked.
  return item.listingMatchStatus === '미등록확정' ? '미등록' : '확인 필요';
}

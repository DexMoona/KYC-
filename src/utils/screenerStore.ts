import { Token, Chain } from '../types';

export type ScreenerSort = 'trending' | 'gainers' | 'losers' | 'volume' | 'liquidity' | 'new';

export interface ScreenerStateSnapshot {
  tokens: Token[];
  selectedChain: Chain | 'All';
  sortBy: ScreenerSort;
  search: string;
  visibleCount: number;
  scrollTop: number;
  lastFetchedAt: number;
  hasLoaded: boolean;
}

class ScreenerStore {
  private tokens: Token[] = [];
  private selectedChain: Chain | 'All' = 'All';
  private sortBy: ScreenerSort = 'trending';
  private search: string = '';
  private visibleCount: number = 50;
  private scrollTop: number = 0;
  private lastFetchedAt: number = 0;
  private hasLoaded: boolean = false;

  private cache = new Map<string, { tokens: Token[]; timestamp: number }>();
  private inFlight = new Map<string, Promise<Token[]>>();
  private listeners = new Set<() => void>();

  constructor() {
    // Eagerly pre-warm screener tokens on app initialization
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.fetchTokens({ silent: true }).catch(() => {});
      }, 500);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('[ScreenerStore] Listener error:', e);
      }
    });
  }

  public getSnapshot(): ScreenerStateSnapshot {
    return {
      tokens: this.tokens,
      selectedChain: this.selectedChain,
      sortBy: this.sortBy,
      search: this.search,
      visibleCount: this.visibleCount,
      scrollTop: this.scrollTop,
      lastFetchedAt: this.lastFetchedAt,
      hasLoaded: this.hasLoaded
    };
  }

  public getTokens(): Token[] {
    return this.tokens;
  }

  public getVisibleCount(): number {
    return this.visibleCount;
  }

  public setVisibleCount(count: number) {
    if (count !== this.visibleCount && count > 0) {
      this.visibleCount = count;
      this.notify();
    }
  }

  public getScrollTop(): number {
    return this.scrollTop;
  }

  public setScrollTop(top: number) {
    if (!isNaN(top) && top >= 0) {
      this.scrollTop = top;
    }
  }

  public getChain(): Chain | 'All' {
    return this.selectedChain;
  }

  public getSortBy(): ScreenerSort {
    return this.sortBy;
  }

  public getSearch(): string {
    return this.search;
  }

  public setFilters(chain: Chain | 'All', search: string, sort: ScreenerSort) {
    const changed = 
      this.selectedChain !== chain || 
      this.search !== search || 
      this.sortBy !== sort;

    if (changed) {
      this.selectedChain = chain;
      this.search = search;
      this.sortBy = sort;
      // Reset visibleCount only when user explicitly switches filters/search
      this.visibleCount = 50;
      this.scrollTop = 0;
      this.notify();
    }
  }

  private buildCacheKey(chain: Chain | 'All', search: string, sort: ScreenerSort): string {
    return `${chain}::${search.trim().toLowerCase()}::${sort}`;
  }

  public async fetchTokens(options?: {
    chain?: Chain | 'All';
    search?: string;
    sort?: ScreenerSort;
    force?: boolean;
    silent?: boolean;
  }): Promise<Token[]> {
    const chain = options?.chain ?? this.selectedChain;
    const search = options?.search ?? this.search;
    const sort = options?.sort ?? this.sortBy;
    const force = options?.force ?? false;
    const cacheKey = this.buildCacheKey(chain, search, sort);

    // 1. Request deduplication: reuse active in-flight request
    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    // 2. Cache hit: if fresh (< 25s) and not forced, serve immediately
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp < 25000)) {
      if (cacheKey === this.buildCacheKey(this.selectedChain, this.search, this.sortBy)) {
        if (this.tokens.length === 0) {
          this.tokens = cached.tokens;
          this.hasLoaded = true;
          this.notify();
        }
      }
      return cached.tokens;
    }

    const fetchPromise = (async () => {
      try {
        const params = new URLSearchParams();
        if (chain !== 'All') params.append('chain', chain);
        if (search.trim()) params.append('search', search.trim());
        params.append('sort', sort);

        const res = await fetch(`/api/tokens?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Server status ${res.status}`);
        }
        const data = await res.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid token list response');
        }

        // Strict real price guarantee: exclude any token without a real, positive market price
        const validTokens: Token[] = data.filter((t: any) => 
          t && 
          t.address && 
          typeof t.price === 'number' && 
          !isNaN(t.price) && 
          t.price > 0
        );

        // Deduplicate by address
        const seen = new Set<string>();
        const uniqueTokens: Token[] = [];
        for (const tok of validTokens) {
          const addr = tok.address.toLowerCase();
          if (!seen.has(addr)) {
            seen.add(addr);
            uniqueTokens.push(tok);
          }
        }

        this.cache.set(cacheKey, { tokens: uniqueTokens, timestamp: Date.now() });

        const currentKey = this.buildCacheKey(this.selectedChain, this.search, this.sortBy);
        if (cacheKey === currentKey) {
          if (this.tokens.length === 0 || force) {
            this.tokens = uniqueTokens;
          } else {
            // Smart In-Place Merge: update prices, 24h %, 1h %, volume, liquidity without replacing array references unnecessarily
            const incomingMap = new Map<string, Token>();
            uniqueTokens.forEach(t => incomingMap.set(t.address.toLowerCase(), t));

            let hasUpdates = false;
            const mergedTokens = this.tokens.map(existing => {
              const incoming = incomingMap.get(existing.address.toLowerCase());
              if (incoming) {
                if (
                  existing.price !== incoming.price ||
                  existing.priceChange24h !== incoming.priceChange24h ||
                  existing.priceChange1h !== incoming.priceChange1h ||
                  existing.volume24h !== incoming.volume24h ||
                  existing.liquidity !== incoming.liquidity ||
                  existing.mcap !== incoming.mcap
                ) {
                  hasUpdates = true;
                  return {
                    ...existing,
                    price: incoming.price,
                    priceChange1h: incoming.priceChange1h,
                    priceChange24h: incoming.priceChange24h,
                    volume24h: incoming.volume24h,
                    liquidity: incoming.liquidity,
                    mcap: incoming.mcap,
                    fdv: incoming.fdv,
                    securityScore: incoming.securityScore,
                    rugRiskScore: incoming.rugRiskScore,
                    verified: incoming.verified,
                    dexName: incoming.dexName
                  };
                }
              }
              return existing;
            });

            // Append any newly indexed tokens
            const existingAddresses = new Set(this.tokens.map(t => t.address.toLowerCase()));
            const newTokens = uniqueTokens.filter(t => !existingAddresses.has(t.address.toLowerCase()));
            if (newTokens.length > 0) {
              mergedTokens.push(...newTokens);
              hasUpdates = true;
            }

            if (hasUpdates) {
              this.tokens = mergedTokens;
            }
          }
          this.lastFetchedAt = Date.now();
          this.hasLoaded = true;
          this.notify();
        }

        return uniqueTokens;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, fetchPromise);
    return fetchPromise;
  }
}

export const screenerStore = new ScreenerStore();

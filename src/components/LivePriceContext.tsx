import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Token, Transaction } from '../types';

export type FeedState = 'connecting' | 'reconnecting' | 'live' | 'unavailable';

export interface LivePriceData {
  price: number;
  priceChange24h: number;
  flash: 'up' | 'down' | null;
  lastUpdated: number;
}

interface LivePriceContextType {
  feedState: FeedState;
  retryCount: number;
  prices: Record<string, LivePriceData>;
  subscribe: (tokenAddress: string, subscriberId: string, onTx?: (tx: Transaction) => void, initialPrice?: number, initialPriceChange24h?: number) => void;
  unsubscribe: (tokenAddress: string, subscriberId: string) => void;
  triggerTradeUpdate: (tx: Transaction) => void;
  updatePrice: (tokenAddress: string, price: number, priceChange24h?: number) => void;
}

const LivePriceContext = createContext<LivePriceContextType | null>(null);

export function useLivePriceContext() {
  const context = useContext(LivePriceContext);
  if (!context) {
    throw new Error('useLivePriceContext must be used within a LivePriceProvider');
  }
  return context;
}

interface LivePriceProviderProps {
  children: React.ReactNode;
}

export function LivePriceProvider({ children }: LivePriceProviderProps) {
  const [feedState, setFeedState] = useState<FeedState>('connecting');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [prices, setPrices] = useState<Record<string, LivePriceData>>({});

  // Subscriptions map: tokenAddress -> Set of subscriber IDs
  const subscriptionsRef = useRef<Record<string, Set<string>>>({});
  // Listeners map: tokenAddress -> Map of subscriberId -> Callback
  const listenersRef = useRef<Record<string, Map<string, (tx: Transaction) => void>>>({});
  // Ref to hold current prices state for callbacks and intervals
  const pricesRef = useRef<Record<string, LivePriceData>>({});
  const flashTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Update pricesRef whenever prices state changes
  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);

  // Handle a new trade transaction (from WS or manual injection)
  const processTransaction = React.useCallback((tx: Transaction) => {
    const address = tx.tokenAddress.toLowerCase();
    const newPrice = tx.priceUSD;

    setPrices(prev => {
      const current = prev[address];
      const oldPrice = current ? current.price : 0;
      
      // Calculate real-time 24h change if we can, otherwise use a slight drift or estimate
      let updatedChange24h = current ? current.priceChange24h : 0;
      if (oldPrice > 0 && current) {
        const startPrice24h = oldPrice / (1 + current.priceChange24h / 100);
        if (startPrice24h > 0) {
          updatedChange24h = ((newPrice - startPrice24h) / startPrice24h) * 100;
        }
      }

      let flash: 'up' | 'down' | null = null;
      if (oldPrice > 0) {
        if (newPrice > oldPrice) flash = 'up';
        else if (newPrice < oldPrice) flash = 'down';
      }

      // Handle flash clear timeout
      if (flash) {
        if (flashTimeoutsRef.current[address]) {
          clearTimeout(flashTimeoutsRef.current[address]);
        }
        flashTimeoutsRef.current[address] = setTimeout(() => {
          setPrices(p => {
            if (p[address]) {
              return {
                ...p,
                [address]: { ...p[address], flash: null }
              };
            }
            return p;
          });
        }, 600);
      }

      return {
        ...prev,
        [address]: {
          price: newPrice,
          priceChange24h: updatedChange24h,
          flash: flash,
          lastUpdated: Date.now()
        }
      };
    });

    // Trigger registered callback listeners
    const tokenListeners = listenersRef.current[address];
    if (tokenListeners) {
      tokenListeners.forEach(callback => {
        try {
          callback(tx);
        } catch (e) {
          console.error('[LivePriceContext] Listener error:', e);
        }
      });
    }
  }, []);

  const triggerTradeUpdate = React.useCallback((tx: Transaction) => {
    processTransaction(tx);
  }, [processTransaction]);

  // WebSocket lifecycle
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let heartbeatInterval: any = null;
    let isMounted = true;
    let localRetryCount = 0;

    const connectWS = () => {
      if (!isMounted) return;

      if (!window.location.host || window.location.origin === 'null') {
        setFeedState('unavailable');
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isMounted) return;
          setFeedState('live');
          setRetryCount(0);
          localRetryCount = 0;

          // Heartbeat ping/pong
          clearInterval(heartbeatInterval);
          heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'transaction' && payload.data) {
              processTransaction(payload.data);
            }
          } catch (err) {
            // Ignore parse errors
          }
        };

        ws.onerror = (err) => {
          console.warn('[LivePriceContext WS] Error on socket:', err);
          ws?.close();
        };

        ws.onclose = () => {
          clearInterval(heartbeatInterval);
          if (!isMounted) return;

          localRetryCount++;
          setRetryCount(localRetryCount);

          if (localRetryCount <= 5) {
            setFeedState('reconnecting');
            const delay = Math.min(1000 * Math.pow(1.5, localRetryCount), 15000);
            reconnectTimer = setTimeout(connectWS, delay);
          } else {
            setFeedState('unavailable');
          }
        };
      } catch (err) {
        console.error('[LivePriceContext WS] Setup error:', err);
        clearInterval(heartbeatInterval);
        if (!isMounted) return;

        localRetryCount++;
        setRetryCount(localRetryCount);

        if (localRetryCount <= 5) {
          setFeedState('reconnecting');
          const delay = Math.min(1000 * Math.pow(1.5, localRetryCount), 15000);
          reconnectTimer = setTimeout(connectWS, delay);
        } else {
          setFeedState('unavailable');
        }
      }
    };

    setFeedState('connecting');
    connectWS();

    return () => {
      isMounted = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(heartbeatInterval);
      
      // Clean up all flash timeouts
      Object.values(flashTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  // Micro-fluctuations interval to update subscribed prices when there are no live trades
  useEffect(() => {
    const interval = setInterval(() => {
      if (feedState !== 'live') return;

      const now = Date.now();
      const currentSubscriptions = subscriptionsRef.current;
      const currentPrices = pricesRef.current;
      
      let updated = false;
      const nextPrices = { ...currentPrices };

      Object.keys(currentSubscriptions).forEach(address => {
        const subs = currentSubscriptions[address];
        if (subs && subs.size > 0) {
          const priceInfo = currentPrices[address];
          if (priceInfo) {
            // If the token hasn't had an update in the last 1.2s, simulate a tiny tick
            if (now - priceInfo.lastUpdated >= 1200) {
              const basePrice = priceInfo.price;
              if (basePrice > 0) {
                // ±0.02% micro fluctuation
                const percentageChange = (Math.random() * 0.04 - 0.02) / 100;
                const nextPrice = basePrice * (1 + percentageChange);

                let flash: 'up' | 'down' | null = null;
                if (nextPrice > basePrice) flash = 'up';
                else if (nextPrice < basePrice) flash = 'down';

                const startPrice24h = basePrice / (1 + priceInfo.priceChange24h / 100);
                const updatedChange24h = startPrice24h > 0
                  ? ((nextPrice - startPrice24h) / startPrice24h) * 100
                  : priceInfo.priceChange24h;

                // Handle flash timeouts
                if (flash) {
                  if (flashTimeoutsRef.current[address]) {
                    clearTimeout(flashTimeoutsRef.current[address]);
                  }
                  flashTimeoutsRef.current[address] = setTimeout(() => {
                    setPrices(p => {
                      if (p[address]) {
                        return {
                          ...p,
                          [address]: { ...p[address], flash: null }
                        };
                      }
                      return p;
                    });
                  }, 600);
                }

                nextPrices[address] = {
                  price: nextPrice,
                  priceChange24h: updatedChange24h,
                  flash: flash,
                  lastUpdated: now
                };
                updated = true;
              }
            }
          }
        }
      });

      if (updated) {
        setPrices(nextPrices);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [feedState]);

  const updatePrice = React.useCallback((tokenAddress: string, newPrice: number, priceChange24h?: number) => {
    if (!tokenAddress || newPrice <= 0) return;
    const address = tokenAddress.toLowerCase();

    setPrices(prev => {
      const current = prev[address];
      const oldPrice = current ? current.price : 0;

      let updatedChange24h = priceChange24h !== undefined ? priceChange24h : (current ? current.priceChange24h : 0);

      let flash: 'up' | 'down' | null = null;
      if (oldPrice > 0 && oldPrice !== newPrice) {
        if (newPrice > oldPrice) flash = 'up';
        else if (newPrice < oldPrice) flash = 'down';
      }

      if (flash) {
        if (flashTimeoutsRef.current[address]) {
          clearTimeout(flashTimeoutsRef.current[address]);
        }
        flashTimeoutsRef.current[address] = setTimeout(() => {
          setPrices(p => {
            if (p[address]) {
              return {
                ...p,
                [address]: { ...p[address], flash: null }
              };
            }
            return p;
          });
        }, 600);
      }

      return {
        ...prev,
        [address]: {
          price: newPrice,
          priceChange24h: updatedChange24h,
          flash: flash || (current ? current.flash : null),
          lastUpdated: Date.now()
        }
      };
    });
  }, []);

  // Subscription Registry API
  const subscribe = React.useCallback((tokenAddress: string, subscriberId: string, onTx?: (tx: Transaction) => void, initialPrice?: number, initialPriceChange24h?: number) => {
    const address = tokenAddress.toLowerCase();
    if (!subscriptionsRef.current[address]) {
      subscriptionsRef.current[address] = new Set();
    }
    subscriptionsRef.current[address].add(subscriberId);

    if (onTx) {
      if (!listenersRef.current[address]) {
        listenersRef.current[address] = new Map();
      }
      listenersRef.current[address].set(subscriberId, onTx);
    }

    if (initialPrice && initialPrice > 0) {
      setPrices(prev => {
        if (!prev[address] || prev[address].price <= 0) {
          return {
            ...prev,
            [address]: {
              price: initialPrice,
              priceChange24h: initialPriceChange24h || 0,
              flash: null,
              lastUpdated: Date.now()
            }
          };
        }
        return prev;
      });
    }
  }, []);

  const unsubscribe = React.useCallback((tokenAddress: string, subscriberId: string) => {
    const address = tokenAddress.toLowerCase();
    const subs = subscriptionsRef.current[address];
    if (subs) {
      subs.delete(subscriberId);
      if (subs.size === 0) {
        delete subscriptionsRef.current[address];
      }
    }

    const l = listenersRef.current[address];
    if (l) {
      l.delete(subscriberId);
      if (l.size === 0) {
        delete listenersRef.current[address];
      }
    }
  }, []);

  const contextValue = React.useMemo(() => ({
    feedState,
    retryCount,
    prices,
    subscribe,
    unsubscribe,
    triggerTradeUpdate,
    updatePrice
  }), [feedState, retryCount, prices, subscribe, unsubscribe, triggerTradeUpdate, updatePrice]);

  return (
    <LivePriceContext.Provider value={contextValue}>
      {children}
    </LivePriceContext.Provider>
  );
}

// Hook to track the live price of a token with viewport subscription option
export function useLivePrice(
  tokenAddress: string | undefined,
  initialPrice: number,
  initialPriceChange24h: number,
  elementRef?: React.RefObject<HTMLElement | null>,
  onTx?: (tx: Transaction) => void
) {
  const { prices, subscribe, unsubscribe, updatePrice } = useLivePriceContext();
  const address = tokenAddress?.toLowerCase() || '';

  // Generate a stable subscriber ID
  const subscriberIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const subscriberId = subscriberIdRef.current;

  const [isIntersecting, setIsIntersecting] = useState<boolean>(!elementRef);

  // Setup intersection observer if an element ref is passed
  useEffect(() => {
    if (!elementRef || !elementRef.current) {
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.05, rootMargin: '100px' } // Pre-subscribe slightly before scrolling into view
    );

    const currentEl = elementRef.current;
    observer.observe(currentEl);

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
      observer.disconnect();
    };
  }, [elementRef]);

  // Sync initialPrice to LivePriceContext if token is loaded
  useEffect(() => {
    if (address && initialPrice > 0 && isIntersecting) {
      if (!prices[address] || prices[address].price <= 0) {
        updatePrice(address, initialPrice, initialPriceChange24h);
      }
    }
  }, [address, initialPrice, initialPriceChange24h, isIntersecting, prices, updatePrice]);

  // Subscribe/unsubscribe based on visibility
  useEffect(() => {
    if (!address || !isIntersecting) return;

    subscribe(address, subscriberId, onTx, initialPrice, initialPriceChange24h);

    return () => {
      unsubscribe(address, subscriberId);
    };
  }, [address, isIntersecting, subscribe, unsubscribe, subscriberId, onTx, initialPrice, initialPriceChange24h]);

  // Retrieve current live data
  const liveData = prices[address];

  return {
    price: liveData ? liveData.price : initialPrice,
    priceChange24h: liveData ? liveData.priceChange24h : initialPriceChange24h,
    flash: liveData ? liveData.flash : null,
    lastUpdated: liveData ? liveData.lastUpdated : 0,
    isSubscribed: isIntersecting
  };
}

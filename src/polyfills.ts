import { Buffer } from 'buffer';

// Polyfill Buffer and process for Solana Web3 and Spl-Token in browser Vite environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  if (!(window as any).process) {
    (window as any).process = { env: {} };
  }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).global = globalThis;
  if (!(globalThis as any).process) {
    (globalThis as any).process = { env: {} };
  }
}

export { Buffer };

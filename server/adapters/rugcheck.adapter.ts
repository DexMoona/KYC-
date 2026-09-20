import { SecurityAudit } from '../../src/types';
import { monitoringService } from '../services/monitoring.service';

export class RugCheckAdapter {
  private baseUrl = 'https://api.rugcheck.xyz/v1';
  private cache = new Map<string, { data: SecurityAudit; expiry: number }>();

  public async getAudit(mint: string): Promise<SecurityAudit | null> {
    const cleanMint = mint.trim();
    if (!cleanMint) return null;

    const cacheKey = `rugcheck_${cleanMint}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const startTime = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/tokens/${cleanMint}/report`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SURCHI/2.0' },
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        throw new Error(`RugCheck HTTP status ${res.status}`);
      }

      const report = await res.json();
      monitoringService.recordSuccess('RugCheck', Date.now() - startTime);

      const risks: string[] = [];
      if (Array.isArray(report.risks)) {
        for (const r of report.risks) {
          if (r.name) risks.push(r.name);
        }
      }

      const isMintAuthorityDisabled = !report.tokenMeta?.mutable && !report.mintAuthority;
      const isFreezeAuthorityDisabled = !report.freezeAuthority;

      // Extract LP locked percent
      let lpLocked = false;
      let lpLockPercent = 0;
      let lpUnlockDate: string | undefined;

      if (Array.isArray(report.markets)) {
        for (const m of report.markets) {
          if (m.lp && m.lp.lpLockedPct !== undefined) {
            lpLockPercent = Math.max(lpLockPercent, Math.round(m.lp.lpLockedPct));
            if (lpLockPercent > 50) lpLocked = true;
          }
        }
      }

      const audit: SecurityAudit = {
        honeypotChecked: true,
        isHoneypot: report.score > 2000 || risks.some(r => r.toLowerCase().includes('honeypot')),
        mintStatus: isMintAuthorityDisabled ? 'Disabled' : 'Enabled',
        freezeStatus: isFreezeAuthorityDisabled ? 'Disabled' : 'Enabled',
        ownershipRenounced: isMintAuthorityDisabled,
        lpLocked,
        lpLockPercent,
        lpUnlockDate,
        burnPercent: 0,
        buyTax: 0,
        sellTax: 0,
        transferRestrictions: report.freezeAuthority !== null,
        suspiciousFunctions: risks
      };

      this.cache.set(cacheKey, { data: audit, expiry: Date.now() + 120000 }); // 2 min cache
      return audit;
    } catch (err: any) {
      monitoringService.recordFailure('RugCheck', err);
      return cached ? cached.data : null;
    }
  }
}

export const rugCheckAdapter = new RugCheckAdapter();

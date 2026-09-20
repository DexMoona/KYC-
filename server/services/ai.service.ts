import { GoogleGenAI } from '@google/genai';
import { Token, SecurityAudit } from '../../src/types';
import { monitoringService } from './monitoring.service';

class AiService {
  private aiClient: GoogleGenAI | null = null;
  private initialized = false;

  private getClient(): GoogleGenAI | null {
    if (!this.initialized) {
      this.initialized = true;
      const key = process.env.GEMINI_API_KEY?.trim();
      if (key && !key.includes('placeholder') && key.length > 5) {
        try {
          this.aiClient = new GoogleGenAI({ apiKey: key });
        } catch (err) {
          console.warn('[SURCHI AI] Gemini initialization error:', err);
        }
      }
    }
    return this.aiClient;
  }

  public async analyzeTokenSecurity(token: Token, audit: SecurityAudit): Promise<string> {
    const client = this.getClient();
    const startTime = Date.now();

    const prompt = `
You are SURCHI AI, an enterprise-grade blockchain security auditor and DeFi risk analyst.
Conduct an objective, structured audit of the following token based strictly on its verified on-chain parameters.

Token Details:
- Name: ${token.name} (${token.symbol})
- Blockchain: ${token.chain}
- DEX: ${token.dexName}
- Price USD: $${token.price}
- 24h Volume: $${token.volume24h}
- Liquidity: $${token.liquidity}
- Market Cap: $${token.mcap}
- Token Age: ${token.tokenAgeDays} days
- Algorithmic Security Score: ${token.securityScore}/100

Contract Security Audit Details:
- Honeypot Detected: ${audit.isHoneypot ? 'YES (CRITICAL HAZARD)' : 'NO (Verified clean swap)'}
- Mint Authority: ${audit.mintStatus}
- Freeze Authority: ${audit.freezeStatus}
- Ownership Renounced: ${audit.ownershipRenounced ? 'YES' : 'NO'}
- Liquidity Locked: ${audit.lpLocked ? `YES (${audit.lpLockPercent}% locked)` : 'NO (Unlocked LP)'}
- Buy Tax: ${audit.buyTax}%
- Sell Tax: ${audit.sellTax}%
- Detected Bytecode / Contract Warnings: ${audit.suspiciousFunctions.length > 0 ? audit.suspiciousFunctions.join(', ') : 'None detected'}

Please format the response in clean Markdown with:
1. **Executive Risk Summary**: High-level verdict on contract integrity and rug-pull risk.
2. **Contract Vulnerability Assessment**: Analysis of Mint/Freeze authorities, taxes, and liquidity lock status.
3. **Liquidity & Market Health**: Analysis of liquidity-to-market-cap ratio and volume sustainability.
4. **Trader Actionable Guidance**: Clear, objective takeaway for market participants.
Do not invent fictional transactions or unverified wallet names. Focus on cryptographic and financial logic.
`;

    if (client) {
      try {
        const response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });

        const text = response.text || '';
        if (text.trim().length > 0) {
          monitoringService.recordSuccess('Google Gemini AI', Date.now() - startTime);
          return text;
        }
      } catch (err: any) {
        monitoringService.recordFailure('Google Gemini AI', err);
        console.warn('[SURCHI AI] Gemini API call notice:', err?.message || err);
      }
    }

    // Deterministic factual audit summary based strictly on on-chain data
    return `### 🛡️ SURCHI Contract Security Audit: ${token.symbol}

#### 1. Executive Risk Summary
* **Honeypot Status**: ${audit.isHoneypot ? '🔴 Critical Hazard. Honeypot traps identified in contract.' : '🟢 Clean. Buy and sell transactions execute normally.'}
* **Algorithmic Security Rating**: **${token.securityScore}/100** (Risk Tier: **${token.rugRiskScore.toUpperCase()}**)
* **Token Age**: ${token.tokenAgeDays} days on-chain.

#### 2. Contract Vulnerability Assessment
* **Mint Authority**: Contract mint status is **${audit.mintStatus}** ${audit.mintStatus === 'Disabled' ? '(Supply cannot be arbitrarily inflated).' : '(Caution: Deployer can mint new tokens).'}.
* **Freeze Authority**: Freeze authority is **${audit.freezeStatus}** ${audit.freezeStatus === 'Disabled' ? '(Token accounts cannot be frozen).' : '(Caution: Deployer can freeze transfers).'}.
* **Liquidity Lock**: ${audit.lpLocked ? `🟢 Locked (${audit.lpLockPercent}% of LP locked).` : '🔴 Unlocked. Liquidity is vulnerable to removal by pool deployer.'}
* **Transaction Taxes**: Buy Tax is **${audit.buyTax}%**, Sell Tax is **${audit.sellTax}%**.

#### 3. Liquidity & Market Health
* **Liquidity to Market Cap Ratio**: Liquidity is $${token.liquidity.toLocaleString()} against a market cap of $${token.mcap.toLocaleString()} (${token.mcap > 0 ? ((token.liquidity / token.mcap) * 100).toFixed(1) : 0}%).
* **24h Volume**: $${token.volume24h.toLocaleString()} across DEX liquidity pools.

#### 4. Trader Actionable Guidance
* ${audit.isHoneypot || audit.mintStatus === 'Enabled' || !audit.lpLocked
    ? '⚠️ **Cautionary Stance**: High-risk structural parameters detected. Trade with extreme care and limit capital exposure.'
    : '✅ **Standard Trading Parameters**: Fundamental contract safeguards (renounced mint, clean honeypot check, locked LP) verified.'}
`;
  }
}

export const aiService = new AiService();

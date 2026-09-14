import React from 'react';
import { ShieldCheck, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface PrivacyPolicyViewProps {
  onClose: () => void;
}

export default function PrivacyPolicyView({ onClose }: PrivacyPolicyViewProps) {
  return (
    <div className="min-h-screen bg-elegant-bg text-elegant-text p-4 md:p-8 flex justify-center">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-4xl bg-elegant-surface border border-elegant-border rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="sticky top-0 z-10 bg-elegant-surface/90 backdrop-blur-md border-b border-elegant-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-elegant-gold/10 flex items-center justify-center border border-elegant-gold/30">
              <ShieldCheck className="w-5 h-5 text-elegant-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-elegant-text-secondary font-medium">SURCHI Transparency & Trust</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-elegant-surface hover:bg-elegant-surface-hover border border-elegant-border text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
        </div>

        <div className="p-6 md:p-8 prose prose-invert prose-elegant max-w-none prose-headings:text-white prose-a:text-elegant-gold hover:prose-a:text-white">
          <h2 className="text-2xl font-bold mb-2">SURCHI Privacy Policy</h2>
          <p className="text-elegant-text-secondary mb-8 font-mono text-xs">Last Updated: September 14, 2026</p>

          <p>
            SURCHI (“SURCHI,” “we,” “us,” or “our”) respects your privacy and is committed to protecting information that may be associated with your use of the SURCHI platform, website, applications, and related services (collectively, the “Services”).
          </p>
          <p>
            This Privacy Policy explains what information we may collect, how we use it, when it may be shared, and the choices available to you when using SURCHI.
          </p>
          <p>
            By accessing or using the Services, you acknowledge that you have read and understood this Privacy Policy.
          </p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">1. Information We Collect</h3>
          
          <h4 className="text-md font-semibold mt-6 mb-2 text-white">1.1 Information You Provide</h4>
          <p>Depending on how you use SURCHI, we may collect information that you voluntarily provide, including:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Email address or other contact information when you contact us.</li>
            <li>Information submitted through forms, support requests, or community channels.</li>
            <li>Account or profile information where account functionality is available.</li>
            <li>Feedback, messages, or other communications you send to us.</li>
          </ul>
          <p>We do not require you to provide personal information simply to view publicly available blockchain market data.</p>

          <h4 className="text-md font-semibold mt-6 mb-2 text-white">1.2 Blockchain and Wallet Information</h4>
          <p>SURCHI may provide blockchain analytics, wallet intelligence, token information, transaction monitoring, portfolio tools, and related features.</p>
          <p>Public blockchain networks are inherently transparent. When you connect or enter a public wallet address, information associated with that address may be publicly accessible on the applicable blockchain.</p>
          <p>Depending on the features you use, SURCHI may process publicly available information such as:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Public wallet addresses.</li>
            <li>Token balances.</li>
            <li>Token holdings.</li>
            <li>Blockchain transactions.</li>
            <li>Token transfers.</li>
            <li>Smart-contract interactions.</li>
            <li>Publicly available transaction timestamps and amounts.</li>
            <li>Public blockchain activity and related analytics.</li>
          </ul>
          <p>SURCHI does not obtain or store your private keys, seed phrases, recovery phrases, or wallet passwords.</p>
          <p className="font-semibold text-white">You are responsible for protecting your wallet credentials and private keys.</p>

          <h4 className="text-md font-semibold mt-6 mb-2 text-white">1.3 Automatically Collected Information</h4>
          <p>When you access our Services, certain technical information may be collected automatically, including:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>IP address.</li>
            <li>Browser type and version.</li>
            <li>Device type.</li>
            <li>Operating system.</li>
            <li>Approximate geographic information derived from technical data.</li>
            <li>Pages or features accessed.</li>
            <li>Date and time of access.</li>
            <li>Diagnostic, performance, and security information.</li>
          </ul>
          <p>We may use cookies, local storage, or similar technologies to maintain functionality, remember preferences, improve performance, and help protect the Services.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">2. How We Use Information</h3>
          <p>We may use information we collect to:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Provide, maintain, and improve SURCHI.</li>
            <li>Provide blockchain analytics and market intelligence.</li>
            <li>Display token, wallet, transaction, and market information.</li>
            <li>Operate portfolio and wallet-related features.</li>
            <li>Improve our AI-powered features and services.</li>
            <li>Detect, prevent, and investigate fraud, abuse, security incidents, and unauthorized activity.</li>
            <li>Monitor and improve platform performance.</li>
            <li>Respond to support requests and communications.</li>
            <li>Understand how users interact with our Services.</li>
            <li>Develop new features and products.</li>
            <li>Comply with applicable legal obligations.</li>
            <li>Protect the rights, property, and safety of SURCHI, our users, and others.</li>
          </ul>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">3. AI Features</h3>
          <p>SURCHI may provide artificial intelligence (“AI”) features for market analysis, contract analysis, security-related insights, token intelligence, or other purposes.</p>
          <p>Information submitted to an AI-powered feature may be processed by SURCHI and/or third-party AI service providers necessary to provide that feature.</p>
          <p>AI-generated information is provided for informational purposes and should not be considered financial, investment, legal, or other professional advice.</p>
          <p className="font-semibold text-white">You should independently verify important information before making financial or trading decisions.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">4. Blockchain Data</h3>
          <p>SURCHI may obtain information from public blockchain networks and third-party blockchain data providers.</p>
          <p>Because blockchain transactions are generally permanent and publicly accessible, information recorded on a blockchain may not be capable of being deleted, modified, or removed by SURCHI.</p>
          <p>SURCHI does not control the underlying blockchain networks.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">5. Third-Party Services</h3>
          <p>SURCHI may use third-party service providers to operate and improve the Services. These providers may include services for:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Blockchain data and indexing.</li>
            <li>Market and token information.</li>
            <li>Analytics.</li>
            <li>Hosting and infrastructure.</li>
            <li>AI processing.</li>
            <li>Security.</li>
            <li>Authentication.</li>
            <li>Communications and email.</li>
            <li>Payment or other integrations where applicable.</li>
          </ul>
          <p>Third-party providers may process information according to their own privacy policies and terms.</p>
          <p>SURCHI is not responsible for the privacy practices of third-party websites, applications, wallets, exchanges, blockchain networks, or services that you access through or alongside SURCHI.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">6. Wallet Connections</h3>
          <p>SURCHI may allow users to connect compatible cryptocurrency wallets to access certain features.</p>
          <p>When connecting a wallet:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>SURCHI does not request your seed phrase or private key.</li>
            <li>You should never provide your seed phrase or private key to SURCHI or anyone claiming to represent SURCHI.</li>
            <li>Wallet addresses and blockchain activity may be visible to SURCHI when necessary to provide requested features.</li>
            <li>Transactions are generally executed through the wallet and applicable blockchain network, not by SURCHI taking custody of your assets.</li>
          </ul>
          <p>SURCHI does not take custody of your cryptocurrency unless a specific service explicitly states otherwise.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">7. Cookies and Local Storage</h3>
          <p>SURCHI may use cookies, local storage, session technologies, or similar technologies to:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Remember user preferences.</li>
            <li>Maintain application functionality.</li>
            <li>Store interface settings.</li>
            <li>Improve security.</li>
            <li>Analyze platform usage.</li>
            <li>Improve performance.</li>
          </ul>
          <p>You may be able to control cookies through your browser settings. Disabling certain technologies may affect the functionality of some SURCHI features.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">8. Data Sharing</h3>
          <p className="font-semibold text-white">We do not sell your personal information for money.</p>
          <p>We may share information when reasonably necessary with:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Service providers that operate parts of the SURCHI infrastructure.</li>
            <li>Security and fraud-prevention providers.</li>
            <li>Professional advisers where necessary.</li>
            <li>Government authorities or law-enforcement agencies when legally required.</li>
            <li>Other parties when necessary to protect SURCHI, our users, or the public.</li>
            <li>Parties involved in a merger, acquisition, financing, restructuring, or sale of assets.</li>
          </ul>
          <p>We may also use aggregated or de-identified information that cannot reasonably be used to identify an individual for analytics, research, development, or other legitimate purposes.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">9. Data Security</h3>
          <p>We use reasonable technical and organizational measures designed to protect information against unauthorized access, alteration, disclosure, or destruction.</p>
          <p>However, no website, application, blockchain network, or internet transmission can be guaranteed to be completely secure.</p>
          <p>You are responsible for maintaining the security of your devices, accounts, wallet credentials, private keys, and recovery phrases.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">10. Data Retention</h3>
          <p>We retain information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including providing the Services, maintaining security, resolving disputes, complying with legal obligations, and enforcing agreements.</p>
          <p>Public blockchain data may remain permanently available on the applicable blockchain network and is outside our control.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">11. Your Privacy Rights</h3>
          <p>Depending on your location and applicable law, you may have rights regarding your personal information, which may include:</p>
          <ul className="list-disc pl-6 space-y-1 mb-4 text-elegant-text-secondary">
            <li>Requesting access to personal information we hold about you.</li>
            <li>Requesting correction of inaccurate information.</li>
            <li>Requesting deletion of certain personal information.</li>
            <li>Requesting restriction of certain processing.</li>
            <li>Objecting to certain processing.</li>
            <li>Requesting a copy of certain information.</li>
            <li>Withdrawing consent where processing is based on consent.</li>
          </ul>
          <p>These rights may be subject to legal limitations and exceptions.</p>
          <p>To submit a privacy-related request, contact us using the contact information provided below.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">12. Children's Privacy</h3>
          <p>SURCHI is not intended for children who are below the minimum age required to use the Services under applicable law.</p>
          <p>We do not knowingly collect personal information from children in violation of applicable privacy laws.</p>
          <p>If you believe a child has provided personal information to SURCHI, please contact us so that we can take appropriate action.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">13. International Users</h3>
          <p>SURCHI may use infrastructure and service providers located in countries other than your country of residence.</p>
          <p>As a result, information may be processed or stored internationally, subject to applicable data-protection laws and appropriate safeguards where required.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">14. Cryptocurrency and Financial Disclaimer</h3>
          <p>SURCHI provides technology, blockchain analytics, market information, AI-generated insights, and related tools.</p>
          <p className="font-semibold text-white">Nothing provided through SURCHI constitutes financial, investment, trading, legal, tax, or other professional advice.</p>
          <p>Cryptocurrency and digital assets are highly volatile and involve significant risk, including the potential loss of your entire investment.</p>
          <p>You are solely responsible for your own decisions and should conduct independent research and seek qualified professional advice where appropriate.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">15. Changes to This Privacy Policy</h3>
          <p>We may update this Privacy Policy from time to time to reflect changes to our Services, technology, legal requirements, or privacy practices.</p>
          <p>When we make changes, we may update the “Last Updated” date at the beginning of this policy.</p>
          <p>Your continued use of the Services after an updated Privacy Policy becomes effective constitutes acceptance of the revised policy to the extent permitted by applicable law.</p>

          <h3 className="text-lg font-bold mt-8 mb-4 text-white">16. Contact Us</h3>
          <p>If you have questions, concerns, or requests regarding this Privacy Policy or SURCHI's privacy practices, please contact us through the official SURCHI communication channels.</p>
          
          <div className="mt-6 p-4 bg-elegant-bg rounded-lg border border-elegant-border">
            <p className="font-bold text-white mb-2">SURCHI</p>
            <p className="mb-1">Website: <a href="https://www.surchi.xyz" target="_blank" rel="noopener noreferrer" className="text-elegant-gold hover:underline">https://www.surchi.xyz</a></p>
            <p>Privacy inquiries: <a href="mailto:Support@surchi.xyz" className="text-elegant-gold hover:underline">Support@surchi.xyz</a></p>
          </div>

          <div className="mt-12 pt-6 border-t border-elegant-border text-center text-xs text-elegant-text-secondary font-mono">
            © 2026 SURCHI. All rights reserved.
          </div>
        </div>
      </motion.div>
    </div>
  );
}

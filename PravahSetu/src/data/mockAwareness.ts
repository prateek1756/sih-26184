import { AwarenessArticle } from '../types';

export const AWARENESS_ARTICLES: AwarenessArticle[] = [
  {
    id: 'upi-payment-fraud',
    category: 'Financial Safety',
    title: 'UPI & QR Code Frauds',
    subtitle: 'Golden Rule: Entering your UPI PIN always DEBITS money, never credits it.',
    shortDesc: 'Scammers send payment requests or fake QR codes under the pretext of buying items on OLX or sending prize money.',
    iconName: 'CreditCard',
    severity: 'critical',
    redFlags: [
      'Anyone asking you to scan a QR code to "receive" money into your account.',
      'Caller urging you to enter your UPI PIN to approve a refund or cashback.',
      'Receiving a collect request from an unknown VPA on Google Pay, PhonePe, or Paytm.',
      'Being asked to change UPI PIN on an unfamiliar link or web page.',
    ],
    immediateActions: [
      'Immediately dial the National Cyber Crime Helpline at 1930 to freeze the money trail.',
      'Open your bank/UPI app and block the suspicious UPI ID & account.',
      'Take screenshots of the transaction ID, UPI reference number (UTR), and chat history.',
      'File a formal complaint on the Pravah Setu portal within the Golden Hour.',
    ],
    preventionTips: [
      'Remember: QR codes are only for paying, never for receiving funds.',
      'Keep your daily UPI transaction limit moderate.',
      'Never approve unknown Collect Requests in your payment apps.',
      'Verify the beneficiary account name shown on the confirmation screen before entering PIN.',
    ],
    faq: [
      {
        question: 'Can someone deduct money from my account just with my mobile number?',
        answer: 'No. No money can leave your account via UPI without entering your secret 4 or 6 digit UPI PIN or explicit OTP validation.'
      },
      {
        question: 'What is the "Golden Hour" in cyber fraud reporting?',
        answer: 'The first 2 to 4 hours after an unauthorized financial transaction are critical. Reporting promptly to 1930 or your bank allows authorities to intercept funds in the recipient bank before fraudsters withdraw cash.'
      }
    ]
  },
  {
    id: 'phishing-fake-sms',
    category: 'Digital Identity',
    title: 'Phishing & Fake SMS Alerts',
    subtitle: 'Electricity bill disconnect, PAN card inactive, or parcel hold messages.',
    shortDesc: 'Urgent messages threatening disconnection or account freeze, directing you to click spoofed government or banking links.',
    iconName: 'MailWarning',
    severity: 'high',
    redFlags: [
      'SMS from unknown 10-digit mobile numbers claiming to be MSEB, BSES, SBI, or HDFC.',
      'Threatening messages like "Your power will be cut tonight at 9:30 PM due to unpaid bill."',
      'Shortened URLs like bit.ly, tinyurl, or suspicious domains ending in .xyz, .top, .live.',
      'Requests to download APK files or install apps like AnyDesk, TeamViewer, or QuickSupport.',
    ],
    immediateActions: [
      'Do NOT click the link or call the number in the SMS.',
      'If you downloaded an APK, immediately disconnect Wi-Fi/mobile data and uninstall the app.',
      'Change your netbanking, UPI, and email passwords from another safe device.',
      'Inform your telecom provider and report the sender number on the Chakshu portal.',
    ],
    preventionTips: [
      'Official utility providers always send SMS from verified sender IDs (e.g., AD-MSEB, VK-SBINB), never personal mobile numbers.',
      'Always pay utility bills through the official electricity board website or trusted aggregator apps.',
      'Never download APK files sent via WhatsApp or SMS.',
    ],
    faq: [
      {
        question: 'What should I do if I already clicked a suspicious link?',
        answer: 'If you did not submit passwords or OTPs, close the browser immediately and clear your browser cache. If you entered passwords, immediately change them and alert your bank.'
      }
    ]
  },
  {
    id: 'fake-customer-care',
    category: 'Impersonation',
    title: 'Fake Customer Care & Remote App Scams',
    subtitle: 'Searching for courier, bank, or airline helpdesks on Google search.',
    shortDesc: 'Cyber criminals put their own mobile numbers on Google Maps and search results posing as customer care agents.',
    iconName: 'Headphones',
    severity: 'high',
    redFlags: [
      'Helpline numbers listed as regular 10-digit personal mobile numbers instead of official 1800 toll-free numbers.',
      'Executive asking you to install "support" apps like RustDesk, AnyDesk, or TeamViewer.',
      'Agent requesting a small ₹5 or ₹10 test recharge to "verify your account".',
      'The caller insists on staying on the phone while you open your banking app.',
    ],
    immediateActions: [
      'Terminate the call immediately.',
      'Uninstall any screen-sharing or remote desktop application installed during the call.',
      'Turn on Airplane mode and restart your phone.',
      'Check bank account balances and block cards/netbanking if access was granted.',
    ],
    preventionTips: [
      'Always obtain customer support numbers from the official app or website URL directly.',
      'Never rely on Google Maps phone numbers for banks, couriers, or hospitals.',
      'No genuine customer support agent will ever ask you to install screen sharing tools to resolve an account issue.',
    ],
    faq: [
      {
        question: 'How do remote access apps steal money?',
        answer: 'Apps like AnyDesk mirror your phone screen to the fraudster. When you open your banking app or receive an OTP, the fraudster can see your screen, capture your credentials, and approve transactions.'
      }
    ]
  },
  {
    id: 'investment-trading-scams',
    category: 'Financial Safety',
    title: 'High-Yield Investment & Stock Scams',
    subtitle: 'WhatsApp & Telegram groups promising 500% returns on institutional trading.',
    shortDesc: 'Victims are lured into cloned trading portals showing fake soaring profits until they try to withdraw their funds.',
    iconName: 'TrendingDown',
    severity: 'critical',
    redFlags: [
      'Being added to WhatsApp or Telegram groups titled "Institutional VIP Trading" or "Crypto Wealth".',
      'Guaranteed daily or weekly returns (e.g., "Earn 20% daily with institutional AI bot").',
      'App not available on Google Play Store or Apple App Store; asked to install via external link.',
      'When withdrawing funds, you are asked to deposit 30% "tax" or "clearance fee" first.',
    ],
    immediateActions: [
      'Stop sending any further money immediately, regardless of what the scammers claim.',
      'Preserve all chat transcripts, deposit transaction IDs, and website URLs.',
      'Report the beneficiary bank accounts and UPI IDs to the Cyber Crime Helpline 1930.',
      'File an FIR and complaint with SEBI SCORES portal if claiming SEBI registration.',
    ],
    preventionTips: [
      'Trade only through SEBI-registered brokers and official demat accounts.',
      'Remember the universal investment rule: High returns never come without high risk; guaranteed high returns are always fraudulent.',
      'Never transfer money to individual personal savings accounts for "corporate investments".',
    ],
    faq: [
      {
        question: 'The app shows my balance is ₹25 Lakhs, can I get it back by paying the withdrawal fee?',
        answer: 'No. The balance shown inside fake trading apps is completely fabricated computer numbers. Paying an extra "withdrawal fee" or "income tax" is just another ploy to steal more money.'
      }
    ]
  },
  {
    id: 'part-time-job-scams',
    category: 'Employment Scams',
    title: 'Part-Time Task & YouTube Rating Scams',
    subtitle: 'Earn ₹3,000 to ₹8,000 per day by liking videos or reviewing hotels.',
    shortDesc: 'Scammers offer simple work-from-home tasks, pay tiny rewards initially, then force users to invest in prepaid task tiers.',
    iconName: 'Briefcase',
    severity: 'high',
    redFlags: [
      'Unsolicited WhatsApp or SMS job offers offering huge compensation for reviewing hotels or liking videos.',
      'Directing conversations quickly to Telegram channels with "Receptionist" or "Tutor".',
      'Tasks that suddenly require you to deposit your own money to unlock your "frozen salary".',
    ],
    immediateActions: [
      'Cut off communication with the handlers immediately.',
      'Report and block the Telegram / WhatsApp numbers.',
      'Report the payment transaction IDs to your bank fraud division.',
    ],
    preventionTips: [
      'Legitimate companies never ask job applicants to pay money to receive tasks or salaries.',
      'Disregard unsolicited job offers on WhatsApp and Telegram from foreign country codes (+62, +84, +234, etc.).',
    ],
    faq: [
      {
        question: 'Why did they pay me ₹200 initially?',
        answer: 'This is known as the bait. Scammers deliberately pay small sums of ₹200 - ₹500 at the beginning to build psychological trust so you feel confident transferring thousands later.'
      }
    ]
  },
  {
    id: 'social-media-impersonation',
    category: 'Social Privacy',
    title: 'Social Media Hacking & Impersonation',
    subtitle: 'Cloned profiles messaging your friends asking for emergency medical funds.',
    shortDesc: 'Criminals clone photos from Instagram or Facebook, create identical accounts, and message followers requesting urgent money.',
    iconName: 'Share2',
    severity: 'medium',
    redFlags: [
      'A friend sends an urgent DM stating they are hospitalized or stranded and need ₹5,000 immediately.',
      'Friend asks you to send money to a UPI ID that has a completely different person name.',
      'Urgent appeals asking not to call them on phone because "the mic is broken".',
    ],
    immediateActions: [
      'Always call your friend directly on their regular phone number before sending any money.',
      'Report the fake account on Instagram/Facebook/X for impersonation.',
      'Post a story or status warning mutual friends about the cloned profile.',
    ],
    preventionTips: [
      'Make your social media profiles private and restrict photo visibility to confirmed friends.',
      'Enable Two-Factor Authentication (2FA) with an authenticator app on all social media accounts.',
      'Never share password reset codes or WhatsApp verification codes with anyone.',
    ],
    faq: [
      {
        question: 'How do I protect my WhatsApp from being taken over?',
        answer: 'Open WhatsApp Settings > Account > Two-step verification > Enable. Set a 6-digit PIN. Never share this PIN or SMS verification codes.'
      }
    ]
  },
  {
    id: 'identity-theft-aadhaar',
    category: 'Digital Identity',
    title: 'Identity Theft & SIM Swap',
    subtitle: 'Protecting Aadhaar, PAN, and mobile SIM cards from unauthorized exploitation.',
    shortDesc: 'Criminals obtain photocopies of IDs to issue duplicate SIM cards or apply for fraudulent instant loans in your name.',
    iconName: 'UserX',
    severity: 'critical',
    redFlags: [
      'Your mobile phone suddenly loses cellular network reception while others around you have full signal.',
      'Receiving alerts for loan applications or credit bureau inquiries you never initiated.',
      'Aadhaar authentication OTPs received when you are not carrying out any service transaction.',
    ],
    immediateActions: [
      'If your phone abruptly loses network, immediately contact your telecom operator to check for SIM swap attempts.',
      'Log in to UIDAI portal (m-Aadhaar) and Lock your Aadhaar Biometrics immediately.',
      'Check your CIBIL / Experian credit report for unauthorized personal loans or credit cards.',
    ],
    preventionTips: [
      'Use Masked Aadhaar (where only the last 4 digits are visible) whenever submitting identity proofs.',
      'Lock your Aadhaar biometrics using the UIDAI portal/app; unlock only when needed.',
      'Never upload unmasked identity cards to unverified websites or telegram bots.',
    ],
    faq: [
      {
        question: 'What is Masked Aadhaar?',
        answer: 'Masked Aadhaar replaces the first 8 digits of your 12-digit Aadhaar number with "XXXX-XXXX", showing only the last 4 digits. It is legally valid everywhere and prevents identity theft.'
      }
    ]
  },
  {
    id: 'online-shopping-fraud',
    category: 'Consumer Protection',
    title: 'Online Shopping & Fake E-Commerce',
    subtitle: 'Branded shoes, electronics, or clothes offered at 90% discount on social ads.',
    shortDesc: 'Deceptive advertisements on Instagram and Facebook directing users to sham websites that take prepaid orders and vanish.',
    iconName: 'ShoppingBag',
    severity: 'medium',
    redFlags: [
      'Unbelievable prices (e.g., latest iPhone or high-end sneakers for ₹999).',
      'Website only offers Online Prepayment / UPI; "Cash on Delivery" is disabled or has an unrealistic surcharge.',
      'Website has no physical address, no valid customer support email, or domain was registered 3 days ago.',
    ],
    immediateActions: [
      'Contact your credit card issuer or bank immediately to initiate a chargeback / transaction dispute.',
      'Take screenshots of order confirmation, payment receipt, and product page.',
      'Report the fraudulent advertisement to the platform (Meta, Google).',
    ],
    preventionTips: [
      'Opt for Cash on Delivery (COD) on newly discovered e-commerce stores until credibility is established.',
      'Check website URL carefully for misspellings (e.g., flipkarrt.store instead of flipkart.com).',
      'Look for authentic user reviews on independent forums rather than on-site testimonials.',
    ],
    faq: [
      {
        question: 'Can I chargeback a credit card transaction for non-delivery?',
        answer: 'Yes! Credit card regulations provide dispute resolution for non-delivery of merchandise. Contact your issuing bank customer support to file a chargeback form.'
      }
    ]
  }
];

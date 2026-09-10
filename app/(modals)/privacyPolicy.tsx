import React from 'react';
import { LegalDocumentBody, ScreenContainer, ScreenHeader } from '@/components';
import { colors } from '@/constants/theme';
import type { LegalSection } from '@/utils/types';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Information We Collect',
    subsections: [
      {
        heading: 'Information You Provide',
        blocks: [
          {
            type: 'paragraph',
            text: 'When you interact with Declut, join our waitlist, create an account, or use our services, we may collect information such as:',
          },
          {
            type: 'bullets',
            items: [
              'Full name',
              'Email address',
              'Phone number',
              'Profile information',
              'Account credentials',
              'Location or address information',
              'Payment-related information',
              'Bank or payout information',
              'Identity verification information, where required',
              'Listings and product information',
              'Photographs and descriptions of items',
              'Messages or communications relating to transactions',
              'Customer support requests',
              'Dispute and refund information',
            ],
          },
        ],
      },
      {
        heading: 'Waitlist and Pre-Launch Information',
        blocks: [
          {
            type: 'paragraph',
            text: 'If you join the Declut waitlist or register your interest before the Platform becomes generally available, we may collect:',
          },
          {
            type: 'bullets',
            items: [
              'Your email address;',
              'Your stated interest in using Declut as a buyer, seller, or both;',
              'The date and time you joined the waitlist;',
              'Referral or acquisition information indicating how you discovered Declut, where available; and',
              'Information relating to your interaction with our pre-launch website or communications.',
            ],
          },
          {
            type: 'paragraph',
            text: 'We use this information to manage the waitlist, understand interest in Declut, prepare for launch, provide early-access opportunities where applicable, and communicate important information about the availability and launch of Declut.',
          },
          {
            type: 'paragraph',
            text: 'Joining the waitlist does not create a Declut account and does not guarantee access to any particular feature, promotion, or launch date.',
          },
        ],
      },
      {
        heading: 'Transaction Information',
        blocks: [
          { type: 'paragraph', text: 'When you buy or sell through Declut, we may collect information relating to the transaction, including:' },
          {
            type: 'bullets',
            items: [
              'Items purchased or sold',
              'Transaction amount',
              'Payment status',
              'Payment method',
              'Refund information',
              'Inspection status',
              'Dispute information',
              'Transaction dates and timestamps',
            ],
          },
          {
            type: 'paragraph',
            text: 'Payment information may be processed by third-party payment service providers. Declut may not directly store complete debit or credit card details.',
          },
        ],
      },
      {
        heading: 'Device and Usage Information',
        blocks: [
          { type: 'paragraph', text: 'We may automatically collect technical information when you visit our website or use Declut, including:' },
          {
            type: 'bullets',
            items: [
              'Device type',
              'Operating system',
              'IP address',
              'Browser information',
              'App version',
              'Device identifiers',
              'Pages or screens viewed',
              'Features used',
              'Crash and diagnostic information',
              'Login activity',
              'Referral or traffic source, where available',
            ],
          },
          {
            type: 'paragraph',
            text: 'This information helps us understand how people discover and interact with Declut and allows us to maintain, secure, and improve the Platform.',
          },
        ],
      },
      {
        heading: 'Location Information',
        blocks: [
          {
            type: 'paragraph',
            text: 'Where you provide permission, Declut may use your location to provide location-based functionality, including helping users discover relevant listings or facilitating transactions.',
          },
          { type: 'paragraph', text: 'You may control location permissions through your browser or device settings.' },
        ],
      },
    ],
  },
  {
    heading: '2. How We Use Your Information',
    blocks: [
      { type: 'paragraph', text: 'We may use your information to:' },
      {
        type: 'bullets',
        items: [
          'Manage the Declut pre-launch waitlist;',
          'Confirm that you have successfully joined the waitlist;',
          'Notify waitlist members when Declut launches or becomes available;',
          'Provide information about early access, where offered;',
          'Send relevant Declut product, launch, and service updates in accordance with applicable law and your communication preferences;',
          'Understand whether prospective users are interested in buying, selling, or both;',
          'Measure and understand pre-launch demand and the effectiveness of our marketing and referral channels;',
          'Create and manage your account;',
          "Provide Declut's marketplace services;",
          'Display and manage product listings;',
          'Facilitate transactions between buyers and sellers;',
          'Process payments, payouts, refunds, and related financial activities;',
          'Facilitate item inspection and transaction completion;',
          'Prevent fraud and unauthorised activity;',
          'Investigate disputes;',
          'Provide customer support;',
          'Verify users where necessary;',
          'Send transaction and account notifications;',
          'Improve the Platform and develop new features;',
          'Monitor Platform performance;',
          'Enforce our Terms of Use;',
          'Comply with applicable legal and regulatory requirements; and',
          'Protect Declut, our users, and third parties.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Where communications are optional, you may unsubscribe using the unsubscribe option provided in our communications or by contacting us.',
      },
      {
        type: 'paragraph',
        text: 'Unsubscribing from promotional or pre-launch communications does not necessarily prevent us from sending communications that are required to provide a service you have requested or for other legitimate administrative, security, or legal purposes.',
      },
    ],
  },
  {
    heading: '3. How We Share Information',
    blocks: [
      { type: 'paragraph', text: 'We do not sell your personal information.' },
      { type: 'paragraph', text: 'We may share information where reasonably necessary with:' },
    ],
    subsections: [
      {
        heading: 'Other Declut Users',
        blocks: [
          {
            type: 'paragraph',
            text: 'Certain information may be shared between buyers and sellers where necessary to facilitate a transaction.',
          },
          { type: 'paragraph', text: 'We aim to limit the information disclosed to what is reasonably required for the relevant transaction.' },
          {
            type: 'paragraph',
            text: 'Waitlist information is not made publicly available to other Declut users merely because you have joined the waitlist.',
          },
        ],
      },
      {
        heading: 'Service Providers',
        blocks: [
          { type: 'paragraph', text: 'We may work with third-party providers that assist us with:' },
          {
            type: 'bullets',
            items: [
              'Payment processing',
              'Identity verification',
              'Hosting and cloud infrastructure',
              'Waitlist management',
              'Email and customer communication',
              'Analytics',
              'Customer support',
              'Fraud detection',
              'Security',
              'Logistics or related services where applicable',
            ],
          },
          {
            type: 'paragraph',
            text: 'These providers may process information only as necessary to provide their services to Declut, subject to applicable agreements and law.',
          },
        ],
      },
      {
        heading: 'Legal and Regulatory Authorities',
        blocks: [
          {
            type: 'paragraph',
            text: 'We may disclose information where required by law, court order, regulatory obligation, or lawful government request.',
          },
          {
            type: 'paragraph',
            text: 'We may also disclose information where reasonably necessary to investigate fraud, protect users, enforce our agreements, or protect the rights and safety of Declut or others.',
          },
        ],
      },
    ],
  },
  {
    heading: '4. Payments and Financial Information',
    blocks: [
      { type: 'paragraph', text: 'Payments made through Declut may be processed by authorised third-party payment providers.' },
      { type: 'paragraph', text: 'Your payment information is subject to the privacy and security practices of the relevant payment provider.' },
      {
        type: 'paragraph',
        text: 'Where Declut facilitates the holding of transaction funds pending completion of a transaction, such arrangements may be provided through appropriately authorised payment partners.',
      },
    ],
  },
  {
    heading: '5. Data Security',
    blocks: [
      {
        type: 'paragraph',
        text: 'We implement reasonable administrative, organisational, and technical measures designed to protect personal information against unauthorised access, disclosure, alteration, loss, or misuse.',
      },
      { type: 'paragraph', text: 'However, no electronic system or method of transmission is completely secure, and we cannot guarantee absolute security.' },
      {
        type: 'paragraph',
        text: 'If you create a Declut account, you are responsible for keeping your password, verification codes, and other account credentials confidential.',
      },
    ],
  },
  {
    heading: '6. Data Retention',
    blocks: [
      {
        type: 'paragraph',
        text: 'We retain personal information for as long as reasonably necessary for the purposes for which it was collected, including to:',
      },
      {
        type: 'bullets',
        items: [
          'Manage our pre-launch waitlist;',
          'Provide launch and early-access communications;',
          'Provide our services;',
          'Maintain transaction records;',
          'Resolve disputes;',
          'Prevent fraud;',
          'Meet accounting, tax, legal, and regulatory obligations; and',
          'Enforce our agreements.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Waitlist information may be retained through the launch of Declut where reasonably necessary to notify you about availability and facilitate your transition to the Platform.',
      },
      {
        type: 'paragraph',
        text: 'Joining the waitlist does not automatically create a Declut account. Where you subsequently create an account, information associated with your waitlist registration may be linked to your account where appropriate.',
      },
      {
        type: 'paragraph',
        text: 'If you unsubscribe from waitlist or marketing communications, we may retain limited information necessary to record and respect your communication preference and comply with applicable legal obligations.',
      },
      {
        type: 'paragraph',
        text: 'Information may otherwise be deleted, anonymised, or securely retained when it is no longer required, subject to applicable legal obligations.',
      },
    ],
  },
  {
    heading: '7. Your Rights',
    blocks: [
      { type: 'paragraph', text: 'Subject to applicable data protection laws, you may have the right to:' },
      {
        type: 'bullets',
        items: [
          'Request access to your personal information;',
          'Request correction of inaccurate information;',
          'Request deletion of certain information;',
          'Object to or restrict certain processing;',
          'Withdraw consent where processing is based on consent;',
          'Unsubscribe from optional marketing or pre-launch communications; and',
          'Request information about how your personal data is processed.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Certain information may need to be retained where required for legal, security, fraud-prevention, accounting, or regulatory purposes.',
      },
      { type: 'paragraph', text: 'Requests may be submitted to Declut@vereinight.com.' },
    ],
  },
  {
    heading: '8. Cookies and Similar Technologies',
    blocks: [
      {
        type: 'paragraph',
        text: 'Our website and Platform may use cookies, SDKs, analytics tools, and similar technologies to remember preferences, understand usage, measure the effectiveness of marketing or referral campaigns, improve performance, and maintain security.',
      },
      {
        type: 'paragraph',
        text: 'These technologies may also help us understand how visitors discover and interact with our pre-launch website and waitlist.',
      },
      {
        type: 'paragraph',
        text: 'Where required, you may manage certain tracking preferences through your browser, device, cookie controls, or Platform settings.',
      },
    ],
  },
  {
    heading: "9. Children's Privacy",
    blocks: [
      {
        type: 'paragraph',
        text: 'Declut is not intended for children under the minimum age permitted to independently enter into transactions under applicable law.',
      },
      { type: 'paragraph', text: 'We do not knowingly collect personal information from children in violation of applicable law.' },
    ],
  },
  {
    heading: '10. Third-Party Services',
    blocks: [
      { type: 'paragraph', text: 'Declut may contain links to or integrate with third-party websites and services.' },
      {
        type: 'paragraph',
        text: 'Their privacy practices are governed by their respective privacy policies. Declut is not responsible for the privacy practices of independent third parties.',
      },
    ],
  },
  {
    heading: '11. Changes to This Privacy Policy',
    blocks: [
      {
        type: 'paragraph',
        text: 'We may update this Privacy Policy periodically to reflect changes to our services, launch status, legal requirements, or business practices.',
      },
      { type: 'paragraph', text: 'Where changes are material, we may notify users through the Platform, email, or another appropriate method.' },
      { type: 'paragraph', text: 'The "Last Updated" date will indicate when the Policy was most recently revised.' },
    ],
  },
  {
    heading: '12. Contact Us',
    blocks: [
      {
        type: 'paragraph',
        text: 'For questions, complaints, or requests relating to this Privacy Policy or your personal information, contact:',
      },
      { type: 'paragraph', text: 'Declut' },
      { type: 'paragraph', text: 'Email: Mydeclutapp@gmail.com' },
      { type: 'paragraph', text: 'Address: 5 Ogunsiji Close, Allen, Ikeja, Lagos State, Nigeria' },
      { type: 'paragraph', text: 'Website: Declut.com.ng' },
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScreenContainer background={colors.white} header={<ScreenHeader title="Privacy Policy" />}>
      <LegalDocumentBody
        title="Privacy Policy"
        effectiveDate="11 August, 2026"
        lastUpdated="12 August, 2026"
        intro={[
          'Declut ("Declut", "we", "us", or "our") respects your privacy and is committed to protecting the personal information you provide when you visit the Declut website, join our waitlist, use the Declut mobile application, or use our related services (collectively, the "Platform").',
          'This Privacy Policy explains what information we collect, why we collect it, how we use and protect it, and the choices available to you.',
          'By accessing or using Declut or providing your information through the Platform, you acknowledge the practices described in this Privacy Policy.',
        ]}
        sections={SECTIONS}
      />
    </ScreenContainer>
  );
}

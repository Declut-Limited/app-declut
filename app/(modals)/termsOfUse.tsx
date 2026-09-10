import React from 'react';
import { LegalDocumentBody, ScreenContainer, ScreenHeader } from '@/components';
import { colors } from '@/constants/theme';
import type { LegalSection } from '@/utils/types';

const SECTIONS: LegalSection[] = [
  {
    heading: '1. About Declut',
    blocks: [
      { type: 'paragraph', text: 'Declut is a marketplace that enables users to list, discover, buy, and sell items, including pre-owned household and personal items.' },
      { type: 'paragraph', text: 'Declut provides technology and related services that facilitate transactions between buyers and sellers.' },
      {
        type: 'paragraph',
        text: 'Unless expressly stated otherwise, Declut is not the owner, manufacturer, or seller of items listed by independent sellers on the Platform.',
      },
    ],
  },
  {
    heading: '2. Eligibility',
    blocks: [
      { type: 'paragraph', text: 'You must have the legal capacity required under applicable law to enter into transactions through Declut.' },
      { type: 'paragraph', text: 'By creating an account, you represent that:' },
      {
        type: 'bullets',
        items: [
          'The information you provide is accurate;',
          'You are legally permitted to use the Platform;',
          'You will comply with these Terms; and',
          'You will not use Declut for unlawful or fraudulent purposes.',
        ],
      },
    ],
  },
  {
    heading: '3. Accounts',
    blocks: [
      { type: 'paragraph', text: 'You are responsible for maintaining the confidentiality and security of your account.' },
      {
        type: 'paragraph',
        text: 'You are responsible for activities performed through your account unless caused by circumstances for which Declut is legally responsible.',
      },
      { type: 'paragraph', text: 'Notify Declut immediately if you believe your account has been compromised.' },
      {
        type: 'paragraph',
        text: 'Declut may suspend or restrict accounts reasonably suspected of fraud, abuse, prohibited activity, or serious violations of these Terms.',
      },
    ],
  },
  {
    heading: '4. Selling on Declut',
    blocks: [
      { type: 'paragraph', text: 'Sellers are responsible for ensuring that their listings are accurate and truthful.' },
      { type: 'paragraph', text: 'When listing an item, sellers must accurately disclose relevant information including:' },
      {
        type: 'bullets',
        items: [
          'Item condition;',
          'Known defects or damage;',
          'Appropriate photographs;',
          'Product description;',
          'Price; and',
          "Other material information that may reasonably influence a buyer's decision.",
        ],
      },
      {
        type: 'paragraph',
        text: "Sellers must not intentionally misrepresent an item's condition, authenticity, ownership, or characteristics.",
      },
    ],
  },
  {
    heading: '5. Prohibited Items',
    blocks: [
      { type: 'paragraph', text: "Users must not list, sell, purchase, or attempt to transact in items prohibited by applicable law or Declut's policies." },
      { type: 'paragraph', text: 'This may include:' },
      {
        type: 'bullets',
        items: [
          'Illegal goods;',
          'Stolen property;',
          'Counterfeit products;',
          'Weapons or other restricted items;',
          'Illegal drugs or controlled substances;',
          'Hazardous materials;',
          'Fraudulent products;',
          'Items that infringe intellectual property rights; and',
          'Any other items Declut determines cannot lawfully or safely be traded through the Platform.',
        ],
      },
      { type: 'paragraph', text: 'Declut may remove prohibited listings and restrict or suspend associated accounts.' },
    ],
  },
  {
    heading: '6. Buying on Declut',
    blocks: [
      { type: 'paragraph', text: 'Buyers are responsible for reviewing listing information before purchasing an item.' },
      {
        type: 'paragraph',
        text: 'Where the transaction includes physical inspection, buyers should inspect the item carefully before confirming that the transaction has been successfully completed.',
      },
      { type: 'paragraph', text: 'Buyers should verify, where applicable:' },
      {
        type: 'bullets',
        items: [
          'The physical condition of the item;',
          'Whether it matches the listing;',
          'Significant defects;',
          'Basic functionality; and',
          'Other material characteristics reasonably capable of being inspected.',
        ],
      },
    ],
  },
  {
    heading: '7. Payments and Transaction Protection',
    blocks: [
      { type: 'paragraph', text: "Eligible transactions may use Declut's transaction protection process." },
      {
        type: 'paragraph',
        text: "When a buyer makes payment, funds may be held through Declut's authorised payment infrastructure or payment partners until the relevant conditions for releasing the funds are satisfied.",
      },
      { type: 'paragraph', text: 'Funds are not necessarily immediately available to the seller after payment by the buyer.' },
      {
        type: 'paragraph',
        text: 'Where inspection applies, the buyer may be required to inspect and confirm acceptance of the item before funds are released to the seller.',
      },
    ],
  },
  {
    heading: '8. Inspection and Confirmation',
    blocks: [
      {
        type: 'paragraph',
        text: "Declut's marketplace is designed to encourage buyers to inspect eligible items before final transaction completion.",
      },
      { type: 'paragraph', text: 'Once a buyer confirms that an item is acceptable and the transaction is completed, funds may be released to the seller.' },
      { type: 'paragraph', text: 'Buyers should therefore avoid confirming acceptance before they are reasonably satisfied with the item.' },
      {
        type: 'paragraph',
        text: 'Where a buyer identifies a material issue before confirming acceptance, the buyer should initiate the applicable rejection or dispute process through Declut.',
      },
    ],
  },
  {
    heading: '9. Disputes',
    blocks: [
      { type: 'paragraph', text: 'A buyer may raise a dispute where an item materially differs from its listing, including situations involving:' },
      {
        type: 'bullets',
        items: ['Undisclosed significant damage;', 'Materially inaccurate descriptions;', 'Incorrect items;', 'Suspected counterfeit goods; or', 'Other significant misrepresentation.'],
      },
      {
        type: 'paragraph',
        text: 'Declut may request information from both parties, including photographs, listing information, communications, receipts, or other evidence.',
      },
      { type: 'paragraph', text: 'Declut may restrict the transaction while the dispute is being reviewed.' },
      { type: 'paragraph', text: 'Users agree to cooperate reasonably with dispute investigations.' },
      {
        type: 'paragraph',
        text: 'Declut may make determinations regarding Platform-level transaction handling based on available evidence, applicable policies, and legal requirements. Nothing in these Terms removes rights that cannot legally be excluded.',
      },
    ],
  },
  {
    heading: '10. Refunds',
    blocks: [
      { type: 'paragraph', text: 'Refund eligibility is governed by the Declut Refund Policy, which forms part of these Terms.' },
      {
        type: 'paragraph',
        text: "A refund of the item's purchase price does not necessarily mean that every Platform, processing, or service charge is refundable.",
      },
      { type: 'paragraph', text: 'Any applicable non-refundable charges will be disclosed in accordance with the Refund Policy and applicable law.' },
    ],
  },
  {
    heading: '11. Fees',
    blocks: [
      { type: 'paragraph', text: 'Declut may charge service, transaction, processing, listing, seller, buyer, or other fees.' },
      { type: 'paragraph', text: 'Applicable fees will be communicated before users complete transactions where required.' },
      { type: 'paragraph', text: 'Declut may change its fee structure from time to time, subject to applicable notice requirements.' },
    ],
  },
  {
    heading: '12. User Conduct',
    blocks: [
      { type: 'paragraph', text: 'You must not:' },
      {
        type: 'bullets',
        items: [
          'Commit or attempt fraud;',
          'Manipulate transactions or reviews;',
          'Harass, threaten, or abuse another user;',
          'Provide deliberately misleading information;',
          "Interfere with the Platform's operation;",
          'Attempt unauthorised access to another account;',
          'Upload malicious software;',
          'Use Declut for unlawful purposes;',
          'Create transactions intended to exploit refunds or promotions; or',
          "Circumvent Declut's payment or safety systems in violation of applicable Platform policies.",
        ],
      },
    ],
  },
  {
    heading: '13. Marketplace Transactions',
    blocks: [
      { type: 'paragraph', text: 'Declut facilitates transactions between independent users.' },
      { type: 'paragraph', text: 'Except where expressly stated otherwise, the sales contract for an item is between the buyer and seller.' },
      { type: 'paragraph', text: 'Sellers remain responsible for the items they list and for complying with applicable obligations relating to their sales.' },
      { type: 'paragraph', text: 'Declut does not guarantee that every item listed will sell or that every buyer or seller will complete a proposed transaction.' },
    ],
  },
  {
    heading: '14. Intellectual Property',
    blocks: [
      {
        type: 'paragraph',
        text: 'The Declut name, logo, interface, software, branding, graphics, and other proprietary Platform materials are owned by or licensed to Declut and are protected by applicable intellectual property laws.',
      },
      {
        type: 'paragraph',
        text: 'Users retain ownership of content they submit but grant Declut the permissions reasonably necessary to host, display, reproduce, process, and distribute that content for operating and promoting the Platform.',
      },
    ],
  },
  {
    heading: '15. Suspension and Termination',
    blocks: [
      { type: 'paragraph', text: 'Declut may suspend, restrict, or terminate access where reasonably necessary because of:' },
      {
        type: 'bullets',
        items: [
          'Fraud or suspected fraud;',
          'Serious or repeated violations of these Terms;',
          'Illegal activity;',
          'Abuse of other users;',
          'Payment-related misconduct;',
          'Security risks; or',
          'Legal or regulatory requirements.',
        ],
      },
      { type: 'paragraph', text: 'Where appropriate and legally required, users may be given notice or an opportunity to appeal.' },
    ],
  },
  {
    heading: '16. Limitation of Liability',
    blocks: [
      {
        type: 'paragraph',
        text: 'To the maximum extent permitted by applicable law, Declut will not be responsible for indirect or consequential losses arising solely from transactions between independent buyers and sellers.',
      },
      { type: 'paragraph', text: 'Nothing in these Terms excludes or limits liability that cannot legally be excluded or restricted.' },
    ],
  },
  {
    heading: '17. Privacy',
    blocks: [{ type: 'paragraph', text: 'Our collection and use of personal information is governed by the Declut Privacy Policy.' }],
  },
  {
    heading: '18. Changes to These Terms',
    blocks: [
      {
        type: 'paragraph',
        text: 'We may update these Terms as Declut develops or where required by changes in law, regulation, technology, or our services.',
      },
      { type: 'paragraph', text: 'Material changes may be communicated through the Platform, email, or another appropriate method.' },
      { type: 'paragraph', text: 'Continued use after the effective date of updated Terms constitutes acceptance where permitted by law.' },
    ],
  },
  {
    heading: '19. Governing Law',
    blocks: [
      { type: 'paragraph', text: 'These Terms are governed by the laws of the Federal Republic of Nigeria.' },
      {
        type: 'paragraph',
        text: 'Any dispute relating to these Terms will be handled in accordance with applicable Nigerian law and any dispute-resolution process specified by Declut or required by law.',
      },
    ],
  },
  {
    heading: '20. Contact',
    blocks: [
      { type: 'paragraph', text: 'Questions regarding these Terms may be sent to:' },
      { type: 'paragraph', text: 'Declut' },
      { type: 'paragraph', text: 'Email: Mydeclutapp@gmail.com' },
      { type: 'paragraph', text: 'Address: 5 Ogunsiji close, Allen, Ikeja, Lagos state.' },
      { type: 'paragraph', text: 'Website: Declut.com.ng' },
    ],
  },
];

export default function TermsOfUseScreen() {
  return (
    <ScreenContainer background={colors.white} header={<ScreenHeader title="Terms of Use" />}>
      <LegalDocumentBody
        title="Terms of Use"
        effectiveDate="11 August, 2026"
        lastUpdated="11 August, 2026"
        intro={[
          'Welcome to Declut.',
          'These Terms of Use ("Terms") govern your access to and use of the Declut mobile application, website, marketplace, and related services ("Declut" or the "Platform").',
          'By creating an account, accessing, or using Declut, you agree to these Terms.',
        ]}
        sections={SECTIONS}
      />
    </ScreenContainer>
  );
}

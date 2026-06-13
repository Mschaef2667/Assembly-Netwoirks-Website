import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Terms of Service — Assembly AI',
  description: 'Terms of Service for Assembly AI by Assembly Networks, LLC.',
}

const PAGE: CSSProperties = {
  backgroundColor: '#F8F6F1',
  minHeight: '100vh',
  color: '#0D0D0D',
}

const HEADER: CSSProperties = {
  backgroundColor: '#0A1628',
  padding: '20px 32px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const HEADER_INNER: CSSProperties = {
  maxWidth: '880px',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
}

const CONTENT: CSSProperties = {
  maxWidth: '880px',
  margin: '0 auto',
  padding: '48px 32px 64px',
  backgroundColor: '#FFFFFF',
}

const H1: CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#0A1628',
  margin: '0 0 8px',
  lineHeight: 1.2,
}

const META: CSSProperties = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0 0 32px',
}

const H2: CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0A1628',
  margin: '36px 0 12px',
  lineHeight: 1.3,
}

const H3: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#0A1628',
  margin: '20px 0 8px',
  lineHeight: 1.4,
}

const P: CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.7,
  color: '#0D0D0D',
  margin: '0 0 14px',
}

const UL: CSSProperties = {
  margin: '0 0 14px',
  paddingLeft: '22px',
  fontSize: '15px',
  lineHeight: 1.7,
  color: '#0D0D0D',
}

const LI: CSSProperties = {
  marginBottom: '6px',
}

const FOOTER: CSSProperties = {
  maxWidth: '880px',
  margin: '0 auto',
  padding: '24px 32px 48px',
  borderTop: '1px solid #E5E7EB',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  fontSize: '13px',
  color: '#6B7280',
  backgroundColor: '#FFFFFF',
}

const FOOTER_LINK: CSSProperties = {
  color: '#0EA5E9',
  textDecoration: 'none',
  fontWeight: 500,
}

export default function TermsOfServicePage() {
  return (
    <div style={PAGE}>
      <header style={HEADER}>
        <div style={HEADER_INNER}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/images/logo.png"
              alt="Assembly AI"
              width={160}
              height={40}
              style={{ maxHeight: '40px', width: 'auto' }}
            />
          </Link>
          <nav style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main style={CONTENT}>
        <h1 style={H1}>Assembly AI — Terms of Service (B2B)</h1>
        <p style={META}>Effective Date: July 1, 2026</p>

        <p style={P}>
          These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the Assembly AI website,
          application, APIs, and related services (collectively, the &ldquo;Services&rdquo;) provided by Assembly
          Networks, LLC, a Colorado limited liability company (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
          By creating an account, clicking &ldquo;I agree,&rdquo; signing an order form, or using the Services, you
          agree to these Terms on behalf of yourself and the business or organization you represent
          (&ldquo;Customer,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;). If you do not agree, do not use the Services.
        </p>
        <p style={P}>Website: www.assemblyai.net</p>

        <h2 style={H2}>1) Authority; Eligibility</h2>
        <p style={P}>
          You represent and warrant that: (a) you are at least 18 years old; (b) you are using the Services
          for business purposes; and (c) you have the legal authority to bind Customer to these Terms. The
          Services are not directed to children or minors.
        </p>

        <h2 style={H2}>2) Changes to the Terms</h2>
        <p style={P}>
          We may update these Terms from time to time. If we make material changes, we will provide
          reasonable notice (e.g., via the Services or email). Continued use of the Services after the
          effective date of an update constitutes acceptance of the updated Terms.
        </p>

        <h2 style={H2}>3) Definitions</h2>
        <p style={P}>
          &ldquo;Customer Content&rdquo; means any data, content, files, text, prompts, audio, video, documents, or
          other materials submitted to the Services by or on behalf of Customer (including outputs
          generated from Customer inputs).
        </p>
        <p style={P}>
          &ldquo;Confidential Information&rdquo; means non-public information disclosed by one party to the other
          that is designated as confidential or that reasonably should be understood to be confidential
          given its nature and the circumstances of disclosure, including Customer Content and information
          about business operations, products, technology, and security practices.
        </p>
        <p style={P}>
          &ldquo;Order Form&rdquo; means an order form, online checkout, statement of work, or other purchasing
          document referencing these Terms.
        </p>

        <h2 style={H2}>4) Accounts; Security; Admin Responsibilities</h2>
        <p style={P}><strong>4.1 Account Registration.</strong> You must provide accurate account information and keep it updated.</p>
        <p style={P}>
          <strong>4.2 Security.</strong> You are responsible for maintaining the confidentiality of login
          credentials and for all activities under your account(s). You will promptly notify us at
          info@assemblynetworks.net of any suspected unauthorized access.
        </p>
        <p style={P}>
          <strong>4.3 Admins.</strong> If Customer designates administrators, those admins may manage users,
          permissions, and settings. Customer is responsible for admin actions and user access controls.
        </p>

        <h2 style={H2}>5) License; Ownership; Restrictions</h2>
        <p style={P}>
          <strong>5.1 License to Use.</strong> Subject to these Terms and payment of applicable fees, we grant
          Customer a limited, non-exclusive, non-transferable, revocable license to access and use the
          Services during the applicable subscription term for Customer&rsquo;s internal business purposes.
        </p>
        <p style={P}>
          <strong>5.2 Company IP.</strong> We retain all rights, title, and interest in and to the Services,
          including all related software, technology, documentation, and intellectual property. No rights
          are granted except as expressly stated.
        </p>
        <p style={P}><strong>5.3 Restrictions.</strong> Customer will not (and will not permit any third party to):</p>
        <ul style={UL}>
          <li style={LI}>(a) reverse engineer, decompile, or attempt to discover source code or underlying components of the Services;</li>
          <li style={LI}>(b) scrape, crawl, harvest, or extract data from the Services except as expressly permitted in writing;</li>
          <li style={LI}>(c) use the Services to develop or improve a competing product or service, or for competitive benchmarking intended for publication without our written consent;</li>
          <li style={LI}>(d) bypass rate limits, access controls, or security protections;</li>
          <li style={LI}>(e) introduce malware or attempt unauthorized access;</li>
          <li style={LI}>(f) use the Services in violation of applicable law, including export/sanctions laws; or</li>
          <li style={LI}>(g) use the Services to infringe or misappropriate intellectual property or other rights.</li>
        </ul>

        <h2 style={H2}>6) Customer Content; Responsibilities</h2>
        <p style={P}>
          <strong>6.1 Ownership.</strong> As between the parties, Customer retains ownership of Customer Content.
        </p>
        <p style={P}>
          <strong>6.2 Permission to Process.</strong> Customer grants Company a worldwide, non-exclusive license
          to host, store, reproduce, transmit, and otherwise process Customer Content solely to: (a)
          provide, maintain, support, and secure the Services; (b) comply with applicable law; (c) enforce
          these Terms; and (d) improve the Services only in aggregated and/or de-identified form, and not
          in a manner that identifies Customer or any individual, builds profiles about Customer, or
          discloses Customer Content to any third party except as permitted under these Terms.
        </p>
        <p style={P}>
          <strong>6.3 Customer Responsibilities.</strong> Customer is solely responsible for: (a) Customer
          Content, including its accuracy, quality, legality, and how it was obtained; (b) ensuring it has
          all rights, permissions, and lawful basis to submit Customer Content to the Services; and (c)
          implementing appropriate internal policies for handling sensitive information.
        </p>
        <p style={P}>
          <strong>6.4 No Regulated Data.</strong> Customer agrees not to submit regulated data unless the
          parties sign a separate written agreement covering such data (e.g., HIPAA/BAA). Without limiting
          the foregoing, do not submit protected health information, children&rsquo;s data, or similarly
          regulated content.
        </p>
        <p style={P}>
          <strong>6.5 Prohibited Content.</strong> Customer will not submit content that is unlawful, harmful,
          infringing, deceptive, or that violates third-party rights.
        </p>

        <h2 style={H2}>7) Confidentiality; Non-Disclosure</h2>
        <p style={P}>
          <strong>7.1 Obligations.</strong> Each party (the &ldquo;Receiving Party&rdquo;) will: (a) use the other
          party&rsquo;s Confidential Information only to perform under these Terms; (b) protect Confidential
          Information using at least reasonable care and no less than the care it uses to protect its own
          confidential information of similar sensitivity; and (c) not disclose Confidential Information to
          any third party except as permitted below.
        </p>
        <p style={P}>
          <strong>7.2 Permitted Disclosures.</strong> The Receiving Party may disclose Confidential Information
          to its employees, contractors, and professional advisors who have a need to know and are bound by
          confidentiality obligations at least as protective as these Terms. Company may also disclose
          Customer Confidential Information to subprocessors and service providers (including hosting,
          analytics, and payment providers) solely to provide the Services, subject to confidentiality and
          security obligations.
        </p>
        <p style={P}>
          <strong>7.3 Exceptions.</strong> Confidential Information does not include information that the
          Receiving Party can demonstrate: (a) is or becomes publicly available through no breach of these
          Terms; (b) was known to the Receiving Party without restriction before receipt; (c) is
          independently developed without use of the disclosing party&rsquo;s Confidential Information; or (d) is
          rightfully received from a third party without breach of any obligation.
        </p>
        <p style={P}>
          <strong>7.4 Compelled Disclosure.</strong> If the Receiving Party is required by law to disclose
          Confidential Information, it will (to the extent legally permitted) provide prompt notice to the
          disclosing party and reasonably cooperate to seek protective treatment.
        </p>
        <p style={P}>
          <strong>7.5 Injunctive Relief.</strong> Unauthorized disclosure or misuse of Confidential Information
          may cause irreparable harm. The harmed party may seek injunctive relief in addition to other
          remedies.
        </p>

        <h2 style={H2}>8) Privacy; Data Handling; Security</h2>
        <p style={P}>
          Our Privacy Policy at <Link href="/privacy" style={{ color: '#0EA5E9' }}>www.assemblyai.net/privacy</Link>{' '}
          describes how we collect and use personal information. Customer acknowledges that we may process
          Customer Content and account data as described in these Terms and the Privacy Policy.
        </p>
        <p style={P}>
          <strong>Retention/Deletion.</strong> We retain Customer Content for as long as Customer&rsquo;s account
          is active and in good standing. After account closure or termination, we will delete or
          de-identify Customer Content within thirty (30) days, except to the extent: (a) Customer requests
          extended retention (up to ninety (90) days) to support export or transition; (b) retention is
          required to comply with applicable law; or (c) retention is reasonably necessary to resolve
          disputes or enforce these Terms. Customer Content stored in system backups may persist for a
          limited period and will be deleted on a rolling basis within sixty (60) days after deletion.
        </p>
        <p style={P}>
          We may retain limited account information and transactional records (e.g., invoices, payment
          status, audit/security logs) for accounting, tax, compliance, and security purposes, and as
          otherwise required or permitted by law.
        </p>
        <p style={P}>
          <strong>Security.</strong> We maintain reasonable administrative, technical, and physical
          safeguards designed to protect Customer Content. However, no system can be guaranteed 100%
          secure, and Customer is responsible for appropriate internal access controls, credential
          hygiene, and policies governing submission of sensitive information.
        </p>

        <h2 style={H2}>8A) Data Roles; Processing; Subprocessors</h2>
        <p style={P}>
          <strong>8A.1 Customer as Controller.</strong> Customer determines the purposes and means of
          processing Customer Content submitted to the Services. As between the parties, Customer is
          responsible for obtaining all rights, permissions, and lawful bases required to submit Customer
          Content (including any personal information) to the Services and to instruct Company to process
          that content.
        </p>
        <p style={P}>
          <strong>8A.2 Company as Service Provider/Processor.</strong> Company processes Customer Content
          only: (a) as necessary to provide, maintain, secure, and support the Services; (b) as instructed
          by Customer through its configuration and use of the Services; (c) to comply with applicable law;
          and (d) to enforce these Terms. Company does not sell Customer Content.
        </p>
        <p style={P}>
          <strong>8A.3 Subprocessors.</strong> Customer authorizes Company to use subprocessors (including
          hosting, analytics, and payment providers) to process Customer Content solely for the purposes
          described in these Terms. Company will require subprocessors to maintain confidentiality and
          security obligations that are commercially reasonable and appropriate for the Services.
        </p>
        <p style={P}>
          <strong>8A.4 Security Incident Notice.</strong> If Company becomes aware of a confirmed
          unauthorized access to Customer Content in Company&rsquo;s systems (&ldquo;Security Incident&rdquo;), Company will
          provide notice to Customer without undue delay and will take commercially reasonable steps to
          contain, investigate, and remediate the Security Incident. Customer is responsible for
          determining its own notification obligations to end users, regulators, or other third parties.
        </p>

        <h2 style={H2}>9) Third-Party Services and Integrations</h2>
        <p style={P}>
          The Services may integrate with or depend on third-party services (including analytics, payments,
          and hosting). Third-party services are not controlled by Company, and their terms and privacy
          practices may apply. Payment processing is provided by Stripe. You authorize us and Stripe to
          charge your payment method for applicable fees in accordance with your selected plan(s) and any
          Order Form.
        </p>

        <h2 style={H2}>10) Fees; Taxes; No Refunds</h2>
        <p style={P}>
          <strong>10.1 Fees.</strong> Some features require payment as described in an Order Form or on our
          pricing page at www.assemblyai.net/pricing.
        </p>
        <p style={P}>
          <strong>10.2 No Refunds.</strong> All fees are non-refundable unless required by applicable law or
          expressly stated in a signed Order Form.
        </p>
        <p style={P}>
          <strong>10.3 Taxes.</strong> Fees exclude taxes, and Customer is responsible for all applicable
          taxes except taxes on Company&rsquo;s net income.
        </p>
        <p style={P}>
          <strong>10.4 Late Payments.</strong> We may suspend access for overdue amounts and charge
          reasonable interest or late fees as permitted by law.
        </p>

        <h2 style={H2}>11) Suspension; Acceptable Use</h2>
        <p style={P}>
          We may suspend or limit access to the Services if we reasonably believe: (a) Customer&rsquo;s use poses
          a security risk; (b) Customer violates these Terms or the Acceptable Use Policy; (c) required by
          law; or (d) Customer fails to pay fees when due. We will use commercially reasonable efforts to
          provide notice and restore access when the issue is resolved.
        </p>

        <h2 style={H2}>12) Service Changes; Beta Features</h2>
        <p style={P}>
          We may modify or discontinue parts of the Services. If we offer beta, preview, or experimental
          features, they are provided &ldquo;as is&rdquo; and may be changed or discontinued at any time.
        </p>

        <h2 style={H2}>13) Disclaimers</h2>
        <p style={P}>
          THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE.&rdquo; TO THE MAXIMUM EXTENT PERMITTED BY LAW,
          COMPANY DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
        </p>
        <p style={P}>
          Company does not warrant that the Services will be uninterrupted, error-free, or that outputs
          will be accurate or suitable for any specific purpose. Customer is solely responsible for
          verifying outputs and for all business decisions made in reliance on the Services.
        </p>

        <h2 style={H2}>13A) AI-Generated Outputs</h2>
        <p style={P}>
          The Services use artificial intelligence to generate content, analysis, messaging, and strategic
          recommendations. AI-generated outputs are provided for informational and planning purposes only
          and do not constitute professional advice of any kind, including legal, financial, marketing, or
          business strategy advice. Customer is solely responsible for reviewing, validating, and making
          all business decisions based on outputs. Company makes no warranty that outputs will be accurate,
          complete, or suitable for any specific purpose.
        </p>

        <h2 style={H2}>14) Limitation of Liability</h2>
        <p style={P}>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
        <p style={P}>
          <strong>14.1 No Consequential Damages.</strong> IN NO EVENT WILL COMPANY BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF
          PROFITS, REVENUE, DATA, BUSINESS INTERRUPTION, OR GOODWILL, EVEN IF ADVISED OF THE POSSIBILITY.
        </p>
        <p style={P}>
          <strong>14.2 Liability Cap.</strong> COMPANY&rsquo;S TOTAL LIABILITY ARISING OUT OF OR RELATED TO THE
          SERVICES OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) $500 OR ONE MONTH OF FEES PAID BY
          CUSTOMER TO COMPANY FOR THE SERVICES, WHICHEVER IS GREATER, OR (B) THE AMOUNTS PAID BY CUSTOMER TO
          COMPANY FOR THE SERVICES IN THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.
        </p>
        <p style={P}>
          <strong>14.3 Basis of Bargain.</strong> The limitations in this Section are a fundamental basis of
          the bargain between the parties.
        </p>

        <h2 style={H2}>15) Indemnification</h2>
        <p style={P}>
          Customer will defend, indemnify, and hold harmless Company and its officers, directors,
          employees, and agents from and against any third-party claims, damages, liabilities, costs, and
          expenses (including reasonable attorneys&rsquo; fees) arising out of or related to: (a) Customer
          Content; (b) Customer&rsquo;s use of the Services; (c) Customer&rsquo;s breach of these Terms; or (d)
          Customer&rsquo;s violation of law or third-party rights.
        </p>
        <p style={P}>
          Company will: (i) promptly notify Customer of the claim (failure to notify does not relieve
          Customer except to the extent materially prejudiced); (ii) allow Customer to control the defense
          and settlement (no settlement admitting fault or imposing obligations on Company without
          Company&rsquo;s consent); and (iii) provide reasonable cooperation at Customer&rsquo;s expense.
        </p>

        <h2 style={H2}>16) Term; Termination</h2>
        <p style={P}>
          <strong>16.1 Term.</strong> These Terms begin when you first accept them and continue until
          terminated. Subscription terms (if any) are as stated in an Order Form.
        </p>
        <p style={P}>
          <strong>16.2 Termination by Customer.</strong> Customer may stop using the Services at any time.
          If you have a paid subscription, termination does not entitle you to any refund.
        </p>
        <p style={P}>
          <strong>16.3 Termination/Suspension by Company.</strong> We may suspend or terminate access
          immediately if Customer breaches these Terms, fails to pay fees, or if required by law.
        </p>
        <p style={P}>
          <strong>16.4 Effect of Termination.</strong> Upon termination, your right to use the Services
          stops. Customer Content handling after termination is described in Section 8.
        </p>

        <h2 style={H2}>17) Dispute Resolution; Arbitration; Governing Law</h2>
        <p style={P}>
          <strong>17.1 Governing Law.</strong> These Terms are governed by the laws of the State of
          Colorado, excluding its conflict of laws rules.
        </p>
        <p style={P}>
          <strong>17.2 Arbitration.</strong> Any dispute, claim, or controversy arising out of or relating
          to these Terms or the Services will be resolved by binding arbitration administered by a
          nationally recognized arbitration provider mutually agreed by the parties. If the parties cannot
          agree on a provider within thirty (30) days after a written demand for arbitration, the
          arbitration will be administered by the American Arbitration Association (AAA) under its
          Commercial Arbitration Rules. The arbitration will take place in Denver County, Colorado, and
          will be conducted in English by one arbitrator. Judgment on the award may be entered in any court
          of competent jurisdiction.
        </p>
        <p style={P}>
          <strong>17.3 Injunctive Relief / IP &amp; Confidentiality.</strong> Either party may seek temporary
          or injunctive relief in court to protect its Confidential Information or intellectual property
          rights.
        </p>
        <p style={P}>
          <strong>17.4 Class Action Waiver (B2B).</strong> Disputes will be brought only on an individual
          basis, and not as a plaintiff or class member in any purported class or representative
          proceeding, to the maximum extent permitted by law.
        </p>

        <h2 style={H2}>18) IP Complaints</h2>
        <p style={P}>
          If you believe content in the Services infringes intellectual property rights, contact
          info@assemblynetworks.net with: (a) identification of the work; (b) the allegedly infringing
          material; (c) your contact information; and (d) a statement you have a good-faith belief the use
          is unauthorized.
        </p>

        <h2 style={H2}>19) Export Compliance; Sanctions</h2>
        <p style={P}>
          Customer will comply with all applicable export control and economic sanctions laws and will not
          use the Services in or for the benefit of any restricted country, entity, or person where
          prohibited.
        </p>

        <h2 style={H2}>20) Miscellaneous</h2>
        <p style={P}>
          <strong>20.1 Assignment.</strong> Customer may not assign these Terms without our prior written
          consent. We may assign these Terms in connection with a merger, acquisition, or sale of assets.
        </p>
        <p style={P}>
          <strong>20.2 Severability.</strong> If any provision is unenforceable, the remaining provisions
          remain in effect.
        </p>
        <p style={P}>
          <strong>20.3 Waiver.</strong> Failure to enforce a provision is not a waiver.
        </p>
        <p style={P}>
          <strong>20.4 Entire Agreement; Order of Precedence.</strong> These Terms (and any Order Form) are
          the entire agreement regarding the Services. If there is a conflict, an Order Form controls for
          the subject matter it covers, then these Terms.
        </p>
        <p style={P}>
          <strong>20.5 Contact.</strong> Assembly Networks, LLC — 2443 S. University Blvd, Suite 281,
          Denver, CO 80210. Email: info@assemblynetworks.net.
        </p>

        <h2 style={{ ...H2, marginTop: '48px', borderTop: '2px solid #0A1628', paddingTop: '32px' }}>
          Appendix 1 — Acceptable Use Policy (AUP)
        </h2>
        <p style={P}>
          This Acceptable Use Policy (&ldquo;AUP&rdquo;) applies to all use of the Services. Capitalized terms not
          defined here have the meanings in the Terms.
        </p>

        <h3 style={H3}>1) General Rules</h3>
        <p style={P}>
          Customer will not, and will not permit any user or third party to, use the Services to:
        </p>
        <ul style={UL}>
          <li style={LI}>violate any applicable law or regulation;</li>
          <li style={LI}>engage in fraudulent, deceptive, or misleading activity;</li>
          <li style={LI}>infringe, misappropriate, or violate any intellectual property, privacy, publicity, or other rights;</li>
          <li style={LI}>send, store, or transmit malware, worms, ransomware, or any code intended to damage or disrupt systems;</li>
          <li style={LI}>interfere with or disrupt the integrity or performance of the Services or third-party systems.</li>
        </ul>

        <h3 style={H3}>2) Security and Abuse</h3>
        <p style={P}>Customer will not:</p>
        <ul style={UL}>
          <li style={LI}>attempt to probe, scan, or test the vulnerability of the Services or related systems without Company&rsquo;s prior written permission;</li>
          <li style={LI}>bypass, disable, or otherwise interfere with authentication, access controls, rate limits, or security features;</li>
          <li style={LI}>use automated means (including bots, scrapers, or spiders) to access the Services except as expressly permitted by Company;</li>
          <li style={LI}>attempt to access accounts, data, or systems not belonging to Customer.</li>
        </ul>

        <h3 style={H3}>3) Prohibited Data Types</h3>
        <p style={P}>
          Unless the parties sign a separate written agreement specifically permitting such data, Customer
          will not submit:
        </p>
        <ul style={UL}>
          <li style={LI}>protected health information (PHI) or other health data regulated under HIPAA;</li>
          <li style={LI}>children&rsquo;s personal information (including data subject to COPPA or similar laws);</li>
          <li style={LI}>payment card data subject to PCI DSS (except as handled directly by Stripe or another payment processor);</li>
          <li style={LI}>government-issued identifiers (e.g., SSNs, driver&rsquo;s license numbers) except where strictly necessary and lawfully obtained;</li>
          <li style={LI}>any other data subject to heightened legal obligations that the Services are not expressly designed to handle.</li>
        </ul>

        <h3 style={H3}>4) High-Risk or Unlawful Content</h3>
        <p style={P}>
          Customer will not use the Services to create, upload, store, or transmit content that:
        </p>
        <ul style={UL}>
          <li style={LI}>is illegal, exploitative, or abusive;</li>
          <li style={LI}>includes non-consensual intimate imagery;</li>
          <li style={LI}>facilitates theft, stalking, harassment, or unlawful surveillance;</li>
          <li style={LI}>promotes or facilitates violence or wrongdoing.</li>
        </ul>

        <h3 style={H3}>5) Competitive Use and Model/Output Misuse</h3>
        <p style={P}>Customer will not:</p>
        <ul style={UL}>
          <li style={LI}>use the Services to build or train a competing product or service;</li>
          <li style={LI}>attempt to extract, reconstruct, or discover underlying models, algorithms, or system prompts (including &ldquo;model extraction&rdquo; attacks);</li>
          <li style={LI}>use outputs as the sole basis for high-stakes decisions without human review, where such decisions could materially impact individuals&rsquo; rights or safety.</li>
        </ul>

        <h3 style={H3}>6) Enforcement</h3>
        <p style={P}>
          Company may investigate suspected AUP violations and may suspend or terminate access to the
          Services immediately if Company reasonably believes Customer&rsquo;s use: (a) violates the AUP or the
          Terms; (b) poses a security risk; (c) could expose Company or others to liability; or (d) could
          disrupt the Services. Where feasible, Company will provide notice and an opportunity to cure.
        </p>
      </main>

      <div style={FOOTER}>
        <span>© {new Date().getFullYear()} Assembly Networks, LLC</span>
        <Link href="/privacy" style={FOOTER_LINK}>Privacy Policy</Link>
        <Link href="/auth/login" style={FOOTER_LINK}>Sign in</Link>
      </div>
    </div>
  )
}

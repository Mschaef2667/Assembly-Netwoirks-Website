import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Privacy Policy — Assembly AI',
  description: 'Privacy Policy for Assembly AI by Assembly Networks, LLC.',
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

export default function PrivacyPolicyPage() {
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
            <Link href="/tos" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main style={CONTENT}>
        <h1 style={H1}>Privacy Policy</h1>
        <p style={META}>Effective Date: July 1, 2026</p>

        <p style={P}>
          This Privacy Policy describes how Assembly Networks, LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) collects, uses, shares, and retains information in connection with the Assembly AI
          website, application, APIs, and related services (collectively, the &ldquo;Services&rdquo;). It applies to
          our business customers (&ldquo;Customer&rdquo;) and the individual users who access the Services on
          Customer&rsquo;s behalf.
        </p>
        <p style={P}>
          Capitalized terms used but not defined here have the meanings given in our{' '}
          <Link href="/tos" style={{ color: '#0EA5E9' }}>Terms of Service</Link>.
        </p>

        <h2 style={H2}>1) Information We Collect</h2>
        <p style={P}>
          <strong>Account Information.</strong> When you register, we collect information you provide such
          as your name, email address, workspace/organization name, role, and password credentials (stored
          in hashed form by our auth provider).
        </p>
        <p style={P}>
          <strong>Usage Data.</strong> We collect data about how you interact with the Services, including
          pages viewed, features used, clicks, session timestamps, device and browser information, IP
          address, and approximate location. This includes product analytics events (e.g., onboarding step
          completions, journey activity).
        </p>
        <p style={P}>
          <strong>Customer Content.</strong> We process content you submit to the Services, including
          company profile data, target market segments, survey questions and responses, decision clarity
          profiles, journey step outputs, generated drafts, prompts, and other materials you or your users
          upload or create.
        </p>
        <p style={P}>
          <strong>Payment Information.</strong> If you purchase a paid plan, payment is processed by
          Stripe. We do not store full payment card numbers on our servers.
        </p>
        <p style={P}>
          <strong>Communications.</strong> If you contact us (e.g., support emails to
          info@assemblynetworks.net), we retain the content of those communications.
        </p>

        <h2 style={H2}>2) How We Use Information</h2>
        <ul style={UL}>
          <li style={LI}>To provide, operate, secure, and support the Services;</li>
          <li style={LI}>To authenticate users and maintain account access;</li>
          <li style={LI}>To process AI-assisted features (e.g., Copilot drafts) using the information you submit;</li>
          <li style={LI}>To improve the platform in aggregate and de-identified form (not in a way that identifies you or builds individual profiles);</li>
          <li style={LI}>To communicate with you about the Services, including service notices, security alerts, and support responses;</li>
          <li style={LI}>To process payments and manage billing through our payment processor;</li>
          <li style={LI}>To detect, investigate, and prevent fraud, abuse, or violations of our Terms;</li>
          <li style={LI}>To comply with applicable law and enforce our agreements.</li>
        </ul>
        <p style={P}>
          We do not sell Customer Content, and we do not use Customer Content to train third-party
          foundation models.
        </p>

        <h2 style={H2}>3) How We Share Information</h2>
        <p style={P}>
          We share information only with service providers (&ldquo;subprocessors&rdquo;) acting on our behalf to
          provide the Services, and only as needed for them to perform their functions. Our current
          subprocessors include:
        </p>
        <ul style={UL}>
          <li style={LI}>
            <strong>Supabase</strong> — authentication, database hosting, and storage for account data and
            Customer Content.
          </li>
          <li style={LI}>
            <strong>Vercel</strong> — application hosting and edge delivery of the Services.
          </li>
          <li style={LI}>
            <strong>Anthropic (Claude API)</strong> — AI processing for Copilot drafts and other
            AI-assisted features. Inputs you send to Copilot are processed by Anthropic to generate
            outputs.
          </li>
          <li style={LI}>
            <strong>Stripe</strong> — payment processing for paid subscriptions (if applicable).
          </li>
          <li style={LI}>
            <strong>PostHog</strong> — product analytics for usage events.
          </li>
        </ul>
        <p style={P}>
          We may also disclose information: (a) to comply with law, legal process, or lawful government
          requests; (b) to protect the rights, safety, or property of Company, our users, or others; (c) in
          connection with a merger, acquisition, financing, or sale of assets, subject to appropriate
          confidentiality protections; or (d) with your direction or consent.
        </p>

        <h2 style={H2}>4) Data Retention</h2>
        <p style={P}>
          We retain Customer Content and account information for as long as your account is active. After
          account closure or termination, retention follows the schedule in Section 8 of our{' '}
          <Link href="/tos" style={{ color: '#0EA5E9' }}>Terms of Service</Link>: we delete or de-identify
          Customer Content within thirty (30) days, with limited exceptions for extended export windows,
          legal requirements, dispute resolution, and rolling backup deletion within sixty (60) days. We
          may retain limited transactional records (invoices, payment status, audit/security logs) for
          accounting, tax, compliance, and security purposes as permitted by law.
        </p>

        <h2 style={H2}>5) Security</h2>
        <p style={P}>
          We maintain reasonable administrative, technical, and physical safeguards designed to protect
          information processed through the Services, including encryption in transit, access controls,
          and audit logging. No system can be guaranteed 100% secure. You are responsible for maintaining
          the confidentiality of your credentials and for the access controls you apply within your
          workspace.
        </p>

        <h2 style={H2}>6) Your Rights</h2>
        <p style={P}>
          Subject to applicable law, you may have the right to:
        </p>
        <ul style={UL}>
          <li style={LI}><strong>Access</strong> the personal information we hold about you;</li>
          <li style={LI}><strong>Correct</strong> inaccurate or incomplete information;</li>
          <li style={LI}><strong>Delete</strong> personal information, subject to legal retention obligations;</li>
          <li style={LI}><strong>Export</strong> a copy of your data in a portable format;</li>
          <li style={LI}><strong>Object to or restrict</strong> certain processing activities;</li>
          <li style={LI}><strong>Withdraw consent</strong> where processing is based on consent.</li>
        </ul>
        <p style={P}>
          For workspace users, requests are typically routed through your workspace administrator. To
          submit a request, contact us at <a href="mailto:info@assemblynetworks.net" style={{ color: '#0EA5E9' }}>info@assemblynetworks.net</a>.
          We will respond within the timeframes required by applicable law.
        </p>

        <h2 style={H2}>7) Children</h2>
        <p style={P}>
          The Services are intended for business use by individuals 18 years or older and are not directed
          to children. We do not knowingly collect personal information from children.
        </p>

        <h2 style={H2}>8) International Data Transfers</h2>
        <p style={P}>
          The Services are operated from the United States. If you access the Services from outside the
          United States, your information may be processed in the United States or other jurisdictions
          where our subprocessors operate. By using the Services, you understand your information will be
          transferred to and processed in those jurisdictions.
        </p>

        <h2 style={H2}>9) Changes to this Policy</h2>
        <p style={P}>
          We may update this Privacy Policy from time to time. If we make material changes, we will provide
          reasonable notice (e.g., via the Services or email). Continued use of the Services after the
          effective date of an update constitutes acceptance of the updated Policy.
        </p>

        <h2 style={H2}>10) Governing Law</h2>
        <p style={P}>
          This Privacy Policy is governed by the laws of the State of Colorado, without regard to its
          conflict of laws rules. Any disputes arising from this Policy will be handled in accordance with
          the dispute resolution provisions in Section 17 of our{' '}
          <Link href="/tos" style={{ color: '#0EA5E9' }}>Terms of Service</Link>, including binding
          arbitration in Denver County, Colorado.
        </p>

        <h2 style={H2}>11) Contact</h2>
        <p style={P}>
          Questions about this Privacy Policy or our data practices? Contact us at:
        </p>
        <p style={P}>
          Assembly Networks, LLC<br />
          2443 S. University Blvd, Suite 281<br />
          Denver, CO 80210<br />
          Email: <a href="mailto:info@assemblynetworks.net" style={{ color: '#0EA5E9' }}>info@assemblynetworks.net</a>
        </p>
      </main>

      <div style={FOOTER}>
        <span>© {new Date().getFullYear()} Assembly Networks, LLC</span>
        <Link href="/tos" style={FOOTER_LINK}>Terms of Service</Link>
        <Link href="/auth/login" style={FOOTER_LINK}>Sign in</Link>
      </div>
    </div>
  )
}

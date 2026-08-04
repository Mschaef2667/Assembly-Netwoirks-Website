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
              src="/images/assembly-ai-logo.svg"
              alt="Assembly AI"
              width={217}
              height={40}
              style={{ maxHeight: '40px', width: 'auto', height: 'auto' }}
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
        <p style={META}>Effective Date: August 4, 2026</p>

        <p style={P}>
          This Privacy Policy describes how Assembly Networks, LLC (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) collects, uses, shares, and retains information in connection with our websites at{' '}
          <strong>assemblynetworks.net</strong> and <strong>assemblyai.net</strong>, the Assembly AI application,
          our APIs, and related services (collectively, the &ldquo;Services&rdquo;). It applies to visitors to our
          websites, to our business customers (&ldquo;Customer&rdquo;), and to the individual users who access the
          Services on Customer&rsquo;s behalf.
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
          <strong>Prospect and Inquiry Information.</strong> When you submit a form on either of our websites,
          such as a demo request, a white paper download, or a general contact or inquiry form, we collect the
          information you provide. Depending on the form, this may include your name, business email address,
          phone number, company name, job title, industry, annual revenue range, the business situation you
          select, the department you wish to reach, and any message or free-text description you choose to
          write. We also record the date and time of submission and the IP address the submission came from.
        </p>
        <p style={P}>
          <strong>Usage Data.</strong> We collect data about how you interact with the Services, including
          pages viewed, features used, clicks, session timestamps, device and browser information, IP
          address, and approximate location. This includes product analytics events (e.g., onboarding step
          completions, journey activity) and website analytics events (e.g., page views and form
          submissions).
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

        <h2 style={H2}>2) Cookies, Analytics, and Cross-Domain Measurement</h2>
        <p style={P}>
          <strong>Cookies and similar technologies.</strong> We and our service providers use cookies and
          similar technologies on our websites and in the application. We use them for two purposes: to keep
          the Services working (for example, to keep you signed in and to protect our forms from automated
          abuse), and to understand how our websites are used so we can improve them.
        </p>
        <p style={P}>
          <strong>Website analytics.</strong> We use Google Analytics 4 on both assemblynetworks.net and
          assemblyai.net. Google Analytics sets cookies (including cookies in the <code>_ga</code> family)
          and processes your IP address, device and browser information, the pages you view, and the actions
          you take, including when you submit a form. We configure our form-submission events to record only
          non-identifying attributes, such as which form was submitted, the industry and revenue range
          selected, and how you heard about us. <strong>We do not send your name, email address, phone
          number, job title, or the content of your message to Google Analytics.</strong>
        </p>
        <p style={P}>
          <strong>Cross-domain measurement.</strong> Our two websites are configured to be measured
          together. If you move between assemblynetworks.net and assemblyai.net, for example by following a
          link from our marketing site to download a white paper, we recognize that as a single visit by a
          single person rather than two separate visits. This lets us understand how people move between our
          sites. It does not cause us to collect any additional categories of information.
        </p>
        <p style={P}>
          <strong>Product analytics.</strong> Within the Assembly AI application we use PostHog to record
          product usage events, as described in Section 1.
        </p>
        <p style={P}>
          <strong>Bot protection.</strong> We use Cloudflare Turnstile on our public forms to distinguish
          human visitors from automated submissions. When you submit a form, Cloudflare processes your IP
          address and browser signals to assess whether the submission is automated, and may set a cookie
          for this purpose. Turnstile is used only for abuse prevention and is not used to track you across
          sites or to build an advertising profile.
        </p>
        <p style={P}>
          <strong>Your choices.</strong> You can control cookies through your browser settings, though
          disabling them may prevent parts of the Services from working. You can opt out of Google Analytics
          across all websites by installing Google&rsquo;s{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0EA5E9' }}
          >
            Analytics Opt-out Browser Add-on
          </a>
          . We honor recognized universal opt-out signals, including Global Privacy Control (GPC), where
          required by applicable law.
        </p>

        <h2 style={H2}>3) How We Use Information</h2>
        <ul style={UL}>
          <li style={LI}>To provide, operate, secure, and support the Services;</li>
          <li style={LI}>To authenticate users and maintain account access;</li>
          <li style={LI}>
            To respond to demo requests, white paper downloads, and other inquiries, and to follow up with
            you about our products and services;
          </li>
          <li style={LI}>
            To process AI-assisted features (e.g., Copilot drafts) using the information you submit;
          </li>
          <li style={LI}>
            To measure and improve the performance of our websites and marketing, including understanding
            which channels and pages lead to inquiries;
          </li>
          <li style={LI}>
            To improve the platform in aggregate and de-identified form (not in a way that identifies you or
            builds individual profiles);
          </li>
          <li style={LI}>
            To communicate with you about the Services, including service notices, security alerts, and
            support responses;
          </li>
          <li style={LI}>To process payments and manage billing through our payment processor;</li>
          <li style={LI}>
            To detect, investigate, and prevent fraud, abuse, automated submissions, or violations of our
            Terms;
          </li>
          <li style={LI}>To comply with applicable law and enforce our agreements.</li>
        </ul>
        <p style={P}>
          We do not sell Customer Content, and we do not use Customer Content to train third-party
          foundation models.
        </p>

        <h2 style={H2}>4) How We Share Information</h2>
        <p style={P}>
          We share information only with service providers (&ldquo;subprocessors&rdquo;) acting on our
          behalf to provide the Services, and only as needed for them to perform their functions. Our
          current subprocessors include:
        </p>
        <ul style={UL}>
          <li style={LI}>
            <strong>Supabase.</strong> Authentication, database hosting, and storage for account data,
            Customer Content, and inquiry submissions.
          </li>
          <li style={LI}>
            <strong>Vercel.</strong> Application hosting and edge delivery of the Services.
          </li>
          <li style={LI}>
            <strong>Anthropic (Claude API).</strong> AI processing for Copilot drafts and other AI-assisted
            features. Inputs you send to Copilot are processed by Anthropic to generate outputs.
          </li>
          <li style={LI}>
            <strong>Stripe.</strong> Payment processing for paid subscriptions (if applicable).
          </li>
          <li style={LI}>
            <strong>PostHog.</strong> Product analytics for in-application usage events.
          </li>
          <li style={LI}>
            <strong>Google (Google Analytics).</strong> Website analytics for assemblynetworks.net and
            assemblyai.net, as described in Section 2.
          </li>
          <li style={LI}>
            <strong>Cloudflare (Turnstile).</strong> Automated-abuse prevention on our public forms, as
            described in Section 2.
          </li>
          <li style={LI}>
            <strong>Notion.</strong> Storage and management of inquiry and prospect records submitted
            through our website forms, used as our customer relationship management system.
          </li>
          <li style={LI}>
            <strong>Resend.</strong> Delivery of transactional and notification email, including internal
            notifications when you submit a form.
          </li>
        </ul>
        <p style={P}>
          We may also disclose information: (a) to comply with law, legal process, or lawful government
          requests; (b) to protect the rights, safety, or property of Company, our users, or others; (c) in
          connection with a merger, acquisition, financing, or sale of assets, subject to appropriate
          confidentiality protections; or (d) with your direction or consent.
        </p>

        <h2 style={H2}>5) Data Retention</h2>
        <p style={P}>
          <strong>Customer accounts and Customer Content.</strong> We retain Customer Content and account
          information for as long as your account is active. After account closure or termination, retention
          follows the schedule in Section 8 of our{' '}
          <Link href="/tos" style={{ color: '#0EA5E9' }}>Terms of Service</Link>: we delete or de-identify
          Customer Content within thirty (30) days, with limited exceptions for extended export windows,
          legal requirements, dispute resolution, and rolling backup deletion within sixty (60) days.
        </p>
        <p style={P}>
          <strong>Prospect and inquiry records.</strong> We retain information submitted through our website
          forms for up to thirty-six (36) months following your most recent interaction with us, after which
          we delete or de-identify it. You may ask us to delete your inquiry record sooner at any time by
          contacting us at info@assemblynetworks.net.
        </p>
        <p style={P}>
          <strong>Transactional and security records.</strong> We may retain limited transactional records
          (invoices, payment status, audit/security logs) for accounting, tax, compliance, and security
          purposes as permitted by law.
        </p>

        <h2 style={H2}>6) Security</h2>
        <p style={P}>
          We maintain reasonable administrative, technical, and physical safeguards designed to protect
          information processed through the Services, including encryption in transit, access controls, and
          audit logging. No system can be guaranteed 100% secure. You are responsible for maintaining the
          confidentiality of your credentials and for the access controls you apply within your workspace.
        </p>

        <h2 style={H2}>7) Your Rights and Choices</h2>
        <p style={P}>Subject to applicable law, you may have the right to:</p>
        <ul style={UL}>
          <li style={LI}>Access the personal information we hold about you;</li>
          <li style={LI}>Correct inaccurate or incomplete information;</li>
          <li style={LI}>Delete personal information, subject to legal retention obligations;</li>
          <li style={LI}>Export a copy of your data in a portable format;</li>
          <li style={LI}>Object to or restrict certain processing activities;</li>
          <li style={LI}>
            Opt out of targeted advertising, the sale of personal data, or profiling in furtherance of
            decisions that produce legal or similarly significant effects;
          </li>
          <li style={LI}>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p style={P}>
          For workspace users, requests are typically routed through your workspace administrator. To submit
          a request, contact us at{' '}
          <a href="mailto:info@assemblynetworks.net" style={{ color: '#0EA5E9' }}>info@assemblynetworks.net</a>.
          We will respond within the timeframes required by applicable law.
        </p>
        <p style={P}>
          <strong>Appeals.</strong> If we decline to act on your request, we will tell you why. You may
          appeal that decision by replying to our response or by writing to info@assemblynetworks.net with
          the subject line &ldquo;Privacy Request Appeal.&rdquo; We will review the appeal and inform you in
          writing of our decision, and the reasons for it, within the period required by applicable law. If
          your appeal is denied, you may contact the attorney general of your state to submit a complaint.
        </p>

        <h2 style={H2}>8) Children</h2>
        <p style={P}>
          The Services are intended for business use by individuals 18 years or older and are not directed
          to children. We do not knowingly collect personal information from children.
        </p>

        <h2 style={H2}>9) International Data Transfers</h2>
        <p style={P}>
          The Services are operated from the United States. If you access the Services from outside the
          United States, your information may be processed in the United States or other jurisdictions where
          our subprocessors operate. By using the Services, you understand your information will be
          transferred to and processed in those jurisdictions.
        </p>

        <h2 style={H2}>10) Changes to this Policy</h2>
        <p style={P}>
          We may update this Privacy Policy from time to time. If we make material changes, we will provide
          reasonable notice (e.g., via the Services or email). Continued use of the Services after the
          effective date of an update constitutes acceptance of the updated Policy.
        </p>

        <h2 style={H2}>11) Governing Law</h2>
        <p style={P}>
          This Privacy Policy is governed by the laws of the State of Colorado, without regard to its
          conflict of laws rules. Any disputes arising from this Policy will be handled in accordance with
          the dispute resolution provisions in Section 17 of our{' '}
          <Link href="/tos" style={{ color: '#0EA5E9' }}>Terms of Service</Link>, including binding
          arbitration in Denver County, Colorado.
        </p>

        <h2 style={H2}>12) Contact</h2>
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

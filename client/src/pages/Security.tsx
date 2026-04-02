export default function Security() {
  return (
    <div className="min-h-screen bg-[#01040A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Vulnerability Disclosure</h1>
          <p className="text-gray-400 text-sm">Last updated: 2 April 2025</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Reporting a Vulnerability</h2>
            <p>
              ONEST Health Pty Ltd takes the security of Perform Creative seriously. If you believe you have
              found a security vulnerability in our platform, we encourage you to report it to us
              responsibly.
            </p>
            <p className="mt-3">
              Please email your findings to{" "}
              <a href="mailto:ryan@onesthealth.com" className="text-emerald-400 hover:underline">
                ryan@onesthealth.com
              </a>{" "}
              with the subject line <strong className="text-white">Security Vulnerability Report</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What to Include</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>A description of the vulnerability and its potential impact</li>
              <li>Steps to reproduce the issue</li>
              <li>Any relevant screenshots, logs, or proof-of-concept code</li>
              <li>Your contact details for follow-up</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Our Commitment</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>We will acknowledge your report within 5 business days</li>
              <li>We will investigate and keep you informed of our progress</li>
              <li>We will notify you when the vulnerability has been resolved</li>
              <li>We will not pursue legal action against researchers acting in good faith</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Scope</h2>
            <p>In scope for reporting:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
              <li>performcreative.io and all subdomains</li>
              <li>Authentication and session management</li>
              <li>API endpoints and data handling</li>
              <li>Third-party integrations (Canva, ClickUp)</li>
            </ul>
            <p className="mt-3">Out of scope:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
              <li>Denial of service attacks</li>
              <li>Social engineering of staff</li>
              <li>Physical security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Contact</h2>
            <p>
              Security reports:{" "}
              <a href="mailto:ryan@onesthealth.com" className="text-emerald-400 hover:underline">
                ryan@onesthealth.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

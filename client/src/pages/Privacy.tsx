export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#01040A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400 text-sm">Last updated: 2 April 2025</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              Perform Creative is operated by ONEST Health Pty Ltd, based in Australia.
              This policy explains how we collect, use, and protect your data when you use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Data We Collect</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Account information (name, email) provided at registration</li>
              <li>Content you upload (images, videos, product information)</li>
              <li>OAuth tokens for connected third-party services (e.g. Canva)</li>
              <li>Usage data (pipeline runs, generated outputs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Canva Integration Data</h2>
            <p>
              When you connect Canva, we store your Canva OAuth access token and refresh token in our
              database. These tokens are used only to upload assets and create designs on your behalf when
              you explicitly trigger those actions. We do not read, modify, or delete your existing Canva
              designs. Tokens are stored encrypted at rest on DigitalOcean infrastructure.
            </p>
            <p className="mt-3">
              You can disconnect Canva at any time from Settings. Upon disconnection, your tokens are
              immediately cleared from our database. We will permanently delete all Canva-related data
              within 30 days of account deletion or disconnection.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>To provide and operate the Platform</li>
              <li>To generate AI-powered ad creatives on your behalf</li>
              <li>To connect to third-party services you authorise (Canva, ClickUp)</li>
              <li>To improve Platform performance and reliability</li>
            </ul>
            <p className="mt-3">We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Storage and Security</h2>
            <p>
              All data is stored on DigitalOcean infrastructure (Sydney region). We use managed MySQL
              databases with encryption at rest. Secrets and API keys are stored in environment variables,
              not in the database. Access to production systems is restricted to authorised personnel.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Third-Party Services</h2>
            <p>The Platform integrates with the following third-party services:</p>
            <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
              <li>
                <strong className="text-white">Canva</strong> — design creation and asset upload
              </li>
              <li>
                <strong className="text-white">ClickUp</strong> — task creation for approved creatives
              </li>
              <li>
                <strong className="text-white">Anthropic / Google Gemini / OpenAI</strong> — AI generation
                and transcription
              </li>
              <li>
                <strong className="text-white">DigitalOcean</strong> — hosting and file storage
              </li>
            </ul>
            <p className="mt-3">Each service is subject to its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. Upon account deletion, all personal
              data and OAuth tokens are removed within 30 days. Generated creative assets may be retained in
              storage for up to 90 days before permanent deletion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data at any time by
              contacting us. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Contact</h2>
            <p>
              Privacy questions or data requests:{" "}
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

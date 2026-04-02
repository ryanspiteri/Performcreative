export default function Terms() {
  return (
    <div className="min-h-screen bg-[#01040A] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-400 text-sm">Last updated: 2 April 2025</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Overview</h2>
            <p>
              Perform Creative ("the Platform") is an AI-powered ad creative tool operated by Ryan Spiteri
              ("we", "us"). By accessing or using the Platform, you agree to these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Use of the Platform</h2>
            <p>
              Access to Perform Creative is granted on an invite-only basis to authorised users. You may use
              the Platform solely for lawful marketing and creative production purposes. You must not share
              your credentials or use the Platform to produce content that is misleading, illegal, or
              infringes third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Canva Integration</h2>
            <p>
              The Platform integrates with Canva via the Canva Connect API. When you connect your Canva
              account, you authorise the Platform to upload assets and create designs on your behalf. You can
              revoke this access at any time from Settings. We only use Canva API access to perform the
              actions you explicitly initiate within the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Intellectual Property</h2>
            <p>
              You retain ownership of any content you upload or generate through the Platform. AI-generated
              outputs are provided for your use subject to applicable laws and the terms of underlying AI
              providers. We do not claim ownership of your creatives.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Limitations</h2>
            <p>
              The Platform is provided "as is". We make no warranties regarding uptime, accuracy of
              AI-generated content, or fitness for a particular purpose. We are not liable for any indirect,
              incidental, or consequential damages arising from your use of the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Termination</h2>
            <p>
              We reserve the right to suspend or terminate access to the Platform at any time, with or
              without notice, for breach of these terms or at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the Platform after changes
              constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Contact</h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a href="mailto:ryan@onesthealth.com" className="text-emerald-400 hover:underline">
                ryan@onesthealth.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Terms and Conditions
        </h1>

        <div className="space-y-6 text-zinc-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By creating an account and accessing the Bed Manager System ("the System"), you agree to be bound by these Terms and Conditions. 
              If you do not agree to these terms, please do not use the System.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. User Responsibilities</h2>
            <p className="leading-relaxed mb-3">As a user of the Bed Manager System, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and complete information during registration</li>
              <li>Keep your login credentials secure and confidential</li>
              <li>Use the System only for its intended medical and administrative purposes</li>
              <li>Report any security breaches or unauthorized access immediately</li>
              <li>Comply with all applicable healthcare regulations and privacy laws</li>
              <li>Not share patient information outside of authorized healthcare contexts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data Privacy and Security</h2>
            <p className="leading-relaxed mb-3">
              The System handles sensitive medical and patient information. By using the System, you acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All data entered is stored securely and encrypted</li>
              <li>You must comply with HIPAA and other healthcare data protection regulations</li>
              <li>Patient data must only be accessed on a need-to-know basis</li>
              <li>You are responsible for maintaining patient confidentiality</li>
              <li>The hospital may audit your access logs for compliance purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Role-Based Access</h2>
            <p className="leading-relaxed">
              Your access to features and data within the System is determined by your assigned role (Hospital Admin, Manager, Ward Staff, or ER Staff). 
              You agree not to attempt to access areas or data beyond your authorization level.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. System Usage</h2>
            <p className="leading-relaxed mb-3">You agree to use the System appropriately:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Updates to bed status must be accurate and timely</li>
              <li>Patient information must be entered correctly</li>
              <li>Emergency requests must only be made for genuine medical emergencies</li>
              <li>System resources must not be misused or overloaded</li>
              <li>You will not attempt to circumvent security measures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Account Termination</h2>
            <p className="leading-relaxed">
              The hospital administration reserves the right to suspend or terminate your account at any time for violation of these terms, 
              misuse of the System, or for any reason deemed necessary to protect patient safety or data security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Limitation of Liability</h2>
            <p className="leading-relaxed">
              While we strive to maintain System availability and accuracy, the hospital is not liable for any interruptions, 
              data loss, or errors that may occur. Medical decisions should always be verified through appropriate channels.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Changes to Terms</h2>
            <p className="leading-relaxed">
              These Terms and Conditions may be updated periodically. Continued use of the System after changes constitutes acceptance of the revised terms. 
              Users will be notified of significant changes via email or system notifications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Contact Information</h2>
            <p className="leading-relaxed">
              For questions about these Terms and Conditions, please contact the hospital IT department or system administrator.
            </p>
          </section>

          <section className="pt-6 border-t border-zinc-700">
            <p className="text-sm text-zinc-500">
              Last Updated: December 2, 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;

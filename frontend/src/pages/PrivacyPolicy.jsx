import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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
          Privacy Policy
        </h1>

        <div className="space-y-6 text-zinc-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Information We Collect</h2>
            <p className="leading-relaxed mb-3">
              The Bed Manager System collects and processes the following types of information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>User Account Information:</strong> Name, email, role, ward assignment, and department</li>
              <li><strong>Bed Status Data:</strong> Bed availability, occupancy status, and cleaning schedules</li>
              <li><strong>Patient Information:</strong> Patient names, ages, and medical conditions (when entered by authorized staff)</li>
              <li><strong>System Activity Logs:</strong> Login times, actions performed, and data modifications</li>
              <li><strong>Emergency Requests:</strong> Request details, timestamps, and approval status</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
            <p className="leading-relaxed mb-3">We use collected information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Managing hospital bed availability and assignments</li>
              <li>Facilitating communication between hospital staff</li>
              <li>Tracking occupancy trends and generating reports</li>
              <li>Ensuring patient safety and appropriate care</li>
              <li>Maintaining system security and preventing unauthorized access</li>
              <li>Complying with healthcare regulations and legal requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Data Security</h2>
            <p className="leading-relaxed mb-3">
              We implement comprehensive security measures to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Encrypted data transmission using secure protocols (HTTPS)</li>
              <li>Password hashing and secure authentication</li>
              <li>Role-based access control to limit data exposure</li>
              <li>Regular security audits and monitoring</li>
              <li>Secure database storage with access restrictions</li>
              <li>Automatic session timeout for inactive users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Data Sharing and Disclosure</h2>
            <p className="leading-relaxed mb-3">
              Your information is shared only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>With authorized hospital staff who need access to perform their duties</li>
              <li>When required by law or legal proceedings</li>
              <li>To comply with healthcare regulations (HIPAA, etc.)</li>
              <li>With system administrators for technical maintenance (under strict confidentiality)</li>
            </ul>
            <p className="leading-relaxed mt-3">
              <strong>We will never sell or share your personal information with third parties for marketing purposes.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Patient Data Protection</h2>
            <p className="leading-relaxed">
              Patient information entered into the System is treated with the highest level of confidentiality. 
              All staff must comply with HIPAA regulations and hospital privacy policies when handling patient data. 
              Unauthorized disclosure of patient information is strictly prohibited and may result in legal consequences.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Retention</h2>
            <p className="leading-relaxed">
              We retain data for as long as necessary to fulfill the purposes outlined in this policy and to comply with legal obligations. 
              Historical occupancy data may be retained for analytical purposes. User accounts are maintained until deletion is requested or 
              employment ends.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights</h2>
            <p className="leading-relaxed mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal information stored in the System</li>
              <li>Request corrections to inaccurate data</li>
              <li>Delete your account (subject to record retention requirements)</li>
              <li>Be informed about how your data is being used</li>
              <li>Report privacy concerns to the hospital privacy officer</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Cookies and Tracking</h2>
            <p className="leading-relaxed">
              The System uses minimal cookies to maintain your session and improve user experience. 
              We do not use third-party tracking cookies or analytics that compromise your privacy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Changes to Privacy Policy</h2>
            <p className="leading-relaxed">
              This Privacy Policy may be updated to reflect changes in our practices or legal requirements. 
              Users will be notified of significant changes via email or system notifications. 
              Continued use of the System after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Contact Information</h2>
            <p className="leading-relaxed">
              For privacy-related questions or concerns, please contact:
            </p>
            <ul className="list-none space-y-2 ml-4 mt-3">
              <li><strong>Privacy Officer:</strong> privacy@hospital.com</li>
              <li><strong>IT Support:</strong> support@hospital.com</li>
              <li><strong>Hospital Administration:</strong> admin@hospital.com</li>
            </ul>
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

export default PrivacyPolicy;

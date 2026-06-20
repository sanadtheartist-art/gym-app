import { X } from 'lucide-react';

export default function PrivacyPolicyDialog({ onClose }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-md glass-card rounded-2xl p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-extrabold text-text-main">Privacy Policy</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-app-bg text-text-main transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm text-text-muted">
          <p>
            <strong className="text-text-main">Data Collection</strong><br />
            JEXI collects workout data you enter, including exercise names, sets, reps, weight, and muscle groups. This data is stored securely in your Supabase account.
          </p>
          <p>
            <strong className="text-text-main">Data Usage</strong><br />
            Your workout data is used solely to provide you with tracking, analytics, and personal records features within the app.
          </p>
          <p>
            <strong className="text-text-main">Data Sharing</strong><br />
            We do not share your personal data with any third parties. Your data remains private to your account.
          </p>
          <p>
            <strong className="text-text-main">Data Security</strong><br />
            All data is encrypted in transit and at rest using Supabase's secure infrastructure.
          </p>
          <p>
            <strong className="text-text-main">Your Rights</strong><br />
            You can export or delete your data at any time using the Data Vault feature in the app.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 h-14 rounded-xl glass-card-lime text-app-bg font-bold text-lg flex items-center justify-center gap-2 hover:shadow-glow-lime transition active:scale-95"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}

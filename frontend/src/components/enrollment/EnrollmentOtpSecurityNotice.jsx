import React from 'react';

/** Shown on public enroll / cart OTP steps — we verify by email only, not SMS. */
export function EnrollmentOtpSecurityNotice({ className = '' }) {
  return (
    <p
      className={`text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2 leading-relaxed ${className}`}
      data-testid="enrollment-otp-security-notice"
    >
      Divine Iris sends your verification code by <strong>email only</strong> — we do not send SMS.
      Do not use codes from text messages for enrollment.
      Never share your code with anyone on phone or WhatsApp.
    </p>
  );
}

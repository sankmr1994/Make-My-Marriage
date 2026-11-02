# Production verification checklist

Run this checklist against the deployed web domain and its matching API deployment after every production release that changes authentication, guest email, or RSVP behavior. Do not use real wedding data or personal guest addresses unless the sender domain is verified and the recipients have consented to receive the test.

## Before testing

- Confirm the web deployment has `NEXT_PUBLIC_API_BASE_URL` set to the production API URL.
- Confirm the API deployment has its production `MONGODB_URI`, `WEB_ORIGIN`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` values.
- Confirm `WEB_ORIGIN` exactly matches the web site origin, including the `https://` scheme and any `www` hostname.
- Confirm MongoDB Atlas permits the deployed API to connect and the Resend sender domain is verified before testing an external recipient.

## Account and session flows

| Flow | Expected result |
|---|---|
| Sign up | A new test email can create an account with a 12+ character password and reaches onboarding or its existing workspace. |
| Sign in | Correct credentials create a session and open the workspace; invalid credentials receive a generic failure response. |
| Sign out | Sign out returns to the public site. Reloading a protected workspace redirects to sign-in. |
| Password reset | Requesting reset shows the same neutral confirmation for known and unknown addresses. A valid link opens `/reset-password`, accepts a new 12+ character password, and invalidates prior sessions. Reusing, revoking, or expiring the link shows an unavailable-link message. |

## Guest invitation and RSVP flows

| Flow | Expected result |
|---|---|
| Invitation campaign | Select a ceremony and active guest families, send the campaign, then confirm the history row records recipients and provider submission status. “Submitted” means Resend accepted the request, not that the message reached an inbox. |
| Reminder campaign | Select only families with a pending RSVP. Confirm a reminder campaign cannot target an already responding family. |
| RSVP response | Open the token link in a signed-out browser, submit Attending or Not attending, and confirm the guest list and dashboard figures update. The same active link can be used to change a decision. |
| Expired or revoked RSVP | Confirm the link is unavailable and that an Admin or Organiser can issue a fresh invitation/reminder link. |

## Evidence to record

- Production web URL, API URL, release commit, tester, date, and browser.
- Result for every table row above, plus relevant safe screenshots.
- Campaign history status and any sanitized provider failure reason; never record tokens, passwords, cookies, or API keys.

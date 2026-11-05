# Photo storage setup (Cloudflare R2)

## Current status

The Cloudflare side is configured and was visually verified in the signed-in account: private bucket `mmm-wedding-media`, an active object read/write token scoped to that bucket, and CORS for localhost and both production domains with `PUT`, `GET`, `HEAD`, and `Content-Type`. Public access and the public development URL are disabled; the bucket had no stored objects at the time of review. The five API settings are populated in `apps/api/.env`, and the bucket and endpoint match the Cloudflare configuration. Secret values were not displayed or copied.

The application now has an initial implementation of server-side R2 signing, scoped guest upload/gallery links, upload sessions, gallery metadata, moderation, private downloads, and admin/guest screens. Guest-specific links can be emailed to the guest-list contact, and both guest-specific and wedding-wide links can be rendered and downloaded as locally generated SVG QR codes. Wedding-wide QR links are anonymous; guest-specific links attribute uploads to the guest record associated with the issued link. A forwarded guest-specific link can still be used by someone else. Live provider/end-to-end verification remains. The bucket is private and the app does not require public URLs. The API rejects partially populated R2 configuration; leave all five settings blank or configure them together. Never commit real credentials or put them in frontend environment variables.

R2 uses key prefixes as virtual folders. Wedding-wide photos use `weddings/<weddingId>/photos/`; event photos use `weddings/<weddingId>/events/<event-name>-<eventId>/photos/`. The event association in MongoDB and the R2 key prefix now both reflect the selected active event.

## Provider configuration review

1. Verified: the private bucket exists and public access remains disabled.
2. Verified: an active object read/write token is limited to that bucket. The secret is available only at token creation, so do not try to reveal it from the dashboard; rotate it there if the local secret is lost.
3. Verified: these five settings are present in `apps/api/.env` and match the bucket/account configuration (values are deliberately omitted here):
   - `R2_ACCOUNT_ID`
   - `R2_ENDPOINT` (the account's S3-compatible endpoint, `https://<account-id>.r2.cloudflarestorage.com`)
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
4. Verified: bucket CORS includes `http://localhost:3000`, `https://mymarriagehub.in`, and `https://www.mymarriagehub.in`, and permits `PUT`, `GET`, `HEAD`, and `Content-Type`. No wildcard origin is configured.
5. Keep account credentials out of browser config, logs, screenshots, and source control. The local secret file is git-ignored.

## Application work still required

Remaining work before calling the milestone complete: finish automated backend tests and live-provider end-to-end verification against the configured bucket; check the dashboard's mobile/keyboard accessibility; and verify production deployment settings and the web origin. Guest uploads start as `PENDING_REVIEW`; the public gallery returns approved photos only. The repository API tests were attempted but could not connect to loopback or MongoDB in this environment, so integration behavior is not claimed as verified.

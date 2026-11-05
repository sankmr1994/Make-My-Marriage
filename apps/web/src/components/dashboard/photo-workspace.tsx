"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, ImagePlus, LoaderCircle, Link2, Search, ShieldCheck, Trash2, X } from "lucide-react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { apiBaseUrl } from "@/lib/api";

type Ceremony = { id: string; name: string; status?: "ACTIVE" | "ARCHIVED" };
type Photo = { id: string; eventId?: string; originalFilename?: string; contentType: string; sizeBytes: number; moderationStatus: "PENDING_REVIEW" | "VISIBLE" | "REJECTED" | "DELETED"; createdAt: string; previewUrl: string; uploaderType: "GUEST" | "ADMIN" | "ORGANISER"; uploaderUserId?: string; guestId?: string; contributorName: string };
type Contributor = { uploaderType: Photo["uploaderType"]; uploaderUserId?: string; guestId?: string; contributorName?: string; photoCount: number };
type AccessLink = { id: string; purpose: "PHOTO_UPLOAD" | "GALLERY_VIEW"; eventId?: string; guestId?: string; guestName?: string; expiresAt?: string; revokedAt?: string; createdAt: string };
type LinkPagination = { page: number; pageSize: number; total: number; totalPages: number; revokedCount: number };
type ApiError = { error?: { message?: string } };
const maximumSize = 20 * 1024 * 1024;

async function readError(response: Response) { return ((await response.json().catch(() => null)) as ApiError | null)?.error?.message ?? "The request could not be completed. Please try again."; }
function downloadQr(id: string, fileName: string) { const svg = document.getElementById(id); if (!svg) return; const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function PhotoWorkspace({ events, eventFilters, canUpload, canModerate, canDelete, canManageLinks }: { events: Ceremony[]; eventFilters: Ceremony[]; canUpload: boolean; canModerate: boolean; canDelete: boolean; canManageLinks: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [eventId, setEventId] = useState("");
  const [purpose, setPurpose] = useState<"PHOTO_UPLOAD" | "GALLERY_VIEW">("PHOTO_UPLOAD");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [showRevokedLinks, setShowRevokedLinks] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkPurposeFilter, setLinkPurposeFilter] = useState<"ALL" | AccessLink["purpose"]>("ALL");
  const [linkPagination, setLinkPagination] = useState<LinkPagination>({ page: 1, pageSize: 7, total: 0, totalPages: 1, revokedCount: 0 });
  const [photoFilter, setPhotoFilter] = useState("ALL");
  const [contributorFilter, setContributorFilter] = useState("ALL");

  const load = useCallback(async () => {
    try {
      const photoQuery = new URLSearchParams({ limit: "100" });
      if (photoFilter === "COMMON") photoQuery.set("scope", "COMMON");
      else if (photoFilter !== "ALL") photoQuery.set("eventId", photoFilter);
      if (contributorFilter.startsWith("ROLE:")) photoQuery.set("uploaderType", contributorFilter.slice(5));
      else if (contributorFilter.startsWith("USER:")) photoQuery.set("uploaderUserId", contributorFilter.slice(5));
      else if (contributorFilter.startsWith("GUEST:")) photoQuery.set("guestId", contributorFilter.slice(6));
      const linkQuery = new URLSearchParams({ page: String(linkPagination.page), includeRevoked: String(showRevokedLinks) });
      if (linkSearch.trim()) linkQuery.set("search", linkSearch.trim());
      if (linkPurposeFilter !== "ALL") linkQuery.set("purpose", linkPurposeFilter);
      const [photoResponse, linkResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/photos?${photoQuery.toString()}`, { credentials: "include", cache: "no-store" }),
        canManageLinks ? fetch(`${apiBaseUrl}/weddings/current/guest-access-links?${linkQuery.toString()}`, { credentials: "include", cache: "no-store" }) : Promise.resolve(null)
      ]);
      if (!photoResponse.ok) throw new Error(await readError(photoResponse));
      if (linkResponse && !linkResponse.ok) throw new Error(await readError(linkResponse));
      const photoBody = await photoResponse.json() as { data?: { photos?: Photo[]; contributors?: Contributor[] } };
      const linkBody = linkResponse ? await linkResponse.json() as { data?: { links?: AccessLink[]; pagination?: LinkPagination } } : null;
      setPhotos(photoBody.data?.photos ?? []);
      setContributors(photoBody.data?.contributors ?? []);
      setLinks(linkBody?.data?.links ?? []);
      if (linkBody?.data?.pagination) setLinkPagination(linkBody.data.pagination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load photo sharing."); }
    finally { setLoading(false); }
  }, [photoFilter, contributorFilter, linkPagination.page, linkSearch, linkPurposeFilter, showRevokedLinks, canManageLinks]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(""); setNotice(""); setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) throw new Error(`${file.name}: choose a JPEG, PNG, or WebP image.`);
        if (file.size <= 0 || file.size > maximumSize) throw new Error(`${file.name}: image must be smaller than 20 MB.`);
        const created = await fetch(`${apiBaseUrl}/photo-upload-sessions`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "GALLERY_PHOTO", eventId: eventId || undefined, expectedContentType: file.type, expectedSizeBytes: file.size, originalFilename: file.name }) });
        if (!created.ok) throw new Error(await readError(created));
        const { data: session } = await created.json() as { data: { sessionId: string; uploadUrl: string; requiredHeaders: Record<string, string> } };
        const uploaded = await fetch(session.uploadUrl, { method: "PUT", headers: session.requiredHeaders, body: file });
        if (!uploaded.ok) throw new Error(`${file.name}: storage rejected this upload (HTTP ${uploaded.status}). Check the bucket CORS policy and try again.`);
        const completed = await fetch(`${apiBaseUrl}/photo-upload-sessions/${session.sessionId}/complete`, { method: "POST", credentials: "include" });
        if (!completed.ok) throw new Error(await readError(completed));
      }
      setNotice("Your photos were uploaded and added to the gallery.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The photos could not be uploaded."); }
    finally { setUploading(false); }
  }

  async function createLink() {
    setError(""); setNotice(""); setShareUrl("");
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/guest-access-links`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, eventId: purpose === "PHOTO_UPLOAD" ? eventId || undefined : undefined }) });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json() as { data: { link: AccessLink; url: string } };
      setShareUrl(body.data.url);
      setNotice("Link created. Copy and save it now; its secret is shown only once.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The guest link could not be created."); }
  }

  async function revoke(linkId: string) {
    if (!window.confirm("Revoke this guest link? Anyone holding it will lose access immediately.")) return;
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/guest-access-links/${linkId}/revoke`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The link could not be revoked."); }
  }

  async function getShareLink(link: AccessLink) {
    setError(""); setNotice(""); setShareUrl("");
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/guest-access-links/${link.id}/reissue`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json() as { data: { link: AccessLink; url: string; emailSubmissionStatus?: "ACCEPTED" | "FAILED" | "NOT_CONFIGURED" | "NOT_REQUESTED" } };
      setPurpose(body.data.link.purpose);
      setShareUrl(body.data.url);
      setNotice(body.data.emailSubmissionStatus === "ACCEPTED" ? "A fresh link was created, the old link was revoked, and the replacement was submitted to the guest by email." : "A replacement link was created and the old link was revoked. Copy or scan the new link now.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "A replacement link could not be created."); }
  }

  async function moderate(photoId: string, moderationStatus: "VISIBLE" | "REJECTED") {
    const response = await fetch(`${apiBaseUrl}/photos/${photoId}/moderation`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moderationStatus }) });
    if (!response.ok) { setError(await readError(response)); return; }
    await load();
  }

  async function remove(photoId: string) {
    if (!window.confirm("Delete this photo from the wedding gallery?")) return;
    const response = await fetch(`${apiBaseUrl}/photos/${photoId}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { setError(await readError(response)); return; }
    await load();
  }

  async function download(photoId: string) {
    const response = await fetch(`${apiBaseUrl}/photos/${photoId}/download-url`, { credentials: "include" });
    if (!response.ok) { setError(await readError(response)); return; }
    const body = await response.json() as { data: { downloadUrl: string } };
    window.open(body.data.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function copyShareUrl() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice("Guest link copied."); }
    catch { setError("Clipboard access was blocked. Select and copy the link from the field."); }
  }

  return <section className="workspace-photos">
    <header className="workspace-section-heading"><div><p className="workspace-eyebrow">WEDDING WORKSPACE <span>·</span> GALLERY</p><h1>Guest photos</h1><p>Upload images, share guest links, and review contributions before they appear in the gallery.</p></div></header>
    {error && <p className="workspace-alert" role="alert">{error}</p>}{notice && <p className="workspace-success" role="status">{notice}</p>}
    <div className="workspace-photo-tools">
      <label>Album<select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">Wedding gallery</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>
      {canUpload && <label className="workspace-photo-file"><ImagePlus size={18} />{uploading ? "Uploading photos…" : "Upload photos"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(event) => { void uploadFiles(event.target.files); event.currentTarget.value = ""; }} /></label>}
      {uploading && <LoaderCircle className="auth-spinner" size={18} />}
    </div>
    {canManageLinks && <section className="workspace-photo-share"><div><span className="workspace-eyebrow">GUEST ACCESS</span><h2>Share a private link</h2><p>Guest uploads wait for approval. Gallery links expose approved photos only. Links and QR codes expire in 90 days. A shared QR link does not identify individual guests; create a guest-specific link from the guest list for attribution.</p></div><label>Link purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value as typeof purpose)}><option value="PHOTO_UPLOAD">Upload photos</option><option value="GALLERY_VIEW">View approved gallery</option></select></label><button className="button button--dark" type="button" onClick={() => void createLink()}><Link2 size={15} /> Create guest link</button>{shareUrl && <><div className="workspace-photo-share-result"><label htmlFor="photo-share-url">Copy this link now</label><input id="photo-share-url" readOnly value={shareUrl} /><button type="button" onClick={() => void copyShareUrl()}><Copy size={15} /> Copy</button></div><div className="workspace-photo-qr"><QRCodeSVG id="shared-photo-qr" value={shareUrl} size={196} level="M" includeMargin /><strong>{purpose === "PHOTO_UPLOAD" ? "Scan to upload photos" : "Scan to view approved photos"}</strong><button type="button" onClick={() => downloadQr("shared-photo-qr", `wedding-${purpose.toLowerCase()}-qr.svg`)}><Download size={14} /> Download QR code</button></div></>}</section>}
    {canManageLinks && (linkPagination.total > 0 || linkSearch || linkPurposeFilter !== "ALL" || showRevokedLinks) && <section className="workspace-photo-links"><div className="workspace-photo-links-heading"><div><h2>Recent links</h2><p className="workspace-photo-links-help">Showing up to seven links per page. Search by guest name or email.</p></div>{linkPagination.revokedCount > 0 && <button type="button" className="workspace-photo-history-toggle" onClick={() => { setLinkPagination((current) => ({ ...current, page: 1 })); setShowRevokedLinks((value) => !value); }}>{showRevokedLinks ? "Hide revoked" : `Show revoked (${linkPagination.revokedCount})`}</button>}</div><div className="workspace-photo-link-filters"><label><Search size={15} /><input aria-label="Search guest links by guest name or email" type="search" maxLength={120} value={linkSearch} placeholder="Search guest name or email" onChange={(event) => { setLinkPagination((current) => ({ ...current, page: 1 })); setLinkSearch(event.target.value); }} /></label><label><span>Link type</span><select value={linkPurposeFilter} onChange={(event) => { setLinkPagination((current) => ({ ...current, page: 1 })); setLinkPurposeFilter(event.target.value as typeof linkPurposeFilter); }}><option value="ALL">All link types</option><option value="PHOTO_UPLOAD">Guest upload</option><option value="GALLERY_VIEW">Gallery view</option></select></label></div>{links.map((link) => <article key={link.id}><span>{link.purpose === "PHOTO_UPLOAD" ? "Guest upload" : "Gallery view"}{link.guestName ? ` · ${link.guestName}` : " · shared QR link"}</span><div className="workspace-photo-link-dates"><time dateTime={link.createdAt}>Created {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(link.createdAt))}</time><time dateTime={link.expiresAt}>{link.revokedAt ? "Revoked" : link.expiresAt ? `Expires ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(link.expiresAt))}` : "No expiry"}</time></div>{!link.revokedAt && <div className="workspace-photo-link-actions"><button type="button" onClick={() => void getShareLink(link)}><Link2 size={14} /> Get link</button><button type="button" onClick={() => void revoke(link.id)}><X size={14} /> Revoke</button></div>}</article>)}{links.length === 0 && <p className="workspace-photo-links-empty">No links match these filters.</p>}<div className="workspace-photo-pagination"><span>{linkPagination.total ? `Showing ${(linkPagination.page - 1) * linkPagination.pageSize + 1}–${Math.min(linkPagination.page * linkPagination.pageSize, linkPagination.total)} of ${linkPagination.total}` : "No matching links"}</span><div><button type="button" disabled={linkPagination.page <= 1} onClick={() => setLinkPagination((current) => ({ ...current, page: current.page - 1 }))}>Previous</button><span>Page {linkPagination.page} of {linkPagination.totalPages}</span><button type="button" disabled={linkPagination.page >= linkPagination.totalPages} onClick={() => setLinkPagination((current) => ({ ...current, page: current.page + 1 }))}>Next</button></div></div></section>}
    <div className="workspace-photo-list-heading"><div><span className="workspace-eyebrow">GALLERY LIBRARY</span><h2>{photos.length} {photos.length === 1 ? "photo" : "photos"}</h2></div><div className="workspace-photo-filter-tools"><label>Event<select value={photoFilter} onChange={(event) => setPhotoFilter(event.target.value)}><option value="ALL">All photos</option><option value="COMMON">Wedding gallery</option>{eventFilters.map((event) => <option key={event.id} value={event.id}>{event.name}{event.status === "ARCHIVED" ? " (archived)" : ""}</option>)}</select></label><label>Uploaded by<select value={contributorFilter} onChange={(event) => setContributorFilter(event.target.value)}><option value="ALL">Everyone</option><option value="ROLE:ADMIN">Admins</option><option value="ROLE:ORGANISER">Organisers</option><option value="ROLE:GUEST">Guests</option>{contributors.map((contributor, index) => <option key={`${contributor.uploaderType}:${contributor.uploaderUserId ?? contributor.guestId ?? contributor.contributorName ?? "unknown"}:${index}`} value={contributor.uploaderUserId ? `USER:${contributor.uploaderUserId}` : contributor.guestId ? `GUEST:${contributor.guestId}` : `ROLE:${contributor.uploaderType}`}>{contributor.uploaderType === "GUEST" ? "Guest" : contributor.uploaderType === "ADMIN" ? "Admin" : "Organiser"}{contributor.contributorName ? ` · ${contributor.contributorName}` : " · older upload"} ({contributor.photoCount})</option>)}</select></label><span><ShieldCheck size={15} /> Guest uploads require approval</span></div></div>
    {loading ? <div className="workspace-empty"><LoaderCircle className="auth-spinner" size={18} /> Loading gallery…</div> : photos.length === 0 ? <div className="workspace-empty"><ImagePlus size={22} /><p>No photos match these filters.</p></div> : <div className="workspace-photo-grid">{photos.map((photo) => <article key={photo.id}><Image className="workspace-photo-thumbnail" src={photo.previewUrl} alt={photo.originalFilename || "Wedding photo"} width={480} height={360} unoptimized /><div className="workspace-photo-card-copy"><strong>{photo.originalFilename || "Wedding photo"}</strong><span>{(photo.sizeBytes / 1024 / 1024).toFixed(1)} MB · {photo.moderationStatus.replaceAll("_", " ")}</span><small>{photo.eventId ? events.find((event) => event.id === photo.eventId)?.name ?? "Ceremony" : "Wedding gallery"}</small><small>Uploaded by {photo.contributorName} · {photo.uploaderType === "ADMIN" ? "Admin" : photo.uploaderType === "ORGANISER" ? "Organiser" : "Guest"}</small></div><div className="workspace-photo-card-actions"><button type="button" aria-label={`Download ${photo.originalFilename || "photo"}`} onClick={() => void download(photo.id)}><Download size={15} /></button>{canModerate && photo.moderationStatus === "PENDING_REVIEW" && <><button type="button" onClick={() => void moderate(photo.id, "VISIBLE")}><Check size={15} /> Approve</button><button type="button" onClick={() => void moderate(photo.id, "REJECTED")}><X size={15} /> Reject</button></>}{canDelete && <button type="button" aria-label={`Delete ${photo.originalFilename || "photo"}`} onClick={() => void remove(photo.id)}><Trash2 size={15} /></button>}</div></article>)}</div>}
  </section>;
}

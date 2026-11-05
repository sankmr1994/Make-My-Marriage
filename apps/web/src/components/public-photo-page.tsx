"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, ImagePlus, LoaderCircle, LockKeyhole } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Photo = { id: string; originalFilename?: string; contentType: string; sizeBytes: number; createdAt: string; previewUrl: string };
type GalleryEvent = { id: string; name: string };
type PageMode = "upload" | "gallery";
const maximumSize = 20 * 1024 * 1024;

async function errorText(response: Response) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; return body?.error?.message ?? "We could not complete that request. Please try again."; }

export function PublicPhotoPage({ mode }: { mode: PageMode }) {
  const [token, setToken] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<GalleryEvent[]>([]);
  const [galleryFilter, setGalleryFilter] = useState("ALL");
  const [scopedEventName, setScopedEventName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const initialToken = useRef<string | null>(null);

  const loadGallery = useCallback(async (accessToken: string, filter: string) => {
    setLoading(true); setError("");
    try {
      const filterQuery = filter === "ALL" ? "" : filter === "COMMON" ? "&scope=COMMON" : `&eventId=${encodeURIComponent(filter)}`;
      const response = await fetch(`${apiBaseUrl}/public/gallery/photos?limit=60${filterQuery}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error(await errorText(response));
      const body = await response.json() as { data?: { photos?: Photo[]; events?: GalleryEvent[]; scopedEventName?: string } };
      setPhotos(body.data?.photos ?? []);
      setGalleryEvents(body.data?.events ?? []);
      setScopedEventName(body.data?.scopedEventName ?? "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The gallery could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const value = initialToken.current ?? window.location.hash.slice(1);
    if (value) initialToken.current = value;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    void Promise.resolve().then(() => {
      setToken(value);
      if (!value) { setError("This link is missing its private token. Please open the complete guest link you were sent."); setLoading(false); return; }
      if (mode === "gallery") void loadGallery(value, "ALL");
      else setLoading(false);
    });
  }, [loadGallery, mode]);

  async function upload(files: FileList | null) {
    if (!files?.length || !token) return;
    setBusy(true); setError(""); setNotice("");
    let uploadedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) throw new Error(`${file.name}: only JPEG, PNG, or WebP images are accepted.`);
        if (file.size < 1 || file.size > maximumSize) throw new Error(`${file.name}: images must be smaller than 20 MB.`);
        const sessionResponse = await fetch(`${apiBaseUrl}/public/photo-upload-sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, expectedContentType: file.type, expectedSizeBytes: file.size, originalFilename: file.name }) });
        if (!sessionResponse.ok) throw new Error(await errorText(sessionResponse));
        const { data: session } = await sessionResponse.json() as { data: { sessionId: string; uploadUrl: string; requiredHeaders: Record<string, string> } };
        const put = await fetch(session.uploadUrl, { method: "PUT", headers: session.requiredHeaders, body: file });
        if (!put.ok) throw new Error(`Storage rejected ${file.name} (HTTP ${put.status}). Please try again.`);
        const completed = await fetch(`${apiBaseUrl}/public/photo-upload-sessions/${session.sessionId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        if (!completed.ok) throw new Error(await errorText(completed));
        uploadedCount += 1;
      }
      setNotice(`${uploadedCount} ${uploadedCount === 1 ? "photo was" : "photos were"} uploaded. The wedding team will review ${uploadedCount === 1 ? "it" : "them"} before adding ${uploadedCount === 1 ? "it" : "them"} to the gallery.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The photo upload failed. You can retry this upload link."); }
    finally { setBusy(false); }
  }

  async function openPhoto(photo: Photo) {
    try {
      const response = await fetch(`${apiBaseUrl}/public/gallery/photos/${photo.id}/download-url`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(await errorText(response));
      const body = await response.json() as { data: { downloadUrl: string } };
      window.open(body.data.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The photo could not be opened."); }
  }

  return <main className="public-photo-page"><header><Link className="workspace-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link></header><section className="public-photo-card"><span className="public-photo-icon">{mode === "upload" ? <ImagePlus size={22} /> : <LockKeyhole size={22} />}</span><p className="workspace-eyebrow">A PRIVATE WEDDING SPACE</p><h1>{mode === "upload" ? "Share a moment" : "Wedding memories"}</h1><p>{mode === "upload" ? "Choose your favourite photos to share with the couple. The wedding team will review them before they appear in the gallery." : "Browse the photos approved by the wedding team."}</p>{error && <p className="workspace-alert" role="alert">{error}</p>}{notice && <p className="workspace-success" role="status"><Check size={15} /> {notice}</p>}{mode === "upload" ? <label className="public-photo-picker">{busy ? <><LoaderCircle className="auth-spinner" size={19} /> Uploading securely…</> : <><ImagePlus size={19} /> Choose photos</>}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!token || busy} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /></label> : <>{scopedEventName ? <p className="public-gallery-scope">Ceremony: {scopedEventName}</p> : <label className="public-gallery-filter">Show<select value={galleryFilter} onChange={(event) => { const filter = event.target.value; setGalleryFilter(filter); void loadGallery(token, filter); }}><option value="ALL">All photos</option><option value="COMMON">Wedding gallery</option>{galleryEvents.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></label>}{loading ? <p className="workspace-empty"><LoaderCircle className="auth-spinner" size={17} /> Loading approved photos…</p> : photos.length ? <div className="public-photo-grid">{photos.map((photo) => <button type="button" key={photo.id} onClick={() => void openPhoto(photo)}><Image className="public-photo-thumbnail" src={photo.previewUrl} alt={photo.originalFilename || "Wedding photo"} width={480} height={320} unoptimized /><strong>{photo.originalFilename || "Wedding photo"}</strong><small>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(photo.createdAt))}</small></button>)}</div> : <p className="workspace-empty">No approved photos have been shared yet.</p>}<button className="button button--outline" type="button" onClick={() => void loadGallery(token, galleryFilter)} disabled={loading}>Refresh gallery</button></> }<small className="public-photo-privacy"><LockKeyhole size={13} /> This private link gives access to this wedding’s photo sharing only.</small></section></main>;
}

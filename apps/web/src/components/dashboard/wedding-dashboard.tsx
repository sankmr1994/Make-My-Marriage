"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowDownUp, CalendarDays, Check, ChevronDown, ChevronRight, Circle, Clock3, Heart, LoaderCircle, LockKeyhole, LogOut, MapPin, Pencil, Plus, RotateCcw, Save, Search, Trash2, Users, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Wedding = { id: string; couple: { brideName: string; groomName: string }; weddingDate: string; timeZone: string; location: { address: string; city?: string; state?: string; country?: string } };
type WeddingEvent = { id: string; name: string; startsAt: string; timeZone: string; venue: { name?: string; address: string; city?: string }; description?: string; status: "ACTIVE" | "ARCHIVED" };
type Account = { id: string; displayName: string; email: string };
type WorkspaceData = { wedding: Wedding; events: WeddingEvent[]; account: Account; role: "ADMIN" | "ORGANISER" };
type TeamMember = { id: string; userId: string; displayName: string; email: string; role: "ADMIN" | "ORGANISER"; joinedAt: string; isWorkspaceCreator: boolean };
type TeamInvitation = { id: string; email: string; role: "ADMIN" | "ORGANISER"; status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"; emailSubmissionStatus: "ACCEPTED" | "FAILED" | "NOT_CONFIGURED"; expiresAt: string; createdAt: string };
type WeddingTask = { id: string; title: string; description?: string; assigneeMembershipId?: string; dueAt?: string; priority: "LOW" | "MEDIUM" | "HIGH"; eventId?: string; status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; notes?: string; createdAt: string; updatedAt: string };
type EditSection = "wedding" | string | null;

const suggestedEventNames = ["Engagement", "Roka", "Haldi", "Mehendi", "Sangeet", "Muhurtham", "Wedding Ceremony", "Reception"];

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null) as { error?: { message?: string; fieldErrors?: Record<string, string> } } | null;
  return Object.values(body?.error?.fieldErrors ?? {})[0] ?? body?.error?.message ?? "We couldn’t save your changes. Please try again.";
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}

function formatEventDate(value: string, zone: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: zone }).format(new Date(value));
}

function dateInZone(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timeInZone(value: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

function offsetForZone(date: string, time: string, zone: string) {
  const instant = new Date(`${date}T${time}:00Z`);
  const text = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = text.match(/GMT([+-])(\d{2}):(\d{2})/);
  return match ? `${match[1]}${match[2]}:${match[3]}` : "+00:00";
}

export function WeddingDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "wedding" | "events" | "tasks" | "team">("dashboard");
  const [eventFilter, setEventFilter] = useState<"ALL" | "UPCOMING" | "PAST" | "ARCHIVED">("ALL");
  const [eventSearch, setEventSearch] = useState("");
  const [eventSortOrder, setEventSortOrder] = useState<"ASC" | "DESC">("ASC");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const [archiveEventId, setArchiveEventId] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [teamTab, setTeamTab] = useState<"ACTIVE" | "PENDING">("ACTIVE");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "ORGANISER">("ORGANISER");
  const [teamNotice, setTeamNotice] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null);
  const [revokeInvitationTarget, setRevokeInvitationTarget] = useState<TeamInvitation | null>(null);
  const [teamActionId, setTeamActionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WeddingTask[]>([]);
  const [taskMembers, setTaskMembers] = useState<TeamMember[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskDialog, setTaskDialog] = useState<"create" | WeddingTask | null>(null);
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<WeddingTask | null>(null);
  const [taskDraftTitle, setTaskDraftTitle] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<"ALL" | WeddingTask["status"]>("ALL");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<"ALL" | WeddingTask["priority"]>("ALL");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("ALL");
  const [taskEventFilter, setTaskEventFilter] = useState("ALL");
  const [taskDueFilter, setTaskDueFilter] = useState<"ALL" | "UPCOMING" | "OVERDUE" | "NONE">("ALL");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const accountResponse = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include", cache: "no-store" });
      if (accountResponse.status === 401) { router.replace("/sign-in"); return; }
      if (!accountResponse.ok) throw new Error("We couldn’t load your account.");
      const accountResult = await accountResponse.json() as { data?: { user?: Account; membership?: unknown } };
      if (!accountResult.data?.membership) { router.replace("/welcome"); return; }
      const [weddingResponse, eventsResponse, tasksResponse, membersResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/weddings/current`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBaseUrl}/events?status=ALL`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBaseUrl}/tasks`, { credentials: "include", cache: "no-store" }),
        fetch(`${apiBaseUrl}/weddings/current/members`, { credentials: "include", cache: "no-store" })
      ]);
      if (!weddingResponse.ok) throw new Error(await errorMessage(weddingResponse));
      if (!eventsResponse.ok) throw new Error(await errorMessage(eventsResponse));
      if (!tasksResponse.ok) throw new Error(await errorMessage(tasksResponse));
      if (!membersResponse.ok) throw new Error(await errorMessage(membersResponse));
      const weddingResult = await weddingResponse.json() as { data?: { wedding?: Wedding; membership?: { role?: "ADMIN" | "ORGANISER" } } };
      const eventsResult = await eventsResponse.json() as { data?: { events?: WeddingEvent[] } };
      const tasksResult = await tasksResponse.json() as { data?: { tasks?: WeddingTask[] } };
      const membersResult = await membersResponse.json() as { data?: { members?: TeamMember[] } };
      if (!weddingResult.data?.wedding || !weddingResult.data.membership?.role || !accountResult.data.user) throw new Error("Wedding details were incomplete.");
      setData({ wedding: weddingResult.data.wedding, events: eventsResult.data?.events ?? [], account: accountResult.data.user, role: weddingResult.data.membership.role });
      setTasks(tasksResult.data?.tasks ?? []);
      setTaskMembers(membersResult.data?.members ?? []);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t load your wedding workspace.");
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!data || (activeView !== "team" && teamLoaded)) return;
    const currentRole = data.role;
    let active = true;
    async function loadTeam() {
      setTeamLoading(true); setError(null);
      try {
        const requests = [fetch(`${apiBaseUrl}/weddings/current/members`, { credentials: "include", cache: "no-store" })];
        if (currentRole === "ADMIN") requests.push(fetch(`${apiBaseUrl}/weddings/current/membership-invitations`, { credentials: "include", cache: "no-store" }));
        const responses = await Promise.all(requests);
        if (!responses[0].ok) throw new Error(await errorMessage(responses[0]));
        const membersResult = await responses[0].json() as { data?: { members?: TeamMember[] } };
        let invitations: TeamInvitation[] = [];
        if (responses[1]) {
          if (!responses[1].ok) throw new Error(await errorMessage(responses[1]));
          const result = await responses[1].json() as { data?: { invitations?: TeamInvitation[] } };
          invitations = result.data?.invitations ?? [];
        }
        if (active) { setTeamMembers(membersResult.data?.members ?? []); setTeamInvitations(invitations); setTeamLoaded(true); }
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "We couldn’t load your wedding team."); setTeamLoaded(true); }
      } finally { if (active) setTeamLoading(false); }
    }
    void loadTeam();
    return () => { active = false; };
  }, [activeView, data, teamLoaded]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !sortControlRef.current?.contains(event.target)) setSortMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortMenuOpen(false);
        sortTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sortMenuOpen]);

  async function saveWedding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ couple: { brideName: form.get("brideName"), groomName: form.get("groomName") }, weddingDate: form.get("weddingDate"), location: { address: form.get("address"), city: form.get("city"), state: form.get("state"), country: form.get("country") } }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { wedding?: Wedding } };
      if (result.data?.wedding) setData((current) => current ? { ...current, wedding: result.data!.wedding! } : current);
      setEditSection(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save your wedding details."); }
    finally { setSaving(false); }
  }

  async function saveEvent(event: React.FormEvent<HTMLFormElement>, item: WeddingEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date")); const time = String(form.get("time"));
    setSaving(true); setError(null);
    try {
      const offset = offsetForZone(date, time, item.timeZone);
      const response = await fetch(`${apiBaseUrl}/events/${item.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), startsAt: `${date}T${time}:00${offset}`, venue: { name: form.get("venueName"), address: form.get("address"), city: form.get("city") }, description: form.get("description") }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { event?: WeddingEvent } };
      if (result.data?.event) setData((current) => current ? { ...current, events: current.events.map((entry) => entry.id === item.id ? { ...entry, ...result.data!.event! } : entry) } : current);
      setEditSection(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save this event."); }
    finally { setSaving(false); }
  }

  async function saveNewEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const date = String(form.get("date")); const time = String(form.get("time"));
    setSaving(true); setError(null);
    try {
      const offset = offsetForZone(date, time, data.wedding.timeZone);
      const response = await fetch(`${apiBaseUrl}/events`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), startsAt: `${date}T${time}:00${offset}`, timeZone: data.wedding.timeZone, venue: { name: form.get("venueName"), address: form.get("address"), city: form.get("city") }, description: form.get("description") }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { event?: WeddingEvent } };
      if (result.data?.event) setData((current) => current ? { ...current, events: [...current.events, { ...result.data!.event!, status: "ACTIVE" as const }].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) } : current);
      setNewEventName(""); setEditSection(null); setActiveView("events"); setEventFilter("ALL");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t create this event."); }
    finally { setSaving(false); }
  }

  async function archiveEvent(item: WeddingEvent) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/events/${item.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setData((current) => current ? { ...current, events: current.events.map((entry) => entry.id === item.id ? { ...entry, status: "ARCHIVED" } : entry) } : current);
      setArchiveEventId(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t archive this event."); }
    finally { setSaving(false); }
  }

  async function unarchiveEvent(item: WeddingEvent) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/events/${item.id}/unarchive`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setData((current) => current ? { ...current, events: current.events.map((entry) => entry.id === item.id ? { ...entry, status: "ACTIVE" } : entry) } : current);
      setEventFilter("ALL");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t restore this event."); }
    finally { setSaving(false); }
  }

  function openNewTask(title = "") {
    setTaskDraftTitle(title);
    setTaskDialog("create");
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>, current?: WeddingTask) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") ?? "");
    const dueAt = dueDate ? `${dueDate}T23:59:59${offsetForZone(dueDate, "23:59", data.wedding.timeZone)}` : null;
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      assigneeMembershipId: String(form.get("assigneeMembershipId") ?? "") || null,
      dueAt,
      priority: String(form.get("priority") ?? "MEDIUM"),
      eventId: String(form.get("eventId") ?? "") || null,
      status: String(form.get("status") ?? "NOT_STARTED"),
      notes: String(form.get("notes") ?? "") || undefined
    };
    setSaving(true); setError(null);
    try {
      const response = await fetch(current ? `${apiBaseUrl}/tasks/${current.id}` : `${apiBaseUrl}/tasks`, { method: current ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { task?: WeddingTask } };
      if (result.data?.task) setTasks((items) => current ? items.map((item) => item.id === current.id ? result.data!.task! : item) : [result.data!.task!, ...items]);
      setTaskDialog(null); setTaskDraftTitle(""); setActiveView("tasks");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t save this task."); }
    finally { setSaving(false); }
  }

  async function updateTaskStatus(task: WeddingTask, status: WeddingTask["status"]) {
    if (task.status === status) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/tasks/${task.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { task?: WeddingTask } };
      if (result.data?.task) setTasks((items) => items.map((item) => item.id === task.id ? result.data!.task! : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t update this task."); }
    finally { setSaving(false); }
  }

  async function deleteTask() {
    if (!taskDeleteTarget) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/tasks/${taskDeleteTarget.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setTasks((items) => items.filter((item) => item.id !== taskDeleteTarget.id));
      setTaskDeleteTarget(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t delete this task."); }
    finally { setSaving(false); }
  }

  async function signOut() {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/logout`, { method: "POST", credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Sign out failed.");
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t sign out."); setSaving(false); }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null); setTeamNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/membership-invitations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { invitation?: TeamInvitation; emailSubmissionStatus?: TeamInvitation["emailSubmissionStatus"] } };
      if (result.data?.invitation) setTeamInvitations((current) => [result.data!.invitation!, ...current]);
      setTeamNotice(result.data?.emailSubmissionStatus === "ACCEPTED" ? "Resend accepted the invitation email submission. Inbox delivery is not confirmed." : result.data?.emailSubmissionStatus === "NOT_CONFIGURED" ? "The invitation is saved, but email is not configured yet. Add the Resend settings, then resend it." : "The invitation is saved, but the email provider did not accept the message. You can retry it from Pending invitations.");
      setInviteEmail(""); setInviteRole("ORGANISER"); setInviteDialogOpen(false); setTeamTab("PENDING");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t create the invitation."); }
    finally { setSaving(false); }
  }

  async function resendInvitation(invitation: TeamInvitation) {
    setTeamActionId(invitation.id); setError(null); setTeamNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/membership-invitations/${invitation.id}/resend`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { data?: { invitation?: TeamInvitation; emailSubmissionStatus?: TeamInvitation["emailSubmissionStatus"] } };
      if (result.data?.invitation) setTeamInvitations((current) => [result.data!.invitation!, ...current.map((item) => item.id === invitation.id ? { ...item, status: "REVOKED" as const } : item)]);
      setTeamNotice(result.data?.emailSubmissionStatus === "ACCEPTED" ? "Resend accepted the fresh invitation email submission. Inbox delivery is not confirmed." : "The fresh invitation link was created, but the email could not be submitted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t resend the invitation."); }
    finally { setTeamActionId(null); }
  }

  async function revokeInvitation(invitation: TeamInvitation) {
    setTeamActionId(invitation.id); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/membership-invitations/${invitation.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setTeamInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, status: "REVOKED" } : item));
      setRevokeInvitationTarget(null);
      setTeamNotice(`The invitation for ${invitation.email} was revoked. Its link can no longer be used.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t revoke the invitation."); }
    finally { setTeamActionId(null); }
  }

  async function removeWorkspaceMember() {
    if (!removeMember) return;
    setTeamActionId(removeMember.id); setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/weddings/current/members/${removeMember.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      setTeamMembers((current) => current.filter((item) => item.id !== removeMember.id));
      setTeamNotice(`${removeMember.displayName} was removed from the wedding team.`);
      setRemoveMember(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn’t remove this member."); }
    finally { setTeamActionId(null); }
  }

  if (status === "loading") return <main className="workspace-loading"><LoaderCircle className="auth-spinner" /> Loading your wedding workspace…</main>;
  if (status === "error" || !data) return <main className="workspace-loading"><section><p className="auth-message auth-message--error" role="alert">{error}</p><button className="button button--dark" onClick={() => void load()}>Try again</button></section></main>;

  const { wedding, events, account, role } = data;
  const daysUntilWedding = Math.max(0, Math.ceil((new Date(`${wedding.weddingDate}T00:00:00Z`).getTime() - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime()) / 86_400_000));
  const activeEvents = events.filter((item) => item.status === "ACTIVE");
  const visibleEvents = events.filter((item) => {
    if (eventFilter === "ARCHIVED") { if (item.status !== "ARCHIVED") return false; }
    else {
      if (item.status !== "ACTIVE") return false;
      const isUpcoming = new Date(item.startsAt).getTime() >= now;
      if (eventFilter === "UPCOMING" && !isUpcoming) return false;
      if (eventFilter === "PAST" && isUpcoming) return false;
    }
    const query = eventSearch.trim().toLocaleLowerCase();
    return !query || [item.name, item.venue.name, item.venue.address, item.venue.city, item.startsAt].some((value) => value?.toLocaleLowerCase().includes(query));
  }).sort((a, b) => eventSortOrder === "ASC" ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt));
  const eventCounts = { ALL: activeEvents.length, UPCOMING: activeEvents.filter((item) => new Date(item.startsAt).getTime() >= now).length, PAST: activeEvents.filter((item) => new Date(item.startsAt).getTime() < now).length, ARCHIVED: events.filter((item) => item.status === "ARCHIVED").length };
  const venueSummaries = activeEvents.reduce<Array<{ key: string; name: string; city: string; events: WeddingEvent[] }>>((venues, item) => {
    const name = item.venue.name || item.venue.address;
    const city = item.venue.city || wedding.location.city || "";
    const key = `${name.trim().toLocaleLowerCase()}|${city.trim().toLocaleLowerCase()}`;
    const existing = venues.find((venue) => venue.key === key);
    if (existing) existing.events.push(item);
    else venues.push({ key, name, city, events: [item] });
    return venues;
  }, []);
  const upcomingEvents = activeEvents.filter((item) => new Date(item.startsAt).getTime() >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const nextEvent = upcomingEvents[0];
  const weddingLocation = [wedding.location.city, wedding.location.state, wedding.location.country].filter(Boolean).join(", ") || wedding.location.address;
  const taskCounts = { NOT_STARTED: tasks.filter((task) => task.status === "NOT_STARTED").length, IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS").length, COMPLETED: tasks.filter((task) => task.status === "COMPLETED").length };
  const isOverdue = (task: WeddingTask) => Boolean(task.dueAt && new Date(task.dueAt).getTime() < now && task.status !== "COMPLETED");
  const memberForTask = (task: WeddingTask) => taskMembers.find((member) => member.id === task.assigneeMembershipId);
  const eventForTask = (task: WeddingTask) => activeEvents.find((item) => item.id === task.eventId);
  const filteredTasks = tasks.filter((task) => {
    const query = taskSearch.trim().toLocaleLowerCase();
    const assignee = memberForTask(task);
    const linkedEvent = eventForTask(task);
    if (query && ![task.title, task.description, task.notes, assignee?.displayName, linkedEvent?.name].some((value) => value?.toLocaleLowerCase().includes(query))) return false;
    if (taskStatusFilter !== "ALL" && task.status !== taskStatusFilter) return false;
    if (taskPriorityFilter !== "ALL" && task.priority !== taskPriorityFilter) return false;
    if (taskAssigneeFilter !== "ALL" && task.assigneeMembershipId !== taskAssigneeFilter) return false;
    if (taskEventFilter !== "ALL" && task.eventId !== taskEventFilter) return false;
    if (taskDueFilter === "OVERDUE" && !isOverdue(task)) return false;
    if (taskDueFilter === "UPCOMING" && (!task.dueAt || new Date(task.dueAt).getTime() < now || task.status === "COMPLETED")) return false;
    return !(taskDueFilter === "NONE" && task.dueAt);
  }).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const taskGroups = { overdue: filteredTasks.filter(isOverdue), upcoming: filteredTasks.filter((task) => !isOverdue(task) && task.status !== "COMPLETED"), completed: filteredTasks.filter((task) => task.status === "COMPLETED") };
  const taskBeingEdited = taskDialog && typeof taskDialog === "object" ? taskDialog : undefined;
  const currentMember = taskMembers.find((member) => member.userId === data?.account.id);
  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <Link className="workspace-brand" href="/" aria-label="Make My Marriage home"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>MAKE MY MARRIAGE</span></Link>
      <button className="workspace-create-event" type="button" onClick={() => { setNewEventName(""); setDescriptionLength(0); setEditSection("create"); }}><Plus size={16} /> Create event</button>
      <p className="workspace-side-label">YOUR WORKSPACE</p>
      <nav className="workspace-nav" aria-label="Workspace navigation">
        <button className={activeView === "dashboard" ? "is-active" : ""} type="button" aria-current={activeView === "dashboard" ? "page" : undefined} onClick={() => setActiveView("dashboard")}><span>◫</span> Dashboard</button>
        <button className={activeView === "wedding" ? "is-active" : ""} type="button" aria-current={activeView === "wedding" ? "page" : undefined} onClick={() => setActiveView("wedding")}><Heart size={17} /> My Wedding</button>
        <button className={activeView === "events" ? "is-active" : ""} type="button" aria-current={activeView === "events" ? "page" : undefined} onClick={() => setActiveView("events")}><CalendarDays size={17} /> Events <span className="workspace-count">{activeEvents.length}</span></button>
        <button className={activeView === "tasks" ? "is-active" : ""} type="button" aria-current={activeView === "tasks" ? "page" : undefined} onClick={() => setActiveView("tasks")}><Check size={17} /> Tasks <span className="workspace-count">{taskCounts.NOT_STARTED + taskCounts.IN_PROGRESS}</span></button>
        <button className={activeView === "team" ? "is-active" : ""} type="button" aria-current={activeView === "team" ? "page" : undefined} onClick={() => { setActiveView("team"); setTeamTab("ACTIVE"); }}><Users size={17} /> Team <span className="workspace-count">{teamLoaded ? teamMembers.length : "…"}</span></button>
      </nav>
      <div className="workspace-sidebar-bottom"><span className="workspace-avatar">{account.displayName.slice(0, 1).toUpperCase()}</span><span className="workspace-user"><strong>{account.displayName}</strong><small>{account.email}</small></span><button type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()} disabled={saving}><LogOut size={17} /></button></div>
    </aside>
    <section className="workspace-main" id="dashboard">
      <header className="workspace-topbar"><div className="workspace-topbar-context"><div><strong>{wedding.couple.brideName} &amp; {wedding.couple.groomName}&apos;s Wedding</strong><small>{formatDate(wedding.weddingDate, { day: "numeric", month: "short", year: "numeric" })} <span>·</span> {weddingLocation}</small></div><span className="workspace-topbar-countdown"><CalendarDays size={14} /> {daysUntilWedding} days to ceremony</span></div><div className="workspace-topbar-actions"><span className="workspace-role-tag">{role === "ADMIN" ? "Admin" : "Organiser"}</span><span className="workspace-topbar-avatar" aria-label={account.displayName}>{account.displayName.slice(0, 1).toUpperCase()}</span><button type="button" onClick={() => void signOut()} disabled={saving}>Sign out <LogOut size={15} /></button></div></header>
      {error && <p className="workspace-alert" role="alert">{error}</p>}
      <div className="workspace-content">
        {activeView === "dashboard" && <>
          <section className="workspace-dashboard-hero" aria-labelledby="workspace-dashboard-title"><div className="workspace-dashboard-hero-copy"><span className="workspace-pill"><span /> MAKE MY MARRIAGE WORKSPACE</span><h1 id="workspace-dashboard-title">{wedding.couple.brideName} <i>&amp;</i> {wedding.couple.groomName}</h1><p className="workspace-dashboard-quote">“Your wedding, thoughtfully together.”</p><p><MapPin size={16} /> {wedding.location.address}{weddingLocation ? ` · ${weddingLocation}` : ""}</p><div className="workspace-dashboard-meta"><span><CalendarDays size={15} /> {formatDate(wedding.weddingDate)}</span><span><Users size={15} /> Your role: {role === "ADMIN" ? "Admin" : "Organiser"}</span></div></div><div className="workspace-dashboard-monogram" aria-hidden="true"><span>{wedding.couple.brideName.slice(0, 1)}<i>&amp;</i>{wedding.couple.groomName.slice(0, 1)}</span><small>{wedding.location.city || "Your celebration"}</small></div></section>
          <section className="workspace-dashboard-metrics" aria-label="Wedding overview"><article><span className="workspace-eyebrow">UPCOMING EVENTS</span><strong>{upcomingEvents.length}</strong><p>{nextEvent ? `Next: ${nextEvent.name}` : "No future ceremonies yet"}</p><button type="button" onClick={() => setActiveView("events")}>View schedule <ChevronRight size={14} /></button></article><article><span className="workspace-eyebrow">TASKS</span><strong>{taskCounts.NOT_STARTED + taskCounts.IN_PROGRESS}</strong><p>{taskCounts.IN_PROGRESS} in progress · {taskCounts.NOT_STARTED} not started</p><button type="button" onClick={() => setActiveView("tasks")}>Open task board <ChevronRight size={14} /></button></article><article><span className="workspace-eyebrow">OVERDUE TASKS</span><strong>{tasks.filter(isOverdue).length}</strong><p>{tasks.some(isOverdue) ? "Needs your attention" : "Nothing overdue"}</p><button type="button" onClick={() => { setTaskDueFilter("OVERDUE"); setActiveView("tasks"); }}>Review tasks <ChevronRight size={14} /></button></article><article><span className="workspace-eyebrow">WORKSPACE ROLE</span><strong>{role === "ADMIN" ? "Admin" : "Organiser"}</strong><p>{role === "ADMIN" ? "Manage your wedding team" : "Plan alongside the couple"}</p><button type="button" onClick={() => setActiveView("team")}>View team <ChevronRight size={14} /></button></article></section>
          <section className="workspace-dashboard-grid"><div className="workspace-dashboard-schedule"><div className="workspace-dashboard-section-heading"><div><p className="workspace-eyebrow">CEREMONY SCHEDULE</p><h2>Your upcoming celebrations</h2></div><button type="button" onClick={() => setActiveView("events")}>View all events <ChevronRight size={14} /></button></div>{upcomingEvents.length ? <div className="workspace-dashboard-event-list">{upcomingEvents.slice(0, 3).map((item) => <article key={item.id}><time dateTime={item.startsAt}><span>{formatEventDate(item.startsAt, item.timeZone, { month: "short" }).toUpperCase()}</span><strong>{formatEventDate(item.startsAt, item.timeZone, { day: "2-digit" })}</strong></time><div><h3>{item.name}</h3><p>{item.venue.name || item.venue.address} · {new Intl.DateTimeFormat("en-IN", { timeZone: item.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt))} IST</p></div><span>{item === nextEvent ? "Next up" : "Scheduled"}</span></article>)}</div> : <div className="workspace-dashboard-empty"><CalendarDays size={20} /><div><strong>No upcoming ceremonies</strong><p>Add the next event to begin your shared itinerary.</p></div><button className="button button--dark" type="button" onClick={() => { setNewEventName(""); setDescriptionLength(0); setEditSection("create"); }}><Plus size={15} /> Create event</button></div>}</div><aside className="workspace-dashboard-brief"><p className="workspace-eyebrow">YOUR WORKSPACE</p><h2>Keep the essentials together.</h2><p>Wedding details, ceremonies, and your planning team are ready whenever you need them.</p><dl><div><dt>Timezone</dt><dd>{wedding.timeZone}</dd></div><div><dt>Active events</dt><dd>{activeEvents.length}</dd></div><div><dt>Archived events</dt><dd>{eventCounts.ARCHIVED}</dd></div></dl><button type="button" onClick={() => setActiveView("wedding")}>Review wedding details <ChevronRight size={14} /></button></aside></section>
        </>}
        {activeView === "tasks" && <section className="workspace-tasks">
          <div className="workspace-tasks-heading"><div><p className="workspace-eyebrow">WEDDING ATELIER <span>·</span> PLANNING &amp; OPERATIONS</p><h1>Tasks &amp; planning</h1><p>Coordinate responsibilities, track ceremonial deliverables, and keep your wedding team synchronised without clutter.</p></div><button className="button button--dark" type="button" onClick={() => openNewTask()}><Plus size={16} /> Add task</button></div>
          <section className="workspace-task-metrics" aria-label="Task status overview"><article><span>NOT STARTED</span><strong>{taskCounts.NOT_STARTED}</strong><small>scheduled tasks</small></article><article><span>IN PROGRESS</span><strong>{taskCounts.IN_PROGRESS}</strong><small>actively handled</small></article><article><span>COMPLETED</span><strong>{taskCounts.COMPLETED}</strong><small>concluded records</small></article><article className="is-overdue"><span>OVERDUE</span><strong>{tasks.filter(isOverdue).length}</strong><small>{tasks.some(isOverdue) ? "Tasks past their due date" : "No tasks past due"}</small></article></section>
          {tasksLoading ? <div className="workspace-empty"><LoaderCircle className="auth-spinner" size={18} /> Loading tasks…</div> : tasks.length === 0 ? <section className="workspace-task-empty"><span><Check size={27} /></span><h2>Your planning list starts here.</h2><p>Break your celebration into manageable milestones. Assign tasks to your partner or wedding organisers, tie them to ceremonies, and stay composed.</p><button className="button button--dark" type="button" onClick={() => openNewTask()}><Plus size={15} /> Add your first task</button><div><p>CURATED QUICK-STARTS</p>{["Confirm venue details", "Review catering guest count", "Invite family", "Finalise floral arrangements", "Book transport", "Finalise reception playlist"].map((title) => <button type="button" key={title} onClick={() => openNewTask(title)}><Plus size={13} /> {title}</button>)}</div><small>Templates prefill a task form for editing. No automated reminders are generated.</small></section> : <>
            <section className="workspace-task-filters" aria-label="Task filters"><label className="workspace-task-search"><Search size={17} /><input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search tasks or keywords…" /></label><select aria-label="Filter by status" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as typeof taskStatusFilter)}><option value="ALL">Status: All</option><option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select><select aria-label="Filter by priority" value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value as typeof taskPriorityFilter)}><option value="ALL">Priority: All</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><select aria-label="Filter by assignee" value={taskAssigneeFilter} onChange={(event) => setTaskAssigneeFilter(event.target.value)}><option value="ALL">Assignee: All members</option>{taskMembers.map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select><select aria-label="Filter by event" value={taskEventFilter} onChange={(event) => setTaskEventFilter(event.target.value)}><option value="ALL">Linked event: All</option>{activeEvents.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><div className="workspace-task-timeline" role="group" aria-label="Quick task filters">{currentMember && <button type="button" className={taskAssigneeFilter === currentMember.id ? "is-active" : ""} aria-pressed={taskAssigneeFilter === currentMember.id} onClick={() => setTaskAssigneeFilter(taskAssigneeFilter === currentMember.id ? "ALL" : currentMember.id)}>My tasks</button>}{(["ALL", "UPCOMING", "OVERDUE", "NONE"] as const).map((filter) => <button type="button" key={filter} className={taskDueFilter === filter ? "is-active" : ""} onClick={() => setTaskDueFilter(filter)}>{filter === "ALL" ? "All" : filter === "NONE" ? "No due date" : filter[0] + filter.slice(1).toLowerCase()}</button>)}</div></section>
            {([ ["overdue", "Overdue", "REQUIRES IMMEDIATE ALIGNMENT"], ["upcoming", "Upcoming", "CHRONOLOGICAL SCHEDULE"], ["completed", "Completed", "LOGGED DELIVERABLES"] ] as const).map(([key, label, description]) => taskGroups[key].length > 0 && <section className={`workspace-task-group is-${key}`} key={key}><header><h2>{label} <span>({taskGroups[key].length})</span></h2><small>{description}</small></header>{taskGroups[key].map((task) => { const assignee = memberForTask(task); const linkedEvent = eventForTask(task); return <article className="workspace-task-row" key={task.id}><button className={`workspace-task-check ${task.status === "COMPLETED" ? "is-complete" : ""}`} type="button" aria-label={task.status === "COMPLETED" ? `Mark ${task.title} as not started` : `Mark ${task.title} as completed`} onClick={() => void updateTaskStatus(task, task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED")} disabled={saving}>{task.status === "COMPLETED" && <Check size={14} />}</button><div className="workspace-task-row-copy"><button type="button" onClick={() => { setTaskDraftTitle(task.title); setTaskDialog(task); }}>{task.title}</button><div><span className={`workspace-priority is-${task.priority.toLowerCase()}`}>{task.priority}</span><span className={`workspace-task-status is-${task.status.toLowerCase().replace("_", "-")}`}>{task.status.replace("_", " ")}</span>{linkedEvent && <span><CalendarDays size={13} /> {linkedEvent.name}</span>}{assignee ? <span><i>{assignee.displayName.slice(0, 1)}</i> {assignee.displayName}</span> : <span>Unassigned</span>}</div></div><div className="workspace-task-row-due">{task.dueAt ? <time className={isOverdue(task) ? "is-overdue" : ""} dateTime={task.dueAt}>{formatEventDate(task.dueAt, wedding.timeZone, { day: "numeric", month: "short", year: "numeric" })}</time> : <span>No due date</span>}<select aria-label={`Update status for ${task.title}`} value={task.status} onChange={(event) => void updateTaskStatus(task, event.target.value as WeddingTask["status"])} disabled={saving}><option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option></select><button type="button" onClick={() => { setTaskDraftTitle(task.title); setTaskDialog(task); }}><Pencil size={14} /> Edit</button><button className="workspace-task-delete-button" type="button" onClick={() => setTaskDeleteTarget(task)} aria-label={`Delete ${task.title}`} title="Delete task"><Trash2 size={14} /></button></div></article>; })}</section>)}
          </>}
        </section>}
        {activeView === "events" && <>
          <div className="workspace-events-heading"><div><p className="workspace-eyebrow">CEREMONIAL REGISTRY <span>·</span> {wedding.location.city} SCHEDULE</p><h1>Ceremonies &amp; Events</h1><p>Plan your ceremonial timeline. All times are shown in {wedding.timeZone}.</p></div><button className="button button--dark" type="button" onClick={() => { setNewEventName(""); setDescriptionLength(0); setEditSection("create"); }}><Plus size={16} /> Create event</button></div>
          <div className="workspace-event-controls"><div className="workspace-event-tabs" role="tablist" aria-label="Filter events">{(["ALL", "UPCOMING", "PAST", "ARCHIVED"] as const).map((filter) => <button type="button" role="tab" aria-selected={eventFilter === filter} className={eventFilter === filter ? "is-active" : ""} key={filter} onClick={() => setEventFilter(filter)}>{filter === "ALL" ? "All events" : filter[0] + filter.slice(1).toLowerCase()} <span>{eventCounts[filter]}</span></button>)}</div><label className="workspace-event-search"><Search size={16} /><input aria-label="Filter events by name, venue, or date" placeholder="Filter by event, venue or date…" value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} /></label><div className="workspace-sort-control" ref={sortControlRef}><button ref={sortTriggerRef} className="workspace-sort-trigger" type="button" aria-haspopup="menu" aria-expanded={sortMenuOpen} aria-label={`Sort events: ${eventSortOrder === "ASC" ? "Soonest first" : "Furthest date first"}`} onClick={() => setSortMenuOpen((open) => !open)}><ArrowDownUp size={15} /><span>{eventSortOrder === "ASC" ? "Soonest first" : "Furthest date first"}</span><ChevronDown className={sortMenuOpen ? "is-open" : ""} size={14} /></button>{sortMenuOpen && <div className="workspace-sort-menu" role="menu" aria-label="Sort events"><button type="button" role="menuitemradio" aria-checked={eventSortOrder === "ASC"} onClick={() => { setEventSortOrder("ASC"); setSortMenuOpen(false); }}>Soonest first{eventSortOrder === "ASC" && <Check size={14} />}</button><button type="button" role="menuitemradio" aria-checked={eventSortOrder === "DESC"} onClick={() => { setEventSortOrder("DESC"); setSortMenuOpen(false); }}>Furthest date first{eventSortOrder === "DESC" && <Check size={14} />}</button></div>}</div></div>
          {visibleEvents.length ? <div className="workspace-events">{visibleEvents.map((item, index) => <article className={`workspace-event ${item.status === "ARCHIVED" ? "is-archived" : ""}`} key={item.id}><span className="workspace-event-number">{String(index + 1).padStart(2, "0")}</span><div className="workspace-event-date"><strong>{formatEventDate(item.startsAt, item.timeZone, { day: "2-digit" })}</strong><span>{formatEventDate(item.startsAt, item.timeZone, { month: "short" }).toUpperCase()}</span><small>{formatEventDate(item.startsAt, item.timeZone, { weekday: "short" })}</small></div><span className="workspace-event-rule" aria-hidden="true" /><div className="workspace-event-info"><span className="workspace-eyebrow">{item.status === "ARCHIVED" ? "ARCHIVED" : new Date(item.startsAt).getTime() < now ? "PAST EVENT" : "UPCOMING EVENT"}<span> · </span><Clock3 size={13} /> {new Intl.DateTimeFormat("en-IN", { timeZone: item.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(item.startsAt))} IST</span><h3>{item.name}</h3><p><MapPin size={14} /> {item.venue.name || item.venue.address} <span>·</span> {item.venue.city || wedding.location.city}{wedding.location.state ? `, ${wedding.location.state}` : ""}</p>{item.description && <p className="workspace-event-description">{item.description}</p>}</div><div className="workspace-event-actions">{item.status === "ACTIVE" ? <><button type="button" className="workspace-edit-button" disabled={saving} onClick={() => { setNewEventName(item.name); setDescriptionLength(item.description?.length ?? 0); setEditSection(item.id); }}><Pencil size={14} /> Edit</button><button type="button" className="workspace-icon-button" aria-label={`Archive ${item.name}`} title={`Archive ${item.name}`} disabled={saving} onClick={() => setArchiveEventId(item.id)}><Archive size={16} /><span className="workspace-action-label">Archive</span></button></> : <button type="button" className="workspace-edit-button" disabled={saving} aria-label={`Unarchive ${item.name}`} onClick={() => void unarchiveEvent(item)}><RotateCcw size={14} /> Unarchive</button>}</div></article>)}</div> : eventSearch.trim() ? <div className="workspace-empty"><Search size={20} /><div><strong>No matching events</strong><p>Try another event name, venue, or date.</p></div></div> : eventFilter === "ARCHIVED" ? <div className="workspace-empty"><Archive size={20} /><div><strong>No archived events</strong><p>Archived events will appear here.</p></div></div> : <div className="workspace-empty workspace-empty--large"><CalendarDays size={25} /><div><strong>No events added yet</strong><p>Add your first ceremony to start building the wedding schedule.</p><div className="workspace-quick-add">{["Engagement", "Haldi", "Mehendi", "Muhurtham", "Reception"].map((name) => <button type="button" key={name} onClick={() => { setNewEventName(name); setDescriptionLength(0); setEditSection("create"); }}>{name} <Plus size={13} /></button>)}</div><button className="button button--dark" type="button" onClick={() => { setNewEventName(""); setDescriptionLength(0); setEditSection("create"); }}><Plus size={15} /> Create your first event</button></div></div>}
          {activeEvents.length > 0 && <section className="workspace-venue-summary" aria-labelledby="workspace-venue-title"><div className="workspace-venue-summary-heading"><div><p className="workspace-eyebrow">VENUE OVERVIEW</p><h2 id="workspace-venue-title">Your celebration locations</h2></div><span>{venueSummaries.length} {venueSummaries.length === 1 ? "venue" : "venues"}</span></div><div className="workspace-venue-summary-grid">{venueSummaries.slice(0, 2).map((venue) => <article className="workspace-venue-card" key={venue.key}><span className="workspace-venue-icon"><MapPin size={17} /></span><p className="workspace-eyebrow">{venue.city || "EVENT VENUE"}</p><h3>{venue.name}</h3><p>{venue.events.length} {venue.events.length === 1 ? "event" : "events"} scheduled here</p><ul>{venue.events.slice(0, 2).map((item) => <li key={item.id}>{item.name}<span>{formatEventDate(item.startsAt, item.timeZone, { day: "numeric", month: "short" })}</span></li>)}</ul></article>)}<article className="workspace-venue-ledger"><p className="workspace-eyebrow">ITINERARY SUMMARY</p><strong>{activeEvents.length} scheduled {activeEvents.length === 1 ? "event" : "events"}</strong><p>Across {venueSummaries.length} {venueSummaries.length === 1 ? "venue" : "venues"}. All times use {wedding.timeZone}.</p><dl><div><dt>Upcoming</dt><dd>{eventCounts.UPCOMING}</dd></div><div><dt>Past</dt><dd>{eventCounts.PAST}</dd></div><div><dt>Archived</dt><dd>{eventCounts.ARCHIVED}</dd></div></dl>{nextEvent && <p className="workspace-next-event"><span>Next event</span><strong>{nextEvent.name}</strong><small>{formatEventDate(nextEvent.startsAt, nextEvent.timeZone, { day: "numeric", month: "short" })} · {new Intl.DateTimeFormat("en-IN", { timeZone: nextEvent.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(nextEvent.startsAt))} IST</small></p>}</article></div>{venueSummaries.length > 2 && <p className="workspace-venue-overflow">Showing 2 of {venueSummaries.length} venues. Event cards above include the full venue details.</p>}</section>}
        </>}
        {activeView === "team" && <section className="workspace-team"><div className="workspace-team-heading"><div><p className="workspace-eyebrow">WEDDING WORKSPACE <span>·</span> PEOPLE</p><h1>Your wedding team</h1><p>Plan together with your partner and trusted wedding organisers.</p></div>{role === "ADMIN" && <button className="button button--dark" type="button" onClick={() => { setTeamNotice(null); setInviteDialogOpen(true); }}><Plus size={16} /> Invite a member</button>}</div>
          {role === "ADMIN" && <div className="workspace-admin-slots"><LockKeyhole size={17} /><div><strong>Admin allocation: {teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length} of 2 slots assigned</strong><span>Admins are reserved for the couple. Pending partner invitations count toward the limit.</span></div><span>{teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length >= 2 ? "CAP REACHED" : "AVAILABLE"}</span></div>}
          <div className="workspace-team-summary"><article><span className="workspace-eyebrow">ACTIVE MEMBERS</span><strong>{teamMembers.length}</strong></article>{role === "ADMIN" && <article><span className="workspace-eyebrow">PENDING INVITATIONS</span><strong>{teamInvitations.filter((item) => item.status === "PENDING").length}</strong></article>}</div>
          <div className="workspace-team-tabs" role="tablist" aria-label="Wedding team lists"><button type="button" role="tab" aria-selected={teamTab === "ACTIVE"} className={teamTab === "ACTIVE" ? "is-active" : ""} onClick={() => setTeamTab("ACTIVE")}>Active members <span>{teamMembers.length}</span></button>{role === "ADMIN" && <button type="button" role="tab" aria-selected={teamTab === "PENDING"} className={teamTab === "PENDING" ? "is-active" : ""} onClick={() => setTeamTab("PENDING")}>Pending invitations <span>{teamInvitations.filter((item) => item.status === "PENDING").length}</span></button>}</div>
          {teamNotice && <p className="workspace-team-notice" role="status">{teamNotice}</p>}
          {teamLoading ? <div className="workspace-empty"><LoaderCircle className="auth-spinner" size={18} /> Loading your wedding team…</div> : teamTab === "ACTIVE" ? <div className="workspace-member-list">{teamMembers.length ? teamMembers.map((member) => <article className="workspace-member-card" key={member.id}><span className="workspace-member-avatar">{member.displayName.slice(0, 1).toUpperCase()}</span><div className="workspace-member-identity"><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={`workspace-member-role ${member.role === "ADMIN" ? "is-admin" : ""}`}>{member.role === "ADMIN" ? "Partner · Admin" : "Wedding Organiser"}</span><span className="workspace-member-joined">{member.isWorkspaceCreator ? "Workspace creator" : `Joined ${new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date(member.joinedAt))}`}</span>{role === "ADMIN" && !member.isWorkspaceCreator && <button className="workspace-team-action" type="button" onClick={() => setRemoveMember(member)}>Remove member</button>}</article>) : <div className="workspace-empty"><Users size={19} /><div><strong>No active members found</strong><p>Invite your partner or a trusted organiser to plan together.</p></div></div>}</div> : <div className="workspace-invitation-list">{teamInvitations.filter((item) => item.status === "PENDING").length ? teamInvitations.filter((item) => item.status === "PENDING").map((item) => <article className="workspace-invitation-row" key={item.id}><span className="workspace-member-avatar">{item.email.slice(0, 1).toUpperCase()}</span><div className="workspace-member-identity"><strong>{item.email}</strong><span>{item.role === "ADMIN" ? "Partner · Admin" : "Wedding Organiser"} · Invited {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</span><small className={item.emailSubmissionStatus === "ACCEPTED" ? "is-submitted" : "is-not-submitted"}>{item.emailSubmissionStatus === "ACCEPTED" ? "Resend accepted email submission · inbox delivery unconfirmed" : item.emailSubmissionStatus === "NOT_CONFIGURED" ? "Email not configured · add Resend settings to send" : "Email submission failed · resend after checking settings"}</small></div><span className="workspace-invitation-status">Awaiting acceptance</span><div className="workspace-invitation-actions"><button type="button" onClick={() => void resendInvitation(item)} disabled={teamActionId === item.id}>{teamActionId === item.id ? "Sending…" : "Resend invitation"}</button><button type="button" onClick={() => setRevokeInvitationTarget(item)} disabled={teamActionId === item.id}>Revoke</button></div></article>) : <div className="workspace-empty"><Users size={19} /><div><strong>No pending invitations</strong><p>Invited collaborators will appear here until they accept.</p>{role === "ADMIN" && <button type="button" onClick={() => setInviteDialogOpen(true)}>Invite another member <ChevronRight size={14} /></button>}</div></div>}</div>}
          <section className="workspace-role-matrix"><p className="workspace-eyebrow">ROLE PERMISSIONS</p><div><article><span className="workspace-member-role is-admin">Admin · Couple</span><p>Manage the wedding team, wedding details, and planning workspace. Admins can remove members except the workspace creator.</p></article><article><span className="workspace-member-role">Wedding Organiser</span><p>Help manage wedding planning. Organisers cannot invite, resend, revoke, or remove team members.</p></article></div></section>
        </section>}
        {activeView === "wedding" && <section className="workspace-wedding-details"><div className="workspace-section-heading"><div><p className="workspace-eyebrow">WEDDING INFORMATION</p><h1>The details you shared</h1></div><button className="workspace-edit-button" type="button" onClick={() => setEditSection("wedding")}><Pencil size={15} /> Edit details</button></div><div className="workspace-detail-grid"><div><span>COUPLE</span><strong>{wedding.couple.brideName} &amp; {wedding.couple.groomName}</strong></div><div><span>WEDDING DATE</span><strong>{formatDate(wedding.weddingDate)}</strong></div><div><span>CITY</span><strong>{wedding.location.city || "—"}</strong></div><div><span>STATE</span><strong>{wedding.location.state || "—"}</strong></div><div><span>COUNTRY</span><strong>{wedding.location.country || "—"}</strong></div><div><span>VENUE OR ADDRESS</span><strong>{wedding.location.address}</strong></div></div></section>}
        <footer className="workspace-footer">Make My Marriage <span>·</span> Your wedding, thoughtfully together.</footer>
      </div>
    </section>
    {inviteDialogOpen && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteDialogOpen(false); }}><form className="workspace-dialog workspace-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-member-title" onSubmit={(event) => void inviteMember(event)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">WEDDING TEAM <span>·</span> INVITATION</p><h2 id="invite-member-title">Invite a member</h2><p>Send a secure invitation link to join {wedding.couple.brideName} &amp; {wedding.couple.groomName}’s wedding workspace.</p></div><button type="button" aria-label="Close" onClick={() => setInviteDialogOpen(false)}><X size={20} /></button></div><div className="workspace-edit-fields"><label className="workspace-wide">Email address<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required maxLength={254} autoComplete="email" placeholder="name@example.com" /></label><fieldset className="workspace-role-options workspace-wide"><legend>Member role</legend><label className={`workspace-role-option ${inviteRole === "ORGANISER" ? "is-selected" : ""}`}><input type="radio" name="inviteRole" value="ORGANISER" checked={inviteRole === "ORGANISER"} onChange={() => setInviteRole("ORGANISER")} /><span><strong>Wedding Organiser</strong><small>Help with wedding planning. Cannot manage team invitations or membership.</small></span></label><label className={`workspace-role-option ${inviteRole === "ADMIN" ? "is-selected" : ""} ${teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length >= 2 ? "is-disabled" : ""}`}><input type="radio" name="inviteRole" value="ADMIN" checked={inviteRole === "ADMIN"} onChange={() => setInviteRole("ADMIN")} disabled={teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length >= 2} /><span><strong>Partner · Admin</strong><small>{teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length >= 2 ? "Cap reached (2 of 2). A wedding can have at most two Admins." : "Invite your partner as the second Admin. A wedding can have at most two Admins."}</small></span>{teamMembers.filter((member) => member.role === "ADMIN").length + teamInvitations.filter((item) => item.role === "ADMIN" && item.status === "PENDING").length >= 2 && <LockKeyhole size={15} />}</label></fieldset></div>{error && <p className="auth-message auth-message--error" role="alert">{error}</p>}<p className="workspace-invite-expiry"><LockKeyhole size={13} /> Invitation links expire after 7 days and can only be accepted by the invited email address.</p><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setInviteDialogOpen(false)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Plus size={15} /> Send invitation</>}</button></div></form></div>}
    {removeMember && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRemoveMember(null); }}><section className="workspace-dialog workspace-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-member-title"><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">TEAM ACCESS <span>·</span> REMOVE MEMBER</p><h2 id="remove-member-title">Remove {removeMember.displayName}?</h2></div><button type="button" aria-label="Close" onClick={() => setRemoveMember(null)}><X size={20} /></button></div><p>This member will lose access to the wedding workspace. Their Make My Marriage account and wedding records will remain.</p><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setRemoveMember(null)}>Keep member</button><button type="button" className="button button--dark" onClick={() => void removeWorkspaceMember()} disabled={teamActionId === removeMember.id}>{teamActionId === removeMember.id ? "Removing…" : "Remove member"}</button></div></section></div>}
    {revokeInvitationTarget && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && teamActionId !== revokeInvitationTarget.id) setRevokeInvitationTarget(null); }}><section className="workspace-dialog workspace-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="revoke-invitation-title"><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">PENDING INVITATION <span>·</span> REVOKE ACCESS</p><h2 id="revoke-invitation-title">Revoke this invitation?</h2></div><button type="button" aria-label="Close" onClick={() => setRevokeInvitationTarget(null)} disabled={teamActionId === revokeInvitationTarget.id}><X size={20} /></button></div><p>The invitation for <strong>{revokeInvitationTarget.email}</strong> will be cancelled. Its link will no longer work, and the recipient will not be able to join using this invitation.</p><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setRevokeInvitationTarget(null)} disabled={teamActionId === revokeInvitationTarget.id}>Keep invitation</button><button type="button" className="button button--dark" onClick={() => void revokeInvitation(revokeInvitationTarget)} disabled={teamActionId === revokeInvitationTarget.id}>{teamActionId === revokeInvitationTarget.id ? "Revoking…" : "Revoke invitation"}</button></div></section></div>}
    {editSection === "wedding" && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditSection(null); }}><form className="workspace-dialog" onSubmit={(event) => void saveWedding(event)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">WEDDING DETAILS</p><h2>Edit your wedding</h2></div><button type="button" aria-label="Close" onClick={() => setEditSection(null)}><X size={20} /></button></div><div className="workspace-edit-fields"><label>Bride’s name<input name="brideName" defaultValue={wedding.couple.brideName} required maxLength={100} /></label><label>Groom’s name<input name="groomName" defaultValue={wedding.couple.groomName} required maxLength={100} /></label><label>Wedding date<input type="date" name="weddingDate" defaultValue={wedding.weddingDate} required /></label><label className="workspace-wide">Venue or address<input name="address" defaultValue={wedding.location.address} required maxLength={300} /></label><label>City<input name="city" defaultValue={wedding.location.city} maxLength={100} /></label><label>State<input name="state" defaultValue={wedding.location.state} maxLength={100} /></label><label>Country<input name="country" defaultValue={wedding.location.country} maxLength={100} /></label></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setEditSection(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Save size={15} /> Save changes</>}</button></div></form></div>}
    {editSection === "create" && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditSection(null); }}><form className="workspace-dialog" onSubmit={(event) => void saveNewEvent(event)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">NEW CEREMONY <span>·</span> {wedding.location.city}</p><h2>Create an event</h2><p>Enter the ceremony details. Times use your wedding timezone ({wedding.timeZone}).</p></div><button type="button" aria-label="Close" onClick={() => setEditSection(null)}><X size={20} /></button></div><div className="workspace-edit-fields"><div className="workspace-wide"><span className="workspace-suggestion-label">Suggested Indian wedding events · or enter your own</span><div className="workspace-quick-add" role="group" aria-label="Suggested event names">{suggestedEventNames.map((name) => <button type="button" key={name} onClick={() => setNewEventName(name)}>{name}</button>)}</div><label>Ceremony or event name<input name="name" value={newEventName} onChange={(event) => setNewEventName(event.target.value)} required maxLength={120} placeholder="e.g. Family dinner or Mehendi" /></label></div><label>Date<input type="date" name="date" required /></label><label>Start time<input type="time" name="time" required /></label><label>Venue name<input name="venueName" maxLength={150} placeholder="e.g. Heritage Hall" /></label><label>City<input name="city" defaultValue={wedding.location.city} maxLength={100} placeholder="City" /></label><label className="workspace-wide">Venue address<input name="address" required maxLength={300} placeholder="Enter the venue or address" /></label><label className="workspace-wide">Notes or instructions <span className="workspace-optional">Optional</span><textarea name="description" maxLength={2000} rows={3} placeholder="Add any details the wedding team should know" onChange={(event) => setDescriptionLength(event.currentTarget.value.length)} /></label><small className="workspace-character-count workspace-wide">{descriptionLength} / 2,000 characters</small></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setEditSection(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Plus size={15} /> Create event</>}</button></div></form></div>}
    {events.map((item) => editSection === item.id && <div className="workspace-dialog-backdrop" role="presentation" key={`edit-${item.id}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditSection(null); }}><form className="workspace-dialog" onSubmit={(event) => void saveEvent(event, item)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">EDIT CEREMONY <span>·</span> {item.venue.city || wedding.location.city}</p><h2>{item.name}</h2><p>Update the event details. Times use {item.timeZone}.</p></div><button type="button" aria-label="Close" onClick={() => setEditSection(null)}><X size={20} /></button></div><div className="workspace-edit-fields"><div className="workspace-wide"><span className="workspace-suggestion-label">Suggested Indian wedding events · or enter your own</span><div className="workspace-quick-add" role="group" aria-label="Suggested event names">{suggestedEventNames.map((name) => <button type="button" key={name} onClick={() => setNewEventName(name)}>{name}</button>)}</div><label>Event name<input name="name" value={newEventName} onChange={(event) => setNewEventName(event.target.value)} required maxLength={120} /></label></div><label>Date<input type="date" name="date" defaultValue={dateInZone(item.startsAt, item.timeZone)} required /></label><label>Start time<input type="time" name="time" defaultValue={timeInZone(item.startsAt, item.timeZone)} required /></label><label>Venue name<input name="venueName" defaultValue={item.venue.name} maxLength={150} /></label><label>City<input name="city" defaultValue={item.venue.city || wedding.location.city} maxLength={100} /></label><label className="workspace-wide">Venue address<input name="address" defaultValue={item.venue.address} required maxLength={300} /></label><label className="workspace-wide">Notes or instructions <span className="workspace-optional">Optional</span><textarea name="description" defaultValue={item.description} maxLength={2000} rows={3} onChange={(event) => setDescriptionLength(event.currentTarget.value.length)} /></label><small className="workspace-character-count workspace-wide">{descriptionLength} / 2,000 characters</small></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setEditSection(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Check size={15} /> Save event</>}</button></div></form></div>)}
    {archiveEventId && events.find((item) => item.id === archiveEventId) && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setArchiveEventId(null); }}><section className="workspace-dialog workspace-archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-event-title"><div className="workspace-dialog-heading"><div><span className="workspace-dialog-icon"><Archive size={19} /></span><p className="workspace-eyebrow">ARCHIVE EVENT <span>·</span> CEREMONIAL REGISTRY</p><h2 id="archive-event-title">Archive {events.find((item) => item.id === archiveEventId)?.name}?</h2></div><button type="button" aria-label="Close" onClick={() => setArchiveEventId(null)}><X size={20} /></button></div><p>Archiving removes this event from active planning while keeping its details and notes. You can restore it any time from the Archived events filter.</p><div className="workspace-archive-summary"><CalendarDays size={18} /><div><strong>{events.find((item) => item.id === archiveEventId)?.name}</strong><span>{formatEventDate(events.find((item) => item.id === archiveEventId)!.startsAt, events.find((item) => item.id === archiveEventId)!.timeZone)} · {events.find((item) => item.id === archiveEventId)?.venue.name || events.find((item) => item.id === archiveEventId)?.venue.address}</span></div><small>Event details retained</small></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setArchiveEventId(null)}>Keep event</button><button type="button" className="button button--dark" onClick={() => { const item = events.find((entry) => entry.id === archiveEventId); if (item) void archiveEvent(item); }} disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Archive size={15} /> Archive event</>}</button></div></section></div>}
    {taskDialog && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTaskDialog(null); }}><form className="workspace-dialog workspace-task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onSubmit={(event) => void saveTask(event, taskBeingEdited)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">TASK SPECIFICATION <span>·</span> {wedding.location.city || "WEDDING ATELIER"}</p><h2 id="task-dialog-title">{taskBeingEdited ? "Edit task" : "Add task"}</h2><p>Assign and track a wedding deliverable. Task reminders and notifications are not sent in V1.</p></div><button type="button" aria-label="Close" onClick={() => setTaskDialog(null)}><X size={20} /></button></div><div className="workspace-edit-fields workspace-task-fields"><label className="workspace-wide">Task name <span className="workspace-required">*</span><input name="title" value={taskDraftTitle} onChange={(event) => setTaskDraftTitle(event.target.value)} required maxLength={120} placeholder="e.g. Confirm ceremony décor" /><small>{taskDraftTitle.length} / 120 characters</small></label><label className="workspace-wide">Description <span className="workspace-optional">Optional</span><textarea name="description" defaultValue={taskBeingEdited?.description} maxLength={2000} rows={3} placeholder="Add the detail your wedding team needs" /></label><label>Assignee <span className="workspace-optional">Optional</span><select name="assigneeMembershipId" defaultValue={taskBeingEdited?.assigneeMembershipId ?? ""}><option value="">Unassigned</option>{taskMembers.map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.role === "ADMIN" ? "Admin" : "Organiser"}</option>)}</select></label><label>Due date <span className="workspace-optional">Optional</span><input type="date" name="dueDate" defaultValue={taskBeingEdited?.dueAt ? dateInZone(taskBeingEdited.dueAt, wedding.timeZone) : ""} /></label><fieldset className="workspace-task-choice workspace-wide"><legend>Priority level</legend>{(["LOW", "MEDIUM", "HIGH"] as const).map((priority) => <label className={(taskBeingEdited?.priority ?? "MEDIUM") === priority ? "is-selected" : ""} key={priority}><input type="radio" name="priority" value={priority} defaultChecked={(taskBeingEdited?.priority ?? "MEDIUM") === priority} /><span><i />{priority[0] + priority.slice(1).toLowerCase()}</span></label>)}</fieldset><label className="workspace-wide">Linked ceremony <span className="workspace-optional">Optional</span><select name="eventId" defaultValue={taskBeingEdited?.eventId ?? ""}><option value="">No linked event</option>{activeEvents.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatEventDate(item.startsAt, item.timeZone, { day: "numeric", month: "short" })}</option>)}</select></label><fieldset className="workspace-task-choice workspace-wide"><legend>Execution status</legend>{(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const).map((statusValue) => <label className={(taskBeingEdited?.status ?? "NOT_STARTED") === statusValue ? "is-selected" : ""} key={statusValue}><input type="radio" name="status" value={statusValue} defaultChecked={(taskBeingEdited?.status ?? "NOT_STARTED") === statusValue} /><span>{statusValue === "NOT_STARTED" ? "Not Started" : statusValue === "IN_PROGRESS" ? "In Progress" : "Completed"}</span></label>)}</fieldset><label className="workspace-wide">Coordination notes <span className="workspace-optional">Optional</span><textarea name="notes" defaultValue={taskBeingEdited?.notes} maxLength={2000} rows={3} placeholder="Add notes for the wedding team" /></label><div className="workspace-vendor-lock workspace-wide"><LockKeyhole size={16} /><div><strong>Linked vendor</strong><span>Vendor records are not available yet. Vendor linking will be enabled when the vendor feature is built.</span></div></div></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setTaskDialog(null)}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Save size={15} /> Save task</>}</button></div></form></div>}
    {taskDeleteTarget && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTaskDeleteTarget(null); }}><section className="workspace-dialog workspace-archive-dialog workspace-task-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-task-title"><div className="workspace-dialog-heading"><div><span className="workspace-dialog-icon is-danger"><Trash2 size={19} /></span><p className="workspace-eyebrow">PERMANENT ACTION WARNING</p><h2 id="delete-task-title">Delete task?</h2></div><button type="button" aria-label="Close" onClick={() => setTaskDeleteTarget(null)} disabled={saving}><X size={20} /></button></div><p>Are you sure you want to permanently delete <strong>{taskDeleteTarget.title}</strong>? It will be removed from this wedding workspace. This action cannot be undone.</p><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setTaskDeleteTarget(null)} disabled={saving}>Keep task</button><button type="button" className="button button--danger" onClick={() => void deleteTask()} disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Trash2 size={15} /> Delete task</>}</button></div></section></div>}
  </main>;
}

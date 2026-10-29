"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, CircleDollarSign, LoaderCircle, Pencil, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { apiBaseUrl } from "@/lib/api";

type Event = { id: string; name: string; startsAt: string; timeZone: string; status: "ACTIVE" | "ARCHIVED" };
type ExpenseCategory = "VENUE" | "CATERING" | "DECOR" | "PHOTOGRAPHY_VIDEO" | "ATTIRE_JEWELLERY" | "BEAUTY_MEHENDI" | "MUSIC_ENTERTAINMENT" | "INVITATIONS" | "TRAVEL" | "OTHER";
type Expense = { id: string; description: string; amountRupees: number; currency: "INR"; category: ExpenseCategory; eventId?: string; paymentStatus: "PAID" | "UNPAID"; paymentDate?: string; payerName?: string; notes?: string; createdAt: string; updatedAt: string };
type Totals = { totalRupees: number; paidRupees: number; unpaidRupees: number };

const categories: Array<{ value: ExpenseCategory; label: string }> = [
  { value: "VENUE", label: "Venue" }, { value: "CATERING", label: "Catering" }, { value: "DECOR", label: "Décor & florals" }, { value: "PHOTOGRAPHY_VIDEO", label: "Photography & video" }, { value: "ATTIRE_JEWELLERY", label: "Attire & jewellery" }, { value: "BEAUTY_MEHENDI", label: "Beauty & mehendi" }, { value: "MUSIC_ENTERTAINMENT", label: "Music & entertainment" }, { value: "INVITATIONS", label: "Invitations" }, { value: "TRAVEL", label: "Travel" }, { value: "OTHER", label: "Other" }
];

function message(response: Response) {
  return response.json().then((body) => Object.values(body?.error?.fieldErrors ?? {})[0] ?? body?.error?.message ?? "We couldn’t save this expense. Please try again.").catch(() => "We couldn’t save this expense. Please try again.");
}
function rupees(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function dateInZone(value: string, zone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)); const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ""; return `${pick("year")}-${pick("month")}-${pick("day")}`; }
function dateLabel(value: string, zone: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: zone, day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
function offsetForZone(date: string, zone: string) { const offset = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T12:00:00Z`)).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00"; const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/); return match ? `${match[1]}${match[2]}:${match[3]}` : "+00:00"; }

export function ExpenseWorkspace({ events, timeZone, onTotalsChange }: { events: Event[]; timeZone: string; onTotalsChange?: (totals: Totals) => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totals, setTotals] = useState<Totals>({ totalRupees: 0, paidRupees: 0, unpaidRupees: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | Expense["paymentStatus"]>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ExpenseCategory>("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [dialog, setDialog] = useState<"create" | Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const activeEvents = events.filter((event) => event.status === "ACTIVE");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/expenses`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(await message(response));
      const body = await response.json() as { data: { expenses: Expense[]; totals: Totals } };
      setExpenses(body.data.expenses); setTotals(body.data.totals); onTotalsChange?.(body.data.totals); setNotice(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "We couldn’t load expenses."); } finally { setLoading(false); }
  }, [onTotalsChange]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const filtered = useMemo(() => expenses.filter((expense) => {
    const term = query.trim().toLowerCase();
    if (term && ![expense.description, expense.payerName, expense.notes].some((value) => value?.toLowerCase().includes(term))) return false;
    if (paymentFilter !== "ALL" && expense.paymentStatus !== paymentFilter) return false;
    if (categoryFilter !== "ALL" && expense.category !== categoryFilter) return false;
    return !(eventFilter !== "ALL" && expense.eventId !== eventFilter);
  }), [categoryFilter, eventFilter, expenses, paymentFilter, query]);
  const editing = dialog && typeof dialog === "object" && dialog.id ? dialog : undefined;
  const eventName = (id?: string) => activeEvents.find((event) => event.id === id)?.name ?? "—";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const paymentStatus = String(form.get("paymentStatus")) as Expense["paymentStatus"];
    const paymentDate = String(form.get("paymentDate") || "");
    const amount = Number(form.get("amountRupees"));
    if (!Number.isFinite(amount) || amount <= 0) { setNotice("Enter an amount of at least ₹1."); return; }
    if (paymentStatus === "PAID" && !paymentDate) { setNotice("Payment date is required for a paid expense."); return; }
    const payload = { description: String(form.get("description") || ""), amountRupees: amount, category: form.get("category"), eventId: String(form.get("eventId") || "") || null, paymentStatus, paymentDate: paymentDate ? `${paymentDate}T12:00:00${offsetForZone(paymentDate, timeZone)}` : null, payerName: String(form.get("payerName") || "") || null, notes: String(form.get("notes") || "") || null };
    setSaving(true); setNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/expenses${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await message(response));
      setDialog(null); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "We couldn’t save this expense."); } finally { setSaving(false); }
  }
  async function remove() {
    if (!deleteTarget) return;
    setSaving(true); setNotice(null);
    try { const response = await fetch(`${apiBaseUrl}/expenses/${deleteTarget.id}`, { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error(await message(response)); setDeleteTarget(null); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "We couldn’t delete this expense."); } finally { setSaving(false); }
  }

  return <section className="workspace-expenses">
    <header className="workspace-expenses-heading"><div><p className="workspace-eyebrow">WEDDING ATELIER <span>·</span> FINANCIAL RECORD</p><h1>Expense ledger</h1><p>Record actual wedding expenses and keep paid and unpaid commitments clear—without turning planning into a budget system.</p></div><button className="button button--dark" type="button" onClick={() => setDialog("create")}><Plus size={16} /> Record expense</button></header>
    {notice && <p className="workspace-alert" role="alert">{notice}</p>}
    <section className="workspace-expense-metrics" aria-label="Expense summary"><article><span>TOTAL RECORDED</span><strong>{rupees(totals.totalRupees)}</strong><small>{expenses.length} {expenses.length === 1 ? "record" : "records"} registered</small></article><article className="is-paid"><span>PAID</span><strong>{rupees(totals.paidRupees)}</strong><small>Recorded as settled</small></article><article><span>UNPAID</span><strong>{rupees(totals.unpaidRupees)}</strong><small>Awaiting payment</small></article><article><span>PAYMENT STATUS</span><strong>{expenses.filter((expense) => expense.paymentStatus === "PAID").length} / {expenses.length}</strong><small>Records marked paid</small></article></section>
    {loading ? <div className="workspace-empty"><LoaderCircle className="auth-spinner" size={18} /> Loading expense ledger…</div> : expenses.length === 0 ? <section className="workspace-expense-empty"><span><ReceiptText size={28} /></span><h2>Every thoughtful detail has a place.</h2><p>Record expenses as they happen, then use one calm ledger to see what has been paid and what remains to be settled.</p><button className="button button--dark" type="button" onClick={() => setDialog("create")}><Plus size={15} /> Record your first expense</button><div><p>QUICK-START RECORDS</p>{["Venue advance", "Catering deposit", "Photography booking", "Floral décor", "Mehendi artist", "Invitation printing"].map((description) => <button type="button" key={description} onClick={() => setDialog({ id: "", description, amountRupees: 0, currency: "INR", category: "OTHER", paymentStatus: "UNPAID", createdAt: "", updatedAt: "" })}><Plus size={13} /> {description}</button>)}</div><small>Amounts are recorded in whole Indian rupees. Budget planning is not part of V1.</small></section> : <>
      <section className="workspace-expense-filters" aria-label="Expense filters"><label className="workspace-expense-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses, payers, or notes…" /></label><select aria-label="Filter by payment status" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}><option value="ALL">Status: All</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}><option value="ALL">Category: All</option>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><select aria-label="Filter by linked event" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}><option value="ALL">Ceremony: All</option>{activeEvents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
      <section className="workspace-expense-list" aria-label="Expense records"><header><span>EXPENSE</span><span>PAYEE / PAYER</span><span>CATEGORY</span><span>CEREMONY</span><span>AMOUNT</span><span>STATUS</span><span>PAYMENT DATE</span><span>ACTIONS</span></header>{filtered.length === 0 ? <p className="workspace-expense-no-results">No expenses match the selected filters.</p> : filtered.map((expense) => <article key={expense.id}><div><strong>{expense.description}</strong>{expense.notes && <small>{expense.notes}</small>}</div><span>{expense.payerName || "—"}</span><span className="workspace-expense-category">{categories.find((category) => category.value === expense.category)?.label ?? expense.category}</span><span>{eventName(expense.eventId)}</span><strong className="workspace-expense-amount">{rupees(expense.amountRupees)}</strong><span className={`workspace-expense-status is-${expense.paymentStatus.toLowerCase()}`}>{expense.paymentStatus === "PAID" ? <Check size={13} /> : <CircleDollarSign size={13} />}{expense.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</span><span>{expense.paymentDate ? dateLabel(expense.paymentDate, timeZone) : "—"}</span><div className="workspace-expense-actions"><button type="button" onClick={() => setDialog(expense)}><Pencil size={14} /> Edit</button><button className="workspace-task-delete-button" type="button" onClick={() => setDeleteTarget(expense)} aria-label={`Delete ${expense.description}`}><Trash2 size={14} /></button></div></article>)}</section>
    </>}
    {dialog && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }}><form className="workspace-dialog workspace-expense-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-dialog-title" onSubmit={(event) => void save(event)}><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">EXPENSE RECORD <span>·</span> {editing ? "EDIT" : "NEW"}</p><h2 id="expense-dialog-title">{editing ? "Edit expense" : "Record expense"}</h2><p>Track an actual wedding expense. Amounts are saved as whole Indian rupees.</p></div><button type="button" aria-label="Close" onClick={() => setDialog(null)} disabled={saving}><X size={20} /></button></div><div className="workspace-edit-fields workspace-expense-fields"><label className="workspace-wide">Expense name <span className="workspace-required">*</span><input name="description" required maxLength={200} defaultValue={editing?.description} placeholder="e.g. Mehendi artist booking" /></label><label>Category <span className="workspace-required">*</span><select name="category" defaultValue={editing?.category ?? "OTHER"}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label>Amount (₹) <span className="workspace-required">*</span><input name="amountRupees" type="number" min="0.01" step="0.01" required defaultValue={editing?.amountRupees || ""} placeholder="0" /><small>Positive decimals are rounded to the nearest rupee.</small></label><label>Payment status <span className="workspace-required">*</span><select name="paymentStatus" defaultValue={editing?.paymentStatus ?? "UNPAID"}><option value="UNPAID">Unpaid</option><option value="PAID">Paid</option></select></label><label>Payment date <span className="workspace-optional">Required when paid</span><input name="paymentDate" type="date" defaultValue={editing?.paymentDate ? dateInZone(editing.paymentDate, timeZone) : ""} /></label><label>Paid by <span className="workspace-optional">Optional</span><input name="payerName" maxLength={120} defaultValue={editing?.payerName} placeholder="e.g. Aarav Kumar" /></label><label>Linked ceremony <span className="workspace-optional">Optional</span><select name="eventId" defaultValue={editing?.eventId ?? ""}><option value="">No linked ceremony</option>{activeEvents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="workspace-wide">Notes <span className="workspace-optional">Optional</span><textarea name="notes" maxLength={2000} rows={3} defaultValue={editing?.notes} placeholder="Add a short record note for the wedding team" /></label></div><div className="workspace-expense-scope-note"><ReceiptText size={16} /><span>This is an expense record, not a budget or payment-management tool. Partial payments, advances, and balances are not tracked in V1.</span></div><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setDialog(null)} disabled={saving}>Cancel</button><button type="submit" className="button button--dark" disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Check size={15} /> Save expense</>}</button></div></form></div>}
    {deleteTarget && <div className="workspace-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDeleteTarget(null); }}><section className="workspace-dialog workspace-archive-dialog workspace-task-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title"><div className="workspace-dialog-heading"><div><p className="workspace-eyebrow">PERMANENT ACTION WARNING</p><h2 id="delete-expense-title">Delete expense?</h2></div><button type="button" aria-label="Close" onClick={() => setDeleteTarget(null)} disabled={saving}><X size={20} /></button></div><p><strong>{deleteTarget.description}</strong> ({rupees(deleteTarget.amountRupees)}) will be permanently removed from this wedding ledger. This cannot be undone.</p><div className="workspace-dialog-actions"><button type="button" className="button button--outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Keep expense</button><button type="button" className="button button--danger" onClick={() => void remove()} disabled={saving}>{saving ? <LoaderCircle className="auth-spinner" size={15} /> : <><Trash2 size={15} /> Delete expense</>}</button></div></section></div>}
  </section>;
}

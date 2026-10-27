import {
  CalendarDays,
  CheckSquare2,
  Globe2,
  IndianRupee,
  QrCode,
  Radio,
  Store,
  UsersRound,
  type LucideIcon
} from "lucide-react";

export const landingImages = {
  couple: "/images/wedding-couple.png",
  mandap: "/images/mandap.png"
} as const;

export const features: { icon: LucideIcon; title: string; description: string; href: string; label: string }[] = [
  { icon: CalendarDays, title: "Multi-ceremony schedules", description: "Plan dates, times, venues, and notes for every wedding event.", href: "#how-it-works", label: "EVENT SCHEDULES" },
  { icon: CheckSquare2, title: "Collaborative tasks", description: "Assign planning tasks to family, organisers, and vendors.", href: "#how-it-works", label: "TASK OWNERS" },
  { icon: IndianRupee, title: "Expense ledger", description: "Record expenses, payments, and vendor dues in one place.", href: "#how-it-works", label: "EXPENSE RECORDS" },
  { icon: UsersRound, title: "Guests & headcounts", description: "Track family guest records, invitations, RSVPs, and event counts.", href: "#collaboration", label: "FAMILY GUEST LIST" },
  { icon: Store, title: "Vendor contacts", description: "Save vendor contact details and planning notes together.", href: "#guest-experience", label: "SAVED CONTACTS" },
  { icon: Globe2, title: "Wedding websites", description: "Share wedding details using one of four included Indian themes.", href: "#website-themes", label: "FOUR V1 THEMES" },
  { icon: Radio, title: "YouTube Live", description: "Embed a configured YouTube stream on your wedding website.", href: "#guest-experience", label: "YOUTUBE EMBED" },
  { icon: QrCode, title: "QR photo sharing", description: "Invite guests to contribute photos for your wedding gallery.", href: "#guest-experience", label: "PHOTO CONTRIBUTIONS" }
];

export const sampleEvents = [
  { day: "12", month: "DEC", title: "Mehendi & Sangeet", place: "The Tamarind Courtyard", time: "6:30 PM" },
  { day: "14", month: "DEC", title: "Wedding Ceremony", place: "The Tamarind Courtyard", time: "7:15 AM" },
  { day: "15", month: "DEC", title: "Reception & Dinner", place: "The Royal Palms", time: "7:00 PM" }
];

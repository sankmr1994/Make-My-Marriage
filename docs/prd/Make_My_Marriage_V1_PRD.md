**MAKE MY MARRIAGE**

**V1 Product Requirements Document**

The digital workspace for planning, coordinating, celebrating, and preserving an Indian wedding.

**Scope: Minimum Viable Product (V1)**

Status: Feature scope finalized for PRD

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Product principle</strong></p>
<p>Keep the wedding workspace simple enough for families to use, but complete enough to replace scattered spreadsheets, messages, email threads, and ad-hoc coordination for the core wedding journey.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# Document Map

**1.** Executive Summary

**2.** Product Vision & Goals

**3.** Target Users & Personas

**4.** V1 Scope & Out of Scope

**5.** Roles & Permission Model

**6.** Information Architecture & Navigation

**7.** Functional Requirements

**8.** Key User Flows

**9.** Data Model

**10.** Integrations

**11.** Non-Functional Requirements

**12.** Analytics & Success Metrics

**13.** Security, Privacy & Trust

**14.** Acceptance Criteria & MVP Exit Criteria

**15.** Risks & Dependencies

**16.** Post-V1 Opportunities

**17.** Open Decisions Before Development

# 1. Executive Summary

Make My Marriage is an India-focused web application designed to provide one collaborative workspace for the planning and execution of a wedding. The V1 product centers on a single wedding per user account and supports multiple people working together under a simple three-role model: Admin, Organiser, and Guest.

The product combines wedding setup, events, tasks, expense tracking, guest management, email invitations, RSVP and RSVP reminders, a publishable wedding website, private YouTube Live viewing, wedding photo sharing, QR-based photo upload, vendor management, and nearby vendor discovery.

V1 deliberately avoids a full wedding budgeting system, complex website builders, vendor payment/advance management, task reminders, WhatsApp/SMS invitations, guest accommodation and travel workflows, AI planning, native mobile apps, and other expansion features. The intent is to ship a coherent end-to-end wedding experience before adding breadth.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>V1 product promise</strong></p>
<p>Create a wedding once, bring the right people together, plan every event, manage guests and expenses, publish the wedding experience, and preserve memories in one place.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

# 2. Product Vision & Goals

## 2.1 Vision

One wedding. One workspace. Everyone connected.

Make My Marriage should become the digital operating layer for an Indian wedding: a shared place for the couple and trusted organisers to prepare the wedding and a simple digital destination for guests to respond, watch, and contribute memories.

## 2.2 V1 Goals

- Enable a user to create and manage one wedding without needing spreadsheets for core planning.

- Allow the couple and trusted organisers to collaboratively manage multiple events, tasks, guests, expenses, vendors, website content, livestream access, and photos.

- Make guest participation frictionless: invitation by email, one-step RSVP, reminder emails, website access, livestream viewing, and photo upload without requiring an account.

- Provide a simple, attractive wedding website with four default Indian wedding themes.

- Provide nearby vendor discovery using a location/places provider, with transparent ratings and location details rather than a proprietary vendor ranking system.

- Keep the V1 experience operationally focused and low-complexity.

## 2.3 Non-Goals

- Replace specialist accounting/budgeting software.

- Become a full vendor marketplace in V1.

- Build a drag-and-drop website builder.

- Create a social network for weddings.

- Require guests to maintain application accounts.

- Build a native iOS/Android application before validating the web product.

# 3. Target Users & Personas

| **Role**  | **Typical user**                                        | **Primary need**                                                                                            |
|-----------|---------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Admin     | Bride and/or Groom                                      | Owns the wedding workspace and has full control. Manages organisers and can operate all V1 modules.         |
| Organiser | Family member, sibling, or professional wedding planner | Runs wedding operations. Has operational access comparable to Admin but cannot add or remove organisers.    |
| Guest     | Invited wedding participant                             | Does not log in. Uses secure links or QR codes for invitation/RSVP, website, livestream, and photo sharing. |

## 3.1 Primary use cases

- A couple creates a wedding, adds events, invites an organiser, and starts tracking tasks and expenses.

- An organiser imports a guest list, sends email invitations, monitors RSVP status, and sends reminders to guests who have not responded.

- The couple or organiser selects one of four Indian wedding website themes, enters wedding details, previews the site, and publishes it.

- A guest opens the wedding website, responds Attending/Not Attending, watches a private YouTube Live stream, and uploads photos through a QR link.

- An organiser searches for nearby photographers/decorators and saves selected vendors into the wedding workspace.

# 4. V1 Scope & Out of Scope

## 4.1 In Scope

| **\#** | **Module**                   | **V1 capability**                                                                                          |
|--------|------------------------------|------------------------------------------------------------------------------------------------------------|
| 1      | Authentication & Account     | Sign up, login, logout, password recovery, profile, one wedding per account.                               |
| 2      | Wedding Management           | Create/edit wedding, couple details, wedding date, location, contact details, wedding photo.               |
| 3      | Dashboard                    | Countdown, upcoming events, task status, guest/RSVP summary, expense summary, quick actions.               |
| 4      | Event Management             | Create/edit/delete events with date, time, venue/location, description/notes, event photo if used.         |
| 5      | Admin & Organiser Management | Three roles, collaborator invitation, organiser addition/removal, role-aware access.                       |
| 6      | Task Management              | Task fields, assignment, priorities, event relation, simple three-status workflow, overdue/upcoming views. |
| 7      | Expense Tracking             | Record expense amount/category/event/paid status/payment date/payer/notes. No budget planning.             |
| 8      | Guest Management             | Manual add, CSV/Excel import, event assignment, search/filter, invitation/RSVP state.                      |
| 9      | Email Invitation & RSVP      | Email invitations, RSVP Attending/Not Attending, pending status, RSVP reminders by email.                  |
| 10     | Wedding Website              | Create/publish website from V1 themes; wedding, event, couple, RSVP, livestream content.                   |
| 11     | YouTube Live                 | Configure a private/intended-for-invited-audience stream and embed it on the wedding website.              |
| 12     | Photo Sharing                | Guest upload, gallery viewing, admin/organiser moderation/deletion, event-aware gallery.                   |
| 13     | QR Codes                     | QR links for photo upload and optional RSVP/website access.                                                |
| 14     | Vendor Management            | Manual vendor records, categories, notes, contacts, search/filter.                                         |
| 15     | Nearby Vendor Discovery      | Location/category search, nearby places, ratings, address/contact/site info, save to wedding.              |

## 4.2 Explicitly Out of Scope for V1

- Multiple weddings per account.

- Wedding budget planning, budget-vs-actual, budget alerts, financial forecasting.

- Vendor advance/remaining balance tracking.

- Separate Finance Manager role.

- Task reminder notifications.

- WhatsApp, SMS, or push invitation delivery.

- Guest accommodation/travel/transport management.

- Seating arrangements, gift management, meal preferences, plus-ones, child counts.

- AI wedding planning or regional ceremony templates.

- Drag-and-drop wedding website builder or a large theme marketplace.

- Native mobile app.

- Vendor marketplace, booking, commissions, or in-app vendor payments.

- Proprietary vendor ratings/reviews or a “best vendor” score.

# 5. Roles & Permission Model

V1 uses three roles only. This is a deliberate simplification intended to keep access control easy to understand and implement.

| **Role**  | **Login** | **Wedding**       | **Events** | **Tasks** | **Expenses** | **Guests** | **Invitations** | **Website** | **Live** | **Photos**  | **Vendors** |
|-----------|-----------|-------------------|------------|-----------|--------------|------------|-----------------|-------------|----------|-------------|-------------|
| Admin     | Yes       | Yes               | Yes        | Yes       | Yes          | Yes        | Yes             | Yes         | Yes      | Yes         | Yes         |
| Organiser | Yes       | Operational       | Yes        | Yes       | Yes          | Yes        | Yes             | Yes         | Yes      | Yes         | Yes         |
| Guest     | No        | Guest-facing only | View       | No        | No           | RSVP       | RSVP            | View        | Watch    | Upload/View | No          |

## 5.1 Admin vs Organiser rule

Admin and Organiser have comparable operational access for V1. The key difference is organisational authority: Admin can add and remove Organisers; Organiser cannot create, remove, or manage Organiser membership.

## 5.2 Guest access principle

Guests should not need an application account. Guest actions should be available through secure, wedding-scoped links and QR codes, with appropriate token expiration/revocation controls where applicable.

# 6. Information Architecture & Navigation

Recommended primary navigation:

- Dashboard

- Wedding

- Events

- Tasks

- Expenses

- Guests

- Invitations & RSVP

- Website

- Livestream

- Photos

- Vendors

- Collaborators

- Settings

## 6.1 Dashboard layout

- Wedding header: couple names, photo, date, countdown, location.

- Upcoming events: next event and event list entry point.

- Task snapshot: not started, in progress, completed, overdue.

- Guest snapshot: total, invited, attending, not attending, pending.

- Expense snapshot: total recorded, paid, unpaid.

- Vendor snapshot: saved vendors and discovery quick action.

- Publishing/experience shortcuts: website, livestream, photo sharing.

- Quick actions: Create Event, Add Task, Add Expense, Add Guest, Invite Collaborator.

# 7. Functional Requirements

## 7.1 Authentication & Account

| **ID**     | **Requirement**                                                                             |
|------------|---------------------------------------------------------------------------------------------|
| FR-AUTH-01 | A user can register with required identity/contact information.                             |
| FR-AUTH-02 | A registered user can log in and log out.                                                   |
| FR-AUTH-03 | A user can recover/reset a forgotten password.                                              |
| FR-AUTH-04 | An account can be associated with no more than one wedding in V1.                           |
| FR-AUTH-05 | A user invited as an Admin or Organiser can create an account and join the invited wedding. |

## 7.2 Wedding Management

| **ID**    | **Requirement**                                                                                                                        |
|-----------|----------------------------------------------------------------------------------------------------------------------------------------|
| FR-WED-01 | Admin can create a wedding with bride name, groom name, wedding date, location, contact details, and wedding photo.                    |
| FR-WED-02 | Admin can edit wedding details after creation.                                                                                         |
| FR-WED-03 | The system displays a wedding countdown based on the configured wedding date.                                                          |
| FR-WED-04 | Wedding location can be represented as a human-readable address plus geolocation when available, to support maps and vendor discovery. |

## 7.3 Event Management

| **ID**    | **Requirement**                                                                                            |
|-----------|------------------------------------------------------------------------------------------------------------|
| FR-EVT-01 | Admin/Organiser can create an event with name, date, time, venue, location/address, and notes/description. |
| FR-EVT-02 | Admin/Organiser can edit or delete an event.                                                               |
| FR-EVT-03 | A wedding can have multiple events.                                                                        |
| FR-EVT-04 | Each event can have its own guest list.                                                                    |
| FR-EVT-05 | Each event can have tasks and expenses associated with it through the relevant modules.                    |

## 7.4 Collaborators / Organiser Management

| **ID**    | **Requirement**                                                            |
|-----------|----------------------------------------------------------------------------|
| FR-COL-01 | Admin can invite a collaborator as Organiser.                              |
| FR-COL-02 | Invited Organiser completes account creation before accessing the wedding. |
| FR-COL-03 | Admin can remove an Organiser from the wedding.                            |
| FR-COL-04 | Organiser cannot add, remove, or manage Organisers.                        |
| FR-COL-05 | The system enforces permissions on both UI and API/service layers.         |

## 7.5 Task Management

| **ID**     | **Requirement**                                                                                                         |
|------------|-------------------------------------------------------------------------------------------------------------------------|
| FR-TASK-01 | Admin/Organiser can create a task with name, description, assignee/owner, due date, priority, event, status, and notes. |
| FR-TASK-02 | Task statuses are Not Started, In Progress, and Completed.                                                              |
| FR-TASK-03 | Tasks can be assigned/reassigned to eligible wedding members.                                                           |
| FR-TASK-04 | Dashboard and task list show upcoming and overdue tasks.                                                                |
| FR-TASK-05 | No automated task reminder notifications are sent in V1.                                                                |

## 7.6 Expense Tracking

| **ID**    | **Requirement**                                                                                                                   |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------|
| FR-EXP-01 | Admin/Organiser can add an expense with description, amount, category, event, paid/unpaid status, payment date, payer, and notes. |
| FR-EXP-02 | Admin/Organiser can edit/delete expenses.                                                                                         |
| FR-EXP-03 | Users can filter/search expenses by event, category, and payment status.                                                          |
| FR-EXP-04 | Dashboard shows recorded total expenses plus paid and unpaid totals.                                                              |
| FR-EXP-05 | The system does not calculate or enforce a wedding budget in V1.                                                                  |

## 7.7 Guest Management

| **ID**    | **Requirement**                                                                           |
|-----------|-------------------------------------------------------------------------------------------|
| FR-GST-01 | Admin/Organiser can add guests manually.                                                  |
| FR-GST-02 | Admin/Organiser can import guests from CSV or Excel.                                      |
| FR-GST-03 | Imported guest data is validated and import errors are presented clearly.                 |
| FR-GST-04 | Guests can be associated with one or more wedding events.                                 |
| FR-GST-05 | Guest list supports search and filters including event, invitation state, and RSVP state. |

## 7.8 Invitations & RSVP

| **ID**     | **Requirement**                                                                                                |
|------------|----------------------------------------------------------------------------------------------------------------|
| FR-RSVP-01 | Admin/Organiser can send an email invitation to a guest.                                                       |
| FR-RSVP-02 | Invitation includes relevant wedding/event information and a secure RSVP link.                                 |
| FR-RSVP-03 | Guest RSVP offers exactly two primary choices: Attending and Not Attending.                                    |
| FR-RSVP-04 | Pending is represented when the guest has not responded.                                                       |
| FR-RSVP-05 | Admin/Organiser can see RSVP summary by wedding and event.                                                     |
| FR-RSVP-06 | Admin/Organiser can send RSVP reminder emails to guests with no response.                                      |
| FR-RSVP-07 | V1 does not collect guest count, children, food preference, accommodation, travel, or comments as RSVP fields. |

## 7.9 Wedding Website

| **ID**    | **Requirement**                                                                                                                                     |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| FR-WEB-01 | Admin/Organiser can start website creation from the wedding workspace.                                                                              |
| FR-WEB-02 | V1 provides four default Indian wedding website themes.                                                                                             |
| FR-WEB-03 | All four themes support the same core content model while using different visual layouts/styles.                                                    |
| FR-WEB-04 | Admin/Organiser can enter/edit couple information, event details, location, contact details, intro/story content, and photos required by the theme. |
| FR-WEB-05 | Website supports RSVP entry point and livestream entry point when enabled.                                                                          |
| FR-WEB-06 | Admin/Organiser can preview the website before publishing.                                                                                          |
| FR-WEB-07 | Admin/Organiser can publish/unpublish the website.                                                                                                  |
| FR-WEB-08 | V1 is template-driven; no drag-and-drop page builder.                                                                                               |

## 7.10 YouTube Live

| **ID**     | **Requirement**                                                                                            |
|------------|------------------------------------------------------------------------------------------------------------|
| FR-LIVE-01 | Admin/Organiser can configure a YouTube Live stream link/identifier for the wedding.                       |
| FR-LIVE-02 | When livestream is enabled, the wedding website displays a live viewing section.                           |
| FR-LIVE-03 | When livestream is disabled, the website does not expose the live player.                                  |
| FR-LIVE-04 | The product communicates that access/privacy depends on the configured YouTube stream visibility settings. |

## 7.11 Photo Sharing

| **ID**    | **Requirement**                                                                       |
|-----------|---------------------------------------------------------------------------------------|
| FR-PHO-01 | Admin/Organiser can enable photo sharing for the wedding.                             |
| FR-PHO-02 | System can generate a QR/link to the photo upload experience.                         |
| FR-PHO-03 | Guest can upload photos without creating an account.                                  |
| FR-PHO-04 | Photos are associated with the wedding and, where captured, the relevant event/album. |
| FR-PHO-05 | Admin/Organiser can view and delete uploaded photos.                                  |
| FR-PHO-06 | Guests can view the shared photo gallery according to wedding privacy settings.       |

## 7.12 Vendor Management & Discovery

| **ID**    | **Requirement**                                                                                                                                                                                                                                                 |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| FR-VEN-01 | Admin/Organiser can manually create, edit, view, and delete vendor records.                                                                                                                                                                                     |
| FR-VEN-02 | Vendor record supports name, category, contact person, phone, email, address, website, notes, and optional external place ID/source reference.                                                                                                                  |
| FR-VEN-03 | Vendor categories include initial common wedding categories such as Photographer, Videographer, Decorator, Backdrop Decorator, Makeup Artist, Mehendi Artist, Caterer, Venue, DJ/Music, Event Planner, Florist, Invitation/Printing, Transportation, and Other. |
| FR-VEN-04 | Admin/Organiser can search/filter their saved vendor list by category and text.                                                                                                                                                                                 |
| FR-VEN-05 | User can discover nearby vendors by category and location.                                                                                                                                                                                                      |
| FR-VEN-06 | Primary search location is the wedding/event venue location, with an optional ability to search another selected location.                                                                                                                                      |
| FR-VEN-07 | Discovery results can show vendor name, category/type, distance, address, rating, user rating count, phone, and website when the source provides these fields.                                                                                                  |
| FR-VEN-08 | User can save a discovered place as a wedding vendor.                                                                                                                                                                                                           |
| FR-VEN-09 | Saved vendors can be associated with one or more wedding events.                                                                                                                                                                                                |
| FR-VEN-10 | Tasks can optionally reference a vendor.                                                                                                                                                                                                                        |
| FR-VEN-11 | Expenses can optionally reference a vendor.                                                                                                                                                                                                                     |
| FR-VEN-12 | The product does not create its own “best vendor” score in V1; source ratings are displayed with appropriate attribution.                                                                                                                                       |

## 7.13 QR & Guest Access

| **ID**   | **Requirement**                                                                     |
|----------|-------------------------------------------------------------------------------------|
| FR-QR-01 | System generates wedding-scoped QR/link destinations for defined guest experiences. |
| FR-QR-02 | QR destinations can open RSVP or photo upload directly without login.               |
| FR-QR-03 | Tokens/links are non-guessable and can be revoked where required.                   |

# 8. Key User Flows

## 8.1 Create Wedding

1.  Sign up/login

2.  Create wedding

3.  Enter couple details, date, location, contact details, photo

4.  Save wedding

5.  Open dashboard

6.  Create first event / invite organiser / add task / add guest

## 8.2 Invite Organiser

7.  Admin opens Collaborators

8.  Select Invite Organiser

9.  Enter invitee email/basic details

10. System sends account/join invitation

11. Invitee creates account/logs in

12. System grants Organiser access

## 8.3 Plan an Event

13. Create event

14. Set date/time/venue

15. Add event notes

16. Create event-specific tasks

17. Add guests to event

18. Record event-related expenses

19. Optionally assign vendors to event

## 8.4 Guest Invitation and RSVP

20. Import/add guest

21. Assign event(s)

22. Send email invitation

23. Guest opens secure link

24. Guest selects Attending or Not Attending

25. RSVP stored

26. Admin/Organiser sees updated summary

27. Send reminder to pending guests when needed

## 8.5 Create Wedding Website

28. Open Website

29. Choose one of four themes

30. Populate wedding content

31. Preview

32. Publish

33. Share website URL/QR

## 8.6 Livestream

34. Admin/Organiser enables livestream

35. Add YouTube Live URL/identifier

36. Validate configured stream

37. Publish live section on website

38. Guest opens website and watches stream

## 8.7 Photo Sharing

39. Admin/Organiser enables gallery

40. Generate QR/link

41. Guest scans QR

42. Guest selects/uploads photos

43. Photos are stored in wedding gallery

44. Admin/Organiser can moderate/delete

45. Guests view gallery

## 8.8 Vendor Discovery

46. Open Vendors

47. Choose vendor category

48. Choose search location/radius

49. Search nearby places

50. Review list/map details and ratings

51. Save vendor to wedding

52. Optionally assign to event/task/expense

# 9. Data Model

The wedding is the central domain object. Users, events, tasks, expenses, guests, invitations, vendors, website content, livestream configuration, and photos are scoped to a wedding.

| **Entity**    | **Core fields / relationships**                                                                                                                         |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| User          | id, name, email, authentication data, profile fields, timestamps                                                                                        |
| Wedding       | id, creator/admin reference, bride name, groom name, date, location/address, lat/lng, contact details, photo, status, timestamps                        |
| WeddingMember | wedding_id, user_id, role, invited/active state, timestamps                                                                                             |
| Event         | id, wedding_id, name, date, time, venue, address, lat/lng, description/notes, photo, timestamps                                                         |
| Task          | id, wedding_id, event_id, name, description, assignee user_id, due date, priority, status, notes, optional vendor_id, timestamps                        |
| Expense       | id, wedding_id, event_id, description, amount, category, paid_status, payment_date, payer user reference/name, optional vendor_id, notes, timestamps    |
| Guest         | id, wedding_id, name, email, invitation state, RSVP state, timestamps                                                                                   |
| EventGuest    | event_id, guest_id, timestamps                                                                                                                          |
| Invitation    | id, wedding_id, guest_id, event_id or event scope, channel, sent state, secure token reference, timestamps                                              |
| RSVP          | id, guest_id, event_id or wedding scope, response: attending/not_attending, response timestamp                                                          |
| Website       | id, wedding_id, theme_id, published state, slug/URL, content configuration, timestamps                                                                  |
| Theme         | id, name, version, visual configuration, active flag                                                                                                    |
| Livestream    | id, wedding_id, provider, stream URL/identifier, enabled state, timestamps                                                                              |
| Photo         | id, wedding_id, event_id/album reference, storage key, uploader/session reference, moderation state, timestamps                                         |
| QRCodeLink    | id, wedding_id, purpose, token, destination, active state, timestamps                                                                                   |
| Vendor        | id, wedding_id, source, external place id, name, category, contact person, phone, email, address, website, rating snapshot if stored, notes, timestamps |

## 9.1 Core relationships

- One User → zero or one Wedding membership in V1.

- One Wedding → many Events.

- One Wedding → many Members; member role is Admin or Organiser.

- One Event → many Tasks, Guests, Expenses, and Vendors through association records/references as applicable.

- One Guest → many EventGuest associations; RSVP is tracked per event where event-specific RSVP is required.

- One Wedding → one active Website configuration in V1, using one selected Theme at a time.

- One Wedding → one or more Photos and QR links.

- One Vendor → may be associated with many Events, Tasks, and Expenses.

# 10. Integrations

## 10.1 Email provider

- Invitation emails

- RSVP reminder emails

- Collaborator invitation emails

- Transactional/error messages where needed

## 10.2 Google Maps Platform / Places API (recommended)

Vendor discovery can use Google Places API (New) Nearby Search for category + geographic search and Place Details/related place data for richer vendor information. The current Google documentation states that Nearby Search (New) supports location restriction, place types, result limits, and ranking by distance or popularity. Rating, user rating count, phone, website, and formatted address are available fields subject to field-mask and billing rules. Production requests should use explicit field masks rather than wildcard fields.

**Official references:** developers.google.com/maps/documentation/places/web-service/nearby-search \| developers.google.com/maps/documentation/places/web-service/place-details \| developers.google.com/maps/documentation/places/web-service/choose-fields

## 10.3 Maps UI

A map view can use Google Maps JavaScript API or another approved map provider. The map should visualize the wedding/event location and discovered vendor results without creating a proprietary vendor score.

## 10.4 YouTube

V1 uses YouTube Live as the livestream provider. The application stores the configured live URL/identifier and embeds the player within the wedding website when enabled. The stream’s actual privacy/visibility behavior remains governed by YouTube configuration.

## 10.5 Object storage

Use cloud object storage for wedding photos, website media, and other uploaded files. Store only secure object references/metadata in the relational database.

# 11. Non-Functional Requirements

| **Area**               | **Requirement**                                                                                                                                                                            |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Performance            | Typical dashboard/list pages should target fast interactive load under normal network conditions. Search/filter actions should provide visible feedback and avoid blocking the whole page. |
| Availability           | Core planning functions should remain available even if an external discovery provider is temporarily unavailable. Vendor discovery can fail gracefully.                                   |
| Scalability            | Design media storage and photo access separately from transactional data to handle spikes during wedding events.                                                                           |
| Security               | Strong authentication, authorization at API/service layer, secure tokens for guest links, encryption in transit, secure password storage, input validation, and audit-friendly logging.    |
| Privacy                | Guests should only see the wedding data intended for guest audiences. Couple/admin data and expenses must never be exposed through guest links.                                            |
| Accessibility          | Key flows should be usable by keyboard and screen-reader users, with readable contrast, labels, focus states, and accessible forms.                                                        |
| Responsive design      | The web app should be mobile-first/responsive; guests may primarily use mobile browsers, while organisers may use desktop and mobile.                                                      |
| Localization readiness | V1 can launch in English, but text/content architecture should allow future Indian language localization without reworking business logic.                                                 |
| Observability          | Centralized application logs, integration error tracking, structured audit events for critical membership and content actions.                                                             |
| Data retention         | Product should define default retention and deletion behavior for inactive weddings and uploaded photos before production launch.                                                          |

# 12. Analytics & Success Metrics

V1 should measure whether families successfully complete the core wedding journey, not just page views.

| **Metric**             | **Definition**                                                                                |
|------------------------|-----------------------------------------------------------------------------------------------|
| Activation             | % of registered users who create a wedding.                                                   |
| Planning activation    | % of weddings with at least one event, one task, one guest, and one expense recorded.         |
| Collaboration          | Average number of active Admin/Organiser members per wedding.                                 |
| Guest engagement       | Invitation sent → invitation opened/clicked where provider data permits → RSVP response rate. |
| Reminder effectiveness | % of pending guests who respond after RSVP reminder.                                          |
| Website usage          | % of weddings that publish a website and number of guest visits.                              |
| Photo participation    | % of weddings with at least one guest photo upload; uploads per wedding.                      |
| Vendor discovery       | Vendor searches, result views, saved vendors, and category usage.                             |
| Feature completion     | End-to-end completion of create wedding → create event → invite guests → collect RSVP.        |

# 13. Security, Privacy & Trust

- Role-based access must be enforced server-side. Hiding a button is not sufficient authorization.

- Guest-facing RSVP and photo-upload links must use unguessable tokens and should support revocation/expiration where appropriate.

- Wedding expenses, collaborator membership, and private administration data must not be reachable from guest-facing routes or APIs.

- Uploaded photos require validation for type/size and malware/content safety controls appropriate to the infrastructure.

- Vendor discovery should clearly distinguish third-party sourced information from vendor information entered by the wedding team.

- Third-party provider terms, attribution rules, storage/caching restrictions, and billing implications must be reviewed before production use of Google Places/Maps data.

- Provide basic wedding-data export and deletion capabilities in the production readiness backlog.

# 14. Acceptance Criteria & MVP Exit Criteria

## 14.1 Cross-module acceptance principles

- A newly created wedding appears in the dashboard with correct couple/date/location information.

- Admin and Organiser see appropriate modules and permissions; Guest cannot enter authenticated management routes.

- Admin can add/remove Organisers; Organiser cannot perform these actions.

- An event can be created and then used as context for tasks, guests, expenses, vendors, and website content.

- A guest can receive an email invitation, RSVP with one of two choices, and the management dashboard updates the response state.

- Pending RSVP guests can be identified and reminded by email.

- A wedding website can be created with one of four themes, previewed, and published.

- A configured YouTube Live stream appears only when enabled.

- A guest can scan a photo-sharing QR code, upload a photo without logging in, and see the image in the gallery subject to moderation rules.

- Vendor discovery can search by category and geographic area, show available rating/location data, and save a result as a wedding vendor.

- A saved vendor can be associated with events, referenced by tasks, and referenced by expenses.

## 14.2 MVP exit criteria

- All P0 user journeys complete successfully in production-like testing.

- No known critical authorization defect for Admin, Organiser, or Guest access.

- Invitation/RSVP flow is reliable and auditable for test mailboxes.

- Website publishing works across supported desktop/mobile browsers.

- Photo upload and gallery performance is acceptable for a wedding-scale media burst.

- Vendor discovery handles API errors, quota errors, and no-result cases gracefully.

- Core analytics events are captured and dashboards exist for activation and RSVP outcomes.

- Privacy/terms/third-party integration requirements are reviewed before public launch.

# 15. Risks & Dependencies

| **Risk**                     | **Impact**                                                                         | **Mitigation**                                                                                                       |
|------------------------------|------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Guest link abuse             | Unauthorized sharing could expose wedding information.                             | Use non-guessable tokens, granular access, revocation, and clear privacy controls.                                   |
| Photo storage cost           | Wedding uploads may create sudden storage/bandwidth spikes.                        | Use object storage, file limits/compression, quotas, and scalable delivery.                                          |
| Email deliverability         | Invitations may land in spam or fail.                                              | Use reputable transactional email provider, domain authentication, bounce handling, and resend controls.             |
| Third-party map data         | Vendor discovery depends on external API availability, quotas, terms, and billing. | Use provider abstraction, explicit field masks, caching only where allowed, graceful fallback, and usage monitoring. |
| YouTube visibility           | “Private” streaming behavior depends on external provider settings.                | Expose clear configuration guidance and treat the embedded player as third-party content.                            |
| Family permission complexity | Broad Organiser access may need more granularity later.                            | Keep V1 simple but centralize permissions so finer scopes can be introduced later.                                   |

# 16. Post-V1 Opportunities

- WhatsApp/SMS invitations and reminders.

- Task reminders and richer notification automation.

- Vendor marketplace, lead/booking workflow, verified vendor profiles, and reviews.

- More website themes and advanced customization.

- Regional Indian wedding templates and multilingual support.

- Accommodation, travel, transport, seating, gifts, and guest preferences.

- Budget planning, family contribution tracking, vendor advances, and payment workflows.

- AI-assisted wedding checklist generation and planning recommendations.

- Native mobile apps and offline/event-day enhancements.

- Advanced wedding photo organization, duplicate detection, search, and shared albums.

# 17. Open Decisions Before Development

| **Decision**               | **What must be finalized**                                                                                                 |
|----------------------------|----------------------------------------------------------------------------------------------------------------------------|
| Account onboarding         | Exact sign-up fields and whether phone number is required, optional, or used only for recovery.                            |
| Admin membership           | Confirm the onboarding flow for Bride and Groom as co-admins, including how the second Admin is invited/claimed.           |
| Guest identity             | Whether a guest RSVP token is single-use, revocable, or reusable for future edits.                                         |
| Website URL                | Choose generated URL format, slug rules, custom domain support policy (V1 likely not included), and unpublishing behavior. |
| Theme content model        | Finalize the four Indian themes and the common content fields required by all themes.                                      |
| Photo limits               | Maximum file size, image formats, per-wedding quota, and moderation defaults.                                              |
| Vendor search location     | Default to wedding/event venue location; define user-selected alternate location and radius options.                       |
| Vendor persistence         | Confirm what third-party vendor data may be stored long-term and what must be fetched on demand under provider terms.      |
| Email provider             | Select provider, sender domain, templates, deliverability setup, bounce handling, and rate limits.                         |
| YouTube access wording     | Finalize in-product language for stream privacy and recommended YouTube visibility configuration.                          |
| Data retention             | Define account/wedding/photo retention and deletion rules.                                                                 |
| Supported browsers/devices | Define V1 supported browser versions and minimum mobile experience.                                                        |

# Appendix A. V1 Feature Inventory

| **\#** | **Feature**                  | **Area**    |
|--------|------------------------------|-------------|
| 01     | Authentication & Account     | Core        |
| 02     | Wedding Management           | Core        |
| 03     | Dashboard                    | Core        |
| 04     | Event Management             | Core        |
| 05     | Admin Management             | Core        |
| 06     | Organiser Management         | Core        |
| 07     | Task Management              | Core        |
| 08     | Expense Tracking             | Core        |
| 09     | Guest Management             | Core        |
| 10     | Email Invitations            | Core        |
| 11     | RSVP                         | Core        |
| 12     | RSVP Reminders               | Core        |
| 13     | Wedding Website Creation     | Experience  |
| 14     | Four Indian Website Themes   | Experience  |
| 15     | YouTube Live Integration     | Experience  |
| 16     | Wedding Photo Sharing        | Experience  |
| 17     | QR Photo Upload              | Experience  |
| 18     | Vendor Management            | Discovery   |
| 19     | Nearby Vendor Discovery      | Discovery   |
| 20     | Vendor → Event Assignment    | Integration |
| 21     | Vendor → Task Integration    | Integration |
| 22     | Vendor → Expense Integration | Integration |

# Appendix B. Product Language / Terminology

| **Term**        | **Definition**                                                                                                   |
|-----------------|------------------------------------------------------------------------------------------------------------------|
| Wedding         | The central workspace representing one wedding.                                                                  |
| Admin           | Bride/groom role with full wedding control, including organiser management.                                      |
| Organiser       | Trusted collaborator with operational wedding access; cannot manage organisers.                                  |
| Guest           | Non-authenticated wedding participant using secure guest-facing links.                                           |
| Event           | A ceremony or wedding-related function inside the wedding, with its own date/time/venue and optional guest list. |
| Task            | A planning/execution action with assignee, date, priority, status, event, and optional vendor.                   |
| Expense         | A recorded amount spent or due, with category, event, paid status, payment date, payer, and optional vendor.     |
| Vendor          | A service provider saved in the wedding workspace or discovered through a location provider.                     |
| Wedding Website | The public/private-facing wedding microsite generated from one of four V1 themes.                                |
| RSVP            | A guest response of Attending or Not Attending, with Pending until a response is received.                       |

*PRD status: V1 scope captured from the finalized product discussion. This document is intended to be the baseline for UX design, technical architecture, backlog creation, and implementation planning.*

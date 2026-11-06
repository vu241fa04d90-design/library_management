# Campus Library: Library Management System

React (Vite) frontend + Django REST Framework backend with JWT login.

## Features

**Librarian (staff account)**
- Add, edit and delete books; search by title, author, ISBN or category
- Issue a book to a member (default loan: 14 days, or pick a due date)
- Mark books as returned; fines are calculated automatically (Rs. 5 per overdue day)
- Add, edit and delete members (change their password, student ID, phone, email)
- Members list with books held and fines owed; clear all of a member's fines in one click
- Issue a book from the Books page or from the Loans page
- Clear (mark as paid) the fine on a single loan
- Settings page: library name, currency, loan days, fine per day, books per member
- Dashboard with titles, copies, books on loan, overdue count and fines due

**Student**
- Register and sign in
- Browse and search the catalogue, see availability
- See their own loans, due dates and fines

**Rules enforced by the server**
- No issuing when no copies are left
- One copy of a title per member at a time
- At most 3 books on loan per member
- A book can only be deleted when no copies are on loan (its returned-loan history is deleted with it)
- A member can only be deleted when they have no books out (their returned-loan history is deleted with them)
- Total copies can't be lowered below the number currently on loan

## Run it

You need Python 3.10+ and Node 18+.

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations library
python manage.py migrate
python manage.py seed_library     # demo users, books and loans
python manage.py runserver
```

API runs at http://localhost:8000/api/ and the Django admin at http://localhost:8000/admin/.

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Demo accounts (created by `seed_library`)

| Role      | Username    | Password     |
|-----------|-------------|--------------|
| Librarian | `librarian` | `library123` |
| Student   | `student1`  | `student123` |

To make your own librarian: `python manage.py createsuperuser`. Any user with
`is_staff` set is treated as a librarian. Students created through the
Register page are normal members.

## API

| Method | Endpoint | Who | Purpose |
|--------|----------|-----|---------|
| POST | `/api/auth/register/` | anyone | Create a student account |
| POST | `/api/auth/login/` | anyone | Get access + refresh tokens and user info |
| POST | `/api/auth/refresh/` | anyone | Get a new access token |
| GET | `/api/auth/me/` | signed in | Current user |
| GET | `/api/stats/` | signed in | Dashboard numbers (library-wide for staff, personal for students) |
| GET | `/api/books/?search=&category=` | signed in | List books |
| POST/PATCH/DELETE | `/api/books/` , `/api/books/{id}/` | staff | Manage books |
| GET | `/api/books/categories/` | signed in | Category names |
| GET | `/api/settings/` | anyone | Library name, currency and loan rules |
| PATCH | `/api/settings/` | staff | Change the library name, currency and loan rules |
| GET/POST | `/api/members/` | staff | List members / add a member |
| PATCH/DELETE | `/api/members/{id}/` | staff | Edit / delete a member |
| POST | `/api/members/{id}/clear-fines/` | staff | Mark all of a member's fines as paid |
| GET | `/api/issues/?status=&search=` | signed in | Loans (students only see their own). `status` = active, overdue or returned |
| POST | `/api/issues/` | staff | Issue a book: `{book, member, due_on?}` |
| POST | `/api/issues/{id}/return/` | staff | Mark a loan as returned |
| POST | `/api/issues/{id}/clear-fine/` | staff | Mark the fine on a loan as paid |

## Project layout

```
backend/
  config/            Django settings and root URLs
  library/           models, serializers, views, permissions, seed command
frontend/
  src/api.js         fetch wrapper with automatic token refresh
  src/AuthContext.jsx
  src/pages/         Login, Register, Dashboard, Books, Loans, Members
  src/components/    Navbar, Modal, ProtectedRoute
```

## Look and feel

- **Login / register page:** a picture on the left (`frontend/public/img/login-hero.svg`) and the form on the right.
  To use your own photo, copy it into `frontend/public/img/` (for example `campus.jpg`) and change the
  `url("/img/login-hero.svg")` line under `.auth-hero` in `frontend/src/styles.css`.
- **Page background:** a faint book pattern (`frontend/public/img/pattern.svg`) with soft colour glows, set in the
  `body` and `body::before` rules in `styles.css`. To use a photo instead, change the `background-image` in `body::before`.
- **Light / dark theme:** the moon/sun button in the top bar. The choice is remembered (`src/theme.js`).
  All colours are variables at the top of `styles.css` (`:root` for light, `[data-theme="dark"]` for dark).
- **Small JavaScript touches:** Show/Hide password button (`components/PasswordInput.jsx`), a shadow under the top bar
  when you scroll (`components/Navbar.jsx`), and a soft fade-in on every page.
- The favicon is `frontend/public/favicon.svg`.

## Overdue reminders

Email and mobile number are now required when a student registers (and when a librarian adds or edits a member).

When a book is past its due date the student is notified in three ways:

1. **In the app** - a "Reminder from the library" box on the student's dashboard.
2. **Email** - sent to the email they registered with. By default emails are printed in the
   backend terminal so you can test without any setup. To send real emails (Gmail example), set these
   in the same cmd window before `runserver`:
   ```cmd
   set EMAIL_HOST_USER=yourlibrary@gmail.com
   set EMAIL_HOST_PASSWORD=your-16-char-app-password
   ```
3. **SMS (optional)** - works if you `pip install twilio` and set `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Without them, SMS is skipped.

Send the reminders either from the **Loans** page (button *Send overdue reminders*) or by running
`python manage.py send_overdue_reminders`. Each loan is reminded at most once per day, so running it
again the same day does nothing. To send them automatically every day, schedule that command in
Windows Task Scheduler.

Students registered before this update have no email or phone. Edit them on the Members page to
add these, otherwise they only get the in-app reminder.

## Starting fresh (removing the demo data)

```bash
python manage.py clear_library      # deletes ALL books, loans and student accounts; librarians are kept
```

Then add your own books and members from the app.

## Updating an existing copy

If you already ran an older version, run these once after copying the new files:

```bash
python manage.py makemigrations library
python manage.py migrate
```

## Settings you may want to change

- Library name, currency, loan length, fine per day and loan limit: the **Settings** page (librarian login)
- API address used by the frontend: copy `frontend/.env.example` to `frontend/.env`
- Before deploying: set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS`
  and `CORS_ALLOWED_ORIGINS` as environment variables, and switch from SQLite to PostgreSQL

## Ideas to extend it

- Fine payment tracking (a `paid` flag on loans)
- Book reservations / waiting list
- Email reminders before the due date (Django management command + cron)
- Book cover images and pagination
- CSV export of loan reports
"# library_management_system" 

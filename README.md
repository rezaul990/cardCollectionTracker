# Daily Collection Tracker

A web app for daily card collection tracking. Branch Managers enter data, Admin (Collection Officer) views all branches and downloads Excel reports.

## Tech Stack

- React (Vite) + TypeScript
- Tailwind CSS
- Firebase Authentication (Email/Password)
- Cloud Firestore
- SheetJS (xlsx) + file-saver for Excel export

## Setup

### 1. Firebase Configuration

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Email/Password authentication
3. Create a Firestore database
4. Copy your Firebase config values

### 2. Environment Variables

Create a `.env` file in the root directory:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

### 3. Firestore Setup

Deploy the security rules from `firestore.rules` to your Firebase project.

Create the `branches` collection with documents like:
```json
{
  "branchId": "branch1",
  "branchName": "Downtown Branch",
  "managerEmail": "manager1@example.com"
}
```

### 4. Create Users

In Firebase Authentication, create users:
- Admin: `admin@yourcompany.com`
- Branch Managers: emails matching `managerEmail` in branches collection

### 5. Install & Run

```bash
npm install
npm run dev
```

### 6. Build & Deploy

```bash
npm run build
```

Deploy the `dist` folder to Vercel or Firebase Hosting.

## User Roles

| Role | Access |
|------|--------|
| Branch Manager | Own branch only, can enter/update data |
| Admin | All branches (read-only), can download Excel |

## Pages

- `/login` - Email/password login
- `/dashboard` - Branch Manager dashboard (today's stats + last 7 days)
- `/entry` - Branch Manager data entry form
- `/admin` - Admin dashboard with date range filter and Excel export

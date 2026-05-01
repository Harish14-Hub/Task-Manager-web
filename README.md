# Team Task Manager

A full-stack team task management system built with React, Node.js, Express, and PostgreSQL. It supports admin-led team management, project-based task assignment, member progress tracking, and a secure first-time login password change flow.

## Features

- JWT-based authentication with role-based access control
- Admin dashboard for member creation, project creation, and task assignment
- Member dashboard for viewing assigned tasks and updating task status
- First-time login password change enforcement for newly created users
- Project-member linking through a `project_members` table
- Live-like admin updates through refresh-driven task monitoring
- Delete member, delete project, and clear workspace actions for admin cleanup
- PostgreSQL-backed persistence for users, projects, memberships, and tasks

## Tech Stack

- Frontend: React + Vite + Vanilla CSS
- Backend: Node.js + Express
- Database: PostgreSQL

## Main Workflow

1. Admin logs in and creates team members.
2. New members are created with the default password `password123`.
3. On first login, members are redirected to a change-password page.
4. Admin creates projects and links members to those projects.
5. Admin assigns tasks to project members.
6. Members update tasks from `To Do` to `In Progress` to `Completed`.
7. Admin monitors task progress from the dashboard.

## Default Admin Login

- Email: `admin@taskmanager.com`
- Password: `Admin123!`

## Project Structure

```text
Task manager/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── routes/
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   ├── pages/
│   │   └── utils/
│   └── package.json
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL

### 1. Database

Create a PostgreSQL database, for example:

```sql
CREATE DATABASE task_manager;
```

Then use the schema in:

```text
backend/db/schema.sql
```

### 2. Backend

Create `backend/.env` using `backend/.env.example` and set your database credentials.

Run:

```bash
cd backend
npm install
node server.js
```

### 3. Frontend

Run:

```bash
cd frontend
npm install
npm run dev
```

## Important Notes

- Public signup is disabled.
- Admin-created users are forced to change their password on first login.
- `node_modules`, build output, and local `.env` files are intentionally excluded from git.

## Deployment

- Frontend: Vercel or Netlify
- Backend + Database: Railway, Render, or similar PostgreSQL-friendly hosting

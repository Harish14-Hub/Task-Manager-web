# 🚀 Team Task Manager

A full-stack team task management system built using **React, Node.js, Express, and PostgreSQL**, designed to simulate real-world team workflows with **role-based access control, optimized queries, and scalable backend architecture**.

---

## 📌 Overview

This application enables organizations to manage teams, projects, and tasks efficiently. It supports **admin-controlled workflows**, where administrators create users, assign tasks, and monitor progress, while members update their assigned tasks.

---

## 🔥 Key Highlights

* Scalable backend architecture with optimized SQL queries
* UUID-based schema for production-level consistency
* Role-based access control (Admin / Member)
* Cursor-based pagination for large datasets
* Efficient JOIN queries to eliminate N+1 problems
* Handles real-world production issues (UUID mismatch, auth errors, deployment bugs)
* Fully deployed system (Frontend: Vercel, Backend: Render, DB: PostgreSQL)

---

## ⚙️ Features

### 🔐 Authentication

* JWT-based login system
* Role-based authorization
* First-time login password change enforcement
* Admin-controlled user creation (no public signup)

---

### 👨‍💼 Admin Capabilities

* Create team members
* Assign roles (Developer, QA, etc.)
* Create and manage projects
* Assign tasks to members
* Monitor task progress (Todo / In Progress / Completed)
* Delete users/projects

---

### 👨‍💻 Member Capabilities

* View assigned tasks
* Update task status
* Track deadlines
* Change password on first login

---

### 📊 Dashboard

* Total tasks
* Completed tasks
* Overdue tasks
* Status distribution

---

## 🧠 Algorithms & Logic Used

### 1. Cursor-Based Pagination

```sql
WHERE t.created_at < $cursor
ORDER BY t.created_at DESC
LIMIT $limit
```

* Avoids OFFSET inefficiency
* Scales for large datasets

---

### 2. Role-Based Filtering

```sql
WHERE t.assigned_to = $userId::uuid
```

* Ensures users only access their own data
* Enforces access control at DB level

---

### 3. Optimized JOIN Queries

```sql
SELECT t.*, u.name, p.name AS project_name
FROM tasks t
JOIN projects p ON p.id = t.project_id
LEFT JOIN users u ON t.assigned_to = u.id;
```

* Eliminates multiple queries
* Reduces API latency

---

### 4. Many-to-Many Relationship

```text
project_members (project_id, user_id)
```

* Efficient team-project mapping
* Avoids redundancy

---

### 5. Conditional Query Building

```js
if (userRole === 'member') {
  query += ` AND t.assigned_to = $n::uuid`;
}
```

---

### 6. UUID Type Handling

```sql
WHERE assigned_to = $1::uuid
```

* Prevents type mismatch issues
* Ensures production compatibility

---

### 7. Data Validation

* Title validation
* Member existence validation
* Project membership validation

---

## ⚡ Performance & Scalability

### 🔹 Indexing

```sql
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_users_email ON users(email);
```

---

### 🔹 Query Optimization

```sql
SELECT t.*, u.name 
FROM tasks t
JOIN users u ON t.assigned_to = u.id;
```

---

### 🔹 Stateless API Design

* JWT-based authentication
* No session storage
* Horizontally scalable

---

### 🔹 Pagination

```sql
LIMIT 10
```

or

```sql
WHERE created_at < $cursor
```

---

## 🧠 Data Structures Used

### HashMap (JS Map)

```js
const userMap = new Map();
```

* O(1) lookup

---

### Arrays + Filtering

```js
tasks.filter(t => t.status === "completed");
```

---

### Sorting

```js
tasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
```

---

### Relational Graph Structure

* Users ↔ Projects ↔ Tasks
* Many-to-Many + One-to-Many

---

## ⚙️ Algorithms Complexity

| Operation | Complexity         |
| --------- | ------------------ |
| Filtering | O(n)               |
| Sorting   | O(n log n)         |
| Lookup    | O(1)               |
| DB Search | O(log n) (indexed) |

---

## 🧱 System Architecture

```text
Client (React)
      ↓
API (Express)
      ↓
Controller Layer
      ↓
Database (PostgreSQL)
      ↓
JSON Response
```

---

## 🔐 Security

* bcrypt password hashing
* JWT authentication
* Role-based route protection
* Secure API validation
* First-login password reset

---

## 🧪 Edge Cases Handled

* UUID vs integer mismatch
* Missing relations
* Invalid tokens (401/403)
* Empty production database
* CORS issues in deployment
* API routing issues

---

## 🛠 Tech Stack

| Layer      | Technology       |
| ---------- | ---------------- |
| Frontend   | React, Vite, CSS |
| Backend    | Node.js, Express |
| Database   | PostgreSQL       |
| Auth       | JWT, bcrypt      |
| Deployment | Vercel, Render   |

---

## 📁 Project Structure

```text
Task-Manager/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── middlewares/
│   ├── routes/
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   ├── pages/
│   │   └── utils/
│   └── package.json
│
└── README.md
```

---

## 🔄 Workflow

1. Admin logs in
2. Admin creates members
3. Members receive default credentials
4. First login → password change
5. Admin creates project
6. Admin assigns members
7. Admin assigns tasks
8. Members update status
9. Admin monitors progress

---

## 🔐 Default Credentials

### Admin

```
Email: admin@test.com  
Password: 123456
```

---

### Members

```
Default Password: password123
```

---

## ⚡ Setup Instructions

### Prerequisites

* Node.js (v18+)
* PostgreSQL

---

### Database Setup

```sql
CREATE DATABASE task_manager;
```

Run schema:

```
backend/db/schema.sql
```

---

### Backend Setup

```bash
cd backend
npm install
node server.js
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## 🚀 Deployment

| Service  | Platform   |
| -------- | ---------- |
| Frontend | Vercel     |
| Backend  | Render     |
| Database | PostgreSQL |

---

## 💡 Production Notes

* Replace localhost API with deployed backend URL
* Enable CORS in backend
* Use environment variables for secrets
* Ensure DATABASE_URL is configured

---

## 🚀 Future Enhancements

* Redis caching
* WebSocket real-time updates
* Notifications system
* File attachments
* Activity logs
* Microservices architecture

---

## 🏆 Why This Project Stands Out

* Handles real production deployment issues
* Demonstrates backend optimization techniques
* Implements scalable system design
* Covers authentication + authorization
* Shows full-stack debugging capability

---

# 💯 Final Statement

This project demonstrates **end-to-end full-stack development**, including **system design, database optimization, authentication, deployment, and real-world debugging**, making it a **production-ready application** suitable for scalable environments.

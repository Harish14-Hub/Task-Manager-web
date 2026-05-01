CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop tables if they exist to allow clean re-initialization
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    job_role VARCHAR(100),
    is_first_login BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on email for fast login lookup
CREATE INDEX idx_users_email ON users(email);

-- Projects Table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on created_by to find projects created by a specific user quickly
CREATE INDEX idx_projects_created_by ON projects(created_by);

-- Project Members Table (Many-to-Many)
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, user_id)
);

-- Index for finding all projects a user belongs to
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) CHECK (status IN ('todo', 'in_progress', 'completed')) DEFAULT 'todo',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and scalability
-- 1. Index on project_id for fast filtering of tasks by project
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

-- 2. Index on assigned_to for fast lookup of a user's tasks
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- 3. Composite index on (project_id, status) for dashboard filtering and Kanban columns
CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);

-- 4. Index on created_at for cursor-based pagination
CREATE INDEX idx_tasks_created_at ON tasks(created_at);

-- 5. Index on due_date for fast sorting and dashboard 'overdue' queries
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

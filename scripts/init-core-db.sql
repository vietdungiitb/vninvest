-- PostgreSQL initialization script for core_db (SaaS-TDB-P2)
-- This script creates the core_db database and sets permissions.
-- Used as Docker entrypoint init script: scripts/init-core-db.sql

-- Create core_db if not exists
SELECT 'CREATE DATABASE core_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'core_db')\gexec;

-- Grant all privileges on core_db to postgres user (already superuser)
GRANT ALL PRIVILEGES ON DATABASE core_db TO postgres;

-- Optional: Create schema and set search path for future flexibility
-- \c core_db
-- CREATE SCHEMA IF NOT EXISTS public;
-- GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

-- Success message (optional)
SELECT 'core_db initialized successfully';

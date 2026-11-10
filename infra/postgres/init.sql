-- Runs once, when the postgres volume is first created.
-- Each backend owns its own database.
CREATE DATABASE auth_db;
CREATE DATABASE shop_db;
\connect shop_db
CREATE EXTENSION IF NOT EXISTS postgis;

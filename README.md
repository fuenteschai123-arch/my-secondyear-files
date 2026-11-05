# Student Dashboard

A CRUD dashboard built with Express.js and SQLite.

## Features
- Create, read, update, and delete students
- Live stats (total students, number of courses)

## Run locally
```
npm install
node server.js
```
Open http://localhost:3000

## API
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/students | List all students |
| POST | /api/students | Add a student |
| PUT | /api/students/:id | Update a student |
| DELETE | /api/students/:id | Delete a student |

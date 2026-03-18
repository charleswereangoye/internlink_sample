# InternLink (sample)

A small Flask + SQLite web app for internship discovery and tracking.

## What’s included

- **Student flow**: browse internships, apply internally, track application status, manage a simple skill profile, and get **skill-based matches**
- **SME flow**: publish internships, review candidates, update application status, and view simple application charts
- **UI**: global **Light/Dark theme toggle** and minimal 2D motion

## Tech stack

- **Backend**: Python, Flask
- **Database**: SQLite (`database.db`)
- **Frontend**: HTML templates + vanilla JS + Chart.js (CDN)

## Run locally (Windows / PowerShell)

From the project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install flask werkzeug
python app.py
```

Then open `http://127.0.0.1:5000`.

## Pages

- **Home**: `/`
- **Internships**: `/internships`
- **Student dashboard**: `/dashboard`
- **Employer dashboard**: `/sme_dashboard`
- **Login/Register**: `/login`, `/register`

## API endpoints (high level)

- **Internships**: `GET/POST /api/internships`
- **Applications**: `GET/POST/PUT /api/applications`
- **Skill profile**: `GET/PUT /api/profile`
- **Matching**: `GET /api/match`

## Database notes

- This repo already includes a SQLite database file: `database.db`.
- There are helper scripts (`create_db.py`, `db.py`, `update_db.py`, `update_apps.py`, `update_profile.py`) that were used during development to create/update tables.
  - If you plan to regenerate the database from scratch, it’s best to create a single clean init script (or use migrations) rather than running these ad-hoc scripts in an unknown order.

## Troubleshooting

- **Port already in use**: stop the other process using port 5000, or change the port in `app.py`.
- **Theme not switching**: clear site storage and reload (theme is persisted in `localStorage`).
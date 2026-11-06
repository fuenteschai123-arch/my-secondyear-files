const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// ---- LOGIN SETTINGS ----
const ADMIN_USER = process.env.ADMIN_USER || 'Admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'palitan-ito-ng-mahabang-random-text';
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASS, 10);
// ------------------------

app.use(express.json());
app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }
    })
);

const db = new sqlite3.Database(path.join(__dirname, 'students.db'), (err) => {
    if (err) console.error(err.message);
    else console.log('SQLite database connected.');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            course TEXT NOT NULL,
            year_level TEXT NOT NULL DEFAULT '1st Year'
        )
    `);
    db.all('PRAGMA table_info(students)', [], (err, columns) => {
        if (err) return console.error(err.message);
        if (!columns.some((c) => c.name === 'year_level')) {
            db.run("ALTER TABLE students ADD COLUMN year_level TEXT NOT NULL DEFAULT '1st Year'");
        }
    });
});

// ---------- PUBLIC ROUTES (no login needed) ----------
let logoCache = null;
app.get('/cpsu-logo.png', (req, res) => {
    const file = path.join(__dirname, 'public', 'cpsu-logo.png');
    if (fs.existsSync(file)) return res.sendFile(file);
    if (!logoCache) {
        try {
            const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
            const m = html.match(/src="data:image\/png;base64,([^"]+)"/);
            if (m) logoCache = Buffer.from(m[1], 'base64');
        } catch (e) { console.error(e.message); }
    }
    if (!logoCache) return res.status(404).end();
    res.type('png').send(logoCache);
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    // Username: hindi sensitive sa laki/liit ng letra. Password: sensitive (Admin123).
    const ok =
        username.toLowerCase() === ADMIN_USER.toLowerCase() &&
        bcrypt.compareSync(password, ADMIN_HASH);

    if (!ok) {
        return setTimeout(
            () => res.status(401).json({ error: 'Incorrect username or password.' }),
            400
        );
    }
    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Could not start session.' });
        req.session.user = ADMIN_USER;
        res.json({ ok: true });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// ---------- EVERYTHING BELOW NEEDS LOGIN ----------
function requireAuth(req, res, next) {
    if (req.session.user) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Please log in.' });
    res.redirect('/login');
}
app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

function readStudent(body) {
    const name = (body.name || '').trim();
    const course = (body.course || '').trim();
    const year_level = body.year_level || '1st Year';
    if (!name || !course) return { error: 'Name and course are required.' };
    if (!YEAR_LEVELS.includes(year_level)) return { error: 'Invalid year level.' };
    return { name, course, year_level };
}

app.get('/api/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/students', (req, res) => {
    const student = readStudent(req.body);
    if (student.error) return res.status(400).json({ error: student.error });
    db.run(
        'INSERT INTO students (name, course, year_level) VALUES (?, ?, ?)',
        [student.name, student.course, student.year_level],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, ...student });
        }
    );
});

app.put('/api/students/:id', (req, res) => {
    const student = readStudent(req.body);
    if (student.error) return res.status(400).json({ error: student.error });
    db.run(
        'UPDATE students SET name = ?, course = ?, year_level = ? WHERE id = ?',
        [student.name, student.course, student.year_level, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Student not found.' });
            res.json({ id: Number(req.params.id), ...student });
        }
    );
});

app.delete('/api/students/:id', (req, res) => {
    db.run('DELETE FROM students WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Student not found.' });
        res.json({ message: 'Student deleted.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

app.use(express.json());

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, 'students.db'), (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log('SQLite database connected.');
    }
});

// Create students table, then add year_level if the old table doesn't have it yet
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
        const hasYear = columns.some((c) => c.name === 'year_level');
        if (!hasYear) {
            db.run(
                "ALTER TABLE students ADD COLUMN year_level TEXT NOT NULL DEFAULT '1st Year'",
                (alterErr) => {
                    if (alterErr) console.error(alterErr.message);
                    else console.log('Added year_level column.');
                }
            );
        }
    });
});

// Serve the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Validate and clean the request body
function readStudent(body) {
    const name = (body.name || '').trim();
    const course = (body.course || '').trim();
    const year_level = body.year_level || '1st Year';

    if (!name || !course) {
        return { error: 'Name and course are required.' };
    }
    if (!YEAR_LEVELS.includes(year_level)) {
        return { error: 'Invalid year level.' };
    }
    return { name, course, year_level };
}

// READ - get all students
app.get('/api/students', (req, res) => {
    db.all('SELECT * FROM students ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CREATE - add student
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

// UPDATE - edit student
app.put('/api/students/:id', (req, res) => {
    const student = readStudent(req.body);
    if (student.error) return res.status(400).json({ error: student.error });

    db.run(
        'UPDATE students SET name = ?, course = ?, year_level = ? WHERE id = ?',
        [student.name, student.course, student.year_level, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Student not found.' });
            }
            res.json({ id: Number(req.params.id), ...student });
        }
    );
});

// DELETE - remove student
app.delete('/api/students/:id', (req, res) => {
    db.run('DELETE FROM students WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Student not found.' });
        }
        res.json({ message: 'Student deleted.' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

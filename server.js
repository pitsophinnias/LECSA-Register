const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

// Load .env file
const envPath = path.resolve(__dirname, '.env');
console.log(`Attempting to load .env file from: ${envPath}`);
if (!fs.existsSync(envPath)) {
    console.error('.env file not found at:', envPath);
    process.exit(1);
}
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const key in envConfig) {
    process.env[key] = envConfig[key];
}

// Validate .env variables
if (!process.env.SECRET_KEY || !process.env.PG_PASSWORD) {
    console.error('SECRET_KEY or PG_PASSWORD is not defined in .env');
    process.exit(1);
}

// Initialize PostgreSQL connection pool
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lecsachurch',
    password: process.env.PG_PASSWORD,
    port: 5432
});

// Verify database connection
pool.connect((err) => {
    if (err) {
        console.error('Failed to connect to PostgreSQL:', err);
        process.exit(1);
    }
    console.log('Connected to PostgreSQL database');
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logs user actions (e.g., login, add records) to the action_logs table
async function logAction(userId, action, details) {
    try {
        await pool.query(
            'INSERT INTO action_logs (user_id, action, details) VALUES ($1, $2, $3)',
            [userId, action, details]
        );
    } catch (err) {
        console.error('Error logging action:', err);
    }
}

// Archives baptisms older than 3 years by moving them to the archives table
async function archiveOldBaptisms() {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    console.log(`Archiving baptisms with baptism_date before: ${threeYearsAgo.toISOString()}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldBaptisms = await client.query(
            'SELECT * FROM baptisms WHERE baptism_date < $1 AND archived = false',
            [threeYearsAgo]
        );
        console.log(`Found ${oldBaptisms.rows.length} baptisms to archive`);
        for (const baptism of oldBaptisms.rows) {
            const maxPalo = (await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM archives')).rows[0].max_palo;
            const archiveId = uuidv4();
            console.log(`Archiving baptism id: ${baptism.id} with archive id: ${archiveId}`);
            await client.query(
                'INSERT INTO archives (id, palo, record_type, details) VALUES ($1, $2, $3, $4)',
                [archiveId, parseInt(maxPalo) + 1, 'baptism', {
                    baptism_id: baptism.id,
                    name: `${baptism.first_name} ${baptism.middle_name || ''} ${baptism.surname}`.trim(),
                    baptism_date: baptism.baptism_date,
                    date_of_birth: baptism.date_of_birth,
                    father_name: `${baptism.father_first_name} ${baptism.father_middle_name || ''} ${baptism.father_surname}`.trim(),
                    mother_name: `${baptism.mother_first_name} ${baptism.mother_middle_name || ''} ${baptism.mother_surname}`.trim(),
                    pastor: baptism.pastor
                }]
            );
            await client.query('UPDATE baptisms SET archived = true WHERE id = $1', [baptism.id]);
        }
        await client.query('COMMIT');
        console.log(`Archived ${oldBaptisms.rows.length} baptisms`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive old baptisms error:', err.message, err.stack);
        throw err;
    } finally {
        client.release();
    }
}

// Archives weddings older than 3 years by moving them to the archives table
async function archiveOldWeddings() {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    console.log(`Archiving weddings with wedding_date before: ${threeYearsAgo.toISOString()}`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const oldWeddings = await client.query(
            'SELECT * FROM weddings WHERE wedding_date < $1 AND archived = false',
            [threeYearsAgo]
        );
        console.log(`Found ${oldWeddings.rows.length} weddings to archive`);
        for (const wedding of oldWeddings.rows) {
            const maxPalo = (await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM archives')).rows[0].max_palo;
            const archiveId = uuidv4();
            console.log(`Archiving wedding id: ${wedding.id} with archive id: ${archiveId}`);
            await client.query(
                'INSERT INTO archives (id, palo, record_type, details) VALUES ($1, $2, $3, $4)',
                [archiveId, parseInt(maxPalo) + 1, 'wedding', {
                    wedding_id: wedding.id,
                    groom_name: `${wedding.groom_first_name} ${wedding.groom_middle_name || ''} ${wedding.groom_surname}`.trim(),
                    bride_name: `${wedding.bride_first_name} ${wedding.bride_middle_name || ''} ${wedding.bride_surname}`.trim(),
                    wedding_date: wedding.wedding_date,
                    pastor: wedding.pastor,
                    location: wedding.location,
                    groom_id_number: wedding.groom_id_number,
                    bride_id_number: wedding.bride_id_number
                }]
            );
            await client.query('UPDATE weddings SET archived = true WHERE id = $1', [wedding.id]);
        }
        await client.query('COMMIT');
        console.log(`Archived ${oldWeddings.rows.length} weddings`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive old weddings error:', err.message, err.stack);
        throw err;
    } finally {
        client.release();
    }
}

// Authenticates JWT token from request headers
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.userId = decoded.userId;
        req.role = decoded.role;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Checks user permissions for a specific action based on role
function checkPermission(permission) {
    return function (req, res, next) {
        pool.query('SELECT * FROM roles WHERE role_name = $1', [req.role], (err, result) => {
            if (err) {
                console.error('Check permission error:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            if (result.rows.length === 0) {
                return res.status(403).json({ error: 'Role not found' });
            }
            if (!result.rows[0][permission]) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            next();
        });
    };
}

// Registers a new user with a username and password
app.post('/api/register/public', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, 'board_member']
        );
        await logAction(result.rows[0].id, 'register', { username });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Handles user login with username and password, returning a JWT token
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.SECRET_KEY, { expiresIn: '1d' });
        await logAction(user.id, 'login', { username });
        res.json({ token, role: user.role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Adds a new baptism record to the database
app.post('/api/baptisms', authenticate, checkPermission('can_add'), async (req, res) => {
    const {
        first_name, middle_name, surname, date_of_birth,
        father_first_name, father_middle_name, father_surname,
        mother_first_name, mother_middle_name, mother_surname,
        baptism_date, pastor
    } = req.body.baptism; // Adjusted to match client-side structure
    if (!first_name || !surname || !date_of_birth || !baptism_date || !pastor ||
        !father_first_name || !father_surname || !mother_first_name || !mother_surname) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            'INSERT INTO baptisms (first_name, middle_name, surname, date_of_birth, father_first_name, father_middle_name, father_surname, mother_first_name, mother_middle_name, mother_surname, baptism_date, pastor, archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false) RETURNING id',
            [
                first_name.trim(), middle_name ? middle_name.trim() : null, surname.trim(), date_of_birth,
                father_first_name.trim(), father_middle_name ? father_middle_name.trim() : null, father_surname.trim(),
                mother_first_name.trim(), mother_middle_name ? mother_middle_name.trim() : null, mother_surname.trim(),
                baptism_date, pastor.trim()
            ]
        );
        const baptismId = result.rows[0].id;
        await logAction(req.userId, 'add_baptism', {
            id: baptismId,
            name: `${first_name} ${middle_name || ''} ${surname}`.trim(),
            date_of_birth,
            baptism_date
        });
        await client.query('COMMIT');
        res.status(201).json({ message: 'Baptism recorded successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add baptism error:', err.message, err.stack);
        res.status(500).json({ error: `Server error: ${err.message}` });
    } finally {
        client.release();
    }
});

// Adds a new wedding record to the database, archiving if older than 3 years
app.post('/api/weddings', authenticate, checkPermission('can_add'), async (req, res) => {
    const {
        groom_first_name, groom_middle_name, groom_surname, groom_id_number,
        bride_first_name, bride_middle_name, bride_surname, bride_id_number,
        wedding_date, pastor, location
    } = req.body;
    if (!groom_first_name || !groom_surname || !bride_first_name || !bride_surname ||
        !wedding_date || !pastor || !location) {
        return res.status(400).json({ error: 'All required fields must be provided' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const weddingDate = new Date(wedding_date);
        const threeYearsAgo = new Date();
        threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
        console.log(`Checking wedding_date: ${weddingDate.toISOString()} against ${threeYearsAgo.toISOString()}`);
        const shouldArchive = weddingDate < threeYearsAgo;
        const result = await client.query(
            'INSERT INTO weddings (groom_first_name, groom_middle_name, groom_surname, groom_id_number, bride_first_name, bride_middle_name, bride_surname, bride_id_number, wedding_date, pastor, location, archived) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
            [
                groom_first_name.trim(),
                groom_middle_name ? groom_middle_name.trim() : null,
                groom_surname.trim(),
                groom_id_number ? groom_id_number.trim() : null,
                bride_first_name.trim(),
                bride_middle_name ? bride_middle_name.trim() : null,
                bride_surname.trim(),
                bride_id_number ? bride_id_number.trim() : null,
                wedding_date,
                pastor.trim(),
                location.trim(),
                shouldArchive
            ]
        );
        const weddingId = result.rows[0].id;
        if (shouldArchive) {
            const maxPalo = (await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM archives')).rows[0].max_palo;
            const archiveId = uuidv4();
            console.log(`Archiving new wedding id: ${weddingId} with archive id: ${archiveId}`);
            await client.query(
                'INSERT INTO archives (id, palo, record_type, details) VALUES ($1, $2, $3, $4)',
                [archiveId, parseInt(maxPalo) + 1, 'wedding', {
                    wedding_id: weddingId,
                    groom_name: `${groom_first_name} ${groom_middle_name || ''} ${groom_surname}`.trim(),
                    bride_name: `${bride_first_name} ${bride_middle_name || ''} ${bride_surname}`.trim(),
                    wedding_date: wedding_date,
                    pastor: pastor,
                    location: location,
                    groom_id_number: groom_id_number,
                    bride_id_number: bride_id_number
                }]
            );
        }
        await logAction(req.userId, 'add_wedding', {
            id: weddingId,
            groom_name: `${groom_first_name} ${groom_middle_name || ''} ${groom_surname}`.trim(),
            bride_name: `${bride_first_name} ${bride_middle_name || ''} ${bride_surname}`.trim(),
            wedding_date,
            archived: shouldArchive
        });
        await client.query('COMMIT');
        res.status(201).json({ message: 'Wedding recorded successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add wedding error:', err.message, err.stack);
        res.status(500).json({ error: `Server error: ${err.message}` });
    } finally {
        client.release();
    }
});

// Fetches non-archived baptism records with search and limit options
app.get('/api/baptisms', authenticate, checkPermission('can_view'), async (req, res) => {
    const limit = parseInt(req.query.limit) || 1000;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    try {
        await archiveOldBaptisms();
        const result = await pool.query(
            'SELECT * FROM baptisms WHERE (first_name ILIKE $1 OR surname ILIKE $1) AND archived = false ORDER BY baptism_date DESC LIMIT $2',
            [search, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch baptisms error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetches non-archived wedding records with search and limit options
app.get('/api/weddings', authenticate, checkPermission('can_view'), async (req, res) => {
    const limit = parseInt(req.query.limit) || 1000;
    const search = req.query.search ? `%${req.query.search}%` : '%';
    try {
        await archiveOldWeddings();
        const result = await pool.query(
            'SELECT * FROM weddings WHERE (groom_first_name ILIKE $1 OR groom_surname ILIKE $1 OR bride_first_name ILIKE $1 OR bride_surname ILIKE $1) AND archived = false ORDER BY wedding_date DESC LIMIT $2',
            [search, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch weddings error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Registers a new member with lebitso and fane
app.post('/api/members', authenticate, checkPermission('can_add'), async (req, res) => {
    const { lebitso, fane } = req.body;
    if (!lebitso || !fane || typeof lebitso !== 'string' || typeof fane !== 'string') {
        return res.status(400).json({ error: 'Valid lebitso and fane are required' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const maxPaloResult = await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM members');
        const palo = parseInt(maxPaloResult.rows[0].max_palo) + 1;
        console.log('Generated palo:', palo, 'for member:', { lebitso, fane });
        const result = await client.query(
            'INSERT INTO members (id, palo, lebitso, fane) VALUES ($1, $2, $3, $4) RETURNING id, palo',
            [uuidv4(), palo, lebitso.trim(), fane.trim()]
        );
        await logAction(req.userId, 'add_member', { id: result.rows[0].id, palo, lebitso, fane });
        await client.query('COMMIT');
        res.status(201).json({ message: 'Member registered successfully', palo });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Add member error:', err.message, err.stack);
        if (err.code === '23505') {
            res.status(400).json({ error: 'Palo already exists' });
        } else if (err.code === '22P02') {
            res.status(400).json({ error: 'Invalid palo format' });
        } else {
            res.status(500).json({ error: `Server error: ${err.message}` });
        }
    } finally {
        client.release();
    }
});

// Fetches member records with search and limit options
app.get('/api/members', authenticate, checkPermission('can_view'), async (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const limit = parseInt(req.query.limit) || 1000;
    const orderBy = req.query.limit ? 'palo DESC' : 'palo ASC';
    try {
        const result = await pool.query(
            `SELECT * FROM members WHERE lebitso ILIKE $1 OR fane ILIKE $1 OR palo::text ILIKE $1 ORDER BY ${orderBy} LIMIT $2`,
            [search, limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch members error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Updates a member's receipt for a specific year
app.put('/api/members/:palo/receipt', authenticate, checkPermission('can_update'), async (req, res) => {
    const { palo } = req.params;
    const { year, receipt } = req.body;
    if (!year || !receipt || !['2024', '2025', '2026', '2027', '2028', '2029', '2030'].includes(year)) {
        return res.status(400).json({ error: 'Valid year and receipt are required' });
    }
    try {
        const result = await pool.query(
            `UPDATE members SET receipt_${year} = $1 WHERE palo = $2`,
            [receipt, parseInt(palo)]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        await logAction(req.userId, 'update_receipt', { palo, year, receipt });
        res.json({ message: 'Receipt updated successfully' });
    } catch (err) {
        console.error('Update receipt error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Archives a member with a specified status (Moved or Deceased)
app.put('/api/members/:palo/archive', authenticate, checkPermission('can_archive'), async (req, res) => {
    const { palo } = req.params;
    const { status } = req.body;
    if (!['Moved', 'Deceased'].includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const memberResult = await client.query('SELECT * FROM members WHERE palo = $1', [parseInt(palo)]);
        if (memberResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Member not found' });
        }
        const member = memberResult.rows[0];
        const maxArchivePaloResult = await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM archives');
        const newArchivePalo = parseInt(maxArchivePaloResult.rows[0].max_palo) + 1;
        await client.query(
            'INSERT INTO archives (id, palo, record_type, details) VALUES ($1, $2, $3, $4)',
            [member.id, newArchivePalo, 'member', {
                lebitso: member.lebitso || '',
                fane: member.fane || '',
                status,
                receipts: {
                    2024: member.receipt_2024 || null,
                    2025: member.receipt_2025 || null,
                    2026: member.receipt_2026 || null,
                    2027: member.receipt_2027 || null,
                    2028: member.receipt_2028 || null,
                    2029: member.receipt_2029 || null,
                    2030: member.receipt_2030 || null
                }
            }]
        );
        await client.query('DELETE FROM members WHERE palo = $1', [parseInt(palo)]);
        await client.query('UPDATE members SET palo = palo - 1 WHERE palo > $1', [parseInt(palo)]);
        await logAction(req.userId, 'archive_member', { palo, status });
        await client.query('COMMIT');
        res.json({ message: `Member archived as ${status}` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Archive member error:', err.message, err.stack);
        res.status(500).json({ error: `Server error: ${err.message}` });
    } finally {
        client.release();
    }
});

// Fetches user list for admin purposes
app.get('/api/admin/users', authenticate, checkPermission('can_view'), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Updates the role of a specific user
app.put('/api/admin/users/:id/role', authenticate, checkPermission('can_update'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const roleResult = await pool.query('SELECT * FROM roles WHERE role_name = $1', [role]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        await logAction(req.userId, 'update_role', { userId: id, role });
        res.json({ message: 'Role updated successfully' });
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetches all roles for admin purposes
app.get('/api/admin/roles', authenticate, checkPermission('can_view'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles');
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch roles error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Adds a new role with specified permissions
app.post('/api/admin/roles', authenticate, checkPermission('can_add'), async (req, res) => {
    const { role_name, can_view, can_add, can_update, can_archive } = req.body;
    if (!role_name || typeof can_view !== 'boolean' || typeof can_add !== 'boolean' ||
        typeof can_update !== 'boolean' || typeof can_archive !== 'boolean') {
        return res.status(400).json({ error: 'Valid role name and permissions are required' });
    }
    try {
        await pool.query(
            'INSERT INTO roles (role_name, can_view, can_add, can_update, can_archive) VALUES ($1, $2, $3, $4, $5)',
            [role_name, can_view, can_add, can_update, can_archive]
        );
        await logAction(req.userId, 'add_role', { role_name });
        res.status(201).json({ message: 'Role added successfully' });
    } catch (err) {
        console.error('Add role error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetches action logs for admin purposes
app.get('/api/admin/action_logs', authenticate, checkPermission('can_view'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT al.id, u.username, al.action, al.details, al.timestamp FROM action_logs al JOIN users u ON al.user_id = u.id ORDER BY al.timestamp DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch action logs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetches archived records with search capability
app.get('/api/archives', authenticate, checkPermission('can_view'), async (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    try {
        await archiveOldBaptisms();
        await archiveOldWeddings();
        const result = await pool.query(
            'SELECT * FROM archives WHERE details->>\'lebitso\' ILIKE $1 OR details->>\'fane\' ILIKE $1 OR details->>\'name\' ILIKE $1 OR details->>\'groom_name\' ILIKE $1 OR details->>\'bride_name\' ILIKE $1 OR palo::text ILIKE $1 ORDER BY palo ASC',
            [search]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch archives error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Restores an archived member record to the members table
app.put('/api/archives/:id/restore', authenticate, checkPermission('can_archive'), async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const archiveResult = await client.query('SELECT * FROM archives WHERE id = $1', [id]);
        if (archiveResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Archive record not found' });
        }
        const archive = archiveResult.rows[0];
        if (archive.record_type !== 'member') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Restore is only supported for member records' });
        }
        const maxPaloResult = await client.query('SELECT COALESCE(MAX(palo), 0) AS max_palo FROM members');
        const newPalo = parseInt(maxPaloResult.rows[0].max_palo) + 1;
        console.log(`Restoring member with archive id: ${id}, new palo: ${newPalo}`);
        
        // Validate archive.details
        if (!archive.details.lebitso || typeof archive.details.lebitso !== 'string') {
            console.error('Invalid lebitso:', archive.details.lebitso);
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or missing lebitso in archive details' });
        }
        if (!archive.details.fane || typeof archive.details.fane !== 'string') {
            console.error('Invalid fane:', archive.details.fane);
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid or missing fane in archive details' });
        }
        const receipts = archive.details.receipts || {
            2024: null, 2025: null, 2026: null, 2027: null, 2028: null, 2029: null, 2030: null
        };
        // Validate receipts
        const years = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];
        for (const year of years) {
            if (receipts[year] !== null && typeof receipts[year] !== 'string') {
                console.error(`Invalid receipt for ${year}:`, receipts[year]);
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Invalid receipt value for ${year}` });
            }
        }
        
        const queryText = `
            INSERT INTO members (
                id, palo, lebitso, fane,
                receipt_2024, receipt_2025, receipt_2026, receipt_2027,
                receipt_2028, receipt_2029, receipt_2030
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        const queryValues = [
            uuidv4(),
            newPalo,
            archive.details.lebitso,
            archive.details.fane,
            receipts['2024'],
            receipts['2025'],
            receipts['2026'],
            receipts['2027'],
            receipts['2028'],
            receipts['2029'],
            receipts['2030']
        ];
        console.log('Executing query:', queryText);
        console.log('Query values:', queryValues);
        
        await client.query(queryText, queryValues);
        await client.query('DELETE FROM archives WHERE id = $1', [id]);
        await logAction(req.userId, 'restore_member', {
            palo: newPalo,
            lebitso: archive.details.lebitso,
            fane: archive.details.fane
        });
        await client.query('COMMIT');
        console.log(`Member restored successfully: palo ${newPalo}`);
        res.json({ message: 'Record restored successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Restore archive error:', {
            message: err.message,
            stack: err.stack,
            archiveId: id,
            details: err.detail || 'No additional details',
            code: err.code || 'No error code',
            archiveDetails: archive ? archive.details : 'No archive details'
        });
        if (err.code === '23502') {
            res.status(400).json({ error: `Missing required field: ${err.column || 'unknown'}` });
        } else if (err.code === '23505') {
            res.status(400).json({ error: 'Duplicate palo or id' });
        } else if (err.code === '22P02') {
            res.status(400).json({ error: 'Invalid data format' });
        } else {
            res.status(500).json({ error: `Server error: ${err.message}` });
        }
    } finally {
        client.release();
    }
});

// Handles 404 errors for undefined endpoints
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Starts the server on the specified port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
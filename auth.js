const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const authMiddleware= require('./authMiddleware');

const router = express.Router();

router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = await pool.query(
            'INSERT INTO Users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, passwordHash]
        );

        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error(error.message);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Email already in use.' });
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const userResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const payload = {
            user: {
                id: user.id,
                email: user.email,
            },
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1d' },
            (err, token) => {
                if (err) throw err;
                res.cookie('token', token, {
                    httpOnly: true, 
                    secure:true, 
                    sameSite: 'None', 
                    maxAge: 24 * 60 * 60 * 1000, 
                });
                res.status(200).json({ message: 'Logged in successfully.' });
            }
        );
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    res.status(200).json(req.user);
});


router.post('/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0), 
    });
    res.status(200).json({ message: 'Logged out successfully.' });
});


module.exports = router;
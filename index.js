require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser'); 
const pool = require('./db'); 
const authRoutes = require('./auth'); 
const authMiddleware = require('./authMiddleware'); 

const app = express();
const port = 4000;

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true, 
}));
app.use(express.json()); 
app.use(cookieParser()); 

app.use('/api/auth', authRoutes); 


app.get('/api/leads', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching leads for user:', req.user.email);
    const allLeads = await pool.query('SELECT * FROM Leads'); 
    res.json(allLeads.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
require('dotenv').config();
const express = require('express');
const qs = require('qs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./auth');
const leadRoutes = require('./leads');
const authMiddleware = require('./authMiddleware');

const app = express();
const port = process.env.PORT || 3001;

app.set('query parser', (str) => {
  return qs.parse(str, { allowPrototypes: true });
});

const allowedOrigins = [
  "http://localhost:5173",
  "https://erico-lead-management-system.vercel.app"
]
// console.log('CORS_ORIGIN from .env:', process.env.CORS_ORIGIN);
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/ping', (req, res) => {
  console.log("Server pinged!");
  res.json({ 
    message: 'Server is running!', 
    timestamp: new Date().toISOString(),
    status: 'OK'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', authMiddleware, leadRoutes);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
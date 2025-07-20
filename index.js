const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json()); // สำหรับรับ JSON
app.use(bodyParser.urlencoded({ extended: true }));

// เชื่อมต่อฐานข้อมูล
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',       // เปลี่ยนให้ตรงกับเครื่องคุณ
  password: '',       // ใส่รหัสผ่านของคุณ
  database: 'temp_db'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Connected to MySQL');
});

// รับค่าจาก ESP32
app.post('/api/temperature', (req, res) => {
  const { temperature } = req.body;

  if (!temperature) return res.status(400).send('Missing value');

  const query = 'INSERT INTO temperature_logs (value) VALUES (?)';
  db.query(query, [temperature], (err, result) => {
    if (err) {
      console.error('❌ Error inserting data:', err);
      return res.sendStatus(500);
    }

    console.log(`✅ Temperature ${temperature} inserted`);
    res.sendStatus(200);
  });
});


app.use(express.static('public'));
// API: ค่า temperature ล่าสุด
app.get('/api/latest-value', (req, res) => {
  const query = 'SELECT * FROM temperature_logs ORDER BY timestamp DESC LIMIT 1';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results[0]);
  });
});

// API: temperature 100 ค่า ล่าสุด
app.get('/api/history', (req, res) => {
  const query = 'SELECT * FROM temperature_logs ORDER BY timestamp DESC LIMIT 100';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    // เรียงจากเก่า → ใหม่
    res.json(results.reverse());
  });
});
// GET รายงานย้อนหลัง (รายวัน / รายเดือน)
app.get('/api/report', (req, res) => {
  const dailyQuery = `
    SELECT DATE(timestamp) AS date,
           MAX(value) AS max,
           MIN(value) AS min,
           AVG(value) AS avg
    FROM temperature_logs
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp) DESC
    LIMIT 30
  `;

  const monthlyQuery = `
    SELECT DATE_FORMAT(timestamp, '%Y-%m') AS date,
           MAX(value) AS max,
           MIN(value) AS min,
           AVG(value) AS avg
    FROM temperature_logs
    GROUP BY DATE_FORMAT(timestamp, '%Y-%m')
    ORDER BY date DESC
    LIMIT 12
  `;

  db.query(dailyQuery, (err, dailyResults) => {
    if (err) {
      console.error('❌ Daily Query Error:', err);
      return res.sendStatus(500);
    }

    db.query(monthlyQuery, (err, monthlyResults) => {
      if (err) {
        console.error('❌ Monthly Query Error:', err);
        return res.sendStatus(500);
      }

      res.json({
        daily: dailyResults,
        monthly: monthlyResults
      });
    });
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});



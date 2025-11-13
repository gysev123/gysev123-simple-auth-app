const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));
require("dotenv").config();

const PORT = process.env.PORT || 3000;

const autoRoutes = require("./routes/auth.js");

app.use(express.static("public"));
app.use("/", autoRoutes);

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`сервер запущен на http://localhost:${PORT}`);
});


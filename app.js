const express = require("express");
const session = require("express-session");
const app = express();
app.use(express.urlencoded({ extended: true }));
require("dotenv").config();

const PORT = process.env.PORT || 3000;

const autoRoutes = require("./routes/auth.js");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

app.use(express.static("public"));
app.use("/", autoRoutes);

app.listen(PORT, () => {
  console.log(`сервер запущен на http://localhost:${PORT}`);
});

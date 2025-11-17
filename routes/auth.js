const express = require("express");
const router = express.Router();
const { verifyUser, registerUser, decrypt } = require("../auth");
const path = require("path");
const pool = require("../bd.js");
const { error } = require("console");

const attempts = {};
const BLOCK_DURATION = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const startTime = Date.now();

const main = path.join(__dirname, "../public/html", "index.html");
const login = path.join(__dirname, "../public/html", "login.html");
const register = path.join(__dirname, "../public/html", "register.html");
const profile = path.join(__dirname, "../public/html", "profile.html");

router.get("/", (req, res) => {
  res.sendFile(main);
});

router.get("/login", (req, res) => {
  res.sendFile(login);
});

router.get("/register", (req, res) => {
  res.sendFile(register);
});

router.get("/profile", (req, res) => {
  res.sendFile(profile);
});

router.post("/reg", async (req, res) => {
  const { login, password, email } = req.body;
  console.log(req.body)

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ Passworderror });
  }

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ Emailderror });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ loginerror });
  }

  try {
    const result = await registerUser(login, password, email);
    res.json({ success: result });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/status", async (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;


  const activeSessions = Object.keys(
    require("express-session").sessions || {}
  ).length;

  try {
    await pool.query('SELECT NOW()');
    bd = "connected";
  } catch (err) {
    console.log(err);
    bd = "disconnected"
  }

  res.json({
    status: "OK",
    uptime: `${hours}ч ${minutes}м ${seconds}с`,
    activeSessions: activeSessions,
    database: bd,
  });
});

router.post("/log", async (req, res) => {
  const { login, password } = req.body;

  const blockError = blockCheck(login);
  if (blockError) {
    return res.status(429).json({ error: blockError });
  }

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ Passworderror });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ loginerror });
  }

  try {
    const result = await verifyUser(login, password);
    if (result == false) {
      if (!attempts[login]) {
        attempts[login] = { count: 1, firstAttempt: Date.now() };
      } else {
        attempts[login].count++;
      }
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    delete attempts[login];
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    req.session.userId = result;
    req.session.login = login;
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.get("/SessionData", (req, res) => {
  let sessionData = {};
  console.log(req.session.userId)
  if (req.session.userId) {
    pool.query('SELECT email FROM users WHERE id = $1', [req.session.userId])
    .then(async result => {
      const emailCrypto = result.rows[0];
      console.log(emailCrypto)
      const email = decrypt(emailCrypto);

    sessionData = {
      userId: req.session.userId,
      login: req.session.login,
      email,
    };
  res.json(sessionData);
  }).catch(error => {
    console.log(error)
  })
  }else res.json(null)
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
    res.json({ success: true }); 
  });
});

function validateEmail(email) {
  if (email.length < 3) return "email слишком короткий";
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return "Email должен соответствовать виду example@email.com";
  return null;
}

function validateLogin(login) {
  if (login.length < 3) return "Логин слишком короткий";
  if (!/^[a-zA-Z0-9]+$/.test(login)) return "Только латиница и цифры";
  return null;
}

function validatePassword(password) {
  if (password.length < 8) {
    return "Пароль должен быть минимм 8 символов";
  }
  if (!/\d/.test(password)) {
    return "Пароль должен содержать цифру";
  }
  return null;
}

function blockCheck(login) {
  const userAttempts = attempts[login];
  if (userAttempts) {
    const timePassed = Date.now() - userAttempts.firstAttempt;
    if (timePassed < BLOCK_DURATION && userAttempts.count >= MAX_ATTEMPTS) {
      return `Слишком много попыток. Попробуйте через ${Math.ceil(
        (BLOCK_DURATION - timePassed) / 60000
      )} минут`;
    }
    if (timePassed >= BLOCK_DURATION) {
      delete attempts[login];
    }
  }
}

module.exports = router;

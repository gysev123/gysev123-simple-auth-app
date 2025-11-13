const express = require("express");
const router = express.Router();
const { verifyUser, registerUser } = require("../auth");
const path = require("path");

const attempts = {};
const BLOCK_DURATION = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const main = path.join(__dirname, "../public/html", "index.html");
const login = path.join(__dirname, "../public/html", "login.html");
const register = path.join(__dirname, "../public/html", "register.html");

router.get("/", (req, res) => {
  res.sendFile(main);
});

router.get("/login", (req, res) => {
  res.sendFile(login);
});

router.get("/register", (req, res) => {
  res.sendFile(register);
});

router.post("/reg", async (req, res) => {
  const { login, password } = req.body;

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ Passworderror });
  }

  try {
    const result = await registerUser(login, password);
    res.json({ success: result });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
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

  try {
    const result = await verifyUser(login, password);
    if (!result) {
      if (!attempts[login]) {
        attempts[login] = { count: 1, firstAttempt: Date.now() };
      } else {
        attempts[login].count++;
      }
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    delete attempts[login];
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

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

const express = require("express");
const router = express.Router();
const {
  verifyUser,
  registerUser,
  decrypt,
  hashing,
  comparePassword,
  randomBytes,
  hash256,
  encrypt,
} = require("../auth");
const path = require("path");
const pool = require("../bd.js");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.email,
    pass: process.env.passwordemail,
  },
});

const attempts = {};
const BLOCK_DURATION = 15 * 60 * 1000;
const emailattempts = {};
const MAX_ATTEMPTS_email = 3;
const BLOCK_DURATION_EMAIL = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const tokenAge = 10 * 60 * 1000;

const startTime = Date.now();

const main = path.join(__dirname, "../public/html", "index.html");
const login = path.join(__dirname, "../public/html", "login.html");
const register = path.join(__dirname, "../public/html", "register.html");
const profile = path.join(__dirname, "../public/html", "profile.html");
const resetPassword = path.join(
  __dirname,
  "../public/html",
  "resetpassword.html"
);
const changePassword = path.join(
  __dirname,
  "../public/html",
  "/change-password.html"
);

const changeEmail = path.join(
  __dirname,
  "../public/html",
  "/change-email.html"
);

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

router.get("/changepassword", (req, res) => {
  res.sendFile(changePassword);
});

router.get("/resetpassword", (req, res) => {
  res.sendFile(resetPassword);
});

router.get("/changeemail", (req, res) => {
  res.sendFile(changeEmail);
});

router.post("/reg", async (req, res) => {
  const { login, password, email } = req.body;

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ error: Passworderror });
  }

  if (req.session.emailconfirm !== true || email !== req.session.email) {
    return res.status(401).json({ error: "подтвердите почту" });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ error: loginerror });
  }

  const result = await registerUser(login, password, email);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
  });

  return res.status(200).json({ success: true, userId: result.userId });
});

router.post("/send-confirmation", async (req, res) => {
  const { login, email } = req.body;

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ error: Emailderror });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ error: loginerror });
  }

  const email_hash = hash256(email);
  const result = await pool.query(
    "SELECT id FROM users WHERE login = $1 OR email_hash = $2",
    [login, email_hash]
  );

  if (result.rows.length > 0) {
    return res.status(401).json({ error: "Логин или почта уже заняты" });
  }

  const token = randomBytes(3);
  const token_hash = hash256(token);
  const expires_at = new Date(Date.now() + tokenAge);

  await pool.query("DELETE FROM email_confirm WHERE email_hash = $1", [
    email_hash,
  ]);

  await pool.query(
    "INSERT INTO email_confirm (token_hash, expires_at, email_hash) VALUES ($1, $2, $3)",
    [token_hash, expires_at, email_hash]
  );

  const blockEmail = emaillimit(email);
  if (blockEmail) {
    return res.status(429).json({ error: blockEmail });
  }

  await confirmemail(email, login, token, "confirm");

  if (!emailattempts[email]) {
    emailattempts[email] = { count: 1, firstAttempt: Date.now() };
  } else {
    emailattempts[email].count++;
  }

  res.status(200).json({ success: "токен отправлен на почту" });
});

router.post("/verify-email", async (req, res) => {
  const { token, email } = req.body;

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ error: Emailderror });
  }

  const Tokenderror = validateToken(token);
  if (Tokenderror) {
    return res.status(401).json({ error: Tokenderror });
  }

  const email_hash = hash256(email);
  const result = await pool.query(
    "SELECT * FROM email_confirm WHERE email_hash = $1",
    [email_hash]
  );

  if (result.rows.length === 0) {
    return res.status(410).json({ error: "токен устарел" });
  }
  const { expires_at, token_hash } = result.rows[0];

  if (expires_at < new Date()) {
    await pool.query("DELETE FROM email_confirm WHERE expires_at < NOW()");

    return res
      .status(410)
      .json({ error: "токен устарел, запросите новый токен" });
  }

  const token_hash_user = hash256(token);
  if (token_hash_user !== token_hash) {
    return res.status(401).json({ error: "не верный токен" });
  }

  req.session.emailconfirm = true;
  req.session.email = email;

  return res.status(200).json({ success: "почта подтверждена" });
});

router.post("/password-check", async (req, res) => {
  const password = req.body.password;

  if (!req.session.login) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const login = req.session.login;

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ error: Passworderror });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ error: loginerror });
  }

  try {
    const result = await verifyUser(login, password);
    if (result == false) {
      return res.status(401).json({ error: "Неверный пароль" });
    }
    req.session.passwordCheck = true;
    return res.status(200).json({ success: "успешно" });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/change-email", async (req, res) => {
  const email = req.body.email;

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ error: Emailderror });
  }

  const email_hash = hash256(email);
  const result = await pool.query(
    "SELECT id FROM users WHERE email_hash = $1",
    [email_hash]
  );

  if (result.rows.length > 0) {
    return res.status(401).json({ error: "Почта уже занятя" });
  }

  const token = randomBytes(3);
  const token_hash = hash256(token);
  const expires_at = new Date(Date.now() + tokenAge);

  await pool.query("DELETE FROM email_confirm WHERE email_hash = $1", [
    email_hash,
  ]);

  await pool.query(
    "INSERT INTO email_confirm (token_hash, expires_at, email_hash) VALUES ($1, $2, $3)",
    [token_hash, expires_at, email_hash]
  );

  const blockEmail = emaillimit(email);
  if (blockEmail) {
    return res.status(429).json({ error: blockEmail });
  }

  await confirmemail(email, req.session.login, token, "confirm");
  req.session.changeEmail = email;
  if (!emailattempts[email]) {
    emailattempts[email] = { count: 1, firstAttempt: Date.now() };
  } else {
    emailattempts[email].count++;
  }

  res.status(200).json({ success: "токен отправлен на почту" });
});

router.post("/change-email-final", async (req, res) => {
  const { email, token } = req.body;

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ error: Emailderror });
  }

  const Tokenderror = validateToken(token);
  if (Tokenderror) {
    return res.status(401).json({ error: Tokenderror });
  }

  if (email !== req.session.changeEmail || req.session.passwordCheck !== true) {
    return res
      .status(401)
      .json({ error: "ошибка смены почты, повторите позже" });
  }

  const email_hash = hash256(email);
  const result = await pool.query(
    "SELECT * FROM email_confirm WHERE email_hash = $1",
    [email_hash]
  );

  if (result.rows.length === 0) {
    return res.status(410).json({ error: "токен устарел" });
  }
  const { expires_at, token_hash } = result.rows[0];

  if (expires_at < new Date()) {
    await pool.query("DELETE FROM email_confirm WHERE expires_at < NOW()");

    return res
      .status(410)
      .json({ error: "токен устарел, запросите новый токен" });
  }

  const token_hash_user = hash256(token);
  if (token_hash_user !== token_hash) {
    return res.status(401).json({ error: "не верный токен" });
  }

  const emailCrypto = await encrypt(email);

  await pool.query(
    "UPDATE users SET email = $1, email_hash = $2 WHERE id = $3",
    [emailCrypto, email_hash, req.session.userId]
  );

  delete req.session.passwordCheck;
  delete req.session.changeEmail;

  return res
    .status(200)
    .json({ success: "Адрес электронной почты успешно обновлён" });
});

router.get("/status", async (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  const activeSessions = Object.keys(req.session || {}).length;

  try {
    await pool.query("SELECT NOW()");
    bd = "connected";
  } catch (err) {
    console.log("Ошибка бд:" + err);
    bd = "disconnected";
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
    return res.status(400).json({ error: Passworderror });
  }

  const loginerror = validateLogin(login);
  if (loginerror) {
    return res.status(400).json({ error: loginerror });
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
    return res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/change-password", async (req, res) => {
  const { oldpassword, newpassword } = req.body;
  const { login, userId } = req.session;

  const blockError = blockCheck(login);
  if (blockError) {
    return res.status(429).json({ error: blockError });
  }

  const error = validatePassword(newpassword);
  if (error) {
    return res.status(400).json({ error });
  }
  if (newpassword == oldpassword) {
    return res
      .status(400)
      .json({ error: "новый пароль не должен совпадать с текущим" });
  }

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );
    const password_hash = result.rows[0].password_hash;
    const coincidence = await comparePassword(oldpassword, password_hash);
    if (coincidence == false) {
      if (!attempts[login]) {
        attempts[login] = { count: 1, firstAttempt: Date.now() };
      } else {
        attempts[login].count++;
      }
      return res.status(401).json({ error: "Неверный пароль" });
    } else {
      const newpassword_hash = await hashing(newpassword);
      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        newpassword_hash,
        userId,
      ]);
      req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: "Ошибка сервера" });
        res.json({ success: true });
      });
    }
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

router.post("/password-resets", async (req, res) => {
  const email = req.body.email;

  const Emailderror = validateEmail(email);
  if (Emailderror) {
    return res.status(400).json({ error: Emailderror });
  }
  const email_hash = hash256(email);

  const result = await pool.query(
    "SELECT id, login FROM users WHERE email_hash = $1",
    [email_hash]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Пользователь не найден" });
  }

  const { id, login } = result.rows[0];
  const token = randomBytes(3);
  const token_hash = hash256(token);
  const expires_at = new Date(Date.now() + tokenAge);

  req.session.cookie.maxAge = tokenAge;
  req.session.resetpasswordid = id;
  req.session.resetpasswordlogin = login;
  req.session.resettoken = false;

  await pool.query("DELETE FROM password_resets WHERE user_id = $1", [id]);

  await pool.query(
    "INSERT INTO password_resets (user_id, token_hash, expires_at, email_hash) VALUES ($1, $2, $3, $4)",
    [id, token_hash, expires_at, email_hash]
  );

  const blockEmail = emaillimit(email);
  if (blockEmail) {
    return res.status(429).json({ error: blockEmail });
  }

  try {
    await confirmemail(login, email, token, "reset");
    if (!emailattempts[email]) {
      emailattempts[email] = { count: 1, firstAttempt: Date.now() };
    } else {
      emailattempts[email].count++;
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error });
  }

  return res.status(200).json({ success: true });
});

router.post("/tokencheck", async (req, res) => {
  const token = req.body.token;

  const Tokenderror = validateToken(token);
  if (Tokenderror) {
    return res.status(401).json({ error: Tokenderror });
  }

  if (!req.session) {
    return res.status(410).json({ error: "токен истек" });
  }

  const { resetpasswordid, resetpasswordlogin } = req.session;

  const blockError = blockCheck(resetpasswordlogin);
  if (blockError) {
    return res.status(429).json({ error: blockError });
  }

  const result = await pool.query(
    "SELECT * FROM password_resets WHERE user_id = $1",
    [resetpasswordid]
  );
  const { token_hash, expires_at } = result.rows[0];

  if (expires_at < Date.now()) {
    await pool.query("DELETE FROM password_resets WHERE expires_at < NOW()");
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Ошибка сервера" });
      res.json({ success: true });
    });
    return res.status(410).json({ error: "токен истек" });
  }

  const tokenhash = hash256(token);

  if (tokenhash !== token_hash) {
    if (!attempts[resetpasswordlogin]) {
      attempts[resetpasswordlogin] = { count: 1, firstAttempt: Date.now() };
    } else {
      attempts[resetpasswordlogin].count++;
    }
    return res.status(401).json({ error: "Неверный токен" });
  } else {
    req.session.resettoken = true;
    return res.status(200).json({ success: true });
  }
});

router.post("/confirmpasswordreset", async (req, res) => {
  const { password } = req.body;

  if (!req.session) {
    return res.status(410).json({ error: "токен истек" });
  }

  const Passworderror = validatePassword(password);
  if (Passworderror) {
    return res.status(400).json({ Passworderror });
  }

  const { resetpasswordid } = req.session;

  const result = await pool.query(
    "SELECT users.email_hash AS user_email_hash, password_resets.email_hash AS reset_email_hash, expires_at FROM users JOIN password_resets ON users.id = password_resets.user_id WHERE users.id = $1",
    [resetpasswordid]
  );

  const userHash = result.rows[0].user_email_hash;
  const resetHash = result.rows[0].reset_email_hash;
  const expires_at = result.rows[0].expires_at;

  if (userHash !== resetHash || expires_at < new Date()) {
    await pool.query("DELETE FROM password_resets WHERE expires_at < NOW()");

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Ошибка сервера" });
      }
      return res
        .status(410)
        .json({ error: "Данные устарели, запросите новый токен" });
    });
  }

  const password_hash = await hashing(password);

  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    password_hash,
    resetpasswordid,
  ]);

  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
  });

  res.status(200).json({ success: "пароль изменен" });
});

router.get("/SessionData", (req, res) => {
  let sessionData = {};
  if (req.session.userId) {
    pool
      .query("SELECT email FROM users WHERE id = $1", [req.session.userId])
      .then(async (result) => {
        const emailCrypto = result.rows[0];
        const email = decrypt(emailCrypto);

        sessionData = {
          userId: req.session.userId,
          login: req.session.login,
          email,
        };
        return res.json(sessionData);
      })
      .catch((error) => {
        console.log(error);
      });
  } else return res.json(null);
});

router.get("/SessionDataReset", (req, res) => {
  let sessionData = {};
  if (req.session.resetpasswordid) {
    sessionData = {
      resetPasswordid: req.session.resetPasswordid,
      resettoken: req.session.resettoken,
    };
    return res.json(sessionData);
  } else res.json(null);
});

async function confirmemail(email, login, token, type) {
  switch (type) {
    case "reset":
      transporter.sendMail({
        from: {
          name: "gysev-auth-app",
          address: process.env.email,
        },
        to: email,
        subject: "reset password",
        text: `ваш токен для востановления пароля от ${login}: "${token}"`,
      });
      break;
    case "confirm":
      transporter.sendMail({
        from: {
          name: "gysev-auth-app",
          address: process.env.email,
        },
        to: email,
        subject: "confirm email",
        text: `ваш токен для подтверждения почты от ${login}: "${token}"`,
      });
      break;
    case "change":
      transporter.sendMail({
        from: {
          name: "gysev-auth-app",
          address: process.env.email,
        },
        to: email,
        subject: "change email",
        text: `ваш токен для смены почты от ${login}: "${token}"`,
      });
      break;
  }
}

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Ошибка сервера" });
    return res.json({ success: true });
  });
});

function validateToken(token) {
  if (token.length < 6 || !/^[a-zA-Z0-9]+$/.test(token))
    return "Неверный токен";
  return null;
}

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

function emaillimit(email) {
  const emailAttempts = emailattempts[email];
  if (emailAttempts) {
    const timePassed = Date.now() - emailAttempts.firstAttempt;
    if (
      timePassed < BLOCK_DURATION_EMAIL &&
      emailAttempts.count >= MAX_ATTEMPTS_email
    ) {
      return `Слишком много попыток. Попробуйте через ${Math.ceil(
        (BLOCK_DURATION_EMAIL - timePassed) / 60000
      )} минут`;
    }
    if (timePassed >= BLOCK_DURATION_EMAIL) {
      delete emailattempts[email];
    }
  }
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

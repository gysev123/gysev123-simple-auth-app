const bcrypt = require("bcrypt");
const pool = require("./bd.js");
const crypto = require("crypto");
const { Buffer } = require("buffer");
const algorithm = "aes-256-cbc";
require("dotenv").config();
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  return hash;
};

const comparePassword = async (oldpassword, oldpassword_hash) => {
  const check = await bcrypt.compare(oldpassword, oldpassword_hash);
  return check;
};

async function registerUser(login, password, email) {
  const hash = await hashPassword(password);
  const emailCrypto = await encrypt(email);
  const result = await pool.query(
    "INSERT INTO users (login, password_hash, created_at, email) VALUES ($1, $2, $3, $4) RETURNING id",
    [login, hash, new Date(), emailCrypto]
  );
  return result.rows[0].id;
}

async function verifyUser(login, password) {
  const result = await pool.query("SELECT * FROM users WHERE login = $1", [
    login,
  ]);
  if (result.rows.length === 0) return false;
  x;
  const user = result.rows[0];
  const check = await bcrypt.compare(password, user.password_hash);
  return check ? user.id : false;
}

async function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const dataAndIv = iv.toString("hex") + ":" + encrypted.toString("hex");
  return dataAndIv;
}

function decrypt(encryptedData) {
  const parts = encryptedData.email.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = {
  verifyUser,
  registerUser,
  decrypt,
  hashPassword,
  comparePassword,
};

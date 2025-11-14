const bcrypt = require("bcrypt");
const pool = require("./bd.js");
const { hashPassword } = require("./hash.js");

async function registerUser(login, password) {
  const hash = await hashPassword(password);
  const result = await pool.query(
    "INSERT INTO users (login, password_hash, created_at) VALUES ($1, $2, $3) RETURNING id",
    [login, hash, new Date()]
  );
  return result.rows[0].id;
}

async function verifyUser(login, password) {
  const result = await pool.query("SELECT * FROM users WHERE login = $1", [
    login,
  ]);
  if (result.rows.length === 0) return false;

  const user = result.rows[0];
  const check = await bcrypt.compare(password, user.password_hash); // Добавил await
  return check ? user.id : false;
}
module.exports = { verifyUser, registerUser };

const bcrypt = require("bcrypt");

const hashPassword = async (plainPassword) => {
  const saltRounds = 10;
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  return hash;
};

module.exports = { hashPassword };

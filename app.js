const express = require("express");
const app = express();
app.use(express.urlencoded({ extended: true }));
require("dotenv").config();

const PORT = process.env.PORT || 3000;

const autoRoutes = require("./routes/auth.js");

app.use(express.static("public"));
app.use("/", autoRoutes);

app.listen(PORT, () => {
  console.log(`сервер запущен на http://localhost:${PORT}`);
});




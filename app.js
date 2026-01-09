const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
require("dotenv").config();

// 1. Initial Config
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. Static Files
app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 3. Handlebars
app.engine("handlebars", exphbs.engine({
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views/layouts"),
  helpers: {
    eq: (a, b) => a === b,
    or: (a, b) => a || b,
    json: (context) => JSON.stringify(context)
  }
}));
app.set("view engine", "handlebars");

// 4. Routes
const routes = require('./src/routes/index');
app.use('/', routes);

// 5. Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));

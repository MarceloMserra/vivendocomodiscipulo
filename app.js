const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");
require("dotenv").config();

const cookieParser = require("cookie-parser");

// 1. Initial Config
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// DEBUG MIDDLEWARE
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

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
    json: (context) => JSON.stringify(context),
    initials: (name) => (name || "U").split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase(),
    firstName: (name) => (name || "").split(' ')[0]
  }
}));
app.set("view engine", "handlebars");

// 4. Routes
// 4. Routes
const routes = require('./src/routes/index');
const meetingRoutes = require('./src/routes/meetingRoutes');
app.use('/', routes);
app.use('/monitoring', meetingRoutes);

// 5. Start Server
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));

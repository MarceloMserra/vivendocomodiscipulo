const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load from root of v2

// Import Routes
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
// const adminRoutes = require('./routes/admin'); // We will create this
// const contentRoutes = require('./routes/content'); // We will create this

const app = express();

// --- Configs ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static Files
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads'))); // Note: we might need to link to original uploads or create new

// Handlebars
app.engine('handlebars', exphbs.engine({
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '../views/layouts'),
    partialsDir: path.join(__dirname, '../views/partials'),
    helpers: {
        eq: (a, b) => a === b,
        json: (context) => JSON.stringify(context)
    }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, '../views'));

// --- Routes ---
app.use('/', indexRoutes);
app.use('/api', apiRoutes);
// app.use('/admin', adminRoutes);
// app.use('/content', contentRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 V2 Running on http://localhost:${PORT}`));

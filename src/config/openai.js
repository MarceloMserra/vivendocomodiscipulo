const OpenAI = require("openai");
require("dotenv").config(); // Ensure env vars are loaded

if (!process.env.OPENAI_API_KEY) console.error("❌ OPENAI_API_KEY não encontrado.");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

module.exports = openai;

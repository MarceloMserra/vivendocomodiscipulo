const express = require("express");
const exphbs = require("express-handlebars");
const multer = require("multer");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-extraction");
const OpenAI = require("openai");
const admin = require("firebase-admin");
require("dotenv").config();

// --- 1. CONFIGURAÇÕES INICIAIS ---
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Pastas Públicas
app.use(express.static("public"));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- 2. CONFIGURAÇÃO DE UPLOADS ---

const uploadPDF = multer({
  dest: path.join(__dirname, "uploads_temp"),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Apenas arquivo PDF."));
  },
});

const storageProfile = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, "public/uploads/profiles");
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "_" + file.originalname.replace(/\s+/g, '_'));
    }
});
const uploadImage = multer({ 
    storage: storageProfile,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Apenas imagens."));
    }
});

// --- 3. FIREBASE ---
let db = null;
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  db = admin.firestore();
  console.log("✅ Firebase conectado!");
} catch (error) {
  console.error("❌ Erro no Firebase:", error.message);
}

// --- 4. OPENAI (CHATGPT) ---
if (!process.env.OPENAI_API_KEY) console.error("❌ OPENAI_API_KEY não encontrado.");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- 5. HANDLEBARS ---
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

// --- 6. FUNÇÃO DE IA (GPT-4o) ---
async function processWithChatGPT(textoDoPDF) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // USANDO O MODELO MAIS POTENTE
            messages: [
                {
                    role: "system",
                    content: `Você é um editor experiente de conteúdo cristão. 
                    Sua missão é extrair TODO o conteúdo de um boletim PDF sem resumir nada importante.
                    Você deve identificar seções específicas como 'Notícias Missionárias', 'Fique por Dentro', 'Manual' e 'Devocionais'.
                    Retorne APENAS um JSON válido.`
                },
                {
                    role: "user",
                    content: `Analise o texto abaixo extraído do PDF.

                    JSON OBRIGATÓRIO:
                    {
                      "semana": "Identifique a semana/mês no topo",
                      "noticias": [
                        { 
                          "titulo": "Título da notícia", 
                          "data": "Data (se houver)", 
                          "conteudo": "Texto COMPLETO da notícia (Não resuma! Copie os parágrafos).",
                          "link": "Se houver link (e-inscricao, forms, whatsapp), extraia aqui."
                        }
                      ],
                      "extras": [ 
                        { 
                            "titulo": "Título (ex: Compreendendo..., Manual de Disciplinas...)", 
                            "conteudo": "Texto COMPLETO e fiel ao PDF desta seção." 
                        } 
                      ],
                      "devocionais": [
                        {
                          "cabecalho_dia": "Copie EXATAMENTE o cabeçalho (Ex: Dia 29 - Domingo, 04 de janeiro)",
                          "titulo": "Título da reflexão",
                          "texto_base": "Versículo (Ex: Marcos 1.11)",
                          "leitura_anual": "Capture a linha 'Leitura anual' do rodapé (Ex: Êxodo 7-8...)",
                          "conteudo": "Texto completo da reflexão",
                          "pergunta_reflexao": "Se houver uma pergunta no final, use-a. Se NÃO houver, CRIE uma pergunta profunda para aplicação pessoal."
                        }
                      ]
                    }
                    
                    DIRETRIZES:
                    1. Procure ativamente por "Notícias Missionárias" e inclua no array 'noticias'.
                    2. Procure por "Manual de Disciplinas" e "Compreendendo" e inclua no array 'extras'.
                    3. Não deixe passar os links.
                    
                    TEXTO DO PDF:
                    ${textoDoPDF}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const content = completion.choices[0].message.content;
        return JSON.parse(content);

    } catch (error) {
        console.error("Erro na OpenAI:", error);
        throw new Error("Falha no ChatGPT: " + error.message);
    }
}

// ================= ROTAS =================

// 1. HOME
app.get("/", async (req, res) => {
  try {
    if (!db) return res.render("home", { data: null });
    const snapshot = await db.collection("conteudos").orderBy("createdAt", "desc").limit(1).get();
    let data = null; let docId = null;
    snapshot.forEach((doc) => { data = doc.data(); docId = doc.id; });

    if (data && data.devocionais) {
      const commentsSnap = await db.collection("comentarios").where("boletimId", "==", docId).orderBy("createdAt", "desc").get();
      const todosComentarios = [];
      commentsSnap.forEach(doc => { const c = doc.data(); c.id = doc.id; todosComentarios.push(c); });

      data.devocionais = data.devocionais.map((dev, index) => {
        return { ...dev, id: index, comentarios: todosComentarios.filter(c => c.devocionalIndex == index) };
      });
      data.uid = docId;
    }
    res.render("home", { data });
  } catch (e) { console.error(e); res.render("home", { data: null }); }
});

// 2. PÁGINAS SIMPLES
app.get("/admin", (req, res) => res.render("admin"));
app.get("/pgm", (req, res) => res.render("pgm"));
app.get("/login", (req, res) => res.render("login", { layout: "main" }));
app.get("/register", (req, res) => res.render("register", { layout: "main" }));
app.get("/profile", (req, res) => res.render("profile"));

// 3. APIS DE USUÁRIO
app.post("/api/profile/update", uploadImage.single("photo"), async (req, res) => {
    const { uid, name, whatsapp, email } = req.body;
    try {
        const updateData = { name, whatsapp, email };
        if (req.file) updateData.photoUrl = `/uploads/profiles/${req.file.filename}`;
        await db.collection("users").doc(uid).update(updateData);
        res.json({ success: true, photoUrl: updateData.photoUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/user-data", async (req, res) => {
    const { uid } = req.body;
    try {
        const doc = await db.collection("users").doc(uid).get();
        if(doc.exists) res.json(doc.data()); else res.status(404).json({error: "User not found"});
    } catch(e) { res.status(500).json({error: e.message}); }
});

// 4. API PGM
app.post("/api/my-pgm", async (req, res) => {
    const { uid } = req.body;
    if(!uid || !db) return res.json({ error: "Dados inválidos" });
    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return res.json({ error: "Erro" });
        const u = userDoc.data();
        const pgmId = u.pgmId || (u.role === 'lider' || u.role === 'admin' ? `pgm_${uid}` : null);
        if (!pgmId) return res.json({ isLeader: false, pgmId: null, role: u.role });
        if ((u.role === 'lider' || u.role === 'admin') && !u.pgmId) await db.collection("users").doc(uid).update({ pgmId });

        const members = [];
        (await db.collection("users").where("pgmId", "==", pgmId).get()).forEach(d => members.push({id:d.id, ...d.data()}));
        const posts = [];
        (await db.collection("pgm_posts").where("pgmId", "==", pgmId).orderBy("createdAt", "desc").get()).forEach(d => posts.push({id:d.id, ...d.data()}));

        return res.json({ isLeader: (u.role === 'lider' || u.role === 'admin'), pgmId, members, posts, role: u.role });
    } catch (e) { res.json({ error: e.message }); }
});

// AÇÕES PGM
app.post("/pgm/add", async (req, res) => {
    const { leaderUid, memberEmail } = req.body;
    try {
        const ld = (await db.collection("users").doc(leaderUid).get()).data();
        if (ld.role !== 'lider' && ld.role !== 'admin') return res.status(403).send("Negado");
        const pgmId = ld.pgmId || `pgm_${leaderUid}`;
        const us = await db.collection("users").where("email", "==", memberEmail).get();
        if(us.empty) return res.send("<script>alert('E-mail não achado');window.location.href='/pgm'</script>");
        let mid; us.forEach(d=>mid=d.id);
        await db.collection("users").doc(mid).update({pgmId});
        res.redirect("/pgm");
    } catch(e) { res.status(500).send(e.message); }
});
app.post("/pgm/remove", async (req, res) => {
    try { await db.collection("users").doc(req.body.memberId).update({pgmId: admin.firestore.FieldValue.delete()}); res.redirect("/pgm"); } catch(e){ res.status(500).send(e.message); }
});
app.post("/pgm/post", async (req, res) => {
    try { await db.collection("pgm_posts").add({...req.body, createdAt: admin.firestore.FieldValue.serverTimestamp()}); res.redirect("/pgm"); } catch(e){ res.status(500).send(e.message); }
});
app.post("/pgm/delete-post", async (req, res) => {
    try { await db.collection("pgm_posts").doc(req.body.postId).delete(); res.redirect("/pgm"); } catch(e){ res.status(500).send(e.message); }
});

// 5. COMENTÁRIOS
app.post("/comentar", async (req, res) => {
    try { await db.collection("comentarios").add({...req.body, devocionalIndex: Number(req.body.devocionalIndex), createdAt: admin.firestore.FieldValue.serverTimestamp()}); res.redirect("/#card-"+req.body.devocionalIndex); } catch(e){ res.redirect("/"); }
});
app.post("/comentario/delete", async (req, res) => {
    try {
        const d = await db.collection("comentarios").doc(req.body.commentId).get();
        if(d.exists) {
            const c = d.data(); const {userRole, userUid, userPgm} = req.body;
            if(userRole==='admin'||userUid===c.authorUid||(userRole==='lider'&&userPgm&&c.authorPgm===userPgm)) await d.ref.delete();
        }
        res.redirect("/");
    } catch(e) { res.status(500).send(e.message); }
});

// 6. ADMIN
app.post("/api/admin/users", async (req, res) => {
    const { uid } = req.body;
    try {
        const ad = await db.collection("users").doc(uid).get();
        if (!ad.exists || ad.data().role !== 'admin') return res.status(403).json({ error: "Negado" });
        const users = []; const gm = {};
        (await db.collection("users").orderBy("name").get()).forEach(d => {
            const u = d.data(); u.uid = d.id; users.push(u);
            if((u.role==='lider'||u.role==='admin')&&u.pgmId) gm[u.pgmId]=u.name;
        });
        res.json(users.map(u => ({...u, leaderName: (u.role==='admin'?'Pastor':(u.role==='lider'?'Líder':(gm[u.pgmId]||'Sem Grupo')))})));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/update-role", async (req, res) => {
    const { adminUid, targetUid, newRole } = req.body;
    try {
        const ad = await db.collection("users").doc(adminUid).get();
        if (ad.data().role !== 'admin') return res.status(403).json({ error: "Negado" });
        const up = { role: newRole };
        if (newRole === 'lider') up.pgmId = `pgm_${targetUid}`;
        await db.collection("users").doc(targetUid).update(up);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// 7. UPLOAD PDF COM CHATGPT (GPT-4o)
app.post("/upload-pdf", uploadPDF.single("boletim"), async (req, res) => {
  let tmpPath = null;
  try {
    if (!db) return res.status(500).send("Erro Firebase.");
    if (!req.file) return res.send("Erro PDF.");
    tmpPath = req.file.path;
    
    const dataBuffer = await fsp.readFile(tmpPath);
    const pdfData = await pdfParse(dataBuffer);
    const textoLimpo = (pdfData?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    console.log("🧠 Enviando para GPT-4o...");
    
    // Chama o ChatGPT
    const jsonFinal = await processWithChatGPT(textoLimpo);

    // LOG DE DEPURAÇÃO: VAI MOSTRAR NO TERMINAL O QUE O GPT LEU
    console.log("📝 RESPOSTA DO GPT (Verifique se falta algo):");
    console.log(JSON.stringify(jsonFinal, null, 2)); 

    await db.collection("conteudos").add({ 
        ...jsonFinal, 
        createdAt: admin.firestore.FieldValue.serverTimestamp(), 
        aiModelUsed: "gpt-4o" 
    });
    
    console.log("✅ Sucesso com ChatGPT!");
    res.redirect("/");

  } catch (error) { 
    console.error("❌ ERRO:", error);
    res.status(500).send(`Erro: ${error.message}`); 
  } finally { 
    if(tmpPath) await fsp.unlink(tmpPath).catch(()=>{}); 
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
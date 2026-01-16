const { db } = require('../config/firebase');

exports.getHomePage = async (req, res) => {
    try {
        if (!db) return res.render("home", { data: null });

        // 1. Get Latest Content
        const snapshot = await db.collection("conteudos").orderBy("createdAt", "desc").limit(1).get();
        let data = null;
        let docId = null;
        snapshot.forEach((doc) => { data = doc.data(); docId = doc.id; });

        if (data && data.devocionais) {
            // 2. Get Comments
            const commentsSnap = await db.collection("comentarios")
                .where("boletimId", "==", docId)
                .orderBy("createdAt", "desc")
                .get();

            const todosComentarios = [];
            commentsSnap.forEach(doc => {
                const c = doc.data();
                c.id = doc.id;
                todosComentarios.push(c);
            });

            // 3. Merge Comments into Devotionals
            data.devocionais = data.devocionais.map((dev, index) => {
                return {
                    ...dev,
                    id: index,
                    comentarios: todosComentarios.filter(c => c.devocionalIndex == index)
                };
            });
            data.uid = docId;
        }

        // Render with new V2 layout (assumed)
        res.render("home", { data, layout: "main" });

    } catch (e) {
        console.error("Home Error:", e);
        res.render("home", { data: null, error: "Erro ao carregar dados." });
    }
};

exports.getLoginPage = (req, res) => res.render("login", { layout: "main" });
exports.getRegisterPage = (req, res) => res.render("register", { layout: "main" });
exports.getProfilePage = (req, res) => res.render("profile", { layout: "main" });

const { db } = require('../config/firebase');

exports.getHomePage = async (req, res) => {
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
};

exports.getLoginPage = (req, res) => res.render("login", { layout: "main" });
exports.getRegisterPage = (req, res) => res.render("register", { layout: "main" });
exports.getProfilePage = (req, res) => res.render("profile");

// Comment Actions (related to Home)
exports.postComment = async (req, res) => {
    try {
        const { admin, db } = require('../config/firebase'); // Lazy load admin for timestamp
        await db.collection("comentarios").add({ ...req.body, devocionalIndex: Number(req.body.devocionalIndex), createdAt: admin.firestore.FieldValue.serverTimestamp() });
        res.redirect("/#card-" + req.body.devocionalIndex);
    } catch (e) { res.redirect("/"); }
};

exports.deleteComment = async (req, res) => {
    try {
        const { db } = require('../config/firebase');
        const d = await db.collection("comentarios").doc(req.body.commentId).get();
        if (d.exists) {
            const c = d.data(); const { userRole, userUid, userPgm } = req.body;
            if (userRole === 'admin' || userUid === c.authorUid || (userRole === 'lider' && userPgm && c.authorPgm === userPgm)) await d.ref.delete();
        }
        res.redirect("/");
    } catch (e) { res.status(500).send(e.message); }
};

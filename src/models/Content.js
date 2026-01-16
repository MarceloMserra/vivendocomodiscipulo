const { db, admin } = require('../config/firebase');

class Content {
    constructor(data) {
        this.id = data.id;
        this.semana = data.semana;
        this.noticias = data.noticias || [];
        this.extras = data.extras || [];
        this.devocionais = data.devocionais || [];
        this.createdAt = data.createdAt;
        this.aiModelUsed = data.aiModelUsed;
    }

    static async create(data) {
        const payload = {
            ...data,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const ref = await db.collection("conteudos").add(payload);
        return new Content({ ...payload, id: ref.id });
    }

    static async listRecent(limit = 1) {
        const snapshot = await db.collection("conteudos")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        if (snapshot.empty) return [];
        return snapshot.docs.map(doc => new Content({ ...doc.data(), id: doc.id }));
    }
}

module.exports = Content;

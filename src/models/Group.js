const { db, admin } = require('../config/firebase');

class Group {
    constructor(data) {
        this.id = data.id;
        this.name = data.name; // Nome do Líder ou Nome Fantasia
        this.leaderUid = data.leaderUid;
        this.supervisorUid = data.supervisorUid || null;
        this.active = data.active !== false;
        this.meetingDay = data.meetingDay || null;
        this.meetingTime = data.meetingTime || null;
        this.location = data.location || null;
        this.createdAt = data.createdAt;
        this.members = data.members || []; // V3: Support denormalized members
    }

    static async findById(id) {
        const doc = await db.collection('pgms').doc(id).get();
        if (!doc.exists) return null;
        return new Group({ ...doc.data(), id: doc.id });
    }

    static async findByLeader(leaderUid) {
        const snapshot = await db.collection('pgms')
            .where('leaderUid', '==', leaderUid)
            .where('active', '==', true)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return new Group({ ...doc.data(), id: doc.id });
    }

    static async create(data) {
        // V3: Group Name default is Leader Name if not provided
        const payload = {
            ...data,
            active: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const ref = await db.collection('pgms').add(payload);
        return new Group({ ...payload, id: ref.id });
    }

    async getMembers() {
        const snapshot = await db.collection('users')
            .where('pgmId', '==', this.id)
            .get(); // Suporte a pgmId (Legacy) e groupId (V3)
        // Nota: V3 Spec pede 'groupId', mas mantemos compatibilidade
        return snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
    }

    async addEvent(eventData) {
        return db.collection('pgm_events').add({
            groupId: this.id,
            leaderUid: this.leaderUid, // Denormalização para segurança
            title: eventData.title,
            date: eventData.date,
            location: eventData.location,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    static async listAll() {
        const snapshot = await db.collection('pgms').orderBy('name').get();
        return snapshot.docs.map(doc => new Group({ ...doc.data(), id: doc.id }));
    }
}

module.exports = Group;

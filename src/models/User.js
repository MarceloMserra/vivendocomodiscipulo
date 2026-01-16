const { db, admin } = require('../config/firebase');

class User {
    constructor(data) {
        this.uid = data.uid;
        this.email = data.email;
        this.displayName = data.name || data.displayName;
        this.photoURL = data.photoURL;
        this.roles = data.roles || { member: true };
        this.status = data.status || 'active';
        this.leaderUid = data.leaderUid || null;
        this.groupId = data.groupId || null;
        this.pgmId = data.pgmId || null; // Retrocompatibilidade durante migração
        this.createdAt = data.createdAt;
    }

    static async findById(uid) {
        if (!uid) return null;
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return null;
        return new User({ ...doc.data(), uid: doc.id });
    }

    static async create(uid, data) {
        const payload = {
            ...data,
            roles: data.roles || { member: true },
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(uid).set(payload);
        return new User({ ...payload, uid });
    }

    static async update(uid, data) {
        await db.collection('users').doc(uid).update({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return this.findById(uid);
    }

    static async listAll() {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => new User({ ...doc.data(), uid: doc.id }));
    }

    /**
     * Busca todos os usuários liderados direta ou indiretamente por este Supervisor
     * V3 Spec: Drill-down
     */
    static async getNetwork(supervisorUid) {
        // Por enquanto, busca simples de liderados diretos
        // Futuro: Implementar recursividade se houver N níveis
        const snapshot = await db.collection('users')
            .where('leaderUid', '==', supervisorUid)
            .get();
        return snapshot.docs.map(doc => new User({ ...doc.data(), uid: doc.id }));
    }

    isAdmin() { return !!this.roles.admin; }
    isSupervisor() { return !!this.roles.supervisor; }
    isLeader() { return !!this.roles.leader; }
}

module.exports = User;

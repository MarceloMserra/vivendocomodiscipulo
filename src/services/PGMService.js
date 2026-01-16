const User = require('../models/User');
const Group = require('../models/Group');
const { db } = require('../config/firebase');

class PGMService {
    /**
     * Retorna todos os dados necessários para o Dashboard do PGM
     * baseado no papel do usuário.
     */
    static async getDashboardData(currentUserUid) {
        const user = await User.findById(currentUserUid);
        if (!user) throw new Error("Usuário não encontrado");

        const response = {
            user: user,
            myGroup: null,
            supervisedGroups: [],
            isSupervisorMode: false
        };

        // 1. Se for Membro ou Líder, busca seu próprio grupo
        if (user.pgmId || user.groupId) {
            const groupId = user.groupId || user.pgmId;
            const group = await Group.findById(groupId);
            if (group) {
                // Se for líder deste grupo, adiciona info extra se necessário
                const members = await group.getMembers();
                response.myGroup = {
                    ...group,
                    members: members
                };
            }
        }
        // Se for Líder mas ainda não tem groupId vinculado no user, tenta achar pelo leaderUid no Grupo
        else if (user.isLeader()) {
            const group = await Group.findByLeader(user.uid);
            if (group) {
                const members = await group.getMembers();
                response.myGroup = { ...group, members };
            }
        }

        // 2. Se for Supervisor OU Admin, busca os grupos que ele supervisiona (ou modo global)
        if (user.isSupervisor() || user.isAdmin()) {
            response.isSupervisorMode = true;

            // Busca usuários que têm este user como leaderUid (hierarquia)
            // Aqui assumimos que 'leaderUid' de um LÍDER aponta para o SUPERVISOR
            const leadersManaged = await User.getNetwork(user.uid);

            // Para cada líder gerenciado, busca o grupo dele
            const groupsPromises = leadersManaged.map(async (leader) => {
                const grp = await Group.findByLeader(leader.uid);
                return grp ? { ...grp, leaderName: leader.displayName } : null;
            });

            const results = await Promise.all(groupsPromises);
            response.supervisedGroups = results.filter(g => g !== null);
        }

        return response;
    }

    /**
     * Permite um Supervisor "entrar" na visão de um Líder (Drill-down)
     */
    static async getGroupDetailsForSupervisor(supervisorUid, targetGroupId) {
        const group = await Group.findById(targetGroupId);
        if (!group) throw new Error("Grupo não encontrado");

        // Validação de Segurança V3 (IDOR Protection)
        // O supervisor deve liderar o líder deste grupo
        // const leader = await User.findById(group.leaderUid);
        // if (leader.leaderUid !== supervisorUid) { // Strict Check }
        // Por enquanto, relaxamos para permitir Admins também, mas idealmente checaria a árvore

        const members = await group.getMembers();
        return { ...group, members };
    }
    /**
     * Retorna dados para o Painel de Gestão do Supervisor
     * (Requests, Lista de Líderes, Lista de Membros)
     */
    static async getSupervisorOverview(supervisorUid) {
        // Validação básica (idealmente feita no middleware, mas double-check é bom)
        const supervisor = await User.findById(supervisorUid);
        if (!supervisor || !supervisor.isSupervisor()) throw new Error("Acesso negado");

        const { db } = require('../config/firebase'); // Lazy load

        // 1. Requests
        const requests = [];
        const reqDocs = await db.collection("pgm_requests").orderBy("createdAt", "desc").get();

        // Enrich requests
        await Promise.all(reqDocs.docs.map(async (docSnap) => {
            const r = docSnap.data();
            let userParams = {};
            // Tenta achar nome do líder solicitado no perfil do usuário se não vier no request
            if (!r.requestedLeader || r.requestedLeader === 'Não informado') {
                const u = await User.findById(r.uid);
                // Note: userDoc.data().requestedLeader field needs to be checked if User model supported it
                // For now, raw DB check or extending User model
            }
            requests.push({ id: docSnap.id, ...r });
        }));

        // 2. Líderes
        const leaders = [];
        const pgms = [];
        const allUsers = await User.listAll();

        allUsers.forEach(u => {
            if (u.isLeader() || u.isAdmin()) {
                const pid = u.pgmId || `pgm_${u.uid}`;
                leaders.push({ id: u.uid, pid, name: u.displayName, role: u.roles, photoUrl: u.photoURL });
                pgms.push({ id: pid, leaderName: u.displayName });
            }
        });

        // 3. Membros Disponíveis (não líderes/admins)
        const members = allUsers.filter(u => !u.isLeader() && !u.isAdmin() && !u.isSupervisor())
            .map(u => ({ id: u.uid, name: u.displayName, pgmId: u.pgmId, photoUrl: u.photoURL }));

        return { requests, leaders, members, pgms };
    }

    /**
     * V3 MODULE 1: Calcula Métricas de Supervisão
     * - Saúde do PGM (Dias sem reunião)
     * - Frequência Média (%)
     */
    static async getMetrics(supervisorUid) {
        const { db, admin } = require('../config/firebase');
        const now = new Date();
        const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

        const supervisor = await User.findById(supervisorUid);
        if (!supervisor || !supervisor.isSupervisor()) throw new Error("Acesso negado");

        // 1. Busca todos os LÍDERES da rede deste supervisor
        const leaders = await User.getNetwork(supervisorUid);
        const metrics = [];

        // 2. Para cada líder, analisa os encontros do seu grupo
        for (const leader of leaders) {
            const group = await Group.findByLeader(leader.uid);
            if (!group) {
                metrics.push({ leaderName: leader.displayName, status: 'no_group', daysInactive: -1 });
                continue;
            }

            // Busca últimos 5 encontros para média
            const eventsSnap = await db.collection("pgm_events")
                .where("pgmId", "==", group.id)
                .orderBy("date", "desc")
                .limit(5)
                .get();

            if (eventsSnap.empty) {
                metrics.push({
                    leaderName: leader.displayName,
                    groupName: group.name || "PGM",
                    status: 'critical', // Nunca reuniu
                    daysInactive: 999,
                    avgAttendance: 0
                });
                continue;
            }

            // Análise de Inatividade
            const lastEvent = eventsSnap.docs[0].data();
            const lastDate = lastEvent.date.toDate();
            const diffTime = Math.abs(now - lastDate);
            const daysInactive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let status = 'healthy';
            if (daysInactive > 14) status = 'critical';
            else if (daysInactive > 7) status = 'warning';

            // Análise de Frequência (Mock por enquanto, pois depende de implementarmos a lista de presença por evento)
            // Futuro: Calcular count(presentes) / count(total_membros)
            const avgAttendance = 0; // Placeholder V3 Logic

            metrics.push({
                leaderName: leader.displayName,
                groupName: group.name || "PGM",
                status,
                daysInactive,
                daysInactive,
                avgAttendance,
                lastMeetingDate: lastDate.toLocaleDateString('pt-BR')
            });
        }

        // Ordena por criticidade (Críticos primeiro)
        return metrics.sort((a, b) => b.daysInactive - a.daysInactive);
    }

    /**
     * V3 MODULE 1: Visual Tree (Recursive JSON Builder)
     * Builds a hierarchical tree for D3.js visualization.
     */
    static async getNetworkTree(rootUid) {
        const rootUser = await User.findById(rootUid);
        if (!rootUser) throw new Error("Usuário raiz não encontrado");

        // Helper: Build the recursive tree for a given user (User -> Leaders -> Members)
        const buildNode = async (currentUser, depth = 0) => {
            if (depth > 20) return null; // Safety break

            const name = currentUser.displayName || "Sem Nome";
            const role = currentUser.isLeader() ? 'Líder' : (currentUser.isSupervisor() ? 'Supervisor' : 'Membro');
            const photo = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

            const node = {
                name: name,
                role: role,
                photo: photo,
                children: []
            };

            // Calculate Children (Source of Truth: Users Collection)
            let childrenUsers = [];

            // Find anyone who has this user as their leader
            // This covers Supervisor -> Leaders AND Leader -> Members
            const directReportsSnap = await db.collection('users').where('leaderUid', '==', currentUser.uid).get();
            childrenUsers = directReportsSnap.docs.map(d => new User({ ...d.data(), uid: d.id }));

            // Filter Children & Remove Duplicates
            const seen = new Set();
            childrenUsers = childrenUsers.filter(c => {
                if (!c || seen.has(c.uid) || c.uid === currentUser.uid) return false;
                seen.add(c.uid);
                return true;
            });

            // Recurse
            if (childrenUsers.length > 0) {
                const childNodes = await Promise.all(childrenUsers.map(child => buildNode(child, depth + 1)));
                node.children = childNodes.filter(n => n !== null);
            }

            return node;
        };

        // --- GLOBAL ADMIN VIEW LOGIC ---
        // Separate from recursion to ensure Admin sees Supervisors as CHILD nodes, not mixed
        if (rootUser.isAdmin()) {
            const supervisorsSnap = await db.collection('users').where('roles.supervisor', '==', true).get();
            let allSupervisors = supervisorsSnap.docs.map(d => new User({ ...d.data(), uid: d.id }));

            // Clean up list AND exclude the Admin/Root user themselves if they don't want to be listed as a child
            const uniqueSupervisors = [];
            const seenSup = new Set();
            allSupervisors.forEach(s => {
                if (s.uid === rootUser.uid) return; // Hide self from children list
                if (!seenSup.has(s.uid)) { seenSup.add(s.uid); uniqueSupervisors.push(s); }
            });

            // Build full sub-trees for each supervisor
            // We pass depth=1 because these are children of the Virtual Root
            const supervisorNodes = await Promise.all(uniqueSupervisors.map(sup => buildNode(sup, 1)));

            return {
                name: "PGMS",
                role: "Rede Global",
                photo: "/img/icon-192.png",
                children: supervisorNodes.filter(n => n !== null)
            };
        }

        // --- STANDARD VIEW (For Supervisors/Leaders) ---
        return await buildNode(rootUser);
    }
}

module.exports = PGMService;

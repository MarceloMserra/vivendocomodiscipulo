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
                metrics.push({
                    leaderName: leader.displayName,
                    groupName: "Sem Grupo",
                    groupId: null,
                    status: 'no_group',
                    daysInactive: -1,
                    avgAttendance: 0,
                    lastMeetingDate: '-'
                });
                continue;
            }

            // Busca TODOS os encontros para ordenar em memória (evita erro de índice composto)
            console.log(`[[QUERY DEBUG]] Fetching events for group ${group.id} WITHOUT LIMIT/ORDER`);
            const eventsSnap = await db.collection("pgm_events")
                .where("pgmId", "==", group.id)
                .get();

            if (eventsSnap.empty) {
                metrics.push({
                    groupId: group.id || null, // FIX: Ensure ID is present
                    leaderName: leader.displayName,
                    groupName: group.name || "PGM",
                    status: 'critical', // Nunca reuniu
                    daysInactive: 999,
                    avgAttendance: 0,
                    lastMeetingDate: 'Nunca'
                });
                continue;
            }

            // Análise de Inatividade
            // Order in memory
            const docs = eventsSnap.docs.map(d => d.data()).sort((a, b) => b.date.toDate() - a.date.toDate());
            const lastEvent = docs[0];
            const lastDate = lastEvent.date.toDate();
            const diffTime = Math.abs(now - lastDate);
            const daysInactive = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            let status = 'healthy';
            if (daysInactive > 14) status = 'critical';
            else if (daysInactive > 7) status = 'warning';

            // Análise de Frequência (Mock por enquanto)
            const avgAttendance = 0;

            metrics.push({
                groupId: group.id || null,
                leaderName: leader.displayName,
                groupName: group.name || "PGM",
                status,
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
    /**
     * V3 MODULE 1.5: PGM-Based Network Tree
     * Groups leaders into PGM Nodes for cleaner visualization.
     */
    static async getNetworkTreePGMBased(rootUid) {
        const rootUser = await User.findById(rootUid);
        if (!rootUser) throw new Error("Usuário raiz não encontrado");

        const { db } = require('../config/firebase');

        // Busca todos os dados em paralelo — uma única rodada de queries
        const [pgmsSnap, allUsersSnap] = await Promise.all([
            db.collection('pgms').where('active', '==', true).get(),
            db.collection('users').get()
        ]);

        const pgms = [];
        pgmsSnap.forEach(d => pgms.push({ id: d.id, ...d.data() }));

        // Monta mapa de todos os usuários em memória (sem base64 de foto)
        const allUsers = {};
        allUsersSnap.forEach(doc => {
            const d = doc.data();
            allUsers[doc.id] = {
                uid: doc.id,
                name: d.displayName || d.name || 'Sem Nome',
                role: d.role,
                roles: d.roles || {},
                pgmId: d.pgmId,
                leaderUid: d.leaderUid,
                photo: (d.photoUrl && !d.photoUrl.startsWith('data:')) ? d.photoUrl :
                       (d.photoURL && !d.photoURL.startsWith('data:')) ? d.photoURL :
                       `https://ui-avatars.com/api/?name=${encodeURIComponent(d.displayName || 'U')}&background=C5A059&color=fff`
            };
        });

        // Monta membros de um PGM a partir do mapa em memória (sem query extra)
        const buildMemberNodes = (pgmId, pgmLeaderUid) => {
            const seen = new Set();
            const nodes = [];
            Object.values(allUsers).forEach(u => {
                if (seen.has(u.uid)) return;
                if (u.pgmId !== pgmId && u.leaderUid !== pgmLeaderUid) return;
                if (u.roles?.leader || u.roles?.supervisor || u.roles?.admin) return;
                if (u.role === 'lider' || u.role === 'supervisor' || u.role === 'admin') return;
                seen.add(u.uid);
                nodes.push({ name: u.name, role: 'Membro', photo: u.photo, children: [] });
            });
            return nodes;
        };

        let rootNode = null;

        if (rootUser.isAdmin()) {
            rootNode = { name: "REDE GLOBAL", role: "Admin", photo: "/img/icon-192.png", children: [] };

            let supervisors = Object.values(allUsers).filter(u =>
                u.roles?.supervisor && u.uid !== rootUid
            );

            // Merge "Ronilda" em "Luiz"
            const luizIndex = supervisors.findIndex(s => s.name.includes("Luiz"));
            const ronildaIndex = supervisors.findIndex(s => s.name.includes("Ronilda"));
            if (luizIndex !== -1 && ronildaIndex !== -1) {
                supervisors[luizIndex].name = "Luiz e Ronilda";
                supervisors[luizIndex].secondaryUid = supervisors[ronildaIndex].uid;
                supervisors.splice(ronildaIndex, 1);
            }

            for (const sup of supervisors) {
                const myPgms = pgms.filter(p =>
                    p.supervisorUid === sup.uid ||
                    (sup.secondaryUid && p.supervisorUid === sup.secondaryUid)
                );

                const pgmNodes = myPgms.map(p => ({
                    name: p.name.replace('PGM ', ''),
                    role: 'PGM',
                    photo: "/img/pgm-icon.png",
                    children: buildMemberNodes(p.id, p.leaderUid)
                }));

                rootNode.children.push({
                    name: sup.name,
                    role: "Supervisor",
                    photo: sup.photo,
                    children: pgmNodes
                });
            }

            // PGMs sem supervisor
            const orphanPgms = pgms.filter(p => !p.supervisorUid);
            if (orphanPgms.length > 0) {
                rootNode.children.push({
                    name: "Sem Supervisão",
                    role: "System",
                    photo: "",
                    children: orphanPgms.map(p => ({ name: p.name, role: 'PGM', children: [] }))
                });
            }

        } else if (rootUser.isSupervisor()) {
            const supUser = allUsers[rootUid];
            rootNode = {
                name: supUser?.name || rootUser.displayName,
                role: "Supervisor",
                photo: supUser?.photo || "",
                children: []
            };

            const myPgms = pgms.filter(p => p.supervisorUid === rootUid);
            rootNode.children = myPgms.map(p => ({
                name: p.name.replace('PGM ', ''),
                role: 'PGM',
                photo: "/img/pgm-icon.png",
                children: buildMemberNodes(p.id, p.leaderUid)
            }));
        } else {
            // Leader/Member View: Just My PGM
            // Fallback to legacy
            return await this.getNetworkTree(rootUid);
        }

        return rootNode;
    }
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

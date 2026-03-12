const { db, admin } = require('../config/firebase');
const User = require('../models/User');

exports.getMonitoringPage = (req, res) => {
    // Render the simplified Input Shell
    res.render('monitoring', { layout: 'dashboard' });
};

exports.getReportsPage = (req, res) => {
    // Render the Reports Shell
    res.render('reports', { layout: 'dashboard' });
};

exports.getMonitoringData = async (req, res) => {
    try {
        // Auth check manually since router middleware might be relaxed for the View
        if (!req.user) return res.status(401).json({ error: 'Não autenticado' });

        const uid = req.user.uid;
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });

        const userData = new User({ ...userDoc.data(), uid });
        const canViewDashboard = userData.isSupervisor() || userData.isAdmin();
        const canInput = userData.isLeader() || userData.isSupervisor() || userData.isAdmin();

        if (!canInput && !canViewDashboard) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }

        // --- Parameters (Body for POST) ---
        const { startDate, endDate, pgmId, selectedLeaderId } = req.body;

        const responseData = {
            user: {
                uid: userData.uid,
                name: userData.displayName,
                roles: userData.roles
            },
            permissions: {
                canView: canViewDashboard,
                canInput: canInput,
                isAdmin: userData.isAdmin() || userData.isSupervisor() // Treat Sup as Admin for this context
            },
            members: [],
            availableLeaders: [], // For Admins to select whose members to edit
            dashboard: null
        };

        // --- 1. Load Data for INPUT FORM ---
        if (canInput) {
            // Determine which Leader's members to fetch
            // If Admin/Sup has selected a leader, use that. Otherwise use own (if leader) or empty.
            let targetUid = uid;

            if (userData.isAdmin() || userData.isSupervisor()) {
                // Fetch ALL Leaders for the dropdown
                try {
                    const leadersSnap = await db.collection('users')
                        .where('roles.lider', '==', true)
                        .orderBy('name_lower')
                        .get();
                    leadersSnap.forEach(doc => {
                        const d = doc.data();
                        responseData.availableLeaders.push({
                            uid: doc.id,
                            name: d.displayName || d.name || 'Líder Sem Nome'
                        });
                    });
                } catch (err) {
                    // Continua com lista vazia se índice não existir
                }

                if (selectedLeaderId) {
                    targetUid = selectedLeaderId;
                } else if (!userData.isLeader()) {
                    targetUid = null;
                }
            }

            if (targetUid) {
                try {
                    const membersSnapshot = await db.collection('users')
                        .where('leaderUid', '==', targetUid)
                        // .orderBy('name_lower') // REMOVED to avoid Index Error
                        .get();

                    membersSnapshot.forEach(doc => {
                        const d = doc.data();
                        responseData.members.push({
                            uid: doc.id,
                            name: d.displayName || d.name || 'Sem Nome',
                            photoUrl: d.photoUrl || d.photoURL || ''
                        });
                    });

                    // Sort in memory
                    responseData.members.sort((a, b) => a.name.localeCompare(b.name));

                } catch (err) {
                    console.error("[DEBUG_MONITOR] Error fetching members:", err.message);
                }
            }
        }

        // --- 2. Load Data for DASHBOARD ---
        if (canViewDashboard) {

            // 2.1 Fetch PGMs Metadata (Needed for mapping IDs to Names/Supervisors)
            const pgmsSnap = await db.collection('pgms').get();
            const pgmMap = {};
            pgmsSnap.forEach(doc => {
                pgmMap[doc.id] = { id: doc.id, ...doc.data() };
            });

            let query = db.collection('meetings');

            // Date Range
            let start, end;
            try {
                start = startDate ? new Date(startDate + 'T00:00:00') : new Date();
                if (!startDate) start.setDate(start.getDate() - 90);

                end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
                if (!endDate) end.setHours(23, 59, 59, 999);
            } catch (err) {
                throw new Error("Erro ao processar datas.");
            }

            query = query.where('date', '>=', admin.firestore.Timestamp.fromDate(start))
                .where('date', '<=', admin.firestore.Timestamp.fromDate(end));

            // PGM/Leader Filter
            // If user is just a Leader (not Admin/Sup), filter by their PGM
            if (userData.isLeader() && !userData.isAdmin() && !userData.isSupervisor()) {
                // Find PGM where user is leader
                // Optimization: User doc has pgmId now
                if (userData.pgmId) {
                    query = query.where('pgmId', '==', userData.pgmId);
                } else {
                    // Fallback or Empty
                    query = query.where('leaderUid', '==', uid); // Legacy fallback
                }
            } else if (pgmId) {
                // Admin filtering by specific PGM
                query = query.where('pgmId', '==', pgmId);
            }

            query = query.orderBy('date', 'desc');

            const meetingsSnap = await query.get();

            // Aggregation
            let totalMeetings = 0;
            let totalAttendance = 0;
            let totalVisitors = 0;
            const uniqueMemberIds = new Set(); // Won't work for legacy, but works for new

            const meetingsList = [];
            const trendMap = {}; // date -> count

            // Structure for Stacked Chart: User wants "Participantes por Supervisão"
            // Map: SupervisorName -> { total: 0, pgms: { pgmName: count } }
            const supervisorAggregation = {};

            meetingsSnap.forEach(doc => {
                const m = doc.data();
                if (!m.date) return;

                const attCount = (Array.isArray(m.attendees) ? m.attendees.length : 0) + (parseInt(m.legacyMemberCount) || 0);
                const visCount = parseInt(m.visitorCount || 0);

                totalMeetings++;
                totalAttendance += attCount;
                totalVisitors += visCount;

                if (Array.isArray(m.attendees)) m.attendees.forEach(id => uniqueMemberIds.add(id));

                // Trend
                const dateKey = m.date.toDate().toISOString().split('T')[0];
                if (!trendMap[dateKey]) trendMap[dateKey] = 0;
                trendMap[dateKey] += attCount;

                // Resolve PGM Info
                let pgmName = 'Desconhecido';
                let supervisorName = 'Sem Supervisão';

                if (m.pgmId && pgmMap[m.pgmId]) {
                    pgmName = pgmMap[m.pgmId].name;
                    supervisorName = pgmMap[m.pgmId].supervisorName || 'Sem Supervisão';
                }

                // Supervisor Aggregation
                if (!supervisorAggregation[supervisorName]) {
                    supervisorAggregation[supervisorName] = { total: 0, pgms: {} };
                }
                const supData = supervisorAggregation[supervisorName];
                supData.total += attCount;

                if (!supData.pgms[pgmName]) supData.pgms[pgmName] = 0;
                supData.pgms[pgmName] += attCount;

                meetingsList.push({
                    id: doc.id,
                    date: dateKey,
                    pgmName: pgmName,
                    supervisorName: supervisorName,
                    attendance: attCount,
                    visitors: visCount
                });
            });

            // Format Data for Stacked Chart
            // We need: Labels (Supervisors) and Datasets (PGMs)
            // But ChartJS structure is tricky if every bar has different PGMs.
            // Simplified approach for JSON response:
            // Return hierarchical data, let Frontend build the datasets.

            const supervisorsChartData = Object.entries(supervisorAggregation).map(([supName, data]) => ({
                name: supName,
                total: data.total,
                breakdown: Object.entries(data.pgms).map(([pName, count]) => ({ name: pName, value: count }))
            })).sort((a, b) => b.total - a.total); // Sort Supervisors by total

            const trendData = Object.entries(trendMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

            responseData.dashboard = {
                summary: {
                    totalMeetings,
                    avgAttendance: totalMeetings ? Math.round((totalAttendance / totalMeetings) * 10) / 10 : 0,
                    totalVisitors,
                    uniqueMembers: uniqueMemberIds.size
                },
                charts: {
                    bySupervisor: supervisorsChartData,
                    trend: trendData,
                    ratio: { members: totalAttendance, visitors: totalVisitors }
                },
                meetings: meetingsList
            };
        }

        res.json(responseData);

    } catch (e) {
        console.error("Monitor API Error Details:");
        if (e.message && e.message.includes('https://console.firebase.google.com')) {
            const url = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)[0];
            console.error(">>> INDEX REQUIRED: " + url);
        } else {
            console.error(e);
        }
        res.status(500).json({ error: e.message });
    }
};

exports.saveMeeting = async (req, res) => {
    try {
        const { date, attendees, visitorCount, targetLeaderUid } = req.body;
        let leaderUid = req.user.uid;

        // Fetch user roles to verify permissions
        // Optimize: We could pass roles in req.user if middleware did it, but it's safe to fetch or check decoded token
        // verifyToken puts decoded token in req.user. If custom claims are set, we might have roles there.
        // But for safety, let's assume we need to check if user is admin to use targetLeaderUid.

        // Quick check using the User model logic would require fetching the doc again or trusting claims if they exist.
        // Let's fetch to be 100% sure of current permissions.
        const userDoc = await db.collection('users').doc(leaderUid).get();
        const userData = new User({ ...userDoc.data(), uid: leaderUid });

        if (userData.isAdmin() || userData.isSupervisor()) {
            if (targetLeaderUid) {
                leaderUid = targetLeaderUid; // Admin saving for someone else
            }
        }

        // Validation
        if (!date) return res.status(400).json({ error: 'Data é obrigatória' });

        // Parse Date (from YYYY-MM-DD to Date object)
        const [year, month, day] = date.split('-').map(Number);
        const meetingDate = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone issues

        // Attendees is array of UIDs. If checkbox, might be string or array
        const attendeeList = Array.isArray(attendees) ? attendees : (attendees ? [attendees] : []);

        const meetingData = {
            leaderUid,
            date: admin.firestore.Timestamp.fromDate(meetingDate),
            attendees: attendeeList,
            visitorCount: parseInt(visitorCount || 0),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: req.user.uid // Audit trail
        };

        await db.collection('meetings').add(meetingData);

        res.json({ success: true, message: 'Reunião registrada com sucesso!' });

    } catch (e) {
        console.error("Error saving meeting:", e);
        res.status(500).json({ error: e.message });
    }
};

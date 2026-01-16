const { admin } = require('../config/firebase');

/**
 * Middleware de Autenticação V3
 * Verifica o Token JWT ou Cookie de Sessão
 */
const verifyToken = async (req, res, next) => {
    let token = null;

    // 1. Tenta pegar do Header (Para API)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split('Bearer ')[1];
    }
    // 2. Tenta pegar do Cookie (Para SSR/Views)
    else if (req.cookies && req.cookies.session) {
        token = req.cookies.session;
    }

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        // Tenta verificar como ID Token primeiro (mais comum no Client SDK)
        // Nota: Para Session Cookies REAIS, usaríamos verifySessionCookie
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;

        // Carrega roles do Firestore para req.user (opcional para performance, mas bom para segurança)
        // const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        // req.user.roles = userDoc.data()?.roles || {};

        return next();
    } catch (error) {
        // Se falhar o ID Token, tenta Session Cookie (se implementarmos login server-side)
        try {
            const decodedClaims = await admin.auth().verifySessionCookie(token, true);
            req.user = decodedClaims;
            return next();
        } catch (e) {
            console.error("Auth Error:", e.message);
            req.user = null;
            return next();
        }
    }
};

/**
 * Middleware para proteger rotas (Exige Login)
 */
const requireAuth = (req, res, next) => {
    if (!req.user) {
        // Se for API, retorna 401
        if (req.path.startsWith('/api')) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Se for View, redireciona para Login
        return res.redirect('/login');
    }
    next();
};

module.exports = { verifyToken, requireAuth };

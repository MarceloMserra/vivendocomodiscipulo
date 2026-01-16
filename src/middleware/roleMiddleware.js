/**
 * Middleware de Controle de Acesso (RBAC)
 * Depende do req.user já estar populado pelo authMiddleware
 */
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).redirect('/login');
        }

        // Se o usuário tiver a claim "admin" setada no Custom Claims, passa direto
        if (req.user.admin === true) return next();

        // Se o token tiver a role específica (ex: req.user.supervisor)
        if (req.user[role] === true) {
            return next();
        }

        // Fallback: Verificar se o token de ID tem a role "role"
        // (Isso depende de como vamos setar as claims no futuro)

        console.warn(`[RBAC] Usuário ${req.user.uid} tentou acessar rota ${role} sem permissão.`);
        return res.status(403).render('error', {
            message: "Você não tem permissão para acessar esta área.",
            layout: "main"
        });
    };
};

module.exports = { requireRole };

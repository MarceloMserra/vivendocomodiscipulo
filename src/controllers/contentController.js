const ContentService = require('../services/ContentService');
const fsp = require("fs/promises");
const { db } = require('../config/firebase'); // Mantido se houver outros endpoints menores

/**
 * Endpoint de Upload de PDF
 * Recebe o arquivo e delega o processamento ao Service
 */
exports.uploadPdf = async (req, res) => {
    let tmpPath = null;
    try {
        if (!req.file) return res.send("Erro: Nenhum arquivo PDF enviado.");
        tmpPath = req.file.path;

        console.log("🚀 [Content Controller] Iniciando processamento via Service...");

        // Delega lógica pesada para o Service
        const newContent = await ContentService.processPdfAndCreateContent(tmpPath);

        console.log("✅ [Content Controller] Conteúdo criado com ID:", newContent.id);
        res.redirect("/");

    } catch (error) {
        console.error("❌ [Content Controller] Erro:", error);
        res.status(500).send(`Erro ao processar PDF: ${error.message}`);
    } finally {
        // Limpeza de arquivo temporário
        if (tmpPath) {
            await fsp.unlink(tmpPath).catch(err => console.warn("Falha ao deletar temp:", err.message));
        }
    }
};

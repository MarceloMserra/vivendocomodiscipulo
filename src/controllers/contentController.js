const { db, admin } = require('../config/firebase');
const pdfParse = require("pdf-extraction");
const fsp = require("fs/promises");
const openai = require('../config/openai');

// --- 6. FUNÇÃO DE IA (GPT-4o) ---
async function processWithChatGPT(textoDoPDF) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // USANDO O MODELO MAIS POTENTE
            messages: [
                {
                    role: "system",
                    content: `Você é um editor experiente de conteúdo cristão. 
                    Sua missão é extrair TODO o conteúdo de um boletim PDF sem resumir nada importante.
                    Você deve identificar seções específicas como 'Notícias Missionárias', 'Fique por Dentro', 'Manual' e 'Devocionais'.
                    Retorne APENAS um JSON válido.`
                },
                {
                    role: "user",
                    content: `Analise o texto abaixo extraído do PDF.
                    JSON OBRIGATÓRIO:
                    {
                      "semana": "Identifique a semana/mês no topo",
                      "noticias": [
                        { 
                          "titulo": "Título da notícia", 
                          "data": "Data (se houver)", 
                          "conteudo": "Texto COMPLETO da notícia em HTML (use <p>, <strong>, <ul>, <li>).",
                          "link": "Se houver link (e-inscricao, forms, whatsapp), extraia aqui."
                        }
                      ],
                      "extras": [ 
                        { 
                            "titulo": "Título (ex: Compreendendo..., Manual de Disciplinas...)", 
                            "conteudo": "Texto COMPLETO desta seção, FORMATADO EM HTML (use <p>, <strong>, <ul>, <li>, <br>). Mantenha a estrutura visual bonita e organizada." 
                        } 
                      ],
                      "devocionais": [
                        {
                          "cabecalho_dia": "Copie EXATAMENTE o cabeçalho (Ex: Dia 29 - Domingo, 04 de janeiro)",
                          "titulo": "Título da reflexão",
                          "texto_base": "Versículo (Ex: Marcos 1.11)",
                          "leitura_anual": "Capture a linha 'Leitura anual' do rodapé (Ex: Êxodo 7-8...)",
                          "conteudo": "Texto completo da reflexão em HTML (use <p>, <strong>, <i> para citações).",
                          "pergunta_reflexao": "Se houver uma pergunta no final, use-a. Se NÃO houver, CRIE uma pergunta profunda para aplicação pessoal."
                        }
                      ]
                    }
                    DIRETRIZES:
                    1. Procure ativamente por "Notícias Missionárias" e inclua no array 'noticias'.
                    2. Procure por "Manual de Disciplinas" e "Compreendendo" e inclua no array 'extras'.
                    3. Não deixe passar os links.
                    4. GERE HTML PURO PARA OS CAMPOS 'conteudo'. NÃO USE MARKDOWN.
                    TEXTO DO PDF:
                    ${textoDoPDF}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const content = completion.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("Erro na OpenAI:", error);
        throw new Error("Falha no ChatGPT: " + error.message);
    }
}

exports.uploadPdf = async (req, res) => {
    let tmpPath = null;
    try {
        if (!db) return res.status(500).send("Erro Firebase.");
        if (!req.file) return res.send("Erro PDF.");
        tmpPath = req.file.path;

        const dataBuffer = await fsp.readFile(tmpPath);
        const pdfData = await pdfParse(dataBuffer);
        const textoLimpo = (pdfData?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

        console.log("🧠 Enviando para GPT-4o...");

        // Chama o ChatGPT
        const jsonFinal = await processWithChatGPT(textoLimpo);

        console.log("📝 RESPOSTA DO GPT:", JSON.stringify(jsonFinal, null, 2));

        await db.collection("conteudos").add({
            ...jsonFinal,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            aiModelUsed: "gpt-4o"
        });

        console.log("✅ Sucesso com ChatGPT!");
        res.redirect("/");

    } catch (error) {
        console.error("❌ ERRO:", error);
        res.status(500).send(`Erro: ${error.message}`);
    } finally {
        if (tmpPath) await fsp.unlink(tmpPath).catch(() => { });
    }
};

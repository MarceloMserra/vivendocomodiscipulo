const pdfParse = require("pdf-extraction");
const openai = require('../config/openai');
const Content = require('../models/Content');
const fsp = require("fs/promises");

class ContentService {

    /**
     * Processa um arquivo PDF (Buffer ou Path), extrai texto e envia para IA.
     * Retorna o objeto Content criado no banco.
     */
    static async processPdfAndCreateContent(filePath) {
        // 1. Extração de Texto do PDF
        console.log("Reading PDF...");
        const dataBuffer = await fsp.readFile(filePath);
        const pdfData = await pdfParse(dataBuffer);
        const textoLimpo = (pdfData?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

        // 2. Inteligência Artificial (GPT-4o)
        console.log("Sending to GPT-4o...");
        const jsonContent = await this._callOpenAI(textoLimpo);

        // 3. Persistência (Model)
        console.log("Saving to Firestore...");
        const newContent = await Content.create({
            ...jsonContent,
            aiModelUsed: "gpt-4o-v3-service"
        });

        return newContent;
    }

    /**
     * Método Privado: Chama a OpenAI com o Prompt Robusto (V3)
     */
    static async _callOpenAI(textoDoPDF) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o",
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
                                "conteudo": "Texto COMPLETO desta seção. NÃO RESUMA.\n\nRegra 1 (Listas Numeradas - 'Manual de Disciplinas'):\n- ETAPA A: Inclua os parágrafos introdutórios (ex: 'Para apoiar essa caminhada...', 'O discipulado não acontece...') em <p>.\n- ETAPA B: USE a tag <ol> para os 10 itens. NÃO coloque números no texto (deixe o <ol> numerar). Título em <STRONG>.\n- ETAPA C: Inclua o texto APÓS a lista (ex: 'De forma prática...', 'Caminhemos juntos') como novos parágrafos <p>.\n\nRegra 2 (Texto Longo - 'Compreendendo...'):\n- QUEBRE O TEXTO em vários parágrafos curtos (<p>)." 
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
            throw new Error("Falha no AI processing: " + error.message);
        }
    }
}

module.exports = ContentService;

const { db, admin } = require('./src/config/firebase');
const pdfParse = require("pdf-extraction");
const fsp = require("fs/promises");
const openai = require('./src/config/openai');

// COPIED LOGIC FROM UPDATED CONTROLLER to ensure it uses the NEW PROMPT
async function processWithChatGPT(textoDoPDF) {
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
    throw new Error("Falha no ChatGPT: " + error.message);
  }
}

async function run() {
  try {
    console.log("Reading PDF...");
    const dataBuffer = await fsp.readFile('./Vivendo como Discípulo - Semana 06.pdf');
    const pdfData = await pdfParse(dataBuffer);
    const textoLimpo = (pdfData?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

    console.log("Processing with GPT-4o...");
    const jsonFinal = await processWithChatGPT(textoLimpo);

    console.log("Saving to Firestore...");
    await db.collection("conteudos").add({
      ...jsonFinal,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      aiModelUsed: "gpt-4o-reprocess"
    });

    console.log("DONE! New content added.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();

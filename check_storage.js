const { admin, storage } = require('./src/config/firebase');

async function checkStorage() {
    console.log("🔍 Diagnosticando Firebase Storage...");

    try {
        console.log("Tentando acessar o bucket configurado...");
        // Uses default bucket from config
        const bucket = storage.bucket();
        console.log(`Bucket Alvo: ${bucket.name}`);

        const [exists] = await bucket.exists();

        if (exists) {
            console.log("✅ SUCESSO: O bucket existe e a conexão foi estabelecida!");
        } else {
            console.log("❌ ERRO: O bucket NÃO existe. Verifique o console do Firebase.");
            console.log("   -> Certifique-se de que o Storage está ATIVADO no console.");
            console.log("   -> Confirme se o bucket 'vivendo-como-discipulo.appspot.com' foi criado.");
        }

    } catch (error) {
        console.error("❌ Erro ao acessar Storage:", error);

        if (error.code === 404 || error.message.includes("not exist")) {
            console.log("\n⚠️  DIAGNÓSTICO: O BUCKET NÃO EXISTE.");
            console.log("1. Vá no Console Firebase -> Criação -> Storage");
            console.log("2. Se vir um botão 'Começar' ou 'Get Started', clique nele!");
            console.log("3. Siga os passos para criar o bucket padrão.");
        }
    }
}

checkStorage();

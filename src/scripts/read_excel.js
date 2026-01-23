const XLSX = require('xlsx');
const path = require('path');

function analyzeExcel() {
    try {
        const filePath = path.join(__dirname, '../../mapeamento_pgs.xlsx');
        console.log("Reading file:", filePath);

        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Header: 1 gives array of arrays

        console.log("\n--- EXCEL STRUCTURE (First 5 Rows) ---");
        data.slice(0, 5).forEach((row, i) => {
            console.log(`Row ${i}:`, JSON.stringify(row));
        });

    } catch (e) {
        console.error("Error reading Excel:", e.message);
    }
}

analyzeExcel();

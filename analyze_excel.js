const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('mapeamento_pgs.xlsx');
    const sheetNameList = workbook.SheetNames;
    console.log('Sheets:', sheetNameList);

    const firstSheetName = sheetNameList[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Get headers (first row)
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: range.s.r, c: C });
        const cell = worksheet[address];
        if (cell && cell.v) headers.push(cell.v);
    }
    console.log('Headers:', headers);

    // Get first 3 rows of data
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1, limit: 3 });
    console.log('First 3 rows:', data);

} catch (err) {
    console.error('Error reading Excel file:', err);
}

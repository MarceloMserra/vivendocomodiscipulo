const fs = require('fs');
const pdf = require('pdf-extraction');

const dataBuffer = fs.readFileSync('Vivendo como Discípulo - Semana 06.pdf');

pdf(dataBuffer).then(function (data) {
    console.log('--- RAW TEXT START ---');
    console.log(data.text);
    console.log('--- RAW TEXT END ---');
}).catch(err => {
    console.error('Error:', err);
});

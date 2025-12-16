// Test the pdf-parse wrapper
const fs = require('fs');

async function testPdfExtraction(pdfPath) {
  try {
    console.log('Loading pdf-parse via wrapper...');
    const pdfParse = require('./lib/pdf-parse-wrapper');
    console.log('✓ pdf-parse loaded successfully\n');

    if (!pdfPath) {
      console.log('No PDF file provided. Usage: node test-wrapper.js <path-to-pdf>');
      return;
    }

    console.log(`Reading PDF file: ${pdfPath}`);
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log(`✓ File read successfully (${dataBuffer.length} bytes)\n`);

    console.log('Parsing PDF...');
    const pdfData = await pdfParse(dataBuffer);

    console.log('✓ PDF parsed successfully!');
    console.log(`Pages: ${pdfData.numpages}`);
    console.log(`Text length: ${pdfData.text.length} characters\n`);
    console.log('First 500 characters of extracted text:');
    console.log(pdfData.text.substring(0, 500));
    console.log('...\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  }
}

// Run test
const pdfPath = process.argv[2];
testPdfExtraction(pdfPath);

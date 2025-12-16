// Test pdfjs-dist PDF extraction
const fs = require('fs');

async function testPdfExtraction(pdfPath) {
  try {
    console.log('Loading pdfjs-dist...');
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    console.log('✓ pdfjs-dist loaded successfully\n');

    if (!pdfPath) {
      console.log('No PDF file provided. Usage: node test-pdfjs.js <path-to-pdf>');
      return;
    }

    console.log(`Reading PDF file: ${pdfPath}`);
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log(`✓ File read successfully (${dataBuffer.length} bytes)\n`);

    console.log('Parsing PDF...');
    const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
    const pdfDocument = await loadingTask.promise;
    console.log(`✓ PDF loaded successfully\n`);

    // Extract text from all pages
    const textParts = [];
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ');
      textParts.push(pageText);
    }

    const extractedText = textParts.join('\n\n');

    console.log('✓ PDF parsed successfully!');
    console.log(`Pages: ${pdfDocument.numPages}`);
    console.log(`Text length: ${extractedText.length} characters\n`);
    console.log('First 500 characters of extracted text:');
    console.log(extractedText.substring(0, 500));
    console.log('...\n');

  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
  }
}

// Run test
const pdfPath = process.argv[2];
testPdfExtraction(pdfPath);

// Test pdf2json PDF extraction
const fs = require('fs');
const PDFParser = require("pdf2json");

async function testPdfExtraction(pdfPath) {
  try {
    console.log('Loading pdf2json...');
    console.log('✓ pdf2json loaded successfully\n');

    if (!pdfPath) {
      console.log('No PDF file provided. Usage: node test-pdf2json.js <path-to-pdf>');
      return;
    }

    console.log(`Reading PDF file: ${pdfPath}`);
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log(`✓ File read successfully (${dataBuffer.length} bytes)\n`);

    console.log('Parsing PDF...');
    const pdfParser = new PDFParser();
    
    const extractedText = await new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => reject(errData));
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        try {
          // Extract text from all pages
          const text = pdfData.Pages
            .map((page) =>
              page.Texts.map((text) =>
                text.R.map((r) => decodeURIComponent(r.T)).join(" ")
              ).join(" ")
            )
            .join("\n\n");
          resolve(text);
        } catch (err) {
          reject(err);
        }
      });
      pdfParser.parseBuffer(dataBuffer);
    });

    console.log('✓ PDF parsed successfully!');
    console.log(`Pages: ${pdfParser.Pages?.length || 'N/A'}`);
    console.log(`Text length: ${extractedText.length} characters\n`);
    console.log('First 500 characters of extracted text:');
    console.log(extractedText.substring(0, 500));
    console.log('...\n');

  } catch (error) {
    console.error('✗ Error:', error.message || error);
    console.error(error);
  }
}

// Run test
const pdfPath = process.argv[2];
testPdfExtraction(pdfPath);

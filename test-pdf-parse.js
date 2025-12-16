// Test script for pdf-parse functionality
// Usage: node test-pdf-parse.js <path-to-pdf-file>

const fs = require('fs');
const path = require('path');

async function testPdfParse() {
  try {
    console.log('Loading pdf-parse module...');
    const pdfParse = require('pdf-parse');
    console.log('✓ pdf-parse loaded successfully');
    console.log('Module type:', typeof pdfParse);
    console.log('Is function:', typeof pdfParse === 'function');

    // Check if a file path was provided
    const pdfPath = process.argv[2];
    
    if (!pdfPath) {
      console.log('\n📝 To test with a PDF file, run:');
      console.log('   node test-pdf-parse.js <path-to-your-pdf>');
      console.log('\n✅ Module import test passed!');
      return;
    }

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ File not found:', pdfPath);
      return;
    }

    console.log('\n📄 Reading PDF file:', pdfPath);
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log('✓ File read successfully, size:', dataBuffer.length, 'bytes');

    console.log('\n🔍 Parsing PDF...');
    const data = await pdfParse(dataBuffer);
    
    console.log('\n✅ PDF parsed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PDF Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Pages:', data.numpages);
    console.log('Text length:', data.text.length, 'characters');
    console.log('\n📝 First 500 characters of extracted text:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(data.text.substring(0, 500));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (data.text.length === 0) {
      console.warn('\n⚠️  Warning: No text extracted (might be a scanned/image PDF)');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nFull error:', error);
  }
}

testPdfParse();

// Wrapper for pdf-parse to prevent debug mode from triggering in Next.js
// This fixes the ENOENT error for test files by loading the library directly

// Load the actual pdf-parse library (not the index which has debug code)
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

// Export the pdf-parse function
module.exports = pdfParse;

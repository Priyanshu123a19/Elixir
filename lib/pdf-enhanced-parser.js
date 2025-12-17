// Enhanced PDF parsing utilities for large multi-page documents

const pdfParse = require('pdf-parse/lib/pdf-parse.js');

/**
 * Extract text from PDF with page markers for better context preservation
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} - Object with text, numpages, and info
 */
async function extractTextWithPageMarkers(buffer) {
  const data = await pdfParse(buffer, {
    max: 0, // Parse all pages
  });

  // Add page markers if multi-page
  if (data.numpages > 1) {
    const lines = data.text.split('\n');
    // Estimate lines per page (rough heuristic)
    const linesPerPage = Math.ceil(lines.length / data.numpages);
    
    let enhancedText = '';
    for (let i = 0; i < data.numpages; i++) {
      const pageStart = i * linesPerPage;
      const pageEnd = Math.min((i + 1) * linesPerPage, lines.length);
      const pageLines = lines.slice(pageStart, pageEnd);
      
      enhancedText += `\n\n=== PAGE ${i + 1} of ${data.numpages} ===\n\n`;
      enhancedText += pageLines.join('\n');
    }
    
    return {
      text: enhancedText.trim(),
      numpages: data.numpages,
      info: data.info,
    };
  }

  return data;
}

/**
 * Clean up extracted text while preserving structure
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
function cleanExtractedText(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')  // Max 2 newlines
    .replace(/[ \t]+/g, ' ')      // Multiple spaces to single
    .replace(/\r\n/g, '\n')       // Normalize line endings
    .trim();
}

/**
 * Detect and extract tabular data from text
 * @param {string} text - Text to analyze
 * @returns {Array} - Array of table objects
 */
function detectTables(text) {
  const tables = [];
  const lines = text.split('\n');
  
  let currentTable = [];
  let tableHeader = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect table rows (lines with multiple values separated by spaces/tabs)
    const hasMultipleValues = (line.match(/\s{2,}|\t/g) || []).length >= 2;
    const hasNumbers = /\d/.test(line);
    
    if (hasMultipleValues && hasNumbers && line.length > 10) {
      if (currentTable.length === 0 && i > 0) {
        // Previous line might be the header
        tableHeader = lines[i - 1].trim();
      }
      currentTable.push(line);
    } else if (currentTable.length > 0) {
      // End of table
      if (currentTable.length >= 2) {
        tables.push({
          header: tableHeader || 'Table',
          rows: currentTable,
        });
      }
      currentTable = [];
      tableHeader = '';
    }
  }
  
  // Add last table if exists
  if (currentTable.length >= 2) {
    tables.push({
      header: tableHeader || 'Table',
      rows: currentTable,
    });
  }
  
  return tables;
}

/**
 * Main export function with enhanced parsing
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} - Enhanced parsing result
 */
async function parseEnhanced(buffer) {
  const data = await extractTextWithPageMarkers(buffer);
  const cleanText = cleanExtractedText(data.text);
  const tables = detectTables(cleanText);
  
  return {
    text: data.text,
    cleanText,
    numpages: data.numpages,
    tables,
    info: data.info,
  };
}

// Maintain backward compatibility - default export
module.exports = pdfParse;

// Enhanced export
module.exports.parseEnhanced = parseEnhanced;
module.exports.extractTextWithPageMarkers = extractTextWithPageMarkers;
module.exports.cleanExtractedText = cleanExtractedText;
module.exports.detectTables = detectTables;

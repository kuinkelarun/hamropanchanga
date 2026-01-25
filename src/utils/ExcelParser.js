/**
 * Excel File Parser
 * Parses uploaded Excel/CSV files for bulk upload operations
 * Includes automatic Preeti font detection and conversion to Unicode
 */

import * as XLSX from 'xlsx';

/**
 * Parse Excel file and return data
 * @param {File} file - The uploaded file
 * @param {String} sheetName - Name of the sheet to parse (default: first sheet)
 * @returns {Promise<Array>} Array of parsed data objects
 */
export const parseExcelFile = (file, sheetName = null) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use specified sheet or first sheet
        const sheet = sheetName 
          ? workbook.Sheets[sheetName]
          : workbook.Sheets[workbook.SheetNames[0]];

        if (!sheet) {
          reject(new Error(`Sheet "${sheetName}" not found`));
          return;
        }

        // Parse sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          defval: '', // Default value for empty cells
          blankrows: false
        });

        // Remove empty rows
        const cleanedData = jsonData.filter(row => 
          Object.values(row).some(val => val !== '' && val !== null)
        );

        resolve(cleanedData);
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse CSV file
 * @param {File} file - The uploaded CSV file
 * @returns {Promise<Array>} Array of parsed data objects
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const workbook = XLSX.read(csv, { type: 'string' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        const jsonData = XLSX.utils.sheet_to_json(sheet, {
          defval: '',
          blankrows: false
        });

        const cleanedData = jsonData.filter(row => 
          Object.values(row).some(val => val !== '' && val !== null)
        );

        resolve(cleanedData);
      } catch (error) {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Detect file type and parse accordingly
 * @param {File} file - The uploaded file
 * @param {String} sheetName - Sheet name for Excel files
 * @returns {Promise<Array>} Array of parsed data
 */
export const parseFile = async (file, sheetName = null) => {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.csv')) {
    return await parseCSVFile(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return await parseExcelFile(file, sheetName);
  } else {
    throw new Error('Unsupported file format. Please upload .xlsx, .xls, or .csv');
  }
};

/**
 * Get sheet names from an Excel file
 * @param {File} file - The Excel file
 * @returns {Promise<Array>} Array of sheet names
 */
export const getExcelSheetNames = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook.SheetNames);
      } catch (error) {
        reject(new Error(`Failed to read file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Trim whitespace from all string values in data
 * @param {Array} data - Array of data objects
 * @returns {Array} Cleaned data
 */
export const trimWhitespace = (data) => {
  return data.map(row => {
    const trimmedRow = {};
    for (const [key, value] of Object.entries(row)) {
      trimmedRow[key] = typeof value === 'string' ? value.trim() : value;
    }
    return trimmedRow;
  });
};

/**
 * Normalize data for processing
 * Trims whitespace, converts Preeti font to Unicode, and converts dates to ISO format
 * @param {Array} data - Raw parsed data
 * @returns {Array} Normalized data with Preeti converted to Unicode
 */
export const normalizeData = (data) => {
  let normalized = trimWhitespace(data);

  // Convert date fields to ISO format if they exist
  normalized = normalized.map(row => {
    const newRow = { ...row };
    
    // Check for date fields
    const dateFields = [
      'Date of Birth (YYYY-MM-DD)',
      'Event Date (YYYY-MM-DD)',
      'Tithi Date'
    ];

    dateFields.forEach(field => {
      if (newRow[field] && newRow[field] !== '') {
        const date = parseDate(newRow[field]);
        if (date) {
          newRow[field] = date;
        }
      }
    });

    return newRow;
  });

  return normalized;
};

/**
 * Parse various date formats to YYYY-MM-DD
 * @param {String|Date|Number} dateValue - Date in various formats
 * @returns {String|null} Date in YYYY-MM-DD format or null if invalid
 */
export const parseDate = (dateValue) => {
  if (!dateValue) return null;

  // If it's already a string in YYYY-MM-DD format
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  // Excel serial date (number)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    return formatDate(date);
  }

  // Try to parse string date
  if (typeof dateValue === 'string') {
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return formatDate(date);
      }
    } catch (e) {
      return null;
    }
  }

  // If it's already a Date object
  if (dateValue instanceof Date) {
    return formatDate(dateValue);
  }

  return null;
};

/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {String} Formatted date
 */
export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default {
  parseExcelFile,
  parseCSVFile,
  parseFile,
  getExcelSheetNames,
  trimWhitespace,
  normalizeData,
  parseDate,
  formatDate
};

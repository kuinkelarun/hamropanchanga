/**
 * Validation logic for Admin bulk upload (Tithis & Events).
 * Extracted from AdminManagement.js for maintainability.
 */

import { nepaliMonths, parseNepaliDate, getTithiIndexByName, getTithiLunarMonthName } from './nepaliDateUtils';
import { normalizePakshaToEnglish } from '../constants/calendarConstants';
import { normalizeTimeTo24 } from './adminUtils';

/**
 * Validate an array of parsed tithi rows from an Excel upload.
 *
 * @param {Object[]} jsonData - Rows parsed from the Excel sheet.
 * @param {Object}   results  - Accumulator with `valid`, `invalid`, `problematic`, `toAdd`, `toUpdate` arrays.
 * @param {Object}   opts
 * @param {Object[]} opts.existingTithis   - Current tithis already in Firestore (used for duplicate detection).
 * @param {Object|null} opts.calendarData  - Admin calendar year data (passed to parseNepaliDate).
 */
export function validateTithisData(jsonData, results, { existingTithis = [], calendarData = null } = {}) {
  jsonData.forEach((row, index) => {
    const errors = [];
    const rowNum = index + 2; // +2 because Excel starts at 1 and we have header row

    // Required fields
    const tithi = row['Tithi*']?.toString().trim();
    const pakshya = row['Pakshya*']?.toString().trim();
    // Support both old 'Month Name (Nepali)*' and new 'Tithi Month (Nepali)*'
    const monthName = (row['Tithi Month (Nepali)*'] || row['Month Name (Nepali)*'])?.toString().trim();
    const startDateRaw = row['Start Date* (YYYY-MM-DD Nepali)']?.toString().trim();
    const startTime = row['Start Time* (HH:MM)']?.toString().trim();
    const endDateRaw = row['End Date* (YYYY-MM-DD Nepali)']?.toString().trim();
    const endTime = row['End Time* (HH:MM)']?.toString().trim();
    const addOrReplace = row['AddOrReplace*']?.toString().trim().toUpperCase();

    if (!tithi) errors.push('Tithi is required');
    if (!pakshya) errors.push('Pakshya is required');
    if (!monthName) errors.push('Month Name (Nepali) is required');
    if (!startDateRaw) errors.push('Start Date is required');
    if (!startTime) errors.push('Start Time is required');
    if (!endDateRaw) errors.push('End Date is required');
    if (!endTime) errors.push('End Time is required');
    if (!addOrReplace) errors.push('AddOrReplace is required');

    // Validate pakshya value
    if (pakshya && pakshya !== 'शुक्लपक्ष' && pakshya !== 'कृष्णपक्ष') {
      errors.push('Pakshya must be either शुक्लपक्ष or कृष्णपक्ष');
    }

    // Validate month name
    if (monthName && !nepaliMonths.includes(monthName)) {
      errors.push(`Month Name must be one of: ${nepaliMonths.join(', ')}`);
    }

    // Validate AddOrReplace value
    if (addOrReplace && addOrReplace !== 'ADD' && addOrReplace !== 'REPLACE') {
      errors.push('AddOrReplace must be either ADD or REPLACE');
    }

    // Parse Nepali dates to AD format
    const startDate = startDateRaw ? parseNepaliDate(startDateRaw, calendarData) : null;
    const endDate = endDateRaw ? parseNepaliDate(endDateRaw, calendarData) : null;

    if (startDateRaw && !startDate) {
      errors.push('Start Date must be in YYYY-MM-DD format (Nepali)');
    }
    if (endDateRaw && !endDate) {
      errors.push('End Date must be in YYYY-MM-DD format (Nepali)');
    }

    const parsedStartTime = normalizeTimeTo24(startTime);
    const parsedEndTime = normalizeTimeTo24(endTime);
    if (!parsedStartTime) errors.push('Start Time must be in HH:MM (24h) or h:MM AM/PM format');
    if (!parsedEndTime) errors.push('End Time must be in HH:MM (24h) or h:MM AM/PM format');

    // Validate date range (only if both dates are valid)
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.push('End Date cannot be before Start Date');
    }

    // Validate Tithi Month registration
    if (startDate && pakshya && tithi && monthName && errors.length === 0) {
      const tithiIndex = getTithiIndexByName(tithi);
      const pakshaNormalized = normalizePakshaToEnglish(pakshya);

      if (tithiIndex) {
        const calculatedLunarMonth = getTithiLunarMonthName(pakshaNormalized, tithiIndex, startDate);
        if (calculatedLunarMonth && calculatedLunarMonth !== monthName) {
          errors.push(
            `Tithi Month Mismatch: ${tithi} (${pakshya}) on ${startDate} falls in "${calculatedLunarMonth}" ` +
            `Tithi Month, but you specified "${monthName}". This tithi may not occur in the specified month. ` +
            `Verify the dates are correct for this tithi.`
          );
        }
      }
    }

    // If dates are equal, check time ordering
    let isProblematic = false;
    if (startDate && endDate && startDate === endDate && parsedStartTime && parsedEndTime) {
      const startMs = new Date(`${startDate}T${parsedStartTime}:00`).getTime();
      const endMs = new Date(`${endDate}T${parsedEndTime}:00`).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
        isProblematic = true;
      }
    }

    if (errors.length > 0) {
      results.invalid.push({ row: rowNum, data: row, errors });
    } else if (isProblematic) {
      results.problematic.push({ row: rowNum, data: row, reason: 'End time is earlier than start time on the same date' });
    } else {
      const fullName = `${pakshya} ${tithi}`;

      const tithiData = {
        name: fullName,
        startDate,
        startTime: parsedStartTime || startTime,
        endDate,
        endTime: parsedEndTime || endTime,
        addOrReplace
      };

      const categoryValue = row['Category (optional)']?.toString().trim();
      if (categoryValue) {
        tithiData.category = categoryValue;
      }

      // Check if exists
      const existing = existingTithis.find(t =>
        t.name === tithiData.name &&
        t.startDate === tithiData.startDate &&
        t.startTime === tithiData.startTime
      );
      if (existing) {
        tithiData.id = existing.id;
        results.toUpdate.push(tithiData);
      } else {
        results.toAdd.push(tithiData);
      }
      results.valid.push({ row: rowNum, ...tithiData });
    }
  });
}

/**
 * Validate an array of parsed event rows from an Excel upload.
 *
 * @param {Object[]} jsonData
 * @param {Object}   results
 * @param {Object}   opts
 * @param {Object[]} opts.existingEvents
 * @param {Object|null} opts.calendarData
 */
export function validateEventsData(jsonData, results, { existingEvents = [], calendarData = null } = {}) {
  jsonData.forEach((row, index) => {
    const errors = [];
    const rowNum = index + 2;

    const title = row['Title*']?.toString().trim();
    const description = row['Description']?.toString().trim() || '';
    const dateRaw = row['Date* (MM-DD-YYYY Nepali)']?.toString().trim();
    const isPublicStr = row['Is Public* (TRUE/FALSE)']?.toString().trim().toUpperCase();
    const addOrReplace = row['AddOrReplace*']?.toString().trim().toUpperCase();

    if (!title) errors.push('Title is required');
    if (!dateRaw) errors.push('Date is required');
    if (!isPublicStr) errors.push('Is Public is required');
    if (!addOrReplace) errors.push('AddOrReplace is required');

    const dateKey = dateRaw ? parseNepaliDate(dateRaw, calendarData) : null;

    if (dateRaw && !dateKey) {
      errors.push('Date must be in YYYY-MM-DD format (Nepali)');
    }

    if (isPublicStr && isPublicStr !== 'TRUE' && isPublicStr !== 'FALSE') {
      errors.push('Is Public must be TRUE or FALSE');
    }

    if (addOrReplace && addOrReplace !== 'ADD' && addOrReplace !== 'REPLACE') {
      errors.push('AddOrReplace must be either ADD or REPLACE');
    }

    if (errors.length > 0) {
      results.invalid.push({ row: rowNum, data: row, errors });
    } else {
      const eventData = {
        title,
        description,
        dateKey,
        isPublic: isPublicStr === 'TRUE',
        associatedPerson: row['Associated Person (optional)']?.toString().trim() || '',
        addOrReplace
      };

      const existing = existingEvents.find(e => e.title === eventData.title && e.dateKey === eventData.dateKey);
      if (existing) {
        eventData.id = existing.id;
        results.toUpdate.push(eventData);
      } else {
        results.toAdd.push(eventData);
      }
      results.valid.push({ row: rowNum, ...eventData });
    }
  });
}

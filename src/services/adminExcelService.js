/**
 * Excel template download, data export, and tithi auto-generation logic.
 * Extracted from AdminManagement.js for maintainability. Seperated from adminmanagement page.
 */

import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import {
  formatAdDateToNepaliStringWithNumerals,
  formatNepaliDateTime,
  getTithiYearFromAdDate,
  getTithiLunarMonthName,
  getTithiIndexByName
} from '../utils/nepaliDateUtils';
import { normalizePakshaToEnglish, normalizePakshaToNepali, SHUKLA_TITHI_NAMES, KRISHNA_TITHI_NAMES } from '../constants/calendarConstants';
import { getEphemerisData, computeTithiFromLongitudes } from '../utils/ephemeris';

/**
 * Download an Excel template for either Tithis or Events.
 * @param {string} activeTab - 'tithis' or 'events'
 * @returns {{ fileName: string }} The name of the generated file
 */
export function downloadTemplate(activeTab) {
  const wb = XLSX.utils.book_new();

  if (activeTab === 'tithis') {
    const wsData = [
      ['Tithi*', 'Pakshya*', 'Tithi Year*', 'Tithi Month (Nepali)*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
      ['एकादशी', 'शुक्लपक्ष', '2082', 'आषाढ', '२०८२-०७-३१', '06:00', '२०८२-०८-०१', '18:00', 'ADD', 'Festival'],
      ['अष्टमी', 'कृष्णपक्ष', '2082', 'श्रावण', '२०८२-०८-०६', '10:00', '२०८२-०८-०६', '22:00', 'ADD', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];

    if (!ws['!dataValidation']) ws['!dataValidation'] = [];
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'B2:B1000', formulas: ['"शुक्लपक्ष,कृष्णपक्ष"'] });
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'I2:I1000', formulas: ['"ADD,REPLACE"'] });

    XLSX.utils.book_append_sheet(wb, ws, 'Tithis');

    // Reference sheet
    const tithiReference = [
      ['Tithi Month System', '', '', ''],
      ['', '', '', ''],
      ['About Tithi Months:', '', '', ''],
      ['Tithi Months are lunar cycles, NOT Nepali calendar months', '', '', ''],
      ['Each Tithi Month runs from:', 'कृष्णपक्ष प्रतिपदा (Krishna day 1)', 'to', 'शुक्लपक्ष पूर्णिमा (Shukla day 15)'],
      ['Tithi Year starts:', 'वैशाख कृष्णपक्ष प्रतिपदा', 'and ends with', 'चैत्र शुक्लपक्ष पूर्णिमा'],
      ['', '', '', ''],
      ['Nepali Months', 'Pakshya Values', 'Shukla Pakshya Tithis', 'Krishna Pakshya Tithis'],
      ['वैशाख', 'शुक्लपक्ष', 'प्रतिपदा', 'प्रतिपदा'],
      ['ज्येष्ठ', 'कृष्णपक्ष', 'द्वितीया', 'द्वितीया'],
      ['आषाढ', '', 'तृतीया', 'तृतीया'],
      ['श्रावण', '', 'चतुर्थी', 'चतुर्थी'],
      ['भाद्र', '', 'पञ्चमी', 'पञ्चमी'],
      ['आश्विन', '', 'षष्ठी', 'षष्ठी'],
      ['कार्तिक', '', 'सप्तमी', 'सप्तमी'],
      ['मार्ग', '', 'अष्टमी', 'अष्टमी'],
      ['पौष', '', 'नवमी', 'नवमी'],
      ['माघ', '', 'दशमी', 'दशमी'],
      ['फाल्गुन', '', 'एकादशी', 'एकादशी'],
      ['चैत्र', '', 'द्वादशी', 'द्वादशी'],
      ['', '', 'त्रयोदशी', 'त्रयोदशी'],
      ['', '', 'चतुर्दशी', 'चतुर्दशी'],
      ['', '', 'पूर्णिमा', 'औंसी'],
      ['', '', '', ''],
      ['Instructions:', '', '', ''],
      ['1. Enter only the Tithi name (e.g., एकादशी) in Tithi column', '', '', ''],
      ['2. Select Pakshya from dropdown: शुक्लपक्ष or कृष्णपक्ष', '', '', ''],
      ['3. Month Name MUST match a Nepali month where that Tithi Month begins', '', '', ''],
      ['   (determined by when कृष्णपक्ष प्रतिपदा of that cycle occurs)', '', '', ''],
      ['4. Date format: YYYY-MM-DD Nepali (e.g., २०८२-०७-३१)', '', '', ''],
      ['5. Time format: HH:MM in 24-hour (e.g., 06:00, 18:00)', '', '', ''],
      ['6. Tithi months may span calendar month boundaries', '', '', ''],
      ['7. AddOrReplace: ADD (append) or REPLACE (delete existing for date & add new)', '', '', ''],
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(tithiReference);
    wsRef['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
  } else {
    const wsData = [
      ['Title*', 'Description', 'Date* (YYYY-MM-DD Nepali)', 'Is Public* (TRUE/FALSE)', 'AddOrReplace*', 'Associated Person (optional)'],
      ['Family Gathering', 'Annual family reunion', '२०८२-०९-१०', 'TRUE', 'ADD', 'John Doe'],
      ['Birthday Celebration', 'Grandmother\'s birthday', '२०८२-०८-१६', 'FALSE', 'ADD', 'Mary Smith'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 35 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 25 }];

    if (!ws['!dataValidation']) ws['!dataValidation'] = [];
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'D2:D1000', formulas: ['"TRUE,FALSE"'] });
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'E2:E1000', formulas: ['"ADD,REPLACE"'] });

    XLSX.utils.book_append_sheet(wb, ws, 'Events');

    const eventReference = [
      ['Instructions:', ''],
      ['1. Title is required - brief event name', ''],
      ['2. Description is optional - detailed information', ''],
      ['3. Date format: YYYY-MM-DD Nepali (e.g., २०८२-०९-१०)', ''],
      ['4. Is Public: Select TRUE or FALSE from dropdown', ''],
      ['   - TRUE: Visible to all users', ''],
      ['   - FALSE: Only visible to you', ''],
      ['5. AddOrReplace: ADD (append) or REPLACE (delete existing for date & add new)', ''],
      ['6. Associated Person is optional', ''],
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(eventReference);
    wsRef['!cols'] = [{ wch: 45 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
  }

  const fileName = activeTab === 'tithis' ? 'Tithis_Template.xlsx' : 'Events_Template.xlsx';
  XLSX.writeFile(wb, fileName);
  return { fileName };
}

/**
 * Export existing tithis or events to Excel.
 * @param {string}   activeTab
 * @param {Object[]} tithis
 * @param {Object[]} events
 * @returns {{ fileName: string, count: number, duplicatesRemoved?: number }}
 */
export function exportData(activeTab, tithis, events) {
  const wb = XLSX.utils.book_new();

  if (activeTab === 'tithis') {
    const seen = new Set();
    const uniqueRows = [];
    tithis.forEach(t => {
      const nameParts = (t.name || '').split(' ');
      const pakshya = nameParts[0] || '';
      const tithi = nameParts.slice(1).join(' ') || t.name || '';
      const pakshType = normalizePakshaToEnglish(pakshya);
      const tithiIndex = getTithiIndexByName(tithi);
      const tithiLunarMonthName = getTithiLunarMonthName(pakshType, tithiIndex, t.startDate || '');
      const tithiYearInfo = getTithiYearFromAdDate(t.startDate || '', null, pakshType, tithiIndex);
      const tithiYear = tithiYearInfo.tithiYear || '';

      const row = [
        tithi, pakshya, tithiYear, tithiLunarMonthName,
        formatAdDateToNepaliStringWithNumerals(t.startDate),
        t.startTime || '',
        formatAdDateToNepaliStringWithNumerals(t.endDate),
        t.endTime || '',
        'ADD'
      ];
      const key = `${tithi}|${pakshya}|${t.startDate || ''}|${t.startTime || ''}|${t.endDate || ''}|${t.endTime || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRows.push(row);
      }
    });

    const wsData = [
      ['Tithi*', 'Pakshya*', 'Tithi Year*', 'Tithi Month (Nepali)*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*'],
      ...uniqueRows
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Tithis');
    XLSX.writeFile(wb, 'Tithis_Export.xlsx');
    return { fileName: 'Tithis_Export.xlsx', count: uniqueRows.length, duplicatesRemoved: tithis.length - uniqueRows.length };
  } else {
    const wsData = [
      ['Title*', 'Description', 'Date* (YYYY-MM-DD Nepali)', 'Is Public* (TRUE/FALSE)', 'AddOrReplace*'],
      ...events.map(e => [
        e.title || '',
        e.description || '',
        formatAdDateToNepaliStringWithNumerals(e.dateKey),
        e.isPublic ? 'TRUE' : 'FALSE',
        'ADD'
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 30 }, { wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Events');
    XLSX.writeFile(wb, 'Events_Export.xlsx');
    return { fileName: 'Events_Export.xlsx', count: events.length };
  }
}

/**
 * Export problematic validation rows to Excel for audit.
 * @param {Object} validationResults
 * @returns {{ fileName: string, count: number } | null}
 */
export function exportProblematicRows(validationResults) {
  if (!validationResults || !validationResults.problematic || validationResults.problematic.length === 0) {
    return null;
  }

  const wb = XLSX.utils.book_new();
  const header = ['Row', 'Tithi', 'Pakshya', 'Start Date (Nepali)', 'Start Time', 'End Date (Nepali)', 'End Time', 'AddOrReplace', 'Category', 'Reason'];
  const wsData = [header];

  validationResults.problematic.forEach(item => {
    const row = item.data || {};
    wsData.push([
      item.row || '',
      row['Tithi*'] || row['Tithi'] || '',
      row['Pakshya*'] || row['Pakshya'] || '',
      row['Start Date* (MM-DD-YYYY Nepali)'] || row['Start Date'] || '',
      row['Start Time* (HH:MM)'] || row['Start Time'] || '',
      row['End Date* (MM-DD-YYYY Nepali)'] || row['End Date'] || '',
      row['End Time* (HH:MM)'] || row['End Time'] || '',
      row['AddOrReplace*'] || row['AddOrReplace'] || '',
      row['Category (optional)'] || '',
      item.reason || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Problematic Rows');

  const fileName = `Problematic_Rows_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { fileName, count: validationResults.problematic.length };
}

/**
 * Download all loaded trees as an Excel file.
 * @param {Object[]} trees
 * @returns {{ fileName: string, count: number }}
 */
export function downloadTreesExcel(trees) {
  const exportRows = (trees || []).map(t => ({
    'Tree Name *': t.title || '',
    'Primary Member Name *': t.primaryMemberName || '',
    'Contact Information *': t.contactInfo || t.contact || '',
    'Location *': t.location || '',
    'Owner': t.ownerEmail || t.ownerUid || ''
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Trees');
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const fileName = `trees_export_${ts}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return { fileName, count: exportRows.length };
}

/**
 * Generate a Tithi Excel file for a given AD date range using ephemeris calculations.
 *
 * @param {string} startDateStr - YYYY-MM-DD AD start
 * @param {string} endDateStr   - YYYY-MM-DD AD end
 * @param {Object} callbacks
 * @param {Function} callbacks.setAutoProgress
 * @param {Function} callbacks.setAutoStatus
 * @returns {Promise<{ fileName: string, count: number, duplicatesSkipped: number, outOfRangeSkipped: number } | null>}
 */
export async function generateTithiExcel(startDateStr, endDateStr, { setAutoProgress, setAutoStatus }) {
  if (!startDateStr || !endDateStr) {
    setAutoStatus('❌ Please select both start and end dates');
    return null;
  }

  const start = new Date(`${startDateStr}T00:00:00Z`);
  const end = new Date(`${endDateStr}T00:00:00Z`);

  if (start > end) {
    setAutoStatus('❌ Start date must be before end date');
    return null;
  }

  setAutoProgress(0);
  setAutoStatus('🔄 Calculating Tithis...');

  try {
    // Load calendar configuration from Firestore
    let adminCalendarData = null;
    try {
      const calendarSnap = await getDocs(collection(db, COLLECTIONS.NEPALI_CALENDAR_YEARS));
      if (!calendarSnap.empty) {
        adminCalendarData = {};
        calendarSnap.docs.forEach(doc => {
          const year = parseInt(doc.id);
          adminCalendarData[year] = {
            startAdDate: doc.data().startAdDate,
            daysInMonths: doc.data().daysInMonths || []
          };
        });
        console.log('Loaded admin calendar data for years:', Object.keys(adminCalendarData).sort((a, b) => a - b).join(', '));
      }
    } catch (err) {
      console.warn('Could not load admin calendar data from Firestore:', err);
    }

    const candidateRows = [];
    const seenStartIsos = new Set();
    let duplicatesSkipped = 0;
    let outOfRangeSkipped = 0;
    const rangeStartEpoch = start.getTime();
    const rangeEndExclusive = end.getTime() + 24 * 60 * 60 * 1000;

    const diagnostics = [];
    let current = new Date(rangeStartEpoch);
    const maxIterations = 1000;
    let iter = 0;

    const shuklaNames = SHUKLA_TITHI_NAMES;
    const krishnaNames = KRISHNA_TITHI_NAMES;

    while (current.getTime() < rangeEndExclusive && iter < maxIterations) {
      iter++;
      let ephemerisData;
      try {
        ephemerisData = await getEphemerisData(current);
      } catch (error) {
        console.error('Error computing ephemeris for', current.toISOString(), ':', error);
        setAutoStatus(`❌ Ephemeris computation error: ${error.message}`);
        return null;
      }

      if (!ephemerisData || typeof ephemerisData !== 'object' || !ephemerisData.tithiStart || !ephemerisData.tithiEnd) {
        current = new Date(current.getTime() + 12 * 60 * 60 * 1000);
        continue;
      }

      const tithiResult = computeTithiFromLongitudes(ephemerisData.moonLon, ephemerisData.sunLon);
      let finalTithiResult = tithiResult;
      if (!tithiResult || typeof tithiResult !== 'object' || !tithiResult.paksha) {
        finalTithiResult = { paksha: 'Shukla', pakshaIndex: 1 };
      }

      let startTimeUTC = new Date(ephemerisData.tithiStart);
      let endTimeUTC = new Date(ephemerisData.tithiEnd);
      if (!isNaN(startTimeUTC.getTime()) && !isNaN(endTimeUTC.getTime()) && endTimeUTC.getTime() < startTimeUTC.getTime()) {
        const tmp = startTimeUTC; startTimeUTC = endTimeUTC; endTimeUTC = tmp;
      }

      if (isNaN(startTimeUTC.getTime()) || isNaN(endTimeUTC.getTime())) {
        current = new Date(current.getTime() + 12 * 60 * 60 * 1000);
        continue;
      }

      const startFmt = formatNepaliDateTime(startTimeUTC, adminCalendarData);
      const endFmt = formatNepaliDateTime(endTimeUTC, adminCalendarData);
      const startNepaliDate = formatAdDateToNepaliStringWithNumerals(startFmt.adDateIso, adminCalendarData);
      const endNepaliDate = formatAdDateToNepaliStringWithNumerals(endFmt.adDateIso, adminCalendarData);
      const startTimeStr = startFmt.time24;
      const endTimeStr = endFmt.time24;

      const pakshya = normalizePakshaToNepali(finalTithiResult.paksha);
      const tithiNames = finalTithiResult.paksha === 'Shukla' ? shuklaNames : krishnaNames;
      const tithiName = tithiNames[finalTithiResult.pakshaIndex - 1] || `Tithi ${finalTithiResult.pakshaIndex}`;

      const startIso = startTimeUTC.toISOString();
      const endIso = endTimeUTC.toISOString();
      const startEpoch = startTimeUTC.getTime();

      const inRange = (startEpoch >= rangeStartEpoch && startEpoch < rangeEndExclusive);
      const isDuplicate = seenStartIsos.has(startIso);

      const startFmtLocal = formatNepaliDateTime(startTimeUTC, adminCalendarData);
      diagnostics.push({
        seedDateUtc: current.toISOString(),
        tithiStartUtc: startIso,
        tithiEndUtc: endIso,
        startEpoch,
        paksha: finalTithiResult.paksha,
        pakshaIndex: finalTithiResult.pakshaIndex,
        tithiName,
        inRange,
        isDuplicate,
        startAdDateNpt: startFmtLocal ? startFmtLocal.adDateIso : null,
        startBsDate: startFmtLocal ? startFmtLocal.bsDate : null
      });

      if (!inRange) {
        outOfRangeSkipped++;
      } else if (isDuplicate) {
        duplicatesSkipped++;
      } else {
        seenStartIsos.add(startIso);
        const tithiLunarMonthName = getTithiLunarMonthName(finalTithiResult.paksha, finalTithiResult.pakshaIndex, startFmtLocal?.adDateIso || '');
        const tithiYearInfo = getTithiYearFromAdDate(startFmtLocal?.adDateIso || '', null, finalTithiResult.paksha, finalTithiResult.pakshaIndex);
        const tithiYear = tithiYearInfo.tithiYear || '';

        candidateRows.push({
          startIsoUtc: startIso,
          endIsoUtc: endIso,
          startEpoch,
          row: [tithiName, pakshya, tithiYear, tithiLunarMonthName, startNepaliDate, startTimeStr, endNepaliDate, endTimeStr, 'ADD', '']
        });
      }

      current = new Date(endTimeUTC.getTime() + 1000);
      const progress = Math.min(100, Math.round(((current.getTime() - rangeStartEpoch) / (rangeEndExclusive - rangeStartEpoch)) * 100));
      setAutoProgress(progress);
    }

    if (candidateRows.length === 0) {
      setAutoStatus('❌ No Tithi data calculated for the selected range');
      return null;
    }

    candidateRows.sort((a, b) => a.startEpoch - b.startEpoch);

    const wb = XLSX.utils.book_new();
    const wsData = [
      ['Tithi*', 'Pakshya*', 'Tithi Year*', 'Tithi Month (Nepali)*', 'Start Date* (YYYY-MM-DD Nepali)', 'Start Time* (HH:MM)', 'End Date* (YYYY-MM-DD Nepali)', 'End Time* (HH:MM)', 'AddOrReplace*', 'Category (optional)'],
      ...candidateRows.map(c => c.row)
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];

    if (!ws['!dataValidation']) ws['!dataValidation'] = [];
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'B2:B1000', formulas: ['"शुक्लपक्ष,कृष्णपक्ष"'] });
    ws['!dataValidation'].push({ type: 'list', allowBlank: false, sqref: 'G2:G1000', formulas: ['"ADD,REPLACE"'] });

    XLSX.utils.book_append_sheet(wb, ws, 'Tithis');

    try {
      const diagWs = XLSX.utils.json_to_sheet(diagnostics.map(d => ({
        seedDateUtc: d.seedDateUtc,
        tithiStartUtc: d.tithiStartUtc,
        tithiEndUtc: d.tithiEndUtc,
        startEpoch: d.startEpoch,
        paksha: d.paksha,
        pakshaIndex: d.pakshaIndex,
        tithiName: d.tithiName,
        inRange: d.inRange ? 'YES' : 'NO',
        isDuplicate: d.isDuplicate ? 'YES' : 'NO'
      })));
      XLSX.utils.book_append_sheet(wb, diagWs, 'Diagnostics');
    } catch (diagErr) {
      console.warn('Failed to append diagnostics sheet:', diagErr);
    }

    const fileName = `Tithis_Auto_${startDateStr.replace(/-/g, '')}_to_${endDateStr.replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    const generated = candidateRows.length;
    const removedMsgParts = [];
    if (duplicatesSkipped > 0) removedMsgParts.push(`${duplicatesSkipped} duplicate${duplicatesSkipped > 1 ? 's' : ''} skipped`);
    if (outOfRangeSkipped > 0) removedMsgParts.push(`${outOfRangeSkipped} out-of-range${outOfRangeSkipped > 1 ? ' rows' : ' row'} skipped`);
    const removedMsg = removedMsgParts.length > 0 ? ` (${removedMsgParts.join(', ')})` : '';
    setAutoStatus(`✅ Generated ${generated} Tithi records in ${fileName}${removedMsg}`);
    setAutoProgress(100);

    return { fileName, count: generated, duplicatesSkipped, outOfRangeSkipped };
  } catch (error) {
    console.error('Error generating Tithi Excel:', error);
    setAutoStatus('❌ Error generating Tithi Excel: ' + error.message);
    return null;
  }
}

/**
 * Bulk Upload Template Generator
 * Generates downloadable Excel templates for bulk tree, member, and event uploads
 * Fields mapped exactly from UI forms: MemberModal, AddEventForm, TreeSelectionPage
 */

import * as XLSX from 'xlsx';

/**
 * Generate Tree Upload Template
 * For creating multiple trees at once
 * Fields from TreeSelectionPage tree creation form
 */
export const generateTreeTemplate = () => {
  const templateData = [
    {
      'Tree Name *': 'Smith Family',
      'Primary Member Name *': 'John Smith',
      'Contact Information *': '+1-555-0101',
      'Location *': 'New York, USA'
    },
    {
      'Tree Name *': 'Johnson Household',
      'Primary Member Name *': 'Mary Johnson',
      'Contact Information *': '+1-555-0102',
      'Location *': 'Boston, USA'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 30 },  // Tree Name
    { wch: 30 },  // Primary Member Name
    { wch: 25 },  // Contact Information
    { wch: 30 }   // Location
  ];

  // Add header formatting hints
  const headerStyle = {
    fill: { fgColor: { rgb: 'FFE699' } },
    font: { bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'thin' } }
  };

  for (let col of ['A1', 'B1', 'C1', 'D1']) {
    if (ws[col]) {
      ws[col].s = headerStyle;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trees');

  // Add instruction sheet
  const instructionData = [
    ['Trees Upload Template - Instructions'],
    [],
    ['FIELD DESCRIPTIONS:'],
    ['Tree Name *', 'REQUIRED - Unique name for the family tree. Max 255 characters.'],
    ['Primary Member Name *', 'REQUIRED - Name of the main family member. Max 255 characters.'],
    ['Contact Information *', 'REQUIRED - Phone number or email to contact. Format: +1-555-0101 or email@example.com'],
    ['Location *', 'REQUIRED - City and Country where family is based. Format: City, Country'],
    [],
    ['RULES:'],
    ['• All fields are REQUIRED', 'Tree cannot be created with missing fields'],
    ['• Tree Name must be unique', 'Duplicate tree names will be rejected'],
    ['• Maximum 255 characters per field', 'Longer text will be truncated'],
    ['• Do not modify column headers', 'Keep the exact column structure'],
    ['• Contact Info can be phone or email', 'Use valid phone (+1-555-0101) or email format'],
    [],
    ['EXAMPLE ENTRIES:'],
    ['Anderson Family Tree', 'Robert Anderson', '+1-212-555-0123', 'New York, USA'],
    ['Kumar Family', 'Rajesh Kumar', 'rajesh@example.com', 'Mumbai, India'],
    ['Lopez Clan', 'Maria Lopez', '+34-91-555-0123', 'Madrid, Spain']
  ];

  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 40 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instructionSheet, 'Instructions');

  XLSX.writeFile(wb, 'Family_Tree_Template.xlsx');
};


/**
 * Generate Family Member Upload Template
 * For adding multiple family members to existing trees
 * Fields mapped from MemberModal: name, nickname, gender, dob, location, photo, notes, status, dod
 */
export const generateMemberTemplate = () => {
  const templateData = [
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'John Smith',
      'Nickname': 'Jack',
      'Gender': 'Male',
      'DOB Year': '1950',
      'DOB Month': '05',
      'DOB Day': '15',
      'Status': 'Alive',
      'DOD Year': '',
      'DOD Month': '',
      'DOD Day': '',
      'Location': 'New York, USA',
      'Photo URL': 'https://example.com/photos/john.jpg',
      'Notes': 'Family patriarch, business owner'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'Mary Smith',
      'Nickname': '',
      'Gender': 'Female',
      'DOB Year': '1952',
      'DOB Month': '03',
      'DOB Day': '20',
      'Status': 'Alive',
      'DOD Year': '',
      'DOD Month': '',
      'DOD Day': '',
      'Location': 'New York, USA',
      'Photo URL': '',
      'Notes': 'Family matriarch, retired teacher'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'Robert Smith',
      'Nickname': 'Bob',
      'Gender': 'Male',
      'DOB Year': '1975',
      'DOB Month': '07',
      'DOB Day': '10',
      'Status': 'Passed Away',
      'DOD Year': '2020',
      'DOD Month': '12',
      'DOD Day': '25',
      'Location': 'Boston, USA',
      'Photo URL': '',
      'Notes': 'Eldest son'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  
  ws['!cols'] = [
    { wch: 20 },  // Tree Name
    { wch: 25 },  // Member Name
    { wch: 20 },  // Nickname
    { wch: 12 },  // Gender
    { wch: 12 },  // DOB Year
    { wch: 12 },  // DOB Month
    { wch: 12 },  // DOB Day
    { wch: 15 },  // Status
    { wch: 12 },  // DOD Year
    { wch: 12 },  // DOD Month
    { wch: 12 },  // DOD Day
    { wch: 25 },  // Location
    { wch: 35 },  // Photo URL
    { wch: 40 }   // Notes
  ];

  const headerStyle = {
    fill: { fgColor: { rgb: 'B4C7E7' } },
    font: { bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'thin' } }
  };

  for (let col of ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'M1', 'N1']) {
    if (ws[col]) {
      ws[col].s = headerStyle;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');

  // Add instruction sheet
  const instructionData = [
    ['Family Members Upload Template - Instructions'],
    [],
    ['REQUIRED FIELDS:'],
    ['Tree Name *', 'Must match an existing tree name exactly (case-sensitive)'],
    ['Member Name *', 'Full name of the family member. Max 255 characters.'],
    [],
    ['OPTIONAL FIELDS:'],
    ['Nickname', 'Shortened name or nickname (e.g., "Jack" for "John"). Max 255 chars.'],
    ['Gender', 'One of: Male, Female, Non-binary, Prefer not to say (or leave blank)'],
    ['DOB Year', 'Date of Birth Year (e.g., 1950) - use English numerals'],
    ['DOB Month', 'Date of Birth Month (01-12) - use English numerals'],
    ['DOB Day', 'Date of Birth Day (01-31) - use English numerals'],
    ['Status', 'One of: Alive, Passed Away (default: Alive)'],
    ['DOD Year', 'Date of Death Year - only fill if Status = "Passed Away"'],
    ['DOD Month', 'Date of Death Month (01-12) - only if Status = "Passed Away"'],
    ['DOD Day', 'Date of Death Day (01-31) - only if Status = "Passed Away"'],
    ['Location', 'City and Country (e.g., "New York, USA"). Max 255 characters.'],
    ['Photo URL', 'Full URL to member photo (e.g., https://example.com/photo.jpg)'],
    ['Notes', 'Any additional information about the member. Max 1000 characters.'],
    [],
    ['IMPORTANT RULES:'],
    ['• Member IDs are auto-generated after upload', 'Do NOT add a Member ID column'],
    ['• Tree Name is case-sensitive', 'Must match existing tree exactly'],
    ['• All three date parts (Year, Month, Day) required together', 'Partial dates will be ignored'],
    ['• Month and Day must be 01-12 and 01-31 respectively', 'Use leading zeros (01 not 1)'],
    ['• Gender values', 'Male, Female, Non-binary, Prefer not to say, or leave blank'],
    ['• Status values', 'Alive or Passed Away (blank defaults to Alive)'],
    ['• DOD fields', 'Only relevant if Status = "Passed Away"; ignored otherwise'],
    ['• Photo URL must be valid', 'Should be direct image URL starting with https://'],
    ['• Duplicate detection', 'Same name + nickname combination will trigger duplicate check'],
    [],
    ['DATE FORMAT EXAMPLE:'],
    ['DOB: 1950-05-15', 'Year: 1950, Month: 05, Day: 15'],
    ['DOB: 1952-03-20', 'Year: 1952, Month: 03, Day: 20'],
    [],
    ['EXAMPLE: Living member'],
    ['Smith Family', 'John Smith', 'Jack', 'Male', '1950', '05', '15', 'Alive', '', '', '', 'New York', 'https://...jpg', 'Patriarch'],
    [],
    ['EXAMPLE: Deceased member'],
    ['Smith Family', 'William Smith', '', 'Male', '1920', '01', '10', 'Passed Away', '2000', '06', '15', 'Boston', '', 'Grandfather']
  ];

  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 40 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instructionSheet, 'Instructions');

  XLSX.writeFile(wb, 'Family_Members_Template.xlsx');
};


/**
 * Generate Event Upload Template
 * For adding multiple events to family members
 * Supports both AD date and Nepali Tithi entry modes
 */
export const generateEventTemplate = () => {
  const templateData = [
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'John Smith',
      'Event Name *': 'Birth',
      'Description': 'Birth in New York',
      'Entry Mode': 'date',
      'Event Year (Nepali)': '2005',
      'Event Month (Nepali)': '12',
      'Event Day (Nepali)': '01',
      'Tithi Month (Lunar)': '',
      'Tithi Pakshya': '',
      'Tithi Name': '',
      'Repeats': 'none'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'John Smith',
      'Event Name *': 'Marriage',
      'Description': 'Married to Mary Johnson',
      'Entry Mode': 'date',
      'Event Year (Nepali)': '2030',
      'Event Month (Nepali)': '03',
      'Event Day (Nepali)': '20',
      'Tithi Month (Lunar)': '',
      'Tithi Pakshya': '',
      'Tithi Name': '',
      'Repeats': 'yearly'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'Mary Smith',
      'Event Name *': 'Birth',
      'Description': 'Birth in Boston',
      'Entry Mode': 'date',
      'Event Year (Nepali)': '2007',
      'Event Month (Nepali)': '10',
      'Event Day (Nepali)': '20',
      'Tithi Month (Lunar)': '',
      'Tithi Pakshya': '',
      'Tithi Name': '',
      'Repeats': 'none'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'Robert Smith',
      'Event Name *': 'Graduation',
      'Description': 'College graduation',
      'Entry Mode': 'date',
      'Event Year (Nepali)': '2052',
      'Event Month (Nepali)': '02',
      'Event Day (Nepali)': '22',
      'Tithi Month (Lunar)': '',
      'Tithi Pakshya': '',
      'Tithi Name': '',
      'Repeats': 'none'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'John Smith',
      'Event Name *': 'Retirement',
      'Description': 'Retired from business',
      'Entry Mode': 'date',
      'Event Year (Nepali)': '2065',
      'Event Month (Nepali)': '09',
      'Event Day (Nepali)': '15',
      'Tithi Month (Lunar)': '',
      'Tithi Pakshya': '',
      'Tithi Name': '',
      'Repeats': 'none'
    },
    {
      'Tree Name *': 'Smith Family',
      'Member Name *': 'Mary Smith',
      'Event Name *': 'Diwali Celebration',
      'Description': 'Family Diwali gathering',
      'Entry Mode': 'tithi',
      'Event Year (Nepali)': '',
      'Event Month (Nepali)': '',
      'Event Day (Nepali)': '',
      'Tithi Month (Lunar)': 'Kartik',
      'Tithi Pakshya': 'Krishna',
      'Tithi Name': 'Amavasya',
      'Repeats': 'yearly'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  
  ws['!cols'] = [
    { wch: 20 },  // Tree Name
    { wch: 25 },  // Member Name
    { wch: 20 },  // Event Name
    { wch: 30 },  // Description
    { wch: 15 },  // Entry Mode
    { wch: 16 },  // Event Year (Nepali)
    { wch: 18 },  // Event Month (Nepali)
    { wch: 16 },  // Event Day (Nepali)
    { wch: 18 },  // Tithi Month (Lunar)
    { wch: 15 },  // Tithi Pakshya
    { wch: 18 },  // Tithi Name
    { wch: 12 }   // Repeats
  ];

  const headerStyle = {
    fill: { fgColor: { rgb: 'C6E0B4' } },
    font: { bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: { bottom: { style: 'thin' } }
  };

  for (let col of ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1']) {
    if (ws[col]) {
      ws[col].s = headerStyle;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Events');

  // Add instruction sheet
  const instructionData = [
    ['Events Upload Template - Instructions'],
    [],
    ['REQUIRED FIELDS:'],
    ['Tree Name *', 'Must match an existing tree name exactly (case-sensitive)'],
    ['Member Name *', 'Must match an existing family member name exactly in that tree'],
    ['Event Name *', 'Name/title of the event (e.g., Birth, Marriage, Graduation)'],
    ['Entry Mode *', 'How to specify date: "date" for Nepali calendar or "tithi" for Nepali lunar calendar'],
    [],
    ['DATE MODE (when Entry Mode = "date"):'],
    ['Event Year (Nepali) *', 'Nepali year (Bikram Sambat / BS): 4-digit number (e.g., 2080)'],
    ['Event Month (Nepali) *', 'Nepali month as 1-2 digits (1-12): 1=Baishakh, 2=Jyeshtha, ..., 12=Chaitra'],
    ['Event Day (Nepali) *', 'Day as 1-2 digits (1-32, e.g., 15)'],
    [],
    ['TITHI MODE (when Entry Mode = "tithi"):'],
    ['Tithi Month (Lunar) *', 'Nepali lunar month: Baishakh, Jyeshtha, Ashadh, Shravan, Bhadra, Ashwin, Kartik, Mangsir, Poush, Magh, Phalgun, Chaitra (English) or corresponding Nepali script'],
    ['Tithi Pakshya *', 'Lunar phase: Shukla (waxing/bright fortnight) or Krishna (waning/dark fortnight)'],
    ['Tithi Name *', 'Lunar day: Pratipada, Dwitiya, Tritiya, Chaturthi, Panchami, Shashthi, Saptami, Ashtami, Navami, Dashami, Ekadashi, Dvadashi, Trayodashi, Chaturdashi, Purnima (full moon), Amavasya (new moon)'],
    [],
    ['OPTIONAL FIELDS:'],
    ['Description', 'Detailed description of the event (max 1000 chars)'],
    ['Repeats', 'Event repetition: none (default), monthly, or yearly'],
    [],
    ['IMPORTANT RULES:'],
    ['• Date vs Tithi', 'Use EITHER date mode (Nepali date) OR tithi mode, not both'],
    ['• Case-sensitive', 'Tree Name and Member Name must match exactly'],
    ['• Nepali date range', 'Years typically 2000-2100 (BS), months 1-12, days 1-32'],
    ['• Tithi Month values', 'Must be exact month name (first letter capitalized)'],
    ['• Tithi Name values', 'Must be exact tithi name (first letter capitalized)'],
    ['• Monthly repetition', 'Works with date mode (repeats on same Nepali date each month)'],
    ['• Yearly repetition', 'Works with both date and tithi modes'],
    [],
    ['NEPALI MONTHS (for Date Mode):'],
    ['1 - Baishakh', 'April 13 - May 14 (typically)'],
    ['2 - Jyeshtha', 'May 15 - June 14 (typically)'],
    ['3 - Ashadh', 'June 15 - July 15 (typically)'],
    ['4 - Shravan', 'July 16 - August 15 (typically)'],
    ['5 - Bhadra', 'August 16 - September 15 (typically)'],
    ['6 - Ashwin', 'September 16 - October 15 (typically)'],
    ['7 - Kartik', 'October 16 - November 14 (typically)'],
    ['8 - Mangsir', 'November 15 - December 14 (typically)'],
    ['9 - Poush', 'December 15 - January 13 (typically)'],
    ['10 - Magh', 'January 14 - February 12 (typically)'],
    ['11 - Phalgun', 'February 13 - March 13 (typically)'],
    ['12 - Chaitra', 'March 14 - April 12 (typically)'],
    [],
    ['NEPALI LUNAR MONTHS (for Tithi Mode):'],
    ['Baishakh', 'Lunar month 1 (March-April)'],
    ['Jyeshtha', 'Lunar month 2 (April-May)'],
    ['Ashadh', 'Lunar month 3 (May-June)'],
    ['Shravan', 'Lunar month 4 (June-July)'],
    ['Bhadra', 'Lunar month 5 (July-August)'],
    ['Ashwin', 'Lunar month 6 (August-September)'],
    ['Kartik', 'Lunar month 7 (September-October)'],
    ['Mangsir', 'Lunar month 8 (October-November)'],
    ['Poush', 'Lunar month 9 (November-December)'],
    ['Magh', 'Lunar month 10 (December-January)'],
    ['Phalgun', 'Lunar month 11 (January-February)'],
    ['Chaitra', 'Lunar month 12 (February-March)'],
    [],
    ['TITHI NAMES:'],
    ['Pratipada', 'First day of lunar month'],
    ['Dwitiya to Chaturdashi', 'Days 2 through 14'],
    ['Purnima', 'Full moon (day 15 of Shukla Paksha)'],
    ['Amavasya', 'New moon (day 15 of Krishna Paksha)'],
    [],
    ['EVENT TYPES (EXAMPLES):'],
    ['Birth', 'Birth of family member'],
    ['Marriage', 'Wedding or marriage event'],
    ['Death', 'Death or passing away'],
    ['Graduation', 'Educational graduation'],
    ['Anniversary', 'Wedding anniversary (use Repeats: yearly)'],
    ['Achievement', 'Notable achievement or award'],
    ['Diwali', 'Use Tithi mode with Kartik month, Amavasya tithi'],
    []
  ];

  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 40 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instructionSheet, 'Instructions');

  XLSX.writeFile(wb, 'Family_Events_Template.xlsx');
};

/**
 * Download all three templates as a zip file (future enhancement)
 */
export const downloadAllTemplates = () => {
  // For now, download them individually
  // User can call:
  // generateTreeTemplate()
  // generateMemberTemplate()
  // generateEventTemplate()
  
  console.log('Downloading individual templates - user will be prompted to download each');
};

export default {
  generateTreeTemplate,
  generateMemberTemplate,
  generateEventTemplate,
  downloadAllTemplates
};

/**
 * Nepali Date Utilities — Organized Re-exports
 *
 * All functions live in ../nepaliDateUtils.js for now (shared internal state
 * and tight coupling between conversion/tithi logic makes physical splitting
 * risky without significant refactoring). This barrel file documents the
 * logical grouping of the 40+ exports.
 *
 * CORE — Calendar data management, number conversion, timezone
 *   setCalendarDataOverride, getActiveCalendarData,
 *   toNepaliNumber, getNepalDate, minBsYear, maxBsYear
 *
 * CONVERSION — AD↔BS date conversion and parsing
 *   convertAdToBs, convertBsToAd, parseNepaliDate
 *
 * FORMATTING — Display-oriented date formatting
 *   formatNepaliDate, formatEnglishDate, formatGregorianMonthYear,
 *   formatNepaliMonthYear, formatAdDateToNepaliString,
 *   formatAdDateToNepaliStringWithNumerals, formatNepaliDateTime,
 *   formatTithiWithMonth
 *
 * MONTHS — Month name/number utilities
 *   getMonthName, getMonthNumber, isValidMonth, getAllMonthsWithNumbers,
 *   getTithisForMonth, nepaliMonths, englishMonths, nepaliWeekdays, englishWeekdays
 *
 * TITHI — Tithi (lunar day) calculations and year/month resolution
 *   getTithiIndexByName, getTithiYearFromAdDate, getTithiLunarMonthName,
 *   getTithiMonthFromAdDate, getTithiMonthFromTithi, getTithiYearStartBoundary,
 *   findPurnimaInMonth, getTithiMonthBoundaries, getTithisForBsDate,
 *   isTithiMonthEnd, isTithiMonthStart, validateTithiMonthContinuity,
 *   mapTithiSequenceToMonths, tithiNameMapping
 */

// Re-export everything from the main file
export * from '../nepaliDateUtils';

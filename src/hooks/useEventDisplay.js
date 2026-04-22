import { useCallback } from 'react';
import { convertAdToBs, convertBsToAd, getNepalDate } from '../utils/nepaliDateUtils';
import { NEPALI_MONTHS } from '../constants/calendarConstants';

export const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

export function getTithiApproxDate(tithiMonth) {
    const idx = NEPALI_MONTHS.indexOf(tithiMonth);
    if (idx === -1) return null;
    const bsMonth = idx + 1;
    const npt = getNepalDate();
    const bsToday = convertAdToBs(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
    if (!bsToday) return null;
    let bsYear = bsToday.year;
    let adDateObj = convertBsToAd(bsYear, bsMonth, 1);
    if (!adDateObj) return null;
    let approxDate = new Date(adDateObj.year, adDateObj.month, adDateObj.day, 12, 0, 0);
    const todayMidnight = new Date(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
    if (approxDate < todayMidnight) {
        const next = convertBsToAd(bsYear + 1, bsMonth, 1);
        if (next) approxDate = new Date(next.year, next.month, next.day, 12, 0, 0);
    }
    return isValidDate(approxDate) ? approxDate : null;
}

export function getNextOccurrence(originalDate, repetition, event) {
    if (!isValidDate(originalDate)) return null;
    const npt = getNepalDate();
    const today = new Date(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate());
    let nextDate = new Date(originalDate);
    nextDate.setHours(12, 0, 0, 0);

    if (repetition === 'monthly') {
        while (nextDate < today) {
            nextDate.setMonth(nextDate.getMonth() + 1);
        }
    } else if (repetition === 'yearly') {
        const dateStr = event?.dateKey || event?.date;
        if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            try {
                const bsDate = convertAdToBs(y, m - 1, d);
                if (bsDate) {
                    let currentBsYear = bsDate.year;
                    while (true) {
                        const adDateObj = convertBsToAd(currentBsYear, bsDate.month, bsDate.day);
                        if (adDateObj) {
                            nextDate = new Date(adDateObj.year, adDateObj.month, adDateObj.day, 12, 0, 0);
                            if (nextDate >= today) return nextDate;
                        }
                        currentBsYear++;
                        if (currentBsYear > bsDate.year + 5) break;
                    }
                }
            } catch (err) {
                console.error('Error calculating next occurrence for yearly event:', err);
            }
        }
        if (event?.tithi?.month) {
            const approx = getTithiApproxDate(event.tithi.month);
            if (approx && isValidDate(approx)) return approx;
        }
        while (nextDate < today) {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
        }
    }
    return nextDate;
}

export function useEventDisplay(events, familyMembers) {
    const mapEvent = useCallback((event) => {
        if (event.resolvedTithiDate) {
            const [y, m, d] = event.resolvedTithiDate.split('-').map(Number);
            const resolvedDate = new Date(y, m - 1, d, 12, 0, 0);
            if (isValidDate(resolvedDate)) {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                let displayDate = resolvedDate;
                if (event.repetition === 'yearly' && resolvedDate < today) {
                    const next = getNextOccurrence(resolvedDate, 'yearly', event);
                    displayDate = isValidDate(next) ? next : resolvedDate;
                }
                const person = familyMembers?.find(m => m.id === event.personId);
                return { ...event, name: event.title || event.name, originalDate: resolvedDate, displayDate, personName: person?.name, personRelation: person?.relation };
            }
        }

        const dateStr = event.dateKey || event.date;
        let originalDate;
        if (dateStr && typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            originalDate = new Date(y, m - 1, d, 12, 0, 0);
        } else {
            originalDate = new Date(event.date || event.dateKey);
        }
        if (!isValidDate(originalDate) && event.tithi?.month) {
            originalDate = getTithiApproxDate(event.tithi.month);
        }

        let displayDate;
        if (event.repetition && event.repetition !== 'none') {
            const next = getNextOccurrence(originalDate, event.repetition, event);
            displayDate = isValidDate(next) ? next : originalDate;
        } else {
            displayDate = originalDate;
        }

        const person = familyMembers?.find(m => m.id === event.personId);
        return { ...event, name: event.title || event.name, originalDate, displayDate, personName: person?.name, personRelation: person?.relation };
    }, [familyMembers]);

    return mapEvent;
}

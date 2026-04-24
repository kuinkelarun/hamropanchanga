import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestoreCollections';
import { normalizePakshaToNepali } from '../constants/calendarConstants';
import {
  convertAdToBs,
  getTithiIndexByName,
  getTithiLunarMonthName,
  getTithiYearFromAdDate,
} from './nepaliDateUtils';

/**
 * Resolve a tithi selection to its occurrence in the CURRENT BS year.
 *
 * Shared save-time logic for AddEventForm (month+tithi dropdown flow) and
 * AddEventModal (calendar-tile click flow). Without this, non-repeating
 * tithi events can be stranded in a past BS year whenever the user's picked
 * context points at a historical AD date.
 *
 * @param {Object} args
 * @param {string} args.pakshaEn       - 'Shukla' or 'Krishna'
 * @param {string} args.tithiName      - Tithi name as stored in the TITHIS collection
 * @param {string} args.lunarMonthName - Target lunar month (e.g. 'Baishakh') to disambiguate
 * @param {string} [args.tithiId]      - Propagated into the returned payload
 * @returns {Promise<{date: string, bsYear: number, tithiPayload: {id,name,paksha,month}}>}
 * @throws {Error} if no matching tithi exists in the current BS year
 */
export async function resolveTithiForCurrentYear({
  pakshaEn,
  tithiName,
  lunarMonthName,
  tithiId = null,
}) {
  if (!pakshaEn || !tithiName || !lunarMonthName) {
    throw new Error('resolveTithiForCurrentYear: pakshaEn, tithiName, and lunarMonthName are required');
  }

  const tithiIndex = getTithiIndexByName(tithiName, { fallbackToOne: false });
  if (!tithiIndex) throw new Error(`Unknown tithi: ${tithiName}`);

  const today = new Date();
  const bsToday = convertAdToBs(today.getFullYear(), today.getMonth(), today.getDate());
  const currentBsYear = bsToday?.year;
  if (!currentBsYear) throw new Error('Could not determine the current Nepali year.');

  const pakshaNepali = normalizePakshaToNepali(pakshaEn);

  const qNew = query(
    collection(db, COLLECTIONS.TITHIS),
    where('pakshya', '==', pakshaNepali),
    where('tithiName', '==', tithiName),
  );
  const old2PartName = `${pakshaNepali} ${tithiName}`;
  const qOld = query(
    collection(db, COLLECTIONS.TITHIS),
    where('name', '>=', old2PartName),
    where('name', '<=', old2PartName + '\uf8ff'),
  );

  const [snapNew, snapOld] = await Promise.all([getDocs(qNew), getDocs(qOld)]);
  const allDocs = new Map();
  snapNew.docs.forEach((d) => allDocs.set(d.id, d));
  snapOld.docs.forEach((d) => {
    if (!allDocs.has(d.id)) allDocs.set(d.id, d);
  });

  let matchStartDate = null;
  let matchLunarMonth = null;
  allDocs.forEach((docSnap) => {
    if (matchStartDate) return;
    const t = docSnap.data();
    if (!t?.name) return;
    if (!t.name.includes(tithiName) || !t.name.includes(pakshaNepali)) return;
    const candidateMonth = getTithiLunarMonthName(pakshaEn, tithiIndex, t.startDate);
    const candidateYearInfo = getTithiYearFromAdDate(t.startDate, null, pakshaEn, tithiIndex);
    if (candidateMonth === lunarMonthName && candidateYearInfo?.tithiYear === currentBsYear) {
      matchStartDate = t.startDate;
      matchLunarMonth = candidateMonth;
    }
  });

  if (!matchStartDate) {
    throw new Error(
      `Could not find ${lunarMonthName} ${pakshaNepali} ${tithiName} in year ${currentBsYear}. Please ensure tithis are generated for this year.`,
    );
  }

  return {
    date: matchStartDate,
    bsYear: currentBsYear,
    tithiPayload: {
      id: tithiId,
      name: tithiName,
      paksha: pakshaEn,
      month: matchLunarMonth,
    },
  };
}

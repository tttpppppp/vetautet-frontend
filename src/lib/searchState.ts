export type PassengerCounts = {
  adult: number;
  child: number;
  senior: number;
  student: number;
};

export type StoredSearchState = {
  departure?: string;
  arrival?: string;
  date?: string;
  returnDate?: string;
  ticketType?: string;
  passengerCounts?: Partial<PassengerCounts>;
  trainType?: string;
};

const SEARCH_STATE_KEY = 'vetau.searchState';
const DEFAULT_PASSENGERS: PassengerCounts = {
  adult: 1,
  child: 0,
  senior: 0,
  student: 0,
};

const normalizeDateValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizePassengerCounts = (counts?: Partial<PassengerCounts>): PassengerCounts => {
  const normalized = {
    adult: Math.max(1, Number(counts?.adult ?? DEFAULT_PASSENGERS.adult) || 1),
    child: Math.max(0, Number(counts?.child ?? 0) || 0),
    senior: Math.max(0, Number(counts?.senior ?? 0) || 0),
    student: Math.max(0, Number(counts?.student ?? 0) || 0),
  };
  return normalized;
};

const passengerTotal = (counts: PassengerCounts) =>
  counts.adult + counts.child + counts.senior + counts.student;

export const readSearchState = (): StoredSearchState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SEARCH_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writeSearchState = (state: StoredSearchState) => {
  if (typeof window === 'undefined') return;
  try {
    const nextState: StoredSearchState = {
      ...state,
      passengerCounts: normalizePassengerCounts(state.passengerCounts),
    };
    window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage failures so search controls still work normally.
  }
};

export const buildSchedulesParamsFromStoredState = ({
  departure,
  arrival,
  fallbackDate,
}: {
  departure?: string;
  arrival?: string;
  fallbackDate?: string | Date | null;
}) => {
  const state = readSearchState();
  const params = new URLSearchParams();
  const passengerCounts = normalizePassengerCounts(state.passengerCounts);
  const totalPassengers = passengerTotal(passengerCounts);
  const date = state.date || normalizeDateValue(fallbackDate) || normalizeDateValue(new Date());

  if (departure || state.departure) params.set('departPlaceName', departure || state.departure || '');
  if (arrival || state.arrival) params.set('returnPlaceName', arrival || state.arrival || '');
  if (date) params.set('departDate', date);
  params.set('returnDate', state.ticketType === 'round-trip' ? (state.returnDate || date) : (state.returnDate || date));
  params.set('roundTrip', String(state.ticketType === 'round-trip'));
  params.set('adults', String(passengerCounts.adult));
  if (passengerCounts.child) params.set('childs', String(passengerCounts.child));
  if (passengerCounts.senior) params.set('elderlys', String(passengerCounts.senior));
  if (passengerCounts.student) params.set('students', String(passengerCounts.student));
  params.set('totalTicket', String(totalPassengers));
  if (state.trainType) params.set('trainType', state.trainType);

  return params;
};

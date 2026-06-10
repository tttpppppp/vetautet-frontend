import type { PassengerFareRule } from '../types/api.types';

export type PassengerTypeCode = 'ADULT' | 'CHILD' | 'SENIOR' | 'STUDENT';
export type PassengerKey = 'adult' | 'child' | 'senior' | 'student';

export type PassengerTypeMeta = {
    label: string;
    description: string;
    discountLabel?: string;
};

export const PASSENGER_TYPE_ORDER: PassengerTypeCode[] = ['ADULT', 'CHILD', 'SENIOR', 'STUDENT'];

export const PASSENGER_KEY_TO_TYPE: Record<PassengerKey, PassengerTypeCode> = {
    adult: 'ADULT',
    child: 'CHILD',
    senior: 'SENIOR',
    student: 'STUDENT',
};

export const PASSENGER_TYPE_TO_KEY: Record<PassengerTypeCode, PassengerKey> = {
    ADULT: 'adult',
    CHILD: 'child',
    SENIOR: 'senior',
    STUDENT: 'student',
};

export const DEFAULT_PASSENGER_TYPE_META: Record<PassengerTypeCode, PassengerTypeMeta> = {
    ADULT: { label: 'Người lớn', description: 'Từ 10 - 59 tuổi' },
    CHILD: { label: 'Trẻ em', description: '6 - 9 tuổi', discountLabel: '-25%' },
    SENIOR: { label: 'Người cao tuổi', description: 'Từ 60 tuổi', discountLabel: '-15%' },
    STUDENT: { label: 'Sinh viên', description: 'Thẻ SV', discountLabel: '-10%' },
};

const numberText = (value?: number | null) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '0';
};

export const discountLabelFromPercent = (value?: number | null) => {
    const numeric = Number(value || 0);
    return numeric > 0 ? `-${numberText(numeric)}%` : undefined;
};

export const descriptionFromRule = (rule: PassengerFareRule, fallback: string) => {
    const minAge = Number(rule.minAge);
    const maxAge = Number(rule.maxAge);
    if (Number.isFinite(minAge) && Number.isFinite(maxAge)) return `${minAge} - ${maxAge} tuổi`;
    if (Number.isFinite(minAge)) return `Từ ${minAge} tuổi`;
    return fallback;
};

export const buildPassengerTypeMeta = (rules?: PassengerFareRule[]) => {
    const meta: Record<PassengerTypeCode, PassengerTypeMeta> = { ...DEFAULT_PASSENGER_TYPE_META };
    (rules || []).forEach((rule) => {
        const type = String(rule.passengerType || '').toUpperCase() as PassengerTypeCode;
        if (!PASSENGER_TYPE_ORDER.includes(type)) return;
        meta[type] = {
            label: rule.label || meta[type].label,
            description: descriptionFromRule(rule, meta[type].description),
            discountLabel: rule.discountLabel || discountLabelFromPercent(rule.discountPercent),
        };
    });
    return meta;
};

export const buildPassengerOptions = (rules?: PassengerFareRule[]) => {
    const meta = buildPassengerTypeMeta(rules);
    return (Object.keys(PASSENGER_KEY_TO_TYPE) as PassengerKey[]).map((key) => {
        const type = PASSENGER_KEY_TO_TYPE[key];
        return {
            key,
            type,
            label: meta[type].label,
            description: meta[type].description,
            discount: meta[type].discountLabel,
        };
    });
};

export const getPassengerFareMultiplier = (rules: PassengerFareRule[] | undefined, passengerType?: string) => {
    const normalizedType = String(passengerType || 'ADULT').toUpperCase();
    if (normalizedType === 'ADULT') return 1;
    const rule = (rules || []).find((item) => String(item.passengerType || '').toUpperCase() === normalizedType && String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
    const multiplier = Number(rule?.fareMultiplier);
    return Number.isFinite(multiplier) && multiplier >= 0 ? multiplier : 1;
};

export const applyPassengerFareRule = (basePrice: number, rules: PassengerFareRule[] | undefined, passengerType?: string) => {
    const price = Number(basePrice || 0);
    return Math.round(price * getPassengerFareMultiplier(rules, passengerType));
};

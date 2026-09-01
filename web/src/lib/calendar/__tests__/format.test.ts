import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentYearMonth, formatDetail, formatRelease, formatYearMonth } from '../format';

describe('formatYearMonth', () => {
	it('年月を日本語表記にする', () => {
		expect(formatYearMonth('2026-10')).toBe('2026年10月');
	});

	it('月の先頭ゼロを外す', () => {
		expect(formatYearMonth('2026-04')).toBe('2026年4月');
	});

	it('null は発売月未定', () => {
		expect(formatYearMonth(null)).toBe('発売月未定');
	});
});

describe('formatDetail', () => {
	it('旬をラベルにする', () => {
		expect(formatDetail('period', 'early')).toBe('上旬');
		expect(formatDetail('period', 'mid')).toBe('中旬');
		expect(formatDetail('period', 'late')).toBe('下旬');
	});

	it('週は月日の週表記にする', () => {
		expect(formatDetail('week', '09-08')).toBe('9/8週');
		expect(formatDetail('week', '12-22')).toBe('12/22週');
	});

	it('月までの粒度は null', () => {
		expect(formatDetail('month', null)).toBeNull();
		expect(formatDetail(null, null)).toBeNull();
	});

	it('知らない旬の値は null', () => {
		expect(formatDetail('period', 'unknown')).toBeNull();
	});
});

describe('formatRelease', () => {
	it('年月と旬をつなげる', () => {
		expect(formatRelease('2026-10', 'period', 'early')).toBe('2026年10月上旬');
	});

	it('月までなら年月だけ', () => {
		expect(formatRelease('2026-10', 'month', null)).toBe('2026年10月');
	});

	it('未定は付加情報を持たない', () => {
		expect(formatRelease(null, null, null)).toBe('発売月未定');
	});
});

describe('currentYearMonth', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('UTC では前月末でも日本時間の月で数える', () => {
		// UTC 8/31 15:30 = 日本時間 9/1 0:30
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-31T15:30:00Z'));
		expect(currentYearMonth()).toBe('2026-09');
	});

	it('オフセットは年をまたげる', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-15T00:00:00Z'));
		expect(currentYearMonth(1)).toBe('2026-12');
		expect(currentYearMonth(2)).toBe('2027-01');
	});
});

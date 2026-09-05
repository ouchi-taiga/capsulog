import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* 独自の文字サイズを教える。既定では text-note を色と読み違え、text-ink と競合させて落としてしまう */
const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			'font-size': [{ text: ['site', 'title', 'heading', 'body', 'input', 'note'] }]
		}
	}
});

/** クラスを結合し、競合するユーティリティは後に書いたものを残す */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

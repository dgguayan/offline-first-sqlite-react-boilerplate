import { describe, expect, it } from 'vitest';
import {
    clampSidebarLogoSize,
    parseSidebarLogoSizeInput,
} from '@/lib/branding';

describe('sidebar logo size controls', () => {
    it('accepts manually entered whole pixels within the sidebar cap', () => {
        expect(parseSidebarLogoSizeInput('127')).toBe(127);
        expect(parseSidebarLogoSizeInput('216')).toBe(216);
    });

    it('rejects empty, fractional, and out-of-range manual values', () => {
        expect(parseSidebarLogoSizeInput('')).toBeNull();
        expect(parseSidebarLogoSizeInput('32.5')).toBeNull();
        expect(parseSidebarLogoSizeInput('23')).toBeNull();
        expect(parseSidebarLogoSizeInput('217')).toBeNull();
    });

    it('clamps committed values to the safe sidebar range', () => {
        expect(clampSidebarLogoSize(10)).toBe(24);
        expect(clampSidebarLogoSize(300)).toBe(216);
        expect(clampSidebarLogoSize(Number.NaN, 48)).toBe(48);
    });
});

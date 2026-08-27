import { describe, expect, it } from 'vitest';
import {
    calculateImageMetrics,
    clampOffset,
} from '@/components/logo-image-editor';

describe('logo image editor geometry', () => {
    it('covers the square frame while preserving image proportions', () => {
        expect(calculateImageMetrics(400, 200, 0, 1, 320)).toEqual({
            scale: 1.6,
            maximumOffsetX: 160,
            maximumOffsetY: 0,
        });

        expect(calculateImageMetrics(400, 200, 90, 1, 320)).toEqual({
            scale: 1.6,
            maximumOffsetX: 0,
            maximumOffsetY: 160,
        });
    });

    it('increases the crop range when the image is zoomed', () => {
        const metrics = calculateImageMetrics(400, 200, 0, 2, 320);

        expect(metrics).toEqual({
            scale: 3.2,
            maximumOffsetX: 480,
            maximumOffsetY: 160,
        });
        expect(clampOffset({ x: 900, y: -900 }, metrics)).toEqual({
            x: 480,
            y: -160,
        });
    });
});

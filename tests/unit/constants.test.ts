/**
 * Unit tests for application constants and configuration values.
 */
import { describe, it, expect } from 'vitest';
import { LANE_COLORS, LANE_LABELS, COMMITMENT_DURATIONS, LLM_TIERS, BIDDING_STRATEGIES, RANK_TIERS } from '@/lib/constants/index';

describe('Constants', () => {
  describe('LANE_COLORS', () => {
    it('defines colors for all 4 lanes', () => {
      expect(Object.keys(LANE_COLORS)).toHaveLength(4);
      expect(LANE_COLORS.research).toBeDefined();
      expect(LANE_COLORS.code).toBeDefined();
      expect(LANE_COLORS.data).toBeDefined();
      expect(LANE_COLORS.outreach).toBeDefined();
    });

    it('all colors are valid hex', () => {
      Object.values(LANE_COLORS).forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });

  describe('LANE_LABELS', () => {
    it('maps lowercase keys to capitalized labels', () => {
      expect(LANE_LABELS.research).toBe('Research');
      expect(LANE_LABELS.code).toBe('Code');
      expect(LANE_LABELS.data).toBe('Data');
      expect(LANE_LABELS.outreach).toBe('Outreach');
    });
  });

  describe('COMMITMENT_DURATIONS', () => {
    it('offers 30, 60, 90 day options', () => {
      expect(COMMITMENT_DURATIONS).toEqual([30, 60, 90]);
    });
  });

  describe('LLM_TIERS', () => {
    it('has 3 tiers in order', () => {
      expect(LLM_TIERS).toEqual(['Standard', 'Pro', 'Elite']);
    });
  });

  describe('BIDDING_STRATEGIES', () => {
    it('has Volume and Margin strategies', () => {
      expect(BIDDING_STRATEGIES).toEqual(['Volume', 'Margin']);
    });
  });

  describe('RANK_TIERS', () => {
    it('has non-overlapping thresholds', () => {
      expect(RANK_TIERS.apprentice.max).toBeLessThan(RANK_TIERS.journeyman.min);
      expect(RANK_TIERS.journeyman.max).toBeLessThan(RANK_TIERS.master.min);
      expect(RANK_TIERS.master.max).toBeLessThan(RANK_TIERS.grandmaster.min);
    });

    it('grandmaster has no upper limit', () => {
      expect(RANK_TIERS.grandmaster.max).toBe(Infinity);
    });
  });
});

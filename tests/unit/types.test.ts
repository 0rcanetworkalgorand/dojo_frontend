/**
 * Unit tests for frontend type definitions and enums.
 */
import { describe, it, expect } from 'vitest';
import { LaneType, TaskState } from '@/lib/types';

describe('Frontend Types', () => {
  describe('LaneType', () => {
    it('has 4 lanes matching backend', () => {
      expect(Object.values(LaneType)).toHaveLength(4);
      expect(LaneType.RESEARCH).toBe('RESEARCH');
      expect(LaneType.CODE).toBe('CODE');
      expect(LaneType.DATA).toBe('DATA');
      expect(LaneType.OUTREACH).toBe('OUTREACH');
    });
  });

  describe('TaskState', () => {
    it('has 6 lifecycle states matching backend', () => {
      expect(Object.values(TaskState)).toHaveLength(6);
    });

    it('has correct state values', () => {
      expect(TaskState.CREATED).toBe('CREATED');
      expect(TaskState.LOCKED).toBe('LOCKED');
      expect(TaskState.SUBMITTED).toBe('SUBMITTED');
      expect(TaskState.VERIFIED).toBe('VERIFIED');
      expect(TaskState.SETTLED).toBe('SETTLED');
      expect(TaskState.SLASHED).toBe('SLASHED');
    });
  });
});

import type { EducationLevel } from './index';

export type LevelEvidence = { source: string; statedLevel: EducationLevel; authoritative: boolean };
export function determineEducationLevel(evidence: LevelEvidence[], override?: EducationLevel) {
  if (override) return { level: override, evidence: evidence.map(item => `${item.source}: ${item.statedLevel}`), confidence: 'high' as const, confirmed: true, unknowns: ['Level was explicitly confirmed or overridden by the learner.'] };
  const available = evidence.filter(item => item.statedLevel !== 'unknown');
  const levels = new Set(available.map(item => item.statedLevel));
  if (!available.length || levels.size !== 1) return {
    level: 'unknown' as const, evidence: available.map(item => `${item.source}: ${item.statedLevel}`), confidence: 'unknown' as const, confirmed: false,
    unknowns: [available.length ? 'Sources disagree. Ask the learner to confirm the intended course level.' : 'No explicit source-supported course level. Age and a bare course code are not evidence.'],
  };
  return {
    level: available[0].statedLevel, evidence: available.map(item => `${item.source}: ${item.statedLevel}`),
    confidence: available.some(item => item.authoritative) ? 'high' as const : 'low' as const, confirmed: false,
    unknowns: ['Provisional course level requires learner confirmation; it does not determine ability or depth.'],
  };
}
export function ageBandFromAge(age: number | null) {
  if (age === null) return 'prefer-not-to-say' as const;
  if (!Number.isInteger(age) || age < 0 || age > 120) throw new Error('Use an optional age band instead of an invalid age. Never request a birthdate.');
  return age < 13 ? 'under-13' : age < 16 ? '13-15' : age < 18 ? '16-17' : age < 25 ? '18-24' : '25-plus';
}

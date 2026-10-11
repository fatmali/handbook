import type { CoursePack } from '../../packages/course-pack/src';

export function CoverageDetails({ pack }: { pack: CoursePack }) {
  return <details className="coverage-details">
    <summary>Coverage & limitations</summary>
    <p>{pack.coverage.summary}</p>
    {pack.coverage.gaps.length > 0 && <ul>{pack.coverage.gaps.map(gap => <li key={gap.id}>{gap.description}</li>)}</ul>}
  </details>;
}

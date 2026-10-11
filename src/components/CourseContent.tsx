import { useEffect, useState, type ReactNode } from 'react';
import type { Block, Citation, CoursePack } from '../../packages/course-pack/src';
import type { Library } from '../storage';

export function Cover({ kind = 'cube' }: { kind?: CoursePack['metadata']['cover'] }) {
  return <svg className={`cover-art ${kind}`} viewBox="0 0 240 260" aria-hidden="true" focusable="false">
    <path className="cover-rule" d="M26 30h188M26 40h95M26 224h188" />
    {kind === 'cube' ? <g><path className="cube-top" d="m120 62 68 38-68 38-68-38Z"/><path className="cube-left" d="m52 100 68 38v77l-68-39Z"/><path className="cube-right" d="m120 138 68-38v76l-68 39Z"/><path className="cube-lines" d="m86 81 68 38M154 81l-68 38m0 0v76m68-76v76m-102-57 68 38 68-38m-68-38v77"/></g> : kind === 'leaf' ? <g className="leaf-lines"><path d="M72 199c0-56 6-108 90-133 20 67-17 116-79 117m0 0 61-96m-50 80-9-50m28 18 41-6"/><circle cx="67" cy="202" r="5"/></g> : <g className="network-lines"><path d="m120 80-62 63 62 53 64-53Zm0 0v116m-62-53h126"/><circle cx="120" cy="80" r="19"/><circle cx="58" cy="143" r="19"/><circle cx="184" cy="143" r="19"/><circle cx="120" cy="196" r="19"/></g>}
  </svg>;
}
export function CitationList({ citations, pack, library, onError }: { citations: Citation[]; pack: CoursePack; library: Library; onError: (error: unknown) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const created: string[] = [];
    Promise.all([...new Set(citations.map(citation => citation.sourceId))].map(async id => {
      const asset = await library.getSource(pack.id, id);
      if (!asset || !alive) return;
      const url = URL.createObjectURL(asset.blob);
      created.push(url);
      setUrls(previous => ({ ...previous, [id]: url }));
    })).catch(onError);
    return () => { alive = false; created.forEach(url => URL.revokeObjectURL(url)); };
  }, [citations, pack.id, library, onError]);
  if (!citations.length) return null;
  return <div className="citations" aria-label="Source locations">{citations.map((citation, index) => {
    const source = pack.sources.find(source => source.id === citation.sourceId);
    const label = `${source?.title ?? citation.sourceId}${citation.pdfPage ? `, PDF p. ${citation.pdfPage}${citation.pdfPageEnd ? `–${citation.pdfPageEnd}` : ''}` : ''}${citation.section ? `, ${citation.section}` : ''}${citation.timestampSeconds !== undefined ? `, ${Math.floor(citation.timestampSeconds / 60)}:${String(citation.timestampSeconds % 60).padStart(2, '0')}` : ''}${citation.verification === 'unverified' ? ' (unverified)' : ''}`;
    const href = urls[citation.sourceId] ? `${urls[citation.sourceId]}${citation.pdfPage ? `#page=${citation.pdfPage}` : ''}` : source?.url;
    return href ? <a key={index} href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <span key={index}>{label}</span>;
  })}</div>;
}
export function LinkedText({ text, concepts, onConcept }: { text: string; concepts: CoursePack['concepts']; onConcept: (id: string) => void }) {
  if (!concepts.length) return <>{text}</>;
  const terms = concepts.flatMap(concept => [concept.term, ...concept.aliases].map(term => ({ term, id: concept.id }))).sort((a, b) => b.term.length - a.term.length);
  const escaped = terms.map(value => value.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'giu');
  const parts: ReactNode[] = [];
  let start = 0;
  for (const match of text.matchAll(regex)) {
    const index = match.index;
    const before = text[index - 1] ?? '';
    const after = text[index + match[0].length] ?? '';
    if (/\p{L}/u.test(before) || /\p{L}/u.test(after)) continue;
    if (index > start) parts.push(text.slice(start, index));
    const found = terms.find(value => value.term.toLowerCase() === match[0].toLowerCase())!;
    parts.push(<button className="concept-link" key={`${index}-${found.id}`} onClick={() => onConcept(found.id)} title={`Define ${found.term}`}>{match[0]}</button>);
    start = index + match[0].length;
  }
  parts.push(text.slice(start));
  return <>{parts}</>;
}
export function Diagram({ block, position, onPosition }: { block: Extract<Block, { kind: 'diagram' }>; position: number; onPosition: (index: number) => void }) {
  const index = Math.max(0, Math.min(position, block.steps.length - 1));
  const step = block.steps[index];
  const columns = [...new Set(block.nodes.map(node => node.column))].sort((a, b) => a - b);
  const vertical = columns.length === 1;
  const locations = new Map(block.nodes.map(node => {
    const inColumn = block.nodes.filter(other => other.column === node.column);
    return [node.id, { x: vertical ? 150 : columns.indexOf(node.column) * 210 + 100, y: inColumn.indexOf(node) * (vertical ? 150 : 110) + 50 }];
  }));
  const height = Math.max(...columns.map(column => block.nodes.filter(node => node.column === column).length)) * (vertical ? 150 : 110);
  const width = vertical ? 300 : columns.length * 210;
  return <figure className="diagram">
    <h3>{block.title}</h3>
    <div className={vertical ? 'diagram-scroll vertical-diagram' : 'diagram-scroll'} tabIndex={0} aria-label="Diagram, scroll horizontally if needed">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, minWidth: width, height }} role="img" aria-label={block.alternative}>
        <defs><marker id={`${block.id}-arrow`} markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="m0 0 8 4-8 4" fill="none" stroke="currentColor"/></marker></defs>
        {block.edges.map((edge, i) => {
          const from = locations.get(edge.from)!; const to = locations.get(edge.to)!;
          const direction = to.x >= from.x ? 1 : -1;
          if (vertical) {
            const down = to.y > from.y;
            const adjacent = Math.abs(to.y - from.y) === 150;
            const words = edge.label.split(' ');
            const lines: string[] = [''];
            words.forEach(word => { const last = lines.length - 1; if (`${lines[last]} ${word}`.trim().length > 17) lines.push(word); else lines[last] = `${lines[last]} ${word}`.trim(); });
            return <g key={i} className="diagram-edge"><path d={adjacent ? `M150,${from.y + (down ? 34 : -34)} L150,${to.y + (down ? -39 : 39)}` : `M65,${from.y} H18 V${to.y} H60`} markerEnd={`url(#${block.id}-arrow)`}/><text x={163} y={(from.y + to.y) / 2 - (lines.length - 1) * 7} textAnchor="start">{lines.map((line, j) => <tspan key={j} x={163} dy={j ? 14 : 0}>{line}</tspan>)}</text></g>;
          }
          return <g key={i} className="diagram-edge"><path d={`M${from.x + 85 * direction},${from.y} L${to.x - 90 * direction},${to.y}`} markerEnd={`url(#${block.id}-arrow)`}/><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle">{edge.label.length > 24 ? `${edge.label.slice(0, 22)}…` : edge.label}</text></g>;
        })}
        {block.nodes.map(node => {
          const point = locations.get(node.id)!;
          const words = node.label.split(' ');
          const lines: string[] = [''];
          words.forEach(word => { if ((lines[lines.length - 1] + word).length > 20) lines.push(word); else lines[lines.length - 1] += `${lines[lines.length - 1] ? ' ' : ''}${word}`; });
          return <g key={node.id} className={step.activeNodeIds.includes(node.id) ? 'diagram-node active' : 'diagram-node'}><title>{node.label}: {node.detail}</title><rect x={point.x - 85} y={point.y - 34} width="170" height="68" rx="12"/><text x={point.x} y={point.y - (Math.min(lines.length, 3) - 1) * 8} textAnchor="middle">{lines.slice(0, 3).map((line, i) => <tspan key={i} x={point.x} dy={i ? 16 : 0}>{line}</tspan>)}</text></g>;
        })}
      </svg>
    </div>
    {block.steps.length > 1 && <><div className="trace-step" aria-live="polite"><strong>{index + 1} / {block.steps.length}: {step.title}</strong><p>{step.explanation}</p></div>
    <div className="button-row"><button disabled={index === 0} onClick={() => onPosition(index - 1)}>Previous trace step</button><button disabled={index === block.steps.length - 1} onClick={() => onPosition(index + 1)}>Next trace step</button></div></>}
    <figcaption>{block.caption}</figcaption>
    <details><summary>Text alternative and relation details</summary><p>{block.alternative}</p><ul>{block.nodes.map(node => <li key={node.id}><strong>{node.label}:</strong> {node.detail}</li>)}</ul><ul>{block.edges.map((edge, i) => <li key={i}>{block.nodes.find(node => node.id === edge.from)?.label} — {edge.label} — {block.nodes.find(node => node.id === edge.to)?.label}</li>)}</ul></details>
  </figure>;
}
export function ContentBlock({ block, pack, library, onError, onConcept, position, onPosition, revealed, onReveal, continuous = false }: {
  block: Block; pack: CoursePack; library: Library; onError: (error: unknown) => void; onConcept: (id: string) => void;
  position: number; onPosition: (index: number) => void; revealed: boolean; onReveal: () => void;
  continuous?: boolean;
}) {
  const concepts = pack.concepts.filter(concept => block.conceptIds.includes(concept.id));
  const prose = (text: string) => <LinkedText text={text} concepts={concepts} onConcept={onConcept}/>;
  let content: ReactNode;
  switch (block.kind) {
    case 'paragraph': content = <p>{prose(block.text)}</p>; break;
    case 'callout': content = continuous && block.tone === 'note'
      ? <section className="prose-section"><h3>{block.title}</h3>{block.text.split(/\n\s*\n/).map((text, i) => <p key={i}>{prose(text)}</p>)}</section>
      : <aside className={`callout ${block.tone}`}><h3>{block.title}</h3><p>{prose(block.text)}</p></aside>; break;
    case 'list': content = <><h3>{block.title}</h3>{block.ordered ? <ol>{block.items.map((item, i) => <li key={i}>{prose(item)}</li>)}</ol> : <ul>{block.items.map((item, i) => <li key={i}>{prose(item)}</li>)}</ul>}</>; break;
    case 'example': content = <section className="worked-example"><h3>{block.title}</h3><p>{prose(block.problem)}</p><ol>{block.steps.map((step, i) => <li key={i}>{prose(step)}</li>)}</ol><p><strong>What follows:</strong> {prose(block.conclusion)}</p></section>; break;
    case 'table': content = <><h3>{block.title}</h3><div className="table-scroll"><table><thead><tr>{block.columns.map((column, i) => <th key={i}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{prose(value)}</td>)}</tr>)}</tbody></table></div></>; break;
    case 'recall': content = <section className="recall"><h3>Try without looking</h3><p>{prose(block.prompt)}</p><button onClick={onReveal} aria-expanded={revealed}>{revealed ? 'Hide explanation' : 'Reveal explanation'}</button>{revealed && <p className="answer">{prose(block.answer)}</p>}</section>; break;
    case 'diagram': content = <Diagram block={block} position={position} onPosition={onPosition}/>; break;
  }
  return <section className="content-block" id={block.id} data-block-id={block.id}>{content}<CitationList citations={block.citations} pack={pack} library={library} onError={onError}/></section>;
}

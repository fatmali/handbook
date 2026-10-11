export function UtilityIcon({ name }: { name: 'quote' | 'resume' }) {
  return <svg viewBox="0 0 24 24" className="utility-icon" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{name === 'quote' ? <><path d="M5 3h14v18l-7-4-7 4Z"/><path d="M8 7h8m-8 4h6"/></> : <><path d="M12 3v10m-4-6 4-4 4 4"/><path d="M5 11v10h14V11"/><path d="M8 17h8"/></>}</svg>;
}

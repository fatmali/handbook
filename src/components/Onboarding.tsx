import { Cover } from './CourseContent';

export function Onboarding({ onImport }: { onImport: () => void }) {
  return <section className="onboarding">
    <div className="resume-folio onboarding-folio">
      <div>
        <h1>Your course, your handbook.</h1>
        <p className="lead">Bring your own course notes. Read connected explanations, explore diagrams, and keep your thoughts alongside them.</p>
        <p>Your library is empty. Import a generated Course Pack JSON to put your first handbook on the shelf.</p>
        <button className="primary" onClick={onImport}>Import your notes</button>
        <p className="small muted onboarding-privacy">No account or server upload. Courses and private notes stay in this browser.</p>
      </div>
      <div className="hero-volume"><Cover kind="network"/><span>Make the ideas<br/>your own.</span></div>
    </div>
    <section className="paper onboarding-guide">
      <h2>Nothing generated yet?</h2>
      <p>Use the course-builder skill with your AI agent to turn your textbook, syllabus, or lecture material into usable notes with diagrams.</p>
      <ol>
        <li><a href={`${import.meta.env.BASE_URL}downloads/handbook-course-builder.zip`} download>Download the course-builder skill</a> and install it in your agent.</li>
        <li>Give the agent your course material. Review one complete week of source-grounded notes and diagrams before it generates the rest.</li>
        <li>Save the validated course JSON, then import it here. You review and confirm the contents before anything is installed.</li>
      </ol>
      <details><summary>How files and privacy work</summary><p>Handbook reads generated Course Pack JSON locally. It does not send your course or notes to a server, and it does not generate notes from a PDF itself. Source PDFs can be attached privately after import.</p><p>Your AI agent has its own data policy; use tools you authorize for the material. Export a private backup from Settings to move browsers or protect against cleared browser storage. There is no automatic cross-device sync.</p></details>
    </section>
  </section>;
}

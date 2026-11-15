import { useState } from 'react'

/** Fixed context images; only their visibility control is interactive. */
export function MarsLocator() {
  const [open, setOpen] = useState(false)
  const asset = (name: string) => `${import.meta.env.BASE_URL}data/locator/${name}`
  return <figure className="mars-locator" onKeyDown={event => { if (event.key === 'Escape') setOpen(false) }}>
    <button className="mars-locator-toggle" type="button" aria-label="Show Pahrump Hills location within Gale Crater" aria-expanded={open} aria-controls="gale-location-context" onClick={() => setOpen(value => !value)}>
      <span className="mars-locator-globe">
        <img src={asset('gale-globe.png')} alt="Mars centered on the Gale Crater region, north up" width={112} height={112} draggable={false} />
        <span className="mars-locator-pin" aria-hidden="true" />
      </span>
      <span className="mars-locator-caption">Gale Crater</span>
    </button>
    {open && <section id="gale-location-context" className="mars-context" aria-label="Pahrump Hills location context">
      <header><h3>Pahrump Hills in Gale Crater</h3><button type="button" aria-label="Close location context" onClick={() => setOpen(false)}>x</button></header>
      <figure>
        <div className="gale-context-highlight">
          <img src={asset('gale-context.jpg')} alt="Gale Crater overview with the approximate Pahrump Hills area highlighted near the base of Mount Sharp" draggable={false} />
          <svg viewBox="0 0 960 600" aria-hidden="true">
            <ellipse cx="480" cy="380" rx="43" ry="21" />
            <path d="M515 367 L570 310 H780" />
            <text x="575" y="299">Pahrump Hills area</text>
          </svg>
        </div>
        <figcaption>Pahrump Hills area - approximate location at Mount Sharp's base.</figcaption>
      </figure>
      <figure>
        <img src={asset('pahrump-context.jpg')} alt="NASA topographic map labelling Pahrump Hills in the Murray Formation at the base of Mount Sharp" draggable={false} />
        <figcaption>Pahrump Hills - at the base of Mount Sharp.</figcaption>
      </figure>
      <p className="mars-context-sources"><a href="https://science.nasa.gov/photojournal/curiosity-cradled-by-gale-crater/" target="_blank" rel="noreferrer">Gale overview - NASA/JPL-Caltech/ESA/DLR/FU Berlin/MSSS</a><a href="https://www.jpl.nasa.gov/images/pia18474-slopes-of-mount-sharp/" target="_blank" rel="noreferrer">Pahrump map - NASA/JPL-Caltech/Univ. of Arizona</a></p>
    </section>}
  </figure>
}

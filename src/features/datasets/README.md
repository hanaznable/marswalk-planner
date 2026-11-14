# NASA dataset boundary

`regions.ts` contains navigation labels, not observations or map coverage.
`registry.ts` is deliberately empty. Add entries only for real, integrated assets
with their original source URL, attribution, region, and coordinate reference
system. Keep retrieval and format conversion outside React components.

Preprocessing belongs in `/scripts/preprocessing`; processed browser assets belong
in `/public/data`. Do not substitute Earth tiles, assume Earth distance formulas,
or assign fabricated coordinates to region selections.

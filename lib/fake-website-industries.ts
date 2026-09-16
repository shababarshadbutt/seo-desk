// Part F addition — deterministic-per-website industry-vertical generator,
// used as the seed value when a `WebsiteProfile` document is auto-created on
// first read (see app/api/website-profiles/route.ts). The Website model has
// no industry/vertical/category field, so this isn't a display-only fake —
// it backs a real, separate `WebsiteProfile` collection, editable later via
// PATCH. The pool intentionally mirrors real, plausible verticals for this
// app's actual dataset (its website names are overwhelmingly aviation/
// aerospace-parts-supply-chain — AFR Enterprises, AOG Airline Solutions, Aero
// OEM Parts, Plane Parts Pro, NSN Direct, etc.), matching the labels Stitch's
// own "RFQ Industry Breakdown" mock uses.
const FAKE_INDUSTRY_POOL = [
  "Aerospace & Defense",
  "Fasteners & Hardware",
  "Electromechanical Parts",
  "Commercial MRO",
  "Industrial Supply",
  "Electronics & Avionics",
];

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function fakeIndustryForWebsite(websiteId: string): string {
  return FAKE_INDUSTRY_POOL[hashString(websiteId) % FAKE_INDUSTRY_POOL.length];
}

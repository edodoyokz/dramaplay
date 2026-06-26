// ponytail: goodshort has a fully custom response shape (nested records/items,
// chapters-based stream resolution, chapter cache). Not a fit for
// SapimuPresetAdapter — keep the existing adapter class as-is.
export { GoodShortAdapter } from "../goodshort";

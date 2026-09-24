/**
 * storyteller/stories/districts.js
 * Canonical district dictionary.
 *
 * The same district is spelt differently across the portal's sources
 * ("Bolangir" in the projection sheets, "Balangir" officially; "Jajapur"
 * vs "Jajpur"; "Debagarh" vs "Deogarh"). Narration keeps the name the page
 * shows; this table only resolves which key to read in each dataset.
 */
(function (root) {
  'use strict';
  var NS = root.SoochanaStoryteller = root.SoochanaStoryteller || {};

  var CANONICAL = {
    Angul: ['Anugul'],
    Balangir: ['Bolangir', 'Bolangiri'],
    Balasore: ['Baleshwar', 'Baleswar', 'Balasore'],
    Bargarh: ['Baragarh'],
    Bhadrak: [],
    Boudh: ['Baudh', 'Bauda'],
    Cuttack: [],
    Deogarh: ['Debagarh', 'Debagada', 'Devgarh'],
    Dhenkanal: [],
    Gajapati: [],
    Ganjam: [],
    Jagatsinghpur: ['Jagatsinghapur'],
    Jajpur: ['Jajapur'],
    Jharsuguda: [],
    Kalahandi: [],
    Kandhamal: ['Kandhamala', 'Phulbani'],
    Kendrapara: [],
    Kendujhar: ['Keonjhar'],
    Khordha: ['Khurda', 'Khurdha'],
    Koraput: [],
    Malkangiri: [],
    Mayurbhanj: [],
    Nabarangpur: ['Nabarangapur', 'Nabarangpore', 'Nowrangpur'],
    Nayagarh: [],
    Nuapada: [],
    Puri: [],
    Rayagada: [],
    Sambalpur: [],
    Subarnapur: ['Sonepur', 'Sonapur'],
    Sundargarh: []
  };

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

  var lookup = {};
  Object.keys(CANONICAL).forEach(function (name) {
    lookup[norm(name)] = name;
    CANONICAL[name].forEach(function (alias) { lookup[norm(alias)] = name; });
  });

  function canonical(name) { return lookup[norm(name)] || null; }

  /* Find the key a given dataset uses for this district. */
  function resolveKey(name, keys) {
    var c = canonical(name);
    if (!c) return null;
    var forms = [c].concat(CANONICAL[c]).map(norm);
    for (var i = 0; i < keys.length; i++) {
      if (forms.indexOf(norm(keys[i])) !== -1) return keys[i];
    }
    return null;
  }

  NS.districts = { CANONICAL: CANONICAL, canonical: canonical, resolveKey: resolveKey, names: Object.keys(CANONICAL) };
  if (typeof module !== 'undefined' && module.exports) module.exports = NS.districts;
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================================
//  Banderas: devuelve la URL de la bandera de un equipo.
//  - Si viene de la API real, usamos su "crest" (la propia football-data.org la da).
//  - Si no, mapeamos el código FIFA (3 letras) a ISO-2 y usamos flagcdn.com.
// ============================================================================
const ISO2 = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', QAT: 'qa', CAN: 'ca', BEL: 'be', MAR: 'ma', JPN: 'jp',
  USA: 'us', NED: 'nl', SEN: 'sn', ECU: 'ec', BRA: 'br', SUI: 'ch', NGA: 'ng', AUS: 'au',
  CRO: 'hr', GHA: 'gh', ARG: 'ar', ESP: 'es', URU: 'uy', POR: 'pt',
  ENG: 'gb-eng', SCO: 'gb-sct', WAL: 'gb-wls', NIR: 'gb-nir',
  FRA: 'fr', GER: 'de', COL: 'co', ITA: 'it', DEN: 'dk', SRB: 'rs', POL: 'pl', NOR: 'no',
  EGY: 'eg', CIV: 'ci', KSA: 'sa', IRN: 'ir', TUN: 'tn', ALG: 'dz', CRC: 'cr', PAN: 'pa',
  HAI: 'ht', JOR: 'jo', UZB: 'uz', CPV: 'cv', NZL: 'nz', PAR: 'py', CUW: 'cw', HON: 'hn',
  PER: 'pe', CHI: 'cl', VEN: 've', CMR: 'cm', GAB: 'ga', MLI: 'ml', TUR: 'tr', UKR: 'ua',
  SWE: 'se', AUT: 'at', SVN: 'si', SVK: 'sk', CZE: 'cz', GRE: 'gr', IRL: 'ie', ROU: 'ro',
  HUN: 'hu', BOL: 'bo', UAE: 'ae', IRQ: 'iq', OMA: 'om', NED2: 'nl',
};

export function flagUrlFromCode(code) {
  if (!code) return null;
  const c = ISO2[code];
  return c ? `https://flagcdn.com/${c}.svg` : null;
}

export function flagUrl(team) {
  if (!team) return null;
  if (team.crest) return team.crest;       // la API ya trae la URL
  return flagUrlFromCode(team.code);
}

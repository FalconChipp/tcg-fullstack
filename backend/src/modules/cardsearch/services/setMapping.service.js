// src/modules/cardsearch/services/setMapping.service.js
// Maps: ABBREV => { tcgdex: '', ptcg: '' }

export const ALIASES = Object.freeze({
  // Mega Evolution sets:
  'MEG':   { tcgdex: 'me01',     ptcg: 'me1' },           // Mega Evolutions Base Set
  'PFL':   { tcgdex: null,       ptcg: null },            // Phantasmal Flames 

  // Scarlet & Violet sets:
  'SVP':   { tcgdex: 'svp',      ptcg: 'svp' },           // Scarlet & Violet Promos
  'SVI':   { tcgdex: 'sv01',     ptcg: 'sv1' },           // Scarlet & Violet Base Set
  'SVE':   { tcgdex: null,       ptcg: null },            // Scarlet & Violet Energy (In API?)
  'PAL':   { tcgdex: 'sv02',     ptcg: 'sv2' },           // Paldea Evolved
  'OBF':   { tcgdex: 'sv03',     ptcg: 'sv3' },           // Obsidian Flames
  'M23':   { tcgdex: null,       ptcg: null },            // McDonald's Match Battle 2023 (In API?)
  'MEW':   { tcgdex: 'sv03.5',   ptcg: 'sv3pt5' },        // 151
  'PAR':   { tcgdex: 'sv04',     ptcg: 'sv4' },           // Paradox Rift
  'PAF':   { tcgdex: 'sv04.5',   ptcg: 'sv4pt5' },        // Paldean Fates 
  'TEF':   { tcgdex: 'sv05',     ptcg: 'sv5' },           // Temporal Forces
  'TWM':   { tcgdex: 'sv06',     ptcg: 'sv6' },           // Twilight Masquerade
  'SFA':   { tcgdex: 'sv6.5',    ptcg: 'sv6pt5' },        // Shrouded Fable
  'SCR':   { tcgdex: 'sv07',     ptcg: 'sv7' },           // Stellar Crown 
  'SSP':   { tcgdex: 'sv08',     ptcg: 'sv8' },           // Surging Sparks
  'PRE':   { tcgdex: 'sv08.5',   ptcg: 'sv8pt5' },        // Prismatic Evolutions
  'JTG':   { tcgdex: 'sv09',     ptcg: 'sv9' },           // Journey Together
  'DRI':   { tcgdex: 'sv10',     ptcg: 'sv10' },          // Destined Rivals
  'BLK':   { tcgdex: 'sv10.5b',  ptcg: 'zsv10pt5' },      // Black Bolt
  'WHT':   { tcgdex: 'sv10.5w',  ptcg: 'rsv10pt5' },      // White Flare

  // Sword & Shield sets:
  'SWSH':  { tcgdex: 'swshp',    ptcg: 'swshp' },         // Sword & Shield Promos
  'SSH':   { tcgdex: 'swsh1',    ptcg: 'swsh1' },         // Sword & Shield
  'RCL':   { tcgdex: 'swsh2',    ptcg: 'swsh2' },         // Rebel Clash
  'DAA':   { tcgdex: 'swsh3',    ptcg: 'swsh3' },         // Darkness Ablaze
  'CPA':   { tcgdex: 'swsh3.5',  ptcg: 'swsh35' },        // Champion's Path
  'VIV':   { tcgdex: 'swsh4',    ptcg: 'swsh4' },         // Vivid Voltage
  'SHF':   { tcgdex: 'swsh4.5',  ptcg: 'swsh45' },        // Shining Fates
  'BST':   { tcgdex: 'swsh5',    ptcg: 'swsh5' },         // Battle Styles
  'CRE':   { tcgdex: 'swsh6',    ptcg: 'swsh6' },         // Chilling Reign
  'EVS':   { tcgdex: 'swsh7',    ptcg: 'swsh7' },         // Evolving Skies
  'FST':   { tcgdex: 'swsh8',    ptcg: 'swsh8' },         // Fusion Strike
  'BRS':   { tcgdex: 'swsh9',    ptcg: 'swsh9' },         // Brilliant Stars
  'ASR':   { tcgdex: 'swsh10',   ptcg: 'swsh10' },        // Astral Radiance
  'PGO':   { tcgdex: 'swsh10.5', ptcg: 'pgo' },           // Pokemon GO
  'LOR':   { tcgdex: 'swsh11',   ptcg: 'swsh11' },        // Lost Origin
  'SIT':   { tcgdex: 'swsh12',   ptcg: 'swsh12' },        // Silver Tempest
  'CRZ':   { tcgdex: 'swsh12.5', ptcg: 'swsh12pt5' },     // Crown Zenith
  'CEL':   { tcgdex: 'cel25',    ptcg: 'cel25' },         // Celebrations
  'FUT':   { tcgdex: 'fut2020',  ptcg: 'fut2020' },       // Pokemon Futsal 2020

  // Sun & Moon sets:
  'SMP':   { tcgdex: 'smp',      ptcg: 'smp' },           // SM Black Star Promos
  'SUM':   { tcgdex: 'sm1',      ptcg: 'sm1' },           // Sun & Moon
  'GRI':   { tcgdex: 'sm2',      ptcg: 'sm2' },           // Guardians Rising
  'BUS':   { tcgdex: 'sm3',      ptcg: 'sm3' },           // Burning Shadows
  'SLG':   { tcgdex: 'sm3.5',    ptcg: 'sm3.5' },         // Shining Legends
  'CIN':   { tcgdex: 'sm4',      ptcg: 'sm4' },           // Crimson Invasion
  'UPR':   { tcgdex: 'sm5',      ptcg: 'sm5' },           // Ultra Prism
  'FLI':   { tcgdex: 'sm6',      ptcg: 'sm6' },           // Forbidden Light
  'CES':   { tcgdex: 'sm7',      ptcg: 'sm7' },           // Celestial Storm
  'DRM':   { tcgdex: 'sm7.5',    ptcg: 'sm75' },          // Dragon Majesty
  'LOT':   { tcgdex: 'sm8',      ptcg: 'sm8' },           // Lost Thunder
  'TEU':   { tcgdex: 'sm9',      ptcg: 'sm9' },           // Team Up
  'UNB':   { tcgdex: 'sm10',     ptcg: 'sm10' },          // Unbroken Bonds
  'UNM':   { tcgdex: 'sm11',     ptcg: 'sm11' },          // Unified Minds
  'CEC':   { tcgdex: 'sm12',     ptcg: 'sm12' },          // Cosmic Eclipse
  'DET':   { tcgdex: 'det1',     ptcg: 'det1' },          // Detective Pikachu
  'HIF':   { tcgdex: 'sm115',    ptcg: 'sm115' },         // Hidden Fates
  'SMA':   { tcgdex: 'sma',      ptcg: 'sma' },           // Yellow A Alternate

  // XY sets:
  'XYP':   { tcgdex: 'xyp',      ptcg: 'xyp' },           // XY Black Star Promos
  'KSS':   { tcgdex: 'xy0',      ptcg: 'xy0' },           // Kalos Starter Set
  'XY':    { tcgdex: 'xy1',      ptcg: 'xy1' },           // XY Base
  'FLF':   { tcgdex: 'xy2',      ptcg: 'xy2' },           // Flashfire
  'FFI':   { tcgdex: 'xy3',      ptcg: 'xy3' },           // Furious Fists
  'PHF':   { tcgdex: 'xy4',      ptcg: 'xy4' },           // Phantom Forces
  'PRC':   { tcgdex: 'xy5',      ptcg: 'xy5' },           // Primal Clash
  'DCR':   { tcgdex: 'dc1',      ptcg: 'dc1' },           // Double Crisis
  'ROS':   { tcgdex: 'xy6',      ptcg: 'xy6' },           // Roaring Skies
  'AOR':   { tcgdex: 'xy7',      ptcg: 'xy7' },           // Ancient Origins
  'BKT':   { tcgdex: 'xy8',      ptcg: 'xy8' },           // BREAKthrough
  'BKP':   { tcgdex: 'xy9',      ptcg: 'xy9' },           // BREAKpoint
  'GEN':   { tcgdex: 'g1',       ptcg: 'g1' },            // Generations
  'FCO':   { tcgdex: 'xy10',     ptcg: 'xy10' },          // Fates Collide
  'STS':   { tcgdex: 'xy11',     ptcg: 'xy11' },          // Steam Siege
  'EVO':   { tcgdex: 'xy12',     ptcg: 'xy12' },          // Evolutions

  // Black & White sets:
  'BWP':   { tcgdex: 'bwp',      ptcg: 'bwp' },           // BW Black Star Promos
  'BLW':   { tcgdex: 'bw1',      ptcg: 'bw1' },           // Black & White
  'EPO':   { tcgdex: 'bw2',      ptcg: 'bw2' },           // Emerging Powers
  'NVI':   { tcgdex: 'bw3',      ptcg: 'bw3' },           // Noble Victories
  'NXD':   { tcgdex: 'bw4',      ptcg: 'bw4' },           // Next Destinies
  'DEX':   { tcgdex: 'bw5',      ptcg: 'bw5' },           // Dark Explorers
  'DRX':   { tcgdex: 'bw6',      ptcg: 'bw6' },           // Dragons Exalted
  'DRV':   { tcgdex: 'dv1',      ptcg: 'dv1' },           // Dragon Vault
  'BCR':   { tcgdex: 'bw7',      ptcg: 'bw7' },           // Boundaries Crossed
  'PLS':   { tcgdex: 'bw8',      ptcg: 'bw8' },           // Plasma Storm
  'PLF':   { tcgdex: 'bw9',      ptcg: 'bw9' },           // Plasma Freeze
  'PLB':   { tcgdex: 'bw10',     ptcg: 'bw10' },          // Plasma Blast
  'LTR':   { tcgdex: 'bw11',     ptcg: 'bw11' },          // Legendary Treasures
  'RC':    { tcgdex: 'rc',       ptcg: 'rc' },            // Radiant Collection

  // Diamond & Pearl sets:
  'DPP':   { tcgdex: 'dpp',      ptcg: 'dpp' },           // DP Black Star Promos
  'DP':    { tcgdex: 'dp1',      ptcg: 'dp1' },           // Diamond & Pearl
  'MT':    { tcgdex: 'dp2',      ptcg: 'dp2' },           // Mysterious Treasures
  'SW':    { tcgdex: 'dp3',      ptcg: 'dp3' },           // Secret Wonders
  'GE':    { tcgdex: 'dp4',      ptcg: 'dp4' },           // Great Encounters
  'MD':    { tcgdex: 'dp5',      ptcg: 'dp5' },           // Majestic Dawn
  'LA':    { tcgdex: 'dp6',      ptcg: 'dp6' },           // Legends Awakened
  'SF':    { tcgdex: 'dp7',      ptcg: 'dp7' },           // Stormfront
  'PL':    { tcgdex: 'pl1',       ptcg: 'pl1' },          // Platinum
  'RR':    { tcgdex: 'pl2',      ptcg: 'pl2' },           // Rising Rivals
  'SV':    { tcgdex: 'pl3',      ptcg: 'pl3' },           // Supreme Victors
  'AR':    { tcgdex: 'pl4',      ptcg: 'pl4' },           // Arceus
  'HSP':   { tcgdex: 'hgssp',    ptcg: 'hgssp' },         // HeartGold & Soul Silver Promos
  'HS':    { tcgdex: 'hgss1',     ptcg: 'hgss1' },        // HeartGold & SoulSilver
  'UL':    { tcgdex: 'hgss2',    ptcg: 'hgss2' },         // Unleashed
  'UD':    { tcgdex: 'hgss3',    ptcg: 'hgss3' },         // Undaunted
  'TM':    { tcgdex: 'hgss4',    ptcg: 'hgss4' },         // Triumphant
  'CL':    { tcgdex: 'col1',      ptcg: 'col1' },         // Call of Legends

  // Ex Series 
  'RS':    { tcgdex: 'ex1',      ptcg: 'ex1' },           // Ruby & Sapphire
  'SS':    { tcgdex: 'ex2',      ptcg: 'ex2' },           // Sandstorm 
  'DR':    { tcgdex: 'ex3',      ptcg: 'ex3' },           // Dragon
  'MA':    { tcgdex: 'ex4',      ptcg: 'ex4' },           // Team Magma v Team Aqua
  'HL':    { tcgdex: 'ex5',      ptcg: 'ex5' },           // Hidden Legends
  'RG':    { tcgdex: 'ex6',      ptcg: 'ex6' },           // FireRed & LeafGreen
  'TRR':   { tcgdex: 'ex7',      ptcg: 'ex7' },           // Team Rocket Returns 
  'DX':    { tcgdex: 'ex8',      ptcg: 'ex8' },           // Deoxys
  'EM':    { tcgdex: 'ex9',      ptcg: 'ex9' },           // Emerald 
  'UF':    { tcgdex: 'ex10',     ptcg: 'ex10' },          // Unseen Forces 
  'DS':    { tcgdex: 'ex11',     ptcg: 'ex11' },          // Delta Species 
  'LM':    { tcgdex: 'ex12',     ptcg: 'ex12' },          // Legend Maker 
  'HP':    { tcgdex: 'ex13',     ptcg: 'ex13' },          // Holon Phantoms 
  'CG':    { tcgdex: 'ex14',     ptcg: 'ex14' },          // Crystal Guardians 
  'DF':    { tcgdex: 'ex15',     ptcg: 'ex15' },          // Dragon Frontiers 
  'PK':    { tcgdex: 'ex16',     ptcg: 'ex16' },          // Power Keepers 

  // eCard Series 
  'EX':    { tcgdex: 'ecard1',   ptcg: 'ecard1' },        // Expedition Base Set 
  'AQ':    { tcgdex: 'ecard2',   ptcg: 'ecard2' },        // Aquapolis 
  'SK':    { tcgdex: 'ecard3',   ptcg: 'ecard3' },        // Skyridge 

  // Legendary Collection 
  'LC':    { tcgdex: 'lc',       ptcg: 'base6' },         // Legendary Collection

  // Neo Series 
  'N1':    { tcgdex: 'neo1',     ptcg: 'neo1' },          // Neo Genesis 
  'N2':    { tcgdex: 'neo2',     ptcg: 'neo2' },          // Neo Discovery 
  'N3':    { tcgdex: 'neo3',     ptcg: 'neo3' },          // Neo Revelation
  'N4':    { tcgdex: 'neo4',     ptcg: 'neo4' },          // Neo Destiny 

  // Original Series
  'BS':    { tcgdex: 'base1',    ptcg: 'base1' },         // Base set 
  'JU':    { tcgdex: 'base2',    ptcg: 'base2' },         // Jungle 
  'FO':    { tcgdex: 'base3',    ptcg: 'base3' },         // Fossil 
  'B2':    { tcgdex: 'base4',    ptcg: 'base4' },         // Base Set 2
  'TR':    { tcgdex: 'base5',    ptcg: 'base5' },         // Team Rocket 
  'G1':    { tcgdex: 'gym1',     ptcg: 'gym1' },          // Gym Heroes 
  'G2':    { tcgdex: 'gym2',     ptcg: 'gym2' },          // Gym Challenge 

  // Misc Sets 
  'SI':    { tcgdex: 'si1',      ptcg: 'si1' },           // Southern Islands 
  'CC':    { tcgdex: 'ex5.5',    ptcg: 'ex5.5' },         // Creator Pack 
  'RM':    { tcgdex: null,       ptcg: null },            // Pokemon Rumble 

  // POP & Prize Packs
  'POP1':  { tcgdex: 'pop1',     ptcg: 'pop1' },
  'POP2':  { tcgdex: 'pop2',     ptcg: 'pop2' },
  'POP3':  { tcgdex: 'pop3',     ptcg: 'pop3' },
  'POP4':  { tcgdex: 'pop4',     ptcg: 'pop4' },
  'POP5':  { tcgdex: 'pop5',     ptcg: 'pop5' },
  'POP6':  { tcgdex: 'pop6',     ptcg: 'pop6' },
  'POP7':  { tcgdex: 'pop7',     ptcg: 'pop7' },
  'POP8':  { tcgdex: 'pop8',     ptcg: 'pop8' },
  'POP9':  { tcgdex: 'pop9',     ptcg: 'pop9' },

  'PPS1':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 1
  'PPS2':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 2
  'PPS3':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 3
  'PPS4':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 4
  'PPS5':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 5
  'PPS6':  { tcgdex: null,       ptcg: null },            // Prize Pack Series 6

  'NP':    { tcgdex: 'np',       ptcg: 'np' },            // Nintendo Black Star Promos
  'WP':    { tcgdex: 'basep',    ptcg: 'basep' },         // Wizards Black Star Promos 
});

// ---------- Derived maps for fast reverse lookups ----------
const MAP_BY_ABBR = {};
const MAP_BY_TCGDEX = {};
const MAP_BY_PTCG = {};

for (const [abbr, ids] of Object.entries(ALIASES)) {
  const AB = abbr.toUpperCase();
  const tcgdex = normOrNull(ids.tcgdex);
  const ptcg = normOrNull(ids.ptcg);
  MAP_BY_ABBR[AB] = { abbr: AB, tcgdex, ptcg };

  if (tcgdex) {
    const key = tcgdex.toLowerCase();
    MAP_BY_TCGDEX[key] = { abbr: AB, tcgdex, ptcg };
  }
  if (ptcg) {
    const key = ptcg.toLowerCase();
    MAP_BY_PTCG[key] = { abbr: AB, tcgdex, ptcg };
  }
}

function normOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function clean(input) {
  return String(input ?? "").trim();
}

/**
 * Resolve any of: ABBR (e.g., 'SSP'), tcgdex ('sv08'), ptcg ('sv8')
 * Returns a normalized shape: { abbr, tcgdex, ptcg } or null if not recognized.
 */
export function resolveSet(input) {
  const raw = clean(input);
  if (!raw) return null;

  // ABBR
  const abbr = raw.toUpperCase();
  if (MAP_BY_ABBR[abbr]) return MAP_BY_ABBR[abbr];

  // tcgdex code
  const low = raw.toLowerCase();
  if (MAP_BY_TCGDEX[low]) return MAP_BY_TCGDEX[low];

  // ptcg code
  if (MAP_BY_PTCG[low]) return MAP_BY_PTCG[low];

  // Fallback: treat as canonical tcgdex if it "looks like" one, otherwise as abbr.
  // (Resolvers then confirm existence in DB.)
  const fallback = {
    abbr,
    tcgdex: low,
    ptcg: null,
  };
  return fallback;
}

/** Convenience: best-effort tcgdex code from any input; returns null if not determinable. */
export function resolveToTcgdex(input) {
  const r = resolveSet(input);
  return r?.tcgdex ?? null;
}

/** Convenience: best-effort ptcg code from any input; returns null if not determinable. */
export function resolveToPTCG(input) {
  const r = resolveSet(input);
  return r?.ptcg ?? null;
}

export function getAbbrForTcgdex(tcgdexCode) {
  if (!tcgdexCode) return null;
  const r = MAP_BY_TCGDEX[String(tcgdexCode).toLowerCase()];
  return r?.abbr ?? null;
}

export function getAbbrForPTCG(ptcgCode) {
  if (!ptcgCode) return null;
  const r = MAP_BY_PTCG[String(ptcgCode).toLowerCase()];
  return r?.abbr ?? null;
}

export function listKnownAbbrs() {
  return Object.keys(MAP_BY_ABBR);
}

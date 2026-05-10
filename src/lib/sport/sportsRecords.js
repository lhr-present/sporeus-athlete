// ─── src/lib/sport/sportsRecords.js — World-record + beginner reference times ──
// Tap-to-fill reference points for the Mission #1 PR picker. Times in seconds.
// "wr" = current men's open world-record class result (rounded to 1 sec for
// resilience to fractional-second updates). "beginner" = a defensible "first
// finish, untrained" time drawn from coaching manuals and event-cutoff tables.
// All entries keyed by (sport, distanceM). Bike direct-FTP and rowing
// time-distance pieces (30min / 60min) are NOT keyed here — those are watt-
// based or distance-based, not time-based.
//
// Sources:
//   Run        — World Athletics records list, IAU ultra records (Mar 2026)
//   Bike TT    — UCI / CTT individual TT records, Hour record (Mar 2026)
//   Swim LCM   — World Aquatics LCM records (Mar 2026)
//   Swim OW    — World Aquatics open-water marathon WR (Mar 2026)
//   Tri        — Ironman / Ironman 70.3 / World Triathlon course records
//   Row erg    — Concept2 World Records (heavyweight men, Mar 2026)
//
// Beginner figures: Daniels (2014), Friel (2016), Olbrecht (2000),
//   Concept2 "first 2k" coach notes; rounded to safe upper bands.
//
// PUBLIC API:
//   getReference(sport, distanceM) → { wr, beginner } | null
//   hasReference(sport, distanceM) → bool

// Helpers — keep numbers readable in the table below.
const m = (mm, ss) => mm * 60 + ss
const h = (hh, mm, ss) => hh * 3600 + mm * 60 + ss

// Distance keys mirror EliteProgramCard DISTANCES exactly.
export const SPORTS_RECORDS = {
  run: {
    1500:   { wr: m(3, 26),   beginner: m(7, 30)  },   // 1500m track
    1609:   { wr: m(3, 43),   beginner: m(8, 0)   },   // 1 mile
    3000:   { wr: m(7, 21),   beginner: m(15, 30) },
    5000:   { wr: m(12, 35),  beginner: m(30, 0)  },
    10000:  { wr: m(26, 11),  beginner: m(65, 0)  },
    15000:  { wr: m(41, 5),   beginner: h(1, 50, 0) },
    16093:  { wr: m(43, 54),  beginner: h(2, 0,  0) },  // 10 mi
    21097:  { wr: m(57, 31),  beginner: h(2, 30, 0) },  // half-marathon
    42195:  { wr: h(2, 0, 35), beginner: h(5, 30, 0) }, // marathon
    50000:  { wr: h(2, 38, 43), beginner: h(7, 0, 0) },
    100000: { wr: h(6, 9, 14),  beginner: h(15, 0, 0) },
    160934: { wr: h(11, 14, 56), beginner: h(30, 0, 0) }, // 100 mi
  },

  // bike TT — distanceM === 0 is the FTP-direct sentinel and lives outside
  // this table. Times are open men's records on flat course / track pursuit.
  bike: {
    1000:   { wr: m(0, 55),  beginner: m(2, 0)   },   // kilo TT (track)
    4000:   { wr: m(3, 59),  beginner: m(8, 0)   },   // 4km IP (track)
    16093:  { wr: m(16, 35), beginner: m(35, 0)  },   // 10 mi TT
    20000:  { wr: m(20, 50), beginner: m(45, 0)  },   // 20K
    40000:  { wr: m(46, 0),  beginner: h(1, 30, 0) },  // 40K TT
    40234:  { wr: m(42, 30), beginner: h(1, 35, 0) },  // 25 mi TT
    100000: { wr: h(2, 4, 0), beginner: h(4, 0, 0) },  // 100K
  },

  swim: {
    50:    { wr: m(0, 20.91), beginner: m(1, 0)  },
    100:   { wr: m(0, 46.4),  beginner: m(2, 0)  },
    200:   { wr: m(1, 42),    beginner: m(4, 30) },
    400:   { wr: m(3, 40),    beginner: m(10, 0) },
    800:   { wr: m(7, 32),    beginner: m(22, 0) },
    1500:  { wr: m(14, 31),   beginner: m(45, 0) },
    3000:  { wr: m(31, 0),    beginner: h(1, 30, 0) },
    5000:  { wr: m(53, 34),   beginner: h(2, 30, 0) },   // open water
    10000: { wr: h(1, 46, 51), beginner: h(5, 0,  0) },  // open water (Olympic)
    25000: { wr: h(4, 50, 0),  beginner: h(12, 0, 0) },  // open water marathon
  },

  triathlon: {
    25750:  { wr: m(52, 0),    beginner: h(2, 0, 0)  },  // sprint (~25.75km total)
    51500:  { wr: h(1, 39, 0), beginner: h(4, 0, 0)  },  // Olympic
    113000: { wr: h(3, 34, 53), beginner: h(8, 0, 0) },  // 70.3
    226000: { wr: h(7, 25, 18), beginner: h(16, 0, 0) }, // Iron 140.6
  },

  // Rowing erg — Concept2 heavyweight men records.
  // distanceM === 0 reserved for direct 2k entry (parity with bike FTP-direct);
  // 30min / 60min pieces are distance-based, surfaced separately if added.
  rowing: {
    500:   { wr: m(1, 10.5),  beginner: m(2, 30)  },
    1000:  { wr: m(2, 33.5),  beginner: m(5, 0)   },
    2000:  { wr: m(5, 35.8),  beginner: m(9, 30)  },
    5000:  { wr: m(14, 54),   beginner: m(25, 0)  },
    6000:  { wr: m(18, 13),   beginner: m(30, 0)  },
    10000: { wr: m(30, 46),   beginner: m(50, 0)  },
    21097: { wr: h(1, 8, 18), beginner: h(1, 50, 0) },
    42195: { wr: h(2, 21, 28), beginner: h(3, 50, 0) },
  },
}

export function getReference(sport, distanceM) {
  const table = SPORTS_RECORDS[sport]
  if (!table) return null
  const hit = table[distanceM]
  return hit || null
}

export function hasReference(sport, distanceM) {
  return getReference(sport, distanceM) != null
}

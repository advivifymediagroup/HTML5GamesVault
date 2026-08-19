/* Word Groups puzzle bank. Each puzzle is four groups of four related
   words, from easiest (yellow) to trickiest (purple) — the trap words in
   harder groups usually look like they belong somewhere else. */
window.GROUP_PUZZLES = [
  {
    groups: [
      {name: "Big cats", color: 0, words: ["LION", "TIGER", "PANTHER", "COUGAR"]},
      {name: "___ storm", color: 1, words: ["THUNDER", "SAND", "SNOW", "FIRE"]},
      {name: "Chess pieces", color: 2, words: ["KNIGHT", "BISHOP", "ROOK", "PAWN"]},
      {name: "Card suits, sort of", color: 3, words: ["HEART", "CLUB", "SPADE", "DIAMOND"]}
    ]
  },
  {
    groups: [
      {name: "Types of bread", color: 0, words: ["RYE", "SOURDOUGH", "PITA", "BAGEL"]},
      {name: "Ocean creatures", color: 1, words: ["OCTOPUS", "STARFISH", "URCHIN", "CORAL"]},
      {name: "___ light", color: 2, words: ["MOON", "SPOT", "TWI", "DAY"]},
      {name: "Card games", color: 3, words: ["BRIDGE", "RUMMY", "HEARTS", "SPADES"]}
    ]
  },
  {
    groups: [
      {name: "Kitchen tools", color: 0, words: ["WHISK", "LADLE", "GRATER", "SPATULA"]},
      {name: "Weather events", color: 1, words: ["MONSOON", "DROUGHT", "BLIZZARD", "HAIL"]},
      {name: "___ bell", color: 2, words: ["DOOR", "DUMB", "COW", "BAR"]},
      {name: "Chess-adjacent terms", color: 3, words: ["CASTLE", "CHECK", "GAMBIT", "STALEMATE"]}
    ]
  },
  {
    groups: [
      {name: "Units of time", color: 0, words: ["DECADE", "FORTNIGHT", "SEASON", "ERA"]},
      {name: "Parts of a shoe", color: 1, words: ["SOLE", "LACE", "HEEL", "TONGUE"]},
      {name: "___ note", color: 2, words: ["FOOT", "KEY", "SIDE", "BANK"]},
      {name: "Sudden movements", color: 3, words: ["LUNGE", "DART", "BOLT", "SPRING"]}
    ]
  },
  {
    groups: [
      {name: "Garden tools", color: 0, words: ["TROWEL", "RAKE", "SHEARS", "HOE"]},
      {name: "Types of dance", color: 1, words: ["WALTZ", "TANGO", "SALSA", "FOXTROT"]},
      {name: "___ box", color: 2, words: ["SAND", "MAIL", "TOOL", "MATCH"]},
      {name: "Card tricks, sort of", color: 3, words: ["SHUFFLE", "DEAL", "CUT", "DRAW"]}
    ]
  },
  {
    groups: [
      {name: "Types of clouds", color: 0, words: ["CIRRUS", "CUMULUS", "STRATUS", "NIMBUS"]},
      {name: "Sewing tools", color: 1, words: ["THIMBLE", "NEEDLE", "BOBBIN", "SEAM"]},
      {name: "___ house", color: 2, words: ["GREEN", "LIGHT", "TREE", "DOLL"]},
      {name: "Ways to walk", color: 3, words: ["STROLL", "STRUT", "SHUFFLE", "STOMP"]}
    ]
  },
  {
    groups: [
      {name: "Musical instruments", color: 0, words: ["OBOE", "CELLO", "TUBA", "HARP"]},
      {name: "Desert features", color: 1, words: ["DUNE", "OASIS", "MIRAGE", "CACTUS"]},
      {name: "___ stone", color: 2, words: ["MILE", "LIME", "CORNER", "GEM"]},
      {name: "Things with rings", color: 3, words: ["SATURN", "ONION", "TREE", "BOXING"]}
    ]
  },
  {
    groups: [
      {name: "Bicycle parts", color: 0, words: ["PEDAL", "SPOKE", "HANDLEBAR", "CHAIN"]},
      {name: "Baking essentials", color: 1, words: ["YEAST", "FLOUR", "BUTTER", "SUGAR"]},
      {name: "___ code", color: 2, words: ["ZIP", "MORSE", "BAR", "DRESS"]},
      {name: "Words for clever", color: 3, words: ["SHARP", "SHREWD", "ASTUTE", "CANNY"]}
    ]
  },
  {
    groups: [
      {name: "Camping gear", color: 0, words: ["TENT", "LANTERN", "COMPASS", "CANTEEN"]},
      {name: "Types of knots", color: 1, words: ["REEF", "BOWLINE", "CLOVE", "GRANNY"]},
      {name: "___ light", color: 2, words: ["FLASH", "STAR", "GAS", "HEAD"]},
      {name: "Things that flicker", color: 3, words: ["CANDLE", "SCREEN", "SIGNAL", "PULSE"]}
    ]
  },
  {
    groups: [
      {name: "Farm animals", color: 0, words: ["GOAT", "MULE", "OX", "RAM"]},
      {name: "Types of fences", color: 1, words: ["PICKET", "CHAIN", "STOCKADE", "RAIL"]},
      {name: "___ yard", color: 2, words: ["BACK", "COURT", "SCRAP", "GRAVE"]},
      {name: "Words for stubborn", color: 3, words: ["MULISH", "OBSTINATE", "HEADSTRONG", "DOGGED"]}
    ]
  },
  {
    groups: [
      {name: "Types of pasta", color: 0, words: ["PENNE", "FUSILLI", "LINGUINE", "RIGATONI"]},
      {name: "Parts of a castle", color: 1, words: ["MOAT", "TURRET", "DRAWBRIDGE", "PARAPET"]},
      {name: "___ jacket", color: 2, words: ["LIFE", "STRAIGHT", "DINNER", "BOMBER"]},
      {name: "Things that can be cracked", color: 3, words: ["JOKE", "CODE", "KNUCKLE", "SAFE"]}
    ]
  },
  {
    groups: [
      {name: "River features", color: 0, words: ["DELTA", "RAPIDS", "TRIBUTARY", "BEND"]},
      {name: "Types of hats", color: 1, words: ["BERET", "FEDORA", "BEANIE", "VISOR"]},
      {name: "___ trip", color: 2, words: ["ROAD", "GUILT", "FIELD", "EGO"]},
      {name: "Words for exhausted", color: 3, words: ["SPENT", "DRAINED", "BEAT", "WORN"]}
    ]
  },
  {
    groups: [
      {name: "Types of tea", color: 0, words: ["OOLONG", "CHAMOMILE", "MATCHA", "ROOIBOS"]},
      {name: "Boxing terms", color: 1, words: ["JAB", "CLINCH", "UPPERCUT", "BOUT"]},
      {name: "___ market", color: 2, words: ["FLEA", "BLACK", "SUPER", "STOCK"]},
      {name: "Words for fake", color: 3, words: ["BOGUS", "PHONY", "SHAM", "COUNTERFEIT"]}
    ]
  },
  {
    groups: [
      {name: "Parts of a tree", color: 0, words: ["TRUNK", "CANOPY", "BARK", "ROOT"]},
      {name: "Types of stitches", color: 1, words: ["CROSS", "BACK", "CHAIN", "BLANKET"]},
      {name: "___ line", color: 2, words: ["DEAD", "PUNCH", "BASE", "HEAD"]},
      {name: "Words for messy", color: 3, words: ["CLUTTERED", "SLOPPY", "UNKEMPT", "DISHEVELED"]}
    ]
  },
  {
    groups: [
      {name: "Types of soup", color: 0, words: ["BISQUE", "CHOWDER", "MINESTRONE", "CONSOMME"]},
      {name: "Astronomy terms", color: 1, words: ["ORBIT", "NEBULA", "ECLIPSE", "COMET"]},
      {name: "___ paper", color: 2, words: ["NEWS", "WALL", "SAND", "FLY"]},
      {name: "Ways to laugh", color: 3, words: ["CHUCKLE", "GIGGLE", "SNICKER", "CACKLE"]}
    ]
  }
];

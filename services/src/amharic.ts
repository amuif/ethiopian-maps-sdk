/** Valhalla maneuver fields the Amharic narrative needs */
export interface ValhallaManeuver {
  type: number;
  street_names?: string[];
  begin_street_names?: string[];
  roundabout_exit_count?: number;
}

const ordinal = (n: number) => `${n}ኛው`;

// Indexed by Valhalla maneuver type (valhalla/baldr/directionsbuilder TripLeg_Maneuver_Type).
// shortcut: phrases written by a non-native speaker and not reviewed yet; get a native speaker to check them before release.
const PHRASES: Record<number, string> = {
  1: 'ጉዞ ጀምር', 2: 'ጉዞ ጀምር', 3: 'ጉዞ ጀምር',
  4: 'መድረሻህ ደርሰሃል', 5: 'መድረሻህ በቀኝ በኩል ነው', 6: 'መድረሻህ በግራ በኩል ነው',
  7: 'ቀጥል', 8: 'ቀጥ ብለህ ቀጥል',
  9: 'በትንሹ ወደ ቀኝ ታጠፍ', 10: 'ወደ ቀኝ ታጠፍ', 11: 'ወደ ቀኝ በደንብ ታጠፍ',
  12: 'ዞረህ ተመለስ', 13: 'ዞረህ ተመለስ',
  14: 'ወደ ግራ በደንብ ታጠፍ', 15: 'ወደ ግራ ታጠፍ', 16: 'በትንሹ ወደ ግራ ታጠፍ',
  17: 'መግቢያውን ቀጥ ብለህ ያዝ', 18: 'በቀኝ በኩል ያለውን መግቢያ ያዝ', 19: 'በግራ በኩል ያለውን መግቢያ ያዝ',
  20: 'በቀኝ በኩል ባለው መውጫ ውጣ', 21: 'በግራ በኩል ባለው መውጫ ውጣ',
  22: 'ቀጥ ብለህ ቆይ', 23: 'በቀኝ በኩል ቆይ', 24: 'በግራ በኩል ቆይ',
  25: 'ተቀላቀል', 37: 'በቀኝ በኩል ተቀላቀል', 38: 'በግራ በኩል ተቀላቀል',
  26: 'ወደ አደባባዩ ግባ', 27: 'ከአደባባዩ ውጣ',
  28: 'ጀልባ ተሳፈር', 29: 'ከጀልባው ውረድ',
};

/** Amharic instruction for one Valhalla maneuver; street names come from OSM `name`, which is usually Amharic in Ethiopia. */
export function amharicInstruction(m: ValhallaManeuver): string {
  if (m.type === 26 && m.roundabout_exit_count) return `ወደ አደባባዩ ግባና በ${ordinal(m.roundabout_exit_count)} መውጫ ውጣ።`;
  const phrase = PHRASES[m.type] ?? 'ቀጥል';
  const street = (m.street_names ?? m.begin_street_names ?? [])[0];
  // Arrival and roundabout exit read badly with a street name appended
  return street && ![4, 5, 6, 27].includes(m.type) ? `${phrase}፤ ${street}።` : `${phrase}።`;
}

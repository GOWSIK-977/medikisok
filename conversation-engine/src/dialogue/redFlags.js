/**
 * Emergency-pattern symptom rules. minMatches = how many of the keywords
 * must appear (anywhere in the transcript so far) before the flag fires.
 * Deliberately conservative/simple for safety.
 */
const RULES = [
  {
    id: 'chest_pain_with_dyspnea',
    keywords: [
      'chest pain',
      'chest tight',
      'chest',
      'pressure in chest',
      'squeezing my chest',
      'heavy pressure',
      'breathless',
      'shortness of breath',
      'difficulty breathing',
      'struggling to breathe',
      'short of breath',
      "can't catch my breath",
      "cannot catch my breath"
    ],
    minMatches: 2,
    severity: 'critical',
  },
  {
    id: 'possible_stroke',
    keywords: ['face drooping', 'slurred speech', 'one side weak', 'sudden weakness', "can't move one side"],
    minMatches: 1,
    severity: 'critical',
  },
  {
    id: 'severe_abdominal_pain',
    keywords: ['abdominal pain', 'severe pain', 'vomiting blood', 'blood in vomit'],
    minMatches: 2,
    severity: 'urgent',
  },
  {
    id: 'high_fever_with_confusion',
    keywords: ['fever', 'confusion', 'disoriented', 'not making sense'],
    minMatches: 2,
    severity: 'urgent',
  },
];

module.exports = { RULES };

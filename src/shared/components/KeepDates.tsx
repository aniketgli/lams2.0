import React from 'react';

/** A date as the portal writes it: 2026-11-10, 10-11-2026 or 10 Nov 2026. */
const DATE = /(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{1,2} [A-Z][a-z]{2} \d{4})/;

/**
 * Text that may wrap between words (e.g. a date range in a narrow table column), but never inside
 * a date: "10-11-2026 – 11-11-2026" breaks only around the dash, not after "10-".
 */
export const KeepDates: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(DATE).map((part, i) => (i % 2 ? <span key={i} className="inline-block">{part}</span> : part))}</>
);

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

/** Hour cutoffs (local clock): morning < 12, afternoon < 17, evening < 21, else night. */
export const TIME_CUTOFFS = { morning: 12, afternoon: 17, evening: 21 } as const;

/** Part of the day from the viewer's local clock. One set of cutoffs for the greeting and the room. */
export function partOfDay(date: Date): PartOfDay {
  const h = date.getHours();
  return h < TIME_CUTOFFS.morning ? "morning" : h < TIME_CUTOFFS.afternoon ? "afternoon" : h < TIME_CUTOFFS.evening ? "evening" : "night";
}

/** Inline head script text: sets html[data-time] before first paint with the same cutoffs as partOfDay. */
export const TIME_BOOT = `(function(){try{var h=new Date().getHours();document.documentElement.setAttribute("data-time",h<${TIME_CUTOFFS.morning}?"morning":h<${TIME_CUTOFFS.afternoon}?"afternoon":h<${TIME_CUTOFFS.evening}?"evening":"night")}catch(e){}})();`;

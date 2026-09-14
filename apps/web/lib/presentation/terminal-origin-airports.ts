/**
 * Curated origin airports for the commercial flight handoff (TASK-053, COM-001).
 *
 * PaxPivot has no terminal coordinates and no nearest-airport engine (out of scope for this
 * pilot). This table is a small, **manually curated, non-authoritative** approximation of which
 * commercial airports sit near each registered pilot terminal, used only to suggest an origin for
 * a Google Flights search the traveler runs themselves. It cites no authoritative source and must
 * be reviewed/kept current by a person — see the UI's own "curated suggestion, check it yourself"
 * disclosure (`CommercialHandoff.tsx`), which is mandatory precisely because this table is not
 * verified.
 *
 * Keyed by the exact terminal `name` string seeded in
 * `apps/api/paxpivot/infrastructure/bootstrap.py::REFERENCE_TERMINALS` — the only stable,
 * human-legible identifier `TripRead` exposes to the web app (`terminal_id` is an opaque UUID).
 * A terminal not listed here (renamed, or newly registered) yields no curated airports; the
 * handoff never guesses one.
 */
export const CURATED_ORIGIN_AIRPORTS: Readonly<
  Record<string, readonly string[]>
> = {
  "Joint Base McGuire-Dix-Lakehurst Passenger Terminal": ["PHL", "TTN", "EWR"],
  "Dover AFB Passenger Terminal": ["PHL", "BWI"],
  "BWI AMC Passenger Terminal": ["BWI"],
  "Joint Base Andrews Passenger Terminal": ["DCA", "IAD", "BWI"],
};

/**
 * The curated commercial airports for a terminal, by its exact registered name.
 *
 * Returns an empty list — never a guess — for a terminal this table does not name.
 */
export function originAirportsForTerminal(
  terminalName: string,
): readonly string[] {
  return CURATED_ORIGIN_AIRPORTS[terminalName] ?? [];
}

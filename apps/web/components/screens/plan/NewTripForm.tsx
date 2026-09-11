import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export type TerminalOption = { id: string; name: string };

type Props = {
  terminals: readonly TerminalOption[];
  error?: string;
};

const ERROR_TEXT: Readonly<Record<string, string>> = {
  invalid:
    "That request was not accepted: the window must end after it starts, span at most 30 days, and the party must be 1 to 9.",
  unavailable:
    "We could not save the request. This is a failure on our side; nothing was recorded.",
};

/**
 * Plain HTML form posted to `/trips/new`; the browser never holds the API token. Native
 * `datetime-local`, `select` and `number` inputs carry the first line of validation; the API
 * makes the final decision.
 */
export function NewTripForm({ terminals, error }: Props) {
  return (
    <Card as="div">
      <form method="post" action="/trips/new" className="pp-stack">
        <label className="pp-label" htmlFor="origin_terminal_id">
          From terminal
        </label>
        <select
          id="origin_terminal_id"
          name="origin_terminal_id"
          required
          className="pp-input"
        >
          {terminals.map((terminal) => (
            <option key={terminal.id} value={terminal.id}>
              {terminal.name}
            </option>
          ))}
        </select>
        <label className="pp-label" htmlFor="destination_text">
          Where to
        </label>
        <input
          id="destination_text"
          name="destination_text"
          type="text"
          required
          maxLength={200}
          className="pp-input"
        />
        <label className="pp-label" htmlFor="window_start">
          Earliest departure (UTC)
        </label>
        <input
          id="window_start"
          name="window_start"
          type="datetime-local"
          required
          className="pp-input"
        />
        <label className="pp-label" htmlFor="window_end">
          Latest departure (UTC)
        </label>
        <input
          id="window_end"
          name="window_end"
          type="datetime-local"
          required
          className="pp-input"
        />
        <label className="pp-label" htmlFor="party_size">
          Travelers
        </label>
        <input
          id="party_size"
          name="party_size"
          type="number"
          min={1}
          max={9}
          defaultValue={1}
          required
          className="pp-input"
        />
        {error && Object.hasOwn(ERROR_TEXT, error) ? (
          <p className="pp-sub" role="alert">
            {ERROR_TEXT[error]}
          </p>
        ) : null}
        <Button type="submit">Save trip request</Button>
      </form>
    </Card>
  );
}

"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  AGE_BAND_OPTIONS,
  CATEGORY_ATTESTATION_OPTIONS,
  type PartyFormTravelerView,
  type PartyFormView,
} from "@/lib/presentation/screens/profile";

type Props = { model: PartyFormView };

const ERROR_TEXT: Readonly<Record<string, string>> = {
  invalid:
    "That party was not accepted: every traveler needs a category attestation and age band, " +
    "and a dependent must name the sponsor. At most 9 travelers are allowed.",
  unavailable:
    "We could not save your party. This is a failure on our side; nothing was changed.",
};

const MAX_DEPENDENTS = 8; // Sponsor + 8 dependents matches the party-size cap of 9.

type DependentRow = PartyFormTravelerView & { key: string };

let nextKey = 0;

function blankDependent(): DependentRow {
  return {
    key: `new-${nextKey++}`,
    id: "",
    categoryAttestation: "unknown",
    ageBand: "unknown",
  };
}

/**
 * Sets the sponsor's category attestation and adds/removes dependents with an age band
 * (TASK-050). Plain form fields carry the values; only the list of dependent rows is client
 * state, so the whole submission is one native POST to `model.action` and makes no eligibility
 * claim of its own.
 */
export function PartyForm({ model }: Props) {
  const [dependents, setDependents] = useState<DependentRow[]>(() =>
    model.dependents.map((dependent) => ({
      key: `existing-${dependent.id}`,
      ...dependent,
    })),
  );
  const formId = useId();

  function addDependent() {
    setDependents((current) => [...current, blankDependent()]);
  }

  function removeDependent(key: string) {
    setDependents((current) =>
      current.filter((dependent) => dependent.key !== key),
    );
  }

  return (
    <Card as="div" id="party-form">
      <h2 className="pp-title">Your party</h2>
      <form
        method="post"
        action={model.action}
        aria-label="Your party"
        className="pp-stack"
      >
        <input type="hidden" name="sponsor_id" value={model.sponsor.id} />
        <label className="pp-label" htmlFor={`${formId}-sponsor-category`}>
          Sponsor category attestation
        </label>
        <select
          id={`${formId}-sponsor-category`}
          name="sponsor_category_attestation"
          defaultValue={model.sponsor.categoryAttestation}
          className="pp-input"
        >
          {CATEGORY_ATTESTATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {dependents.map((dependent, index) => (
          <fieldset key={dependent.key} className="pp-stack">
            <legend className="pp-label">Dependent {index + 1}</legend>
            <input type="hidden" name="dependent_id" value={dependent.id} />
            <label
              className="pp-label"
              htmlFor={`${formId}-dependent-${dependent.key}-age`}
            >
              Age band
            </label>
            <select
              id={`${formId}-dependent-${dependent.key}-age`}
              name="dependent_age_band"
              defaultValue={dependent.ageBand}
              className="pp-input"
            >
              {AGE_BAND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label
              className="pp-label"
              htmlFor={`${formId}-dependent-${dependent.key}-category`}
            >
              Category attestation
            </label>
            <select
              id={`${formId}-dependent-${dependent.key}-category`}
              name="dependent_category_attestation"
              defaultValue={dependent.categoryAttestation}
              className="pp-input"
            >
              {CATEGORY_ATTESTATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeDependent(dependent.key)}
            >
              Remove dependent {index + 1}
            </Button>
          </fieldset>
        ))}

        {dependents.length < MAX_DEPENDENTS ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addDependent}
          >
            Add dependent
          </Button>
        ) : null}

        {model.error && Object.hasOwn(ERROR_TEXT, model.error) ? (
          <p className="pp-sub" role="alert">
            {ERROR_TEXT[model.error]}
          </p>
        ) : null}

        <Button type="submit">Save party</Button>
      </form>
    </Card>
  );
}

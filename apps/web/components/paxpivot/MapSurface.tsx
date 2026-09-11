import { Flag, MapPin, Plane, TowerControl } from "lucide-react";
import { useId } from "react";
import type {
  MapMarkerKind,
  MapMarkerView,
  MapView,
} from "@/lib/presentation/types";

const MARKER_ICON: Record<MapMarkerKind, typeof Plane> = {
  origin: MapPin,
  terminal: Plane,
  destination: Flag,
  airport: TowerControl,
};

const SURFACE_TEXT: Record<MapView["status"], string> = {
  ready: "Map",
  loading: "Map loading",
  empty: "No locations to map yet",
  error: "Map unavailable",
};

/** Every marker as a chip: the text alternative for the map, always rendered. */
export function MapMarkerList({
  markers,
}: {
  markers: readonly MapMarkerView[];
}) {
  if (markers.length === 0)
    return <p className="pp-meta">No locations to show yet.</p>;
  return (
    <ul className="pp-map__list" aria-label="Locations on the map">
      {markers.map((marker) => {
        const Icon = MARKER_ICON[marker.kind];
        const body = (
          <>
            <span className="pp-marker__dot" data-tone={marker.tone}>
              <Icon aria-hidden="true" />
            </span>
            {marker.label}
            <span className="pp-marker__status pp-meta">
              · {marker.statusText}
            </span>
          </>
        );
        return (
          <li key={marker.id}>
            {marker.href ? (
              <a className="pp-marker" href={marker.href}>
                {body}
              </a>
            ) : (
              <span className="pp-marker">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

type Props = { map: MapView; size?: "inline" | "hero" };

/**
 * Map container contract. The MapLibre canvas mounts inside `.pp-map__surface` in a later task;
 * this component never fetches data and always renders the marker list beside the surface.
 */
export function MapSurface({ map, size = "inline" }: Props) {
  const captionId = useId();
  return (
    <figure className="pp-map" aria-labelledby={captionId}>
      <div
        className="pp-map__surface"
        data-size={size}
        data-status={map.status}
        role="img"
        aria-label={`${map.title}: ${SURFACE_TEXT[map.status]}, ${map.markers.length} locations listed below`}
      >
        <span className="pp-map__note">
          {map.note ?? SURFACE_TEXT[map.status]}
        </span>
      </div>
      <figcaption id={captionId} className="sr-only">
        {map.title}
      </figcaption>
      <MapMarkerList markers={map.markers} />
    </figure>
  );
}

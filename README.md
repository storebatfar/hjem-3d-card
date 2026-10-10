# Hjem 3D Card

A Home Assistant Lovelace card that renders an interactive 3D model of a house and garden with three.js.
The house is described as data in the card configuration (`house:`), so the repository contains no
real floor plan — only the generic engine and a small example house (`test/fixtures/example-house.json`).

**Requirements:** A browser with WebGL2 support (all modern browsers since ~2018).

**Bundle size:** ≈ 530 KB (three.js included).

## Install
Add `storebatfar/hjem-3d-card` as a custom HACS repository (category *Dashboard*) and download it.

## Minimal configuration
```yaml
type: custom:hjem-3d-card
house: { ... }   # see test/fixtures/example-house.json for the format
```

Options: `height` (CSS height, default `calc(100vh - 96px)`), `idle_timeout` (seconds, default 60),
`quality` (`auto` | `high` | `medium` | `low`), `debug` (shows quality and frame time).

### Rooms and lights
Rooms come from the house description (`house.rooms`: floor rectangles per room id). Link a room to a Home Assistant
light group with `rooms`; in the floor-plan view the room glows in the group's colour and brightness and a tap toggles it.

```yaml
rooms:
  living: { light: light.living_room }
  bedroom: {}            # drawn, but no light (not tappable)
mode_entity: input_select.theme_mode   # tap flash turns dark when this is "Lys"
```

Optional house keys: `walls` (interior partitions: `x0,x1,z0,z1`, optional `h`), `fixtures` (`kind: cabinet|counter`,
`x0,x1,z0,z1,h`) and `room` on an opening so its glass glows with that room.

### Cars and charger

Parking spots come from `house.parking` (rear-bumper centre position and nose direction for each spot).
Link cars to parking with `cars`, and name Home Assistant entities to track them. A charger wall point comes from
`house.charger` (wall position, height, outward facing, and ground route to the driveway).

```yaml
cars:
  car1: { spot: p1, model: model_y, color: '#c8c8c8', page: biler,
    tracker: device_tracker.car1, cable: binary_sensor.car1_cable, charging: binary_sensor.car1_charging, battery: sensor.car1_battery }
charger:
  led: light.charger_led
page_entity: input_select.page
```

- `spot` (required): A parking spot from `house.parking`
- `model` (default `model_y`): Car type — `model_y` or `model_3` (affects render size and proportions)
- `color` (default `#c8c8c8`): Paint colour in hex format
- `page` (default `biler`): The `input_select` option to select on `page_entity` when the car is tapped
- `tracker` (optional): A device tracker entity; when `unavailable`, `unknown`, or missing, the car remains visible (only explicit away states hide it)
- `cable` (optional): A binary sensor entity; when `on`, a cable appears from the wall charger to the car's rear charge port
- `charging` (optional): A binary sensor entity; when `on`, the cable shows animated flow and the card renders continuously at ~15 fps while visible
- `battery` (optional): A numeric sensor entity; shows a battery percentage label above the car

Car-related configuration:
- `charger.led` (optional): Controls the wall charger LED colour and brightness; requires `house.charger`
- `page_entity` (optional): An `input_select` entity; tapping a car writes a `select_option` service call to open the car's page

See `test/fixtures/example-house.json` for a complete example.

## House format

The `house:` object describes the plot, building shell, roof, openings (windows/doors), surfaces (deck/path), and hedges. Coordinates are in metres, with origin at the northwest outer corner; x extends east, z extends south. Openings along a wall are measured along x (north/south walls) or z (west/east walls) from the wall's start.

Example structure:
- `plot`: `{ x0, x1, z0, z1 }` — plot boundaries
- `shell`: `{ width, depth, wallHeight?, wallThickness? }` — building dimensions
- `roof`: `{ pitch?, overhang?, gableOverhang?, solar: [...], windows: [...] }`
- `openings`: `{ north: [...], south: [...], west: [...], east: [...] }` — each item: `{ kind, from, to, sill?, head, room? }`
- `rooms`: `{ [id]: { rects: [{ x0, x1, z0, z1 }, ...] }, ... }` — floor rectangles per room
- `walls`: `[{ x0, x1, z0, z1, h? }, ...]` — interior partitions
- `fixtures`: `[{ kind, x0, x1, z0, z1, h }, ...]` — kind: `cabinet` | `counter`
- `surfaces`: `[{ kind, x0, x1, z0, z1 }, ...]` — kind: `concrete` | `path` | `deck`
- `hedges`: `[{ x0, x1, z0, z1, h? }, ...]`
- `parking`: `{ [id]: { x, z, facing } }` — rear-bumper centre on the ground + nose direction (`east` | `west` | `north` | `south`)
- `charger`: `{ x, y, z, facing, route: [{x, z}] }` — wall point, centre height, outward wall direction, ground waypoints to the driveway

See `test/fixtures/example-house.json` for a complete example.

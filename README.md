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

See `test/fixtures/example-house.json` for a complete example.

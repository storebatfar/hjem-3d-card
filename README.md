# Hjem 3D Card

A Home Assistant Lovelace card that renders an interactive 3D model of a house and garden with three.js.
The house is described as data in the card configuration (`house:`), so the repository contains no
real floor plan — only the generic engine and a small example house (`test/fixtures/example-house.json`).

## Install
Add `storebatfar/hjem-3d-card` as a custom HACS repository (category *Dashboard*) and download it.

## Minimal configuration
```yaml
type: custom:hjem-3d-card
house: { ... }   # see test/fixtures/example-house.json for the format
```

Options: `height` (CSS height, default `calc(100vh - 96px)`), `idle_timeout` (seconds, default 60),
`quality` (`auto` | `high` | `medium` | `low`), `debug` (shows quality and frame time).

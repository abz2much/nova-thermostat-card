# Nova Thermostat Card

An interactive dial thermostat card for Home Assistant, in Nova's ember/gold
visual style — pairs naturally with the [Nova theme](https://github.com/abz2much/nova-ha-theme)
and [Nova Hero Card](https://github.com/abz2much/nova-hero-card), but works
under any theme (it falls back to sensible defaults if theme variables
aren't set).

No dependencies, no build step — it's a single vanilla-JS custom element.

## Install via HACS

1. HACS → the three-dot menu → **Custom repositories**.
2. Add this repository's URL, category **Dashboard** (plugin).
3. Install **Nova Thermostat Card**, then hard-refresh your browser.

## Install manually

1. Copy `nova-thermostat-card.js` into your Home Assistant `config/www/` directory.
2. Add it as a dashboard resource (**Settings → Dashboards → ⋮ → Resources →
   Add Resource**):
   - URL: `/local/nova-thermostat-card.js`
   - Resource type: **JavaScript Module**
3. Hard-refresh your browser.

## Usage

```yaml
type: custom:nova-thermostat-card
entity: climate.living_room
name: Living Room # optional, overrides the entity's own name
```

- `entity` *(required)* — a `climate.*` entity.
- `name` *(optional)* — display name; defaults to the entity's own name.

## Controls

- **−  /  +** buttons step the target temperature by the entity's own
  `target_temp_step` (falls back to 0.5°). Calls are debounced 500ms after
  the last tap so rapid taps don't spam `climate.set_temperature`.
- A row of mode buttons (Heat / Cool / Auto / Dry / Fan / Off) appears
  automatically for any entity that supports more than one `hvac_mode`,
  calling `climate.set_hvac_mode`.
- The ring itself is display-only (no drag-to-set) — it shows the target
  temperature as arc progress and current temperature as a small dot marker,
  colored by the active mode (ember for heat, cool blue for cool, etc.).

## Scope

One climate entity per card, matching how you'd use the native thermostat
card — add one instance per thermostat.

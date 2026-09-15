const MODE_COLOR = {
  heat: '#e2542f',
  cool: '#6ea8ff',
  auto: '#5fbf7a',
  dry: '#e8b23d',
  fan_only: '#6ea8ff',
  heat_cool: '#f4b860',
  off: '#7a6d5e',
};

const MODE_LABEL = {
  heat: 'Heat',
  cool: 'Cool',
  auto: 'Auto',
  dry: 'Dry',
  fan_only: 'Fan',
  heat_cool: 'Heat/Cool',
  off: 'Off',
};

const R = 80;
const CX = 100;
const CY = 100;
const SWEEP = 270; // degrees of arc; leaves a 90deg gap centered at the bottom
const START = 90 + (360 - SWEEP) / 2; // 135deg — start of the arc, clockwise from east
const CIRCUMFERENCE = 2 * Math.PI * R;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pointOnRing(fraction) {
  const angleDeg = START + SWEEP * clamp(fraction, 0, 1);
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(angleRad),
    y: CY + R * Math.sin(angleRad),
  };
}

function arcDashArray(fraction) {
  const len = CIRCUMFERENCE * (SWEEP / 360) * clamp(fraction, 0, 1);
  return `${len} ${CIRCUMFERENCE - len}`;
}

class NovaThermostatCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith('climate.')) {
      throw new Error('nova-thermostat-card: "entity" must be a climate.* entity');
    }
    this.config = config;
    this._pendingTarget = null;
    this._debounceTimer = null;

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(175deg, var(--card-background-color, #1e1712), #19140fdd);
          border: 1px solid var(--divider-color, #33291f);
          border-radius: var(--ha-card-border-radius, 16px);
          padding: 20px 20px 16px;
        }
        ha-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #6ea8ff, #f4b860 55%, #e2542f);
          opacity: .55;
        }
        ha-card:hover {
          border-color: #e2542f70;
          box-shadow: 0 0 18px 1px #e2542f22;
        }
        .title {
          font-size: 15px;
          font-weight: 600;
          color: var(--primary-text-color, #f3ece1);
          margin: 0 0 6px;
          text-align: center;
        }
        .ring-wrap {
          position: relative;
          width: 100%;
          max-width: 220px;
          margin: 0 auto;
        }
        svg { display: block; width: 100%; height: auto; }
        .track { fill: none; stroke: var(--divider-color, #33291f); stroke-width: 10; stroke-linecap: round; }
        .progress { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray .3s ease, stroke .3s ease; }
        .current-dot { transition: cx .3s ease, cy .3s ease; }
        .center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          pointer-events: none;
        }
        .state-label {
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: var(--secondary-text-color, #a89a89);
        }
        .target {
          font-size: 34px;
          font-weight: 600;
          color: var(--primary-text-color, #f3ece1);
          line-height: 1.1;
        }
        .target sup { font-size: 16px; font-weight: 500; }
        .current {
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
          color: var(--secondary-text-color, #a89a89);
        }
        .buttons {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          margin-top: 10px;
        }
        .step-btn {
          width: 40px; height: 40px;
          border-radius: 50%;
          border: 1px solid var(--divider-color, #33291f);
          background: var(--secondary-background-color, #1e1712);
          color: var(--primary-text-color, #f3ece1);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: border-color .2s ease, background .2s ease;
        }
        .step-btn:hover { border-color: #f4b860; }
        .step-btn:active { background: var(--divider-color, #33291f); }
        .modes {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 6px;
          margin-top: 12px;
        }
        .mode-btn {
          padding: 5px 11px;
          border-radius: 14px;
          border: 1px solid var(--divider-color, #33291f);
          background: transparent;
          color: var(--secondary-text-color, #a89a89);
          font-family: var(--code-font-family, monospace);
          font-size: 11px;
          cursor: pointer;
          transition: border-color .2s ease, color .2s ease, background .2s ease;
        }
        .mode-btn.active {
          color: var(--primary-text-color, #f3ece1);
          border-color: currentColor;
          font-weight: 600;
        }
      </style>
      <ha-card>
        <p class="title"></p>
        <div class="ring-wrap">
          <svg viewBox="0 0 200 200">
            <circle class="track" cx="${CX}" cy="${CY}" r="${R}"
              transform="rotate(${START} ${CX} ${CY})"
              stroke-dasharray="${arcDashArray(1)}"></circle>
            <circle class="progress" cx="${CX}" cy="${CY}" r="${R}"
              transform="rotate(${START} ${CX} ${CY})"></circle>
            <circle class="current-dot" r="5" fill="var(--primary-text-color, #f3ece1)"></circle>
          </svg>
          <div class="center">
            <div class="state-label"></div>
            <div class="target"></div>
            <div class="current"></div>
          </div>
        </div>
        <div class="buttons">
          <button class="step-btn" data-dir="-1" aria-label="Decrease temperature">−</button>
          <button class="step-btn" data-dir="1" aria-label="Increase temperature">+</button>
        </div>
        <div class="modes"></div>
      </ha-card>`;

    this._els = {
      title: this.shadowRoot.querySelector('.title'),
      progress: this.shadowRoot.querySelector('.progress'),
      dot: this.shadowRoot.querySelector('.current-dot'),
      stateLabel: this.shadowRoot.querySelector('.state-label'),
      target: this.shadowRoot.querySelector('.target'),
      current: this.shadowRoot.querySelector('.current'),
      modes: this.shadowRoot.querySelector('.modes'),
      buttons: this.shadowRoot.querySelectorAll('.step-btn'),
    };

    this._els.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this._step(Number(btn.dataset.dir)));
    });
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this.config.entity];
    if (!stateObj || !this._els) return;

    const attrs = stateObj.attributes;
    const min = attrs.min_temp ?? 7;
    const max = attrs.max_temp ?? 35;
    this._step_size = attrs.target_temp_step || 0.5;
    this._min = min;
    this._max = max;

    const target = this._pendingTarget ?? attrs.temperature ?? attrs.target_temp_low ?? min;
    const current = attrs.current_temperature;
    const mode = stateObj.state;
    const action = attrs.hvac_action;

    const color = MODE_COLOR[mode] || MODE_COLOR.off;
    this._els.title.textContent = this.config.name || hass.formatEntityName?.(stateObj) || stateObj.attributes.friendly_name || this.config.entity;
    this._els.progress.setAttribute('stroke', color);
    this._els.progress.setAttribute('stroke-dasharray', arcDashArray((target - min) / (max - min)));
    this._els.dot.setAttribute('fill', color);

    if (current != null) {
      const p = pointOnRing((current - min) / (max - min));
      this._els.dot.setAttribute('cx', p.x);
      this._els.dot.setAttribute('cy', p.y);
      this._els.dot.style.display = '';
    } else {
      this._els.dot.style.display = 'none';
    }

    const label = action && action !== 'off' ? action : mode;
    this._els.stateLabel.textContent = (label || '').replace(/_/g, ' ');
    const digits = this._step_size.toString().split('.')[1]?.length ?? 0;
    this._els.target.innerHTML = `${target.toFixed(digits)}<sup>°</sup>`;
    this._els.current.textContent = current != null ? `now ${current}°` : '';

    const modes = attrs.hvac_modes || [];
    if (modes.length > 1) {
      this._els.modes.innerHTML = modes
        .map((m) => `<button class="mode-btn${m === mode ? ' active' : ''}" data-mode="${m}" style="color:${m === mode ? MODE_COLOR[m] || '' : ''}">${MODE_LABEL[m] || m}</button>`)
        .join('');
      this._els.modes.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._hass.callService('climate', 'set_hvac_mode', {
            entity_id: this.config.entity,
            hvac_mode: btn.dataset.mode,
          });
        });
      });
    } else {
      this._els.modes.innerHTML = '';
    }
  }

  _step(dir) {
    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) return;
    const base = this._pendingTarget ?? stateObj.attributes.temperature ?? this._min;
    const next = clamp(
      Math.round((base + dir * this._step_size) / this._step_size) * this._step_size,
      this._min,
      this._max
    );
    this._pendingTarget = next;
    // Re-render immediately for a responsive feel, then debounce the actual call.
    this.hass = this._hass;

    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._hass.callService('climate', 'set_temperature', {
        entity_id: this.config.entity,
        temperature: next,
      });
      this._pendingTarget = null;
    }, 500);
  }

  getCardSize() {
    return 4;
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find((id) => id.startsWith('climate.'));
    return { entity: entity || 'climate.living_room' };
  }
}

customElements.define('nova-thermostat-card', NovaThermostatCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'nova-thermostat-card',
  name: 'Nova Thermostat',
  description: 'Ember/gold dial thermostat card with temperature and mode controls',
});

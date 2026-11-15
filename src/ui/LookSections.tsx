import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { updateSettings, useSettings } from '../theme/settings';
import { CARD_BACKS, PIECE_SETS, THEMES, TILE_STYLES } from '../theme/themes';
import { card } from '../games/cards/cards';
import { PlayingCard } from '../games/cards/CardView';
import { TileView } from '../games/tiles/TileView';

export type LookPart = 'theme' | 'pieces' | 'cardBack' | 'cardFace' | 'tiles';
export const ALL_LOOKS: LookPart[] = ['theme', 'pieces', 'cardBack', 'cardFace', 'tiles'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  return (
    <section className="stack-sm">
      <h2 className="section-title">{t(title)}</h2>
      <div className="swatch-grid">{children}</div>
    </section>
  );
}

/** The appearance pickers, shared by the Customize page and the in-game panel */
export function LookSections({ parts = ALL_LOOKS }: { parts?: LookPart[] }) {
  const s = useSettings();
  const t = useT();
  const has = (p: LookPart) => parts.includes(p);
  return (
    <>
      {has('theme') && (
        <Section title="Table background">
          {THEMES.map((th) => (
            <button key={th.id} className={'swatch' + (s.theme === th.id ? ' on' : '')} aria-pressed={s.theme === th.id} onClick={() => updateSettings({ theme: th.id })}>
              <span className="swatch-preview" style={{ background: th.vars['--bg'] }}>
                <span className="swatch-accent" style={{ background: th.vars['--accent'] }} />
              </span>
              <span className="small">{t(th.name)}</span>
            </button>
          ))}
        </Section>
      )}
      {has('pieces') && (
        <Section title="Player colors">
          {s.colorblind && <p className="small muted wide-note">{t('Colorblind-friendly colors are on (in Customize), so these are replaced.')}</p>}
          {PIECE_SETS.map((p) => (
            <button key={p.id} className={'swatch' + (s.pieces === p.id ? ' on' : '')} aria-pressed={s.pieces === p.id} onClick={() => updateSettings({ pieces: p.id })}>
              <span className="swatch-preview dots">
                {p.colors.slice(0, 4).map((c) => (
                  <span key={c} className="seat-dot big" style={{ background: c }} />
                ))}
              </span>
              <span className="small">{t(p.name)}</span>
            </button>
          ))}
        </Section>
      )}
      {has('cardBack') && (
        <Section title="Card backs">
          {CARD_BACKS.map((b) => (
            <button key={b.id} className={'swatch' + (s.cardBack === b.id ? ' on' : '')} aria-pressed={s.cardBack === b.id} onClick={() => updateSettings({ cardBack: b.id })}>
              <span className="swatch-preview plain">
                <span className={`pcard pcard-md back back-${b.id}`}>
                  <span className="back-inner" />
                </span>
              </span>
              <span className="small">{t(b.name)}</span>
            </button>
          ))}
        </Section>
      )}
      {has('cardFace') && (
        <Section title="Card faces">
          {(
            [
              ['two', 'Classic red & black'],
              ['four', 'Four colors'],
            ] as const
          ).map(([id, name]) => (
            <button key={id} className={'swatch' + (s.cardFace === id ? ' on' : '')} aria-pressed={s.cardFace === id} onClick={() => updateSettings({ cardFace: id })}>
              <span className="swatch-preview plain">
                {[card(0, 14), card(1, 13), card(2, 12), card(3, 10)].map((c, i) => (
                  <PlayingCard key={c} card={c} size="sm" face={id} style={{ marginLeft: i ? -14 : 0 }} />
                ))}
              </span>
              <span className="small">{t(name)}</span>
            </button>
          ))}
        </Section>
      )}
      {has('tiles') && (
        <Section title="Okey tiles">
          {TILE_STYLES.map((ts) => (
            <button key={ts.id} className={'swatch' + (s.tiles === ts.id ? ' on' : '')} aria-pressed={s.tiles === ts.id} onClick={() => updateSettings({ tiles: ts.id })}>
              <span className={`swatch-preview plain tiles-${ts.id}`}>
                {[0, 14, 28, 42].map((tile) => (
                  <TileView key={tile} tile={tile} size="sm" styleId={ts.id} />
                ))}
              </span>
              <span className="small">{t(ts.name)}</span>
            </button>
          ))}
        </Section>
      )}
    </>
  );
}

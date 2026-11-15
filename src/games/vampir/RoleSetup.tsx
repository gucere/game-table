import type { GameOptionsProps } from '../../engine/types';
import { t as tx } from '../../i18n';
import { checkCounts, countsFor, suggestedCounts } from './config';
import { ROLES, ROLE_IDS, type Role } from './roles';
import './vampir.css';

const TEAM_LABEL = { village: 'Village', vampires: 'Vampires', neutral: 'On their own' } as const;

/** Setup panel: how many of each role, with a suggested lineup for the table size */
export function RoleSetup({ numPlayers, options, onChange, readOnly }: GameOptionsProps) {
  const auto = !options.roster || options.roster === 'auto';
  const counts = countsFor(numPlayers, options);
  const error = checkCounts(numPlayers, counts);
  const total = ROLE_IDS.reduce((a, r) => a + counts[r], 0);
  const set = (role: Role, value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 12) return;
    onChange?.('roster', JSON.stringify({ ...counts, [role]: value }));
  };

  return (
    <section className="stack-sm vk-setup" aria-label={tx('Role lineup')}>
      <div className="vk-setup-heading">
        <div>
          <h2 className="section-title">{tx('Role lineup')}</h2>
          <p className="small muted">{tx('How many players get each role. Roles are dealt secretly when the game starts.')}</p>
        </div>
        <span className={'chip' + (total === numPlayers ? '' : ' trump-chip')} aria-live="polite">
          {tx('{total} / {players} roles', { total, players: numPlayers })}
        </span>
      </div>
      {!readOnly && (
        <div className="vk-setup-actions">
          <button className="btn" onClick={() => onChange?.('roster', 'auto')} disabled={auto}>
            ✨ {tx('Use the suggestion for {n} players', { n: numPlayers })}
          </button>
          {auto && <span className="small muted">{tx('Suggested lineup: it follows the number of players. Change any number to make your own.')}</span>}
        </div>
      )}
      {(['village', 'vampires', 'neutral'] as const).map((team) => (
        <div key={team} className="stack-sm">
          <h3 className="small vk-team">{tx(TEAM_LABEL[team])}</h3>
          <div className="vk-role-grid">
            {ROLE_IDS.filter((r) => ROLES[r].team === team).map((role) => (
              <div className="vk-role-count" key={role}>
                <span className="vk-role-count-text">
                  <strong>
                    {ROLES[role].icon} {tx(ROLES[role].name)}
                  </strong>
                  <span className="small muted">{tx(ROLES[role].desc)}</span>
                </span>
                {readOnly ? (
                  <strong className="vk-role-number">{counts[role]}</strong>
                ) : (
                  <span className="vk-stepper">
                    <button className="btn small" aria-label={tx('Fewer')} disabled={counts[role] <= 0} onClick={() => set(role, counts[role] - 1)}>
                      −
                    </button>
                    <strong className="vk-role-number">{counts[role]}</strong>
                    <button className="btn small" aria-label={tx('More')} disabled={counts[role] >= 12} onClick={() => set(role, counts[role] + 1)}>
                      +
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {error ? (
        <p className="status" role="alert">
          {tx(error)}
          {!readOnly && !auto && ` ${tx('Or use the suggestion.')}`}
        </p>
      ) : (
        <p className="small muted">{tx('Every player has a role. Ready to play.')}</p>
      )}
      {!error && counts.kardes === 1 && <p className="small muted">{tx('A single Sibling has nobody to recognize. Use two or more.')}</p>}
    </section>
  );
}

/** Default when the setup suggests roles for a table size (used by tests too) */
export { suggestedCounts };

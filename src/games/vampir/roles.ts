/** Vampir Köylü roles: names and descriptions are our own. Names are translated through i18n. */
export type Team = 'village' | 'vampires' | 'neutral';

export const ROLE_IDS = ['koylu', 'vampir', 'doktor', 'gozcu', 'cadi', 'avci', 'koruma', 'yasli', 'kardes', 'aga', 'lanetli', 'hain', 'soytari', 'katil'] as const;
export type Role = (typeof ROLE_IDS)[number];

export const ROLES: Record<Role, { name: string; icon: string; team: Team; desc: string }> = {
  koylu: { name: 'Villager', icon: '🌾', team: 'village', desc: 'No power at night. Talk, watch and vote out the vampires.' },
  vampir: { name: 'Vampire', icon: '🧛', team: 'vampires', desc: 'Each night, choose a victim together with the other vampires. By day, blend in.' },
  doktor: { name: 'Doctor', icon: '🩺', team: 'village', desc: 'Each night, protect one person (yourself too) from every attack except poison. Not the same person two nights in a row.' },
  gozcu: { name: 'Seer', icon: '🔮', team: 'village', desc: 'Each night, look into one person and learn whether they are a vampire.' },
  cadi: { name: 'Witch', icon: '🧪', team: 'village', desc: 'You have one healing potion (protects a person for a night) and one poison (kills a person) for the whole game. At most one potion a night.' },
  avci: { name: 'Hunter', icon: '🏹', team: 'village', desc: 'When you die, by night or by vote, you may take one living player down with you.' },
  koruma: { name: 'Bodyguard', icon: '🛡️', team: 'village', desc: 'Each night, guard someone else. If they are attacked, you die in their place. Not the same person two nights in a row.' },
  yasli: { name: 'Elder', icon: '🧓', team: 'village', desc: 'Tough as old boots: you survive the first vampire bite. Anything after that can kill you.' },
  kardes: { name: 'Sibling', icon: '🤝', team: 'village', desc: 'You know who the other Siblings are, so you can trust each other. No night power.' },
  aga: { name: 'Noble', icon: '🎩', team: 'village', desc: 'The first time the village votes you out, your title is revealed and you stay. The second time, you go.' },
  lanetli: { name: 'Cursed', icon: '🌑', team: 'village', desc: 'You are on the village side, but the Seer sees you as a vampire. Careful!' },
  hain: { name: 'Traitor', icon: '🗡️', team: 'vampires', desc: 'A human who serves the vampires. You know who they are; they don’t know you. You can’t bite, and the Seer sees you as human. You win with the vampires.' },
  soytari: { name: 'Jester', icon: '🃏', team: 'neutral', desc: 'You win alone if the village votes you out by day, and the game ends right there. Dying at night doesn’t count.' },
  katil: { name: 'Killer', icon: '🔪', team: 'neutral', desc: 'Each night, kill one person. You win alone if you are among the last two players standing.' },
};

export const roleTeam = (role: Role): Team => ROLES[role].team;
/** Who counts toward the vampires' numbers: vampires and their human helper */
export const onVampireSide = (role: Role) => roleTeam(role) === 'vampires';

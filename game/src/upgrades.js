// The eight blessings the lantern offers between waves. Each one names itself, says what
// it does in one line, and applies itself to the keeper's stats. A blessing may be taken
// more than once; the world caps how far each stat can grow.

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Wick',
    desc: 'Fire 18% faster',
    apply(stats) {
      stats.fireInterval = Math.max(0.07, stats.fireInterval * 0.82);
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Flame',
    desc: '+1 bolt damage',
    apply(stats) {
      stats.boltDamage += 1;
    },
  },
  {
    id: 'twin',
    name: 'Twin Lanterns',
    desc: '+1 bolt per shot (max 5)',
    apply(stats) {
      stats.bolts = Math.min(5, stats.bolts + 1);
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    desc: 'Bolts pass through +1 gloom',
    apply(stats) {
      stats.pierce += 1;
    },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    desc: 'Move 12% faster',
    apply(stats) {
      stats.speed = Math.min(480, stats.speed * 1.12);
    },
  },
  {
    id: 'mend',
    name: 'Lantern Mend',
    desc: 'Restore 40 lantern light',
    apply(stats, world) {
      world.healLantern(40);
    },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    desc: 'Embers fly to you from farther away',
    apply(stats) {
      stats.magnet = Math.min(420, stats.magnet * 1.6);
    },
  },
  {
    id: 'dash',
    name: 'Long Dash',
    desc: 'Dash recharges 35% faster',
    apply(stats) {
      stats.dashCooldown = Math.max(0.6, stats.dashCooldown * 0.65);
    },
  },
];

/** Three different blessings, drawn from the seeded random: the choice between waves. */
export function drawUpgrades(random) {
  const pool = UPGRADES.slice();
  const drawn = [];
  for (let i = 0; i < 3; i += 1) {
    const index = Math.floor(random() * pool.length);
    drawn.push(pool.splice(index, 1)[0]);
  }
  return drawn;
}

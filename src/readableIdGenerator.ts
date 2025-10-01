const adjectifs = [
  'Agile', 'Bleu', 'Calme', 'Doux', 'Epique', 'Fort', 'Grand', 'Habile', 'Intense', 'Joyeux', 
  'Brave', 'Clair', 'Drole', 'Efficace', 'Fier', 'Gentil', 'Haut', 'Ideal', 'Juste', 'Noble'
];

const noms = [
  'Lion', 'Tigre', 'Aigle', 'Comete', 'Defi', 'Eclair', 'Feu', 'Guerrier', 'Heros', 'Impact',
  'Jet', 'Lune', 'Mythe', 'Ninja', 'Ocean', 'Prodige', 'Quete', 'Reve', 'Soleil', 'Titan'
];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateReadableId(): string {
  const adj = getRandomElement(adjectifs);
  const nom = getRandomElement(noms);
  const num = Math.floor(Math.random() * 100);
  
  return `${adj}-${nom}-${num}`.toLowerCase();
}

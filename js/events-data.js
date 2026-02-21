/* ================================================================
   YourPass — events-data.js
   Source unique de vérité pour tous les événements.
   Importez ce fichier AVANT main.js sur toutes les pages.
================================================================ */

'use strict';

window.YOURPASS_EVENTS = [
  {
    id: 1,
    title: 'WeLoveYa Festival',
    description: 'La plus grande fête de la musique au Bénin avec des artistes locaux et internationaux. Une expérience inoubliable qui célèbre la richesse musicale du Bénin et de toute l\'Afrique de l\'Ouest.',
    location: 'Cotonou',
    venue: 'Stade de l\'Amitié',
    date: '2026-03-15',
    endDate: '2026-03-17',
    time: '18:00 - 23:00',
    price: 5000,
    vipPrice: 15000,
    image: 'welove.jpg',
    category: 'festival',
    featured: true,
    artists: ['Angelique Kidjo', 'Skepta', 'Burna Boy', 'Willy Azadi'],
    organizer: 'YourPass Events',
    ageRestriction: 'Tous publics',
    capacity: 50000
  },
  {
    id: 2,
    title: 'Eat & Drink Festival',
    description: 'Célébration de la gastronomie béninoise avec des chefs renommés, des dégustations et des ateliers culinaires. Venez découvrir les saveurs authentiques du Bénin.',
    location: 'Porto-Novo',
    venue: 'Place Jean Bayol',
    date: '2026-04-20',
    endDate: '2026-04-21',
    time: '12:00 - 22:00',
    price: 3000,
    vipPrice: 8000,
    image: 'eatdrink.jpeg',
    category: 'food',
    featured: false,
    artists: ['Chef Marcel', 'Chef Aïcha', 'Chef Yvette'],
    organizer: 'Benin Food Association',
    ageRestriction: 'Tous publics',
    capacity: 10000
  },
  {
    id: 3,
    title: 'Vodun Days',
    description: 'Festival des traditions et cultures ancestrales du Bénin. Cérémonies authentiques, danses traditionnelles et expositions culturelles inoubliables.',
    location: 'Ouidah',
    venue: 'Route des Esclaves',
    date: '2026-01-10',
    endDate: '2026-01-12',
    time: '09:00 - 18:00',
    price: 2500,
    vipPrice: 6000,
    image: 'vodun.jpeg',
    category: 'culture',
    featured: false,
    artists: ['Groupe Dan Gnon', 'Troupe Sakpata', 'Compagnie Mina'],
    organizer: 'Ministère de la Culture',
    ageRestriction: 'Tous publics',
    capacity: 15000
  },
  {
    id: 4,
    title: 'Arts Festival Benin',
    description: 'Célébration des arts contemporains et traditionnels du Bénin. Expositions, performances artistiques et ateliers ouverts à tous.',
    location: 'Cotonou',
    venue: 'Centre Culturel',
    date: '2026-05-25',
    endDate: '2026-05-27',
    time: '10:00 - 20:00',
    price: 4000,
    vipPrice: 10000,
    image: 'vodun1.jpeg',
    category: 'culture',
    featured: false,
    artists: ['Romuald Hazoumé', 'Chloé Quenum', 'Ornel Mancini'],
    organizer: 'Benin Arts Council',
    ageRestriction: 'Tous publics',
    capacity: 8000
  },
  {
    id: 5,
    title: 'Jazz Night Cotonou',
    description: 'Soirée jazz en plein air sous les étoiles. Une sélection de musiciens d\'exception pour une nuit mémorable.',
    location: 'Cotonou',
    venue: 'Institut Français du Bénin',
    date: '2026-02-14',
    endDate: '2026-02-14',
    time: '20:00 - 23:00',
    price: 7500,
    vipPrice: 15000,
    image: 'welove4.jpeg',
    category: 'concert',
    featured: false,
    artists: ['Jazz Band 1', 'Jazz Band 2'],
    organizer: 'Institut Français',
    ageRestriction: 'Tous publics',
    capacity: 500
  },
  {
    id: 6,
    title: 'Tech Conference Bénin',
    description: 'Conférence sur l\'innovation technologique en Afrique avec des experts de renommée internationale.',
    location: 'Parakou',
    venue: 'Université de Parakou',
    date: '2026-06-20',
    endDate: '2026-06-21',
    time: '09:00 - 17:00',
    price: 10000,
    vipPrice: 20000,
    image: 'welove5.jpeg',
    category: 'conference',
    featured: false,
    artists: [],
    organizer: 'Tech Africa Hub',
    ageRestriction: 'Tous publics',
    capacity: 2000
  }
];

/**
 * Retourne un événement par son ID.
 */
window.getEventById = function(id) {
  return window.YOURPASS_EVENTS.find(e => e.id === parseInt(id)) || null;
};

/**
 * Formate un prix en XOF.
 */
window.formatPrice = function(price) {
  if (!price && price !== 0) return 'Gratuit';
  return new Intl.NumberFormat('fr-FR').format(price) + ' XOF';
};

/**
 * Formate une date en français.
 */
window.formatDate = function(dateStr, options) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', options || { day: 'numeric', month: 'long', year: 'numeric' });
};

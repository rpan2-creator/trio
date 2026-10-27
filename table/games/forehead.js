/* Forehead — hold the phone to your forehead; team shouts clues. Tilt down = got it,
   tilt up = pass (DeviceOrientation), with on-screen buttons and keyboard as fallback. */
(function () {
  'use strict';
  const T = window.Table, esc = T.esc;

  const DECKS = {
    movies: { name: 'Movie Moments', emoji: '🎬', color: '#ff4d6d', hint: 'Describe the scene', words: ['Car chase', 'Alien invasion', 'Zombie outbreak', 'Bank heist', 'Shark attack', 'Haunted house', 'Time travel', 'Superhero landing', 'Slow-motion explosion', 'Courtroom drama', 'Prom night', 'Road trip', 'Training montage', 'Sword fight', 'Dance-off', 'Wedding crasher', 'Plot twist', 'Kissing in the rain', 'Disaster at sea', 'Robot uprising', 'Haunted doll', 'Spy gadget', 'Jungle expedition', 'Treasure map', 'Western showdown', 'Pirate ship', 'Dinosaur escape', 'Space station', 'Prison break', 'Undercover cop', 'Body swap', 'Talking animal', 'Final battle', 'Popcorn bucket', 'Red carpet', 'Movie trailer voice', 'Sequel', 'Jump scare', 'Credits scene', 'Stunt double', 'Villain monologue', 'Sidekick', 'Getaway driver', 'Mad scientist', 'Magic wand', 'Haunted mirror'] },
    animals: { name: 'Animals', emoji: '🦒', color: '#3ddc97', hint: 'Sounds & moves allowed', words: ['Giraffe', 'Penguin', 'Kangaroo', 'Octopus', 'Flamingo', 'Sloth', 'Hippo', 'Peacock', 'Porcupine', 'Chameleon', 'Llama', 'Platypus', 'Raccoon', 'Skunk', 'Squirrel', 'Bald eagle', 'Jellyfish', 'Seahorse', 'Crab', 'Lobster', 'Gorilla', 'Koala', 'Panda', 'Polar bear', 'Moose', 'Armadillo', 'Hedgehog', 'Bat', 'Owl', 'Woodpecker', 'Turkey', 'Goat', 'Donkey', 'Rooster', 'Camel', 'Zebra', 'Cheetah', 'Walrus', 'Dolphin', 'Shark', 'Snail', 'Butterfly', 'Mosquito', 'Beaver', 'Alligator', 'Hamster', 'Parrot'] },
    foods: { name: 'Snack Attack', emoji: '🍔', color: '#ff9f1c', hint: 'Foods & drinks', words: ['Pizza', 'Hot dog', 'Taco', 'Cheeseburger', 'Pancakes', 'Waffles', 'Mac and cheese', 'Buffalo wings', 'Nachos', 'S\'mores', 'Corn dog', 'Popcorn', 'Pretzel', 'Apple pie', 'Cotton candy', 'Corn on the cob', 'Spaghetti', 'Sushi', 'Burrito', 'Guacamole', 'Lemonade', 'Milkshake', 'Ice cream sandwich', 'Donut', 'Bagel', 'Chicken nuggets', 'French fries', 'Potato salad', 'Meatloaf', 'Clam chowder', 'Lobster roll', 'Barbecue ribs', 'Cupcake', 'Peanut butter', 'Pickle', 'Watermelon', 'Grilled cheese', 'Cereal', 'Chili', 'Brownie', 'Cinnamon roll', 'Coffee', 'Bubble gum', 'Jelly beans', 'Fortune cookie', 'Avocado toast'] },
    jobs: { name: 'Who Am I? Jobs', emoji: '👩‍🚒', color: '#4cc9f0', hint: 'Act out the job', words: ['Firefighter', 'Astronaut', 'Dentist', 'Lifeguard', 'Chef', 'Plumber', 'Pilot', 'Magician', 'Mail carrier', 'Barber', 'Referee', 'Zookeeper', 'Librarian', 'Detective', 'Farmer', 'Weather reporter', 'Taxi driver', 'Personal trainer', 'Surgeon', 'Teacher', 'Ballerina', 'DJ', 'Waiter', 'Photographer', 'Construction worker', 'Lumberjack', 'Clown', 'Tour guide', 'Babysitter', 'Scientist', 'Judge', 'Cowboy', 'Bartender', 'Mechanic', 'Electrician', 'Hairdresser', 'Ship captain', 'Park ranger', 'Ice cream truck driver', 'News anchor', 'Opera singer', 'Mime', 'Auctioneer', 'Crossing guard', 'Beekeeper', 'Gardener'] },
    sports: { name: 'Game Day', emoji: '🏈', color: '#9b5de5', hint: 'Sports & activities', words: ['Touchdown', 'Slam dunk', 'Home run', 'Hole in one', 'Surfing', 'Bowling', 'Figure skating', 'Bull riding', 'Sumo wrestling', 'Archery', 'Fencing', 'Ping pong', 'Cheerleading', 'Marathon', 'Rock climbing', 'Skateboarding', 'Water skiing', 'Yoga', 'Karate', 'Boxing', 'Hockey', 'Curling', 'Pole vault', 'Hurdles', 'Synchronized swimming', 'Tailgating', 'Wave in the stands', 'Mascot', 'Halftime show', 'Hula hoop', 'Jump rope', 'Cornhole', 'Tug of war', 'Golf cart', 'Bobsled', 'Ski jump', 'Horse racing', 'Lacrosse', 'Volleyball spike', 'Penalty kick', 'Gymnastics', 'Weightlifting', 'Bicycle race', 'Fishing', 'Kayaking', 'Dodgeball'] },
    accents: { name: 'Say It With an Accent', emoji: '🗣️', color: '#f15bb5', hint: 'Clue-giver must use the accent shown', words: ['Pirate: Treasure', 'Cowboy: Horse', 'Royal butler: Teacup', 'Surfer dude: Wave', 'Robot: Vacuum', 'Sports announcer: Goal', 'Old-time radio host: Microphone', 'Grandpa: Rocking chair', 'Valley girl: Shopping mall', 'Movie trailer guy: Volcano', 'Whisper: Library', 'Opera singer: Shower', 'Toddler: Ice cream', 'Game show host: Prize', 'Southern belle: Sweet tea', 'Vampire: Garlic', 'Drill sergeant: Push-ups', 'Nature documentary: Squirrel', 'Auctioneer: Antique', 'Flight attendant: Seatbelt', 'Super villain: Kitten', 'Detective: Fingerprint', 'Wizard: Toaster', 'News anchor: Traffic jam', 'Chef: Spaghetti', 'Fitness coach: Burpee', 'Ghost: Doorbell', 'Alien: Hamburger', 'Knight: Dragon', 'Yoga teacher: Pretzel', 'Infomercial host: Blender', 'Baby talk: Puppy', 'Rapper: Grocery list', 'Shakespeare actor: Smartphone', 'Lifeguard: Sunscreen', 'Sleepy person: Alarm clock', 'Tour guide: Statue', 'Pageant host: Crown', 'Robot butler: Sandwich', 'Mad scientist: Potato', 'Cheerleader: Homework', 'Weather reporter: Tornado', 'Grumpy cat: Monday', 'Caveman: Cell phone'] },
    actout: { name: 'Act It Out', emoji: '🎭', color: '#ffd23f', hint: 'No talking — charades only!', words: ['Brushing teeth', 'Walking a dog', 'Changing a tire', 'Riding a roller coaster', 'Bobbing for apples', 'Flipping pancakes', 'Taking a selfie', 'Mowing the lawn', 'Building a snowman', 'Doing laundry', 'Juggling', 'Playing air guitar', 'Milking a cow', 'Walking on ice', 'Riding a horse', 'Blowing bubbles', 'Hailing a taxi', 'Carving a turkey', 'Lighting a campfire', 'Assembling furniture', 'Parallel parking', 'Wrapping a present', 'Stepping on a LEGO brick', 'Swatting a fly', 'Opening a stuck jar', 'Ironing a shirt', 'Shoveling snow', 'Rowing a boat', 'Painting a wall', 'Getting a haircut', 'Watching a scary movie', 'Bowling a strike', 'Yawning', 'Sneezing', 'Lost in the dark', 'Climbing a ladder', 'Diving into a pool', 'Walking a tightrope', 'Making a pizza', 'Eating spaghetti', 'Playing the drums', 'Sleepwalking', 'Waiting in line', 'Catching a fish', 'Popping popcorn', 'Riding a unicycle'] },
  };

  const L = {
    DECKS,
    /* Phone held upright on the forehead, screen facing out: beta ~ 90.
       Screen tipped to the floor: |beta| > 140 -> correct. Screen tipped to the ceiling: beta < 35 -> pass.
       Must return to the neutral band (55..125) before the next tilt counts. */
    tilt(beta, armed) {
      if (beta == null) return { armed, act: null };
      if (beta > 55 && beta < 125) return { armed: true, act: null };
      if (!armed) return { armed, act: null };
      if (Math.abs(beta) > 140) return { armed: false, act: 'correct' };
      if (beta < 35 && beta > -40) return { armed: false, act: 'pass' };
      return { armed, act: null };
    },
  };

  function mount(root, ctx) {
    const P = ctx.players.filter(p => !p.bot);
    const dur = ctx.opts.seconds || 60;
    let dead = false, timer = null, results = [], idx = 0, playerI = 0, teamScores = P.map(() => 0), deckKey = null, words = [], used = new Set();
    const el = s => root.querySelector(s);

    function shell(inner, cls) {
      root.innerHTML = `<div class="fh ${cls || ''}">${inner}</div>`;
    }

    function pickDeck() {
      shell(`<header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">Forehead</span><span class="g-sub">${esc(P[playerI].name)} is up</span></div><span class="icon-btn ghost"></span></header>
        <div class="fh-pick"><h1 class="display">Pick a deck</h1><p class="sub">${esc(P[playerI].name)} guesses. Everyone else gives clues!</p>
        <div class="deck-grid">${Object.entries(DECKS).map(([k, d], i) => `<button type="button" class="deck-tile" data-deck="${k}" style="--dc:${d.color};--d:${i * 50}ms"><span class="dt-emoji">${d.emoji}</span><b>${d.name}</b><small>${d.hint}</small><i class="dt-n">${d.words.length} cards</i></button>`).join('')}</div></div>`, 'pick');
      root.querySelector('.deck-grid').addEventListener('click', e => { const b = e.target.closest('[data-deck]'); if (b) { T.sfx('pop'); deckKey = b.dataset.deck; ready(); } });
    }

    let orientOK = false, orientHandler = null;
    async function ensureOrientation() {
      try {
        if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const r = await DeviceOrientationEvent.requestPermission(); orientOK = r === 'granted';
        } else orientOK = 'DeviceOrientationEvent' in window && matchMedia('(pointer:coarse)').matches;
      } catch (e) { orientOK = false; }
    }

    function ready() {
      const d = DECKS[deckKey];
      shell(`<header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">${d.emoji} ${esc(d.name)}</span><span class="g-sub">${dur} seconds</span></div><span class="icon-btn ghost"></span></header>
        <div class="fh-ready" style="--dc:${d.color}">
          <div class="fh-phone-demo" aria-hidden="true"><div class="head">🙂</div><div class="ph"><span>${esc(d.words[0])}</span></div></div>
          <h1 class="display">${esc(P[playerI].name)}, phone on your forehead!</h1>
          <ul class="tilt-help"><li><span class="tiltb down">⤵</span><b>Tilt down</b> when you get it</li><li><span class="tiltb up">⤴</span><b>Tilt up</b> to pass</li></ul>
          <p class="sub">No tilt sensor? Use the big buttons (or ↓ / ↑ keys).</p>
          <button type="button" class="btn primary xl wide" data-go>I'm ready</button></div>`, 'ready');
      el('[data-go]').addEventListener('click', async () => { T.sfx('tap'); await ensureOrientation(); countdown(); }, { once: true });
      el('[data-go]').focus();
    }

    async function countdown() {
      const d = DECKS[deckKey];
      for (const k of [3, 2, 1]) {
        if (dead) return;
        shell(`<div class="fh-count" style="--dc:${d.color}"><span class="display">${k}</span></div>`, 'count');
        T.sfx('tick'); T.haptic(20); await T.sleep(800);
      }
      start();
    }

    function start() {
      const d = DECKS[deckKey];
      words = T.shuffle(d.words.filter(w => !used.has(w))); if (words.length < 15) { used.clear(); words = T.shuffle(d.words); }
      idx = 0; results = [];
      let left = dur, armed = true, locked = false;
      shell(`<div class="fh-play" style="--dc:${d.color}">
        <div class="fh-top"><button type="button" class="icon-btn glass" data-menu aria-label="Game menu">${T.icon('menu')}</button><span class="fh-time" role="timer">${left}</span><span class="fh-score">✓ <b>0</b></span></div>
        <div class="fh-card" aria-live="assertive" data-deck="${esc(d.emoji + ' ' + d.name)}"><span class="fh-word display">${esc(words[0])}</span><small>${esc(d.hint)}</small></div>
        <div class="fh-btns"><button type="button" class="fh-b pass" data-a="pass" aria-label="Pass">⤴ Pass</button><button type="button" class="fh-b ok" data-a="correct" aria-label="Got it">Got it ⤵</button></div>
        <div class="fh-flash" aria-hidden="true"></div></div>`, 'playing');
      if (window.Frame) window.Frame.tone('light');
      const word = el('.fh-word'), tm = el('.fh-time'), sc = el('.fh-score b'), flash = el('.fh-flash'), card = el('.fh-card');
      const fit = () => { const len = words[idx].length; word.style.fontSize = (len > 22 ? 30 : len > 14 ? 38 : len > 9 ? 46 : 56) + 'px'; };
      fit();
      function act(kind) {
        if (locked || dead || ctx.paused) return; locked = true;
        results.push({ w: words[idx], ok: kind === 'correct' }); used.add(words[idx]);
        flash.className = 'fh-flash show ' + kind; flash.textContent = kind === 'correct' ? 'CORRECT!' : 'PASS';
        T.sfx(kind === 'correct' ? 'correct' : 'pass'); T.haptic(kind === 'correct' ? 30 : [15, 40, 15]);
        sc.textContent = results.filter(r => r.ok).length;
        setTimeout(() => {
          idx++; if (idx >= words.length) { words = words.concat(T.shuffle(d.words)); }
          word.textContent = words[idx]; fit(); card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
          flash.className = 'fh-flash'; locked = false;
        }, 700 * (T.speed === 1 ? 1 : 0.1));
      }
      root.querySelector('.fh-btns').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
      const key = e => { if (e.key === 'ArrowDown') { e.preventDefault(); act('correct'); } if (e.key === 'ArrowUp') { e.preventDefault(); act('pass'); } };
      document.addEventListener('keydown', key);
      if (orientOK) {
        armed = false;
        orientHandler = e => { const r = L.tilt(e.beta, armed); armed = r.armed; if (r.act) act(r.act); };
        window.addEventListener('deviceorientation', orientHandler);
      }
      timer = setInterval(() => {
        if (ctx.paused) return;
        left--; tm.textContent = left; tm.classList.toggle('low', left <= 10);
        if (left <= 5 && left > 0) T.sfx('tick');
        if (left <= 0) {
          clearInterval(timer); document.removeEventListener('keydown', key);
          if (orientHandler) window.removeEventListener('deviceorientation', orientHandler);
          T.sfx('buzz'); roundDone();
        }
      }, 1000 * (T.speed === 1 ? 1 : 0.03));
      cleanup = () => { clearInterval(timer); document.removeEventListener('keydown', key); if (orientHandler) window.removeEventListener('deviceorientation', orientHandler); };
    }
    let cleanup = () => {};

    async function roundDone() {
      const got = results.filter(r => r.ok).length;
      teamScores[playerI] += got;
      shell(`<div class="fh-times-up"><span class="display">TIME'S UP!</span></div>`, 'count');
      await T.sleep(1100); if (dead) return;
      const more = playerI < P.length - 1 && ctx.opts.mode !== 'single';
      shell(`<header class="g-top">${ctx.menuButton()}<div class="g-title"><span class="g-name">Round results</span><span class="g-sub">${esc(P[playerI].name)} · ${esc(DECKS[deckKey].name)}</span></div><span class="icon-btn ghost"></span></header>
        <div class="fh-res"><div class="fh-big"><span class="display">${got}</span><small>correct</small></div>
        <ul class="fh-list">${results.map((r, i) => `<li class="${r.ok ? 'ok' : 'no'}" style="--d:${i * 50}ms"><span>${r.ok ? '✓' : '✕'}</span>${esc(r.w)}</li>`).join('') || '<li class="no">No cards played</li>'}</ul></div>
        <footer class="footbar">${more ? `<button type="button" class="btn primary grow xl" data-next>Next: ${esc(P[playerI + 1].name)}</button>` : '<button type="button" class="btn primary grow xl" data-fin>See final scores</button>'}</footer>`, 'res');
      if (got) T.sfx('win');
      root.querySelector('.footbar').addEventListener('click', e => {
        if (e.target.closest('[data-next]')) { playerI++; T.sfx('tap'); pickDeck(); }
        if (e.target.closest('[data-fin]')) finish();
      });
    }

    function finish() {
      const played = ctx.opts.mode === 'single' ? [playerI] : P.map((_, i) => i).slice(0, playerI + 1);
      const order = played.sort((a, b) => teamScores[b] - teamScores[a]);
      ctx.end({
        headline: `${P[order[0]].name} is the forehead champ!`, sub: `${dur}-second rounds`,
        ranking: order.map(i => Object.assign({}, P[i], { label: teamScores[i] + ' correct' })),
        stats: [{ value: teamScores.reduce((a, b) => a + b, 0), label: 'total correct' }, { value: Math.max(...teamScores), label: 'best round' }],
      });
    }

    pickDeck();
    return { destroy() { dead = true; cleanup(); } };
  }

  T.games.forehead = {
    id: 'forehead', name: 'Forehead', kicker: 'Party guessing', tagline: 'Phone on your head. Friends shout clues. Tilt to score.',
    blurb: 'The guess-what\'s-on-your-forehead party game. Hold the phone to your head, your friends give clues, accents or charades. Tilt down when you get it, tilt up to pass. 60 seconds, go!',
    players: [2, 12], minutes: [5, 15], difficulty: 1, bots: false, rotate: true, noise: 'high', colors: ['#ff7b00', '#c2185b', '#ffd23f'],
    vibes: { chill: 0.6, competitive: 0.7, chaotic: 1, strategic: 0.2 },
    vibeWhy: { chill: 'Zero rules to learn', competitive: 'Beat each other\'s 60-second score', chaotic: 'Loud, silly, everybody yelling', strategic: 'Not much strategy — pure fun' },
    setting: { home: 0.9, bar: 0.85, backyard: 1 }, settingWhy: { home: 'Instant living-room laughs', bar: 'Works even when it\'s noisy', backyard: 'Perfect for a big outdoor group' },
    options: [{ key: 'seconds', label: 'Round time', def: 60, choices: [[30, '30s'], [60, '60s'], [90, '90s']] }, { key: 'mode', label: 'Turns', def: 'all', choices: [['all', 'Everyone'], ['single', 'Just one']] }],
    box: () => `<svg viewBox="0 0 160 110" class="box-svg"><circle cx="80" cy="78" r="30" fill="#ffd9b8"/><circle cx="70" cy="80" r="3.5" fill="#222"/><circle cx="90" cy="80" r="3.5" fill="#222"/><path d="M70 94 q10 8 20 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>
      <g transform="rotate(-6 80 36)"><rect x="42" y="16" width="76" height="40" rx="8" fill="#151525"/><rect x="46" y="20" width="68" height="32" rx="5" fill="#fff"/><text x="80" y="42" text-anchor="middle" font-size="13" font-weight="900" font-family="Inter,Arial" fill="#ff4d6d">PENGUIN</text></g>
      <text x="22" y="40" font-size="20">❓</text><text x="124" y="72" font-size="18">💬</text></svg>`,
    rules: [
      { title: 'Phone on your forehead', text: 'One player holds the phone to their forehead, screen facing out. <b>Everyone else</b> can see the word — the player can\'t!', art: () => `<div class="fh-phone-demo big"><div class="head">🤔</div><div class="ph"><span>Flamingo</span></div></div>` },
      { title: 'Friends give clues', text: 'Describe it, act it out, hum it — just <b>don\'t say the word</b>. Some decks want accents or charades only.', art: () => `<div class="art-clues"><span>"Pink!"</span><span>"One leg!"</span><span>"Bird!"</span></div>` },
      { title: 'Tilt to score', text: '<b>Tilt down</b> when you guess it, <b>tilt up</b> to pass. No sensor? Tap the buttons. Most correct in 60 seconds wins.', art: () => `<div class="art-tilt"><span class="tiltb down">⤵<small>Got it</small></span><span class="tiltb up">⤴<small>Pass</small></span></div>` },
    ],
    more: '<p>All cards are original prompts. 7 decks, 40+ cards each. Every player gets a turn; highest score wins.</p>',
    mount, logic: L,
  };
  T.order.push('forehead');
})();

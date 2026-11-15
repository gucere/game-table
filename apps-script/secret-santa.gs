/**
 * Game Table: Secret Santa mailer (Google Apps Script web app).
 *
 * The site sends the list of names and emails here; this script does the draw and emails each
 * person the name they drew, so nobody (not even the organizer) sees the pairs.
 * Emails go out from the Google account that deploys the script, so use a separate Gmail
 * account made for this. Setup steps are in the README ("Secret Santa emails").
 *
 * Limits, because the site is public: 3–40 people per draw, plain-text names (no links),
 * at most MAX_EMAILS_PER_HOUR emails an hour in total, and Google's own daily quota.
 */

var MAX_PEOPLE = 40;
var MAX_EMAILS_PER_HOUR = 120;
var SITE_NAME = 'Game Table';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var people = clean(data.people);
    var lang = data.lang === 'tr' ? 'tr' : 'en';
    var extras = {
      budget: plain(data.budget, 30),
      date: plain(data.dateText || data.date, 40),
      note: plain(data.note, 300),
    };

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var cache = CacheService.getScriptCache();
      var hourKey = 'sent-' + Math.floor(Date.now() / 3600000);
      var sentThisHour = Number(cache.get(hourKey) || 0);
      if (sentThisHour + people.length > MAX_EMAILS_PER_HOUR) throw new Error('busy: too many emails this hour, try again later');
      if (MailApp.getRemainingDailyQuota() < people.length) throw new Error('busy: the daily email limit is reached, try again tomorrow');

      var receiver = drawWithExclusions(people.length, cleanExclusions(data.exclusions, people.length));
      if (!receiver) throw new Error('these exclusions leave no possible draw');
      for (var i = 0; i < people.length; i++) {
        var msg = message(lang, people[i].name, people[receiver[i]].name, extras);
        MailApp.sendEmail({ to: people[i].email, subject: msg.subject, body: msg.body, name: SITE_NAME + ' 🎅' });
      }
      cache.put(hourKey, String(sentThisHour + people.length), 3700);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true, sent: people.length });
  } catch (err) {
    return json({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'secret-santa' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Short plain text: no links or markup, so the mailer can't be used to spread spam */
function plain(s, max) {
  s = String(s == null ? '' : s)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  if (/(https?:|www\.|\.[a-z]{2,}\/)/i.test(s)) throw new Error('links are not allowed in names or messages');
  return s;
}

function clean(list) {
  if (!Array.isArray(list) || list.length < 3 || list.length > MAX_PEOPLE) throw new Error('need 3 to ' + MAX_PEOPLE + ' people');
  var seen = {};
  return list.map(function (p) {
    var name = plain(p && p.name, 40);
    var email = String((p && p.email) || '').trim().toLowerCase();
    if (!name) throw new Error('every person needs a name');
    if (!/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(email) || email.length > 100) throw new Error('bad email: ' + email);
    if (seen[email]) throw new Error('duplicate email: ' + email);
    seen[email] = true;
    return { name: name, email: email };
  });
}

/** Pairs of positions in the list who may not draw each other */
function cleanExclusions(list, n) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (p) {
    return Array.isArray(p) && p.length === 2 && p.every(function (x) { return x === Math.floor(x) && x >= 0 && x < n; }) && p[0] !== p[1];
  }).slice(0, 100);
}

/** Like drawCycle, but nobody draws someone they're paired with in the exclusions */
function drawWithExclusions(n, exclusions) {
  var banned = {};
  exclusions.forEach(function (p) { banned[p[0] + '>' + p[1]] = true; banned[p[1] + '>' + p[0]] = true; });
  var ok = function (g, r) { return g !== r && !banned[g + '>' + r]; };
  for (var k = 0; k < 2000; k++) {
    var r = drawCycle(n);
    if (r.every(function (x, g) { return ok(g, x); })) return r;
  }
  return null;
}

/** receiver[i] = who person i buys for; one big circle, so nobody draws themselves */
function drawCycle(n) {
  var order = [];
  for (var i = 0; i < n; i++) order.push(i);
  for (var k = n - 1; k > 0; k--) {
    var j = Math.floor(Math.random() * (k + 1));
    var t = order[k];
    order[k] = order[j];
    order[j] = t;
  }
  var receiver = [];
  for (var m = 0; m < n; m++) receiver[order[m]] = order[(m + 1) % n];
  return receiver;
}

function message(lang, giver, receiver, x) {
  var tr = lang === 'tr';
  var lines = [
    (tr ? 'Merhaba ' : 'Hi ') + giver + '!',
    '',
    tr ? 'Yılbaşı çekilişi yapıldı. Hediye alacağın kişi:' : 'The Secret Santa draw is done. You are buying a present for:',
    '',
    '    🎁 ' + receiver,
    '',
  ];
  if (x.budget) lines.push((tr ? 'Bütçe: ' : 'Budget: ') + x.budget);
  if (x.date) lines.push((tr ? 'Hediyeleşme günü: ' : 'Gift exchange: ') + x.date);
  if (x.note) lines.push('', x.note);
  lines.push('', tr ? 'Kimseye söyleme! 🤫' : 'Keep it a secret! 🤫', '', '— ' + SITE_NAME);
  return {
    subject: tr ? '🎁 Yılbaşı çekilişi sonucun' : '🎁 Your Secret Santa draw',
    body: lines.join('\n'),
  };
}

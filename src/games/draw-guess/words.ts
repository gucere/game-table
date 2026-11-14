/** Original word lists: simple, drawable nouns and actions. Underscores become spaces. */

export const WORDS_TR = `
elma armut muz çilek karpuz kiraz üzüm limon portakal havuç domates biber patlıcan mısır ekmek simit peynir yumurta pizza dondurma pasta çay kahve bardak çatal kaşık bıçak tabak tencere çaydanlık
kedi köpek kuş balık at inek koyun tavuk ördek fil zürafa aslan kaplan maymun yılan kaplumbağa tavşan fare arı kelebek örümcek penguen balina ahtapot deve kurbağa salyangoz baykuş köpekbalığı
ev okul cami köprü kule kale çadır deniz_feneri ağaç çiçek güneş ay yıldız bulut yağmur şimşek kar gökkuşağı dağ nehir ada plaj volkan orman çöl şelale
araba otobüs tren uçak gemi bisiklet motosiklet roket helikopter tekne traktör kamyon balon paraşüt denizaltı
masa sandalye yatak kapı pencere lamba saat ayna şemsiye anahtar kilit makas kalem defter kitap çanta gözlük şapka ayakkabı çorap eldiven gömlek elbise kravat atkı yüzük taç
telefon bilgisayar televizyon kamera kulaklık robot gitar davul piyano keman zil mikrofon
top futbol basketbol tenis satranç tavla zar uçurtma salıncak kaykay kayak buz_pateni
doktor aşçı itfaiyeci polis pilot astronot korsan büyücü palyaço prenses şövalye hayalet vampir
uyumak koşmak yüzmek dans_etmek gülmek ağlamak zıplamak okumak yazmak resim_yapmak balık_tutmak kar_topu
kalp göz el ayak burun kulak diş saç bıyık sakal
hediye mum kurdele bayrak harita pusula hazine çapa mektup zarf pul fener
`.trim().split(/\s+/).map((w) => w.replace(/_/g, ' '));

export const WORDS_EN = `
apple banana strawberry watermelon cherry grapes lemon orange carrot tomato pepper corn bread cheese egg pizza ice_cream cake tea coffee cup fork spoon knife plate pot kettle sandwich cookie
cat dog bird fish horse cow sheep chicken duck elephant giraffe lion tiger monkey snake turtle rabbit mouse bee butterfly spider penguin whale octopus camel frog snail owl shark
house school bridge tower castle tent lighthouse tree flower sun moon star cloud rain lightning snow rainbow mountain river island beach volcano forest desert waterfall
car bus train plane ship bicycle motorcycle rocket helicopter boat tractor truck balloon parachute submarine
table chair bed door window lamp clock mirror umbrella key lock scissors pencil notebook book bag glasses hat shoe sock glove shirt dress tie scarf ring crown
phone computer television camera headphones robot guitar drum piano violin bell microphone
ball football basketball tennis chess dice kite swing skateboard ski
doctor chef firefighter police pilot astronaut pirate wizard clown princess knight ghost vampire
sleeping running swimming dancing laughing crying jumping reading writing painting fishing snowman
heart eye hand foot nose ear tooth hair mustache beard
gift candle ribbon flag map compass treasure anchor letter envelope stamp lantern
`.trim().split(/\s+/).map((w) => w.replace(/_/g, ' '));

export function wordList(lang: string): string[] {
  return lang === 'en' ? WORDS_EN : WORDS_TR;
}

const FOLD: Record<string, string> = { ı: 'i', ğ: 'g', ü: 'u', ş: 's', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

/** Lowercase, strip spaces/punctuation, and fold Turkish letters so "kopek" matches "köpek" */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[ıığüşöçâîû]/g, (c) => FOLD[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

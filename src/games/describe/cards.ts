/** Our own cards: the word to describe, then the words you may not say. */
const TR = `
deniz: su, mavi, dalga, yüzmek, tuzlu
kahve: fincan, içmek, Türk, köpük, sabah
bayram: tatil, şeker, el öpmek, harçlık, kurban
düğün: gelin, damat, nikah, halay, takı
simit: susam, çay, halka, fırın, ekmek
vapur: deniz, iskele, martı, Boğaz, gemi
futbol: top, gol, kale, maç, takım
telefon: aramak, mesaj, ekran, akıllı, şarj
kitap: okumak, sayfa, yazar, roman, kütüphane
doktor: hasta, hastane, ilaç, muayene, hemşire
okul: öğretmen, öğrenci, ders, sınıf, teneffüs
bisiklet: pedal, tekerlek, sürmek, zil, iki
yağmur: şemsiye, ıslak, bulut, damla, gök gürültüsü
kar: beyaz, kış, soğuk, kardan adam, yağmak
çay: bardak, demlik, şeker, içmek, Rize
pizza: İtalyan, peynir, dilim, hamur, sipariş
balık: deniz, yüzmek, olta, pullu, ekmek
tatil: yaz, deniz, otel, izin, gezmek
ayna: yansıma, bakmak, cam, yüz, duvar
saat: zaman, akrep, yelkovan, kol, dakika
anahtar: kapı, kilit, açmak, cep, ev
uçak: havalimanı, pilot, uçmak, bilet, kanat
tren: ray, vagon, istasyon, lokomotif, yolcu
hamam: kese, köpük, sıcak, göbek taşı, yıkanmak
baklava: şerbet, fıstık, tatlı, yufka, tepsi
gözlük: göz, cam, görmek, numara, takmak
şemsiye: yağmur, açmak, ıslanmak, sap, güneş
düdük: öttürmek, hakem, ses, polis, ıslık
pasaport: yurt dışı, vize, kimlik, seyahat, damga
mektup: zarf, pul, yazmak, posta, göndermek
müze: tarih, eser, sergi, bilet, gezmek
kumsal: deniz, kum, havlu, şezlong, güneşlenmek
kamp: çadır, ateş, orman, doğa, uyku tulumu
sinema: film, perde, patlamış mısır, bilet, salon
gitar: tel, çalmak, akor, müzik, pena
piyano: tuş, çalmak, siyah, beyaz, konser
kedi: miyav, tüy, fare, evcil, pati
köpek: havlamak, sadık, tasma, kemik, yürüyüş
arı: bal, sokmak, kovan, vızıldamak, çiçek
fil: hortum, büyük, Afrika, fildişi, gri
penguen: kutup, buz, kuş, uçamaz, siyah beyaz
ağaç: yaprak, dal, gövde, orman, kök
güneş: sıcak, ışık, gökyüzü, doğmak, batmak
ay: gece, dolunay, hilal, gökyüzü, yıldız
doğum günü: pasta, mum, hediye, yaş, kutlamak
hediye: paket, vermek, sürpriz, doğum günü, kurdele
pazar: sebze, meyve, tezgah, alışveriş, satıcı
berber: saç, tıraş, makas, kesmek, ustura
fırın: ekmek, pişirmek, sıcak, hamur, mutfak
buzdolabı: soğuk, mutfak, yiyecek, kapak, buz
çamaşır makinesi: yıkamak, kıyafet, deterjan, dönmek, kirli
tavla: zar, pul, oynamak, kahvehane, mars
satranç: şah, vezir, piyon, tahta, mat
lunapark: dönme dolap, eğlence, oyuncak, bilet, çarpışan araba
itfaiye: yangın, söndürmek, hortum, kırmızı, merdiven
polis: suç, hırsız, karakol, düdük, üniforma
astronot: uzay, roket, Ay, kask, yerçekimi
korsan: gemi, hazine, kanca, papağan, deniz
dondurma: soğuk, külah, yaz, top, çikolata
karpuz: yeşil, kırmızı, çekirdek, yaz, meyve
kış: soğuk, kar, mevsim, aralık, mont
yorgan: yatak, uyumak, sıcak, örtmek, battaniye
sabah: kahvaltı, uyanmak, erken, güneş, gün
kahvaltı: sabah, peynir, zeytin, çay, yumurta
masal: çocuk, prenses, bir varmış bir yokmuş, anlatmak, uyumak
rüya: uyumak, gece, görmek, kâbus, uyanmak
diş fırçası: macun, ağız, temizlemek, banyo, fırçalamak
bulmaca: kelime, çözmek, gazete, kare, ipucu
sihirbaz: şapka, tavşan, numara, değnek, gösteri
`;

const EN = `
beach: sand, sea, sun, swim, towel
coffee: cup, drink, morning, bean, caffeine
birthday: cake, candle, present, party, age
wedding: bride, groom, marry, ring, dress
pizza: cheese, slice, Italy, dough, delivery
train: track, station, passenger, carriage, ticket
soccer: ball, goal, kick, team, match
phone: call, text, screen, smart, charge
book: read, page, author, novel, library
doctor: patient, hospital, medicine, nurse, sick
school: teacher, student, class, lesson, homework
bicycle: pedal, wheel, ride, bell, two
rain: umbrella, wet, cloud, drop, weather
snow: white, winter, cold, snowman, flake
tea: cup, kettle, drink, leaves, sugar
fish: swim, water, sea, fin, catch
holiday: vacation, trip, hotel, beach, travel
mirror: reflection, look, glass, face, wall
clock: time, hands, hour, minute, tick
key: lock, door, open, pocket, house
airplane: fly, pilot, airport, wings, ticket
umbrella: rain, open, wet, handle, sun
passport: travel, abroad, visa, border, photo
letter: envelope, stamp, write, mail, send
museum: art, history, exhibit, painting, visit
camping: tent, fire, forest, sleeping bag, outdoors
cinema: movie, popcorn, screen, ticket, film
guitar: strings, play, music, chord, rock
piano: keys, play, black, white, music
cat: meow, purr, mouse, pet, whiskers
dog: bark, pet, leash, bone, walk
bee: honey, sting, hive, buzz, flower
elephant: trunk, big, Africa, gray, ivory
penguin: ice, bird, fly, black, cold
tree: leaf, branch, trunk, forest, wood
sun: hot, light, sky, rise, set
moon: night, full, sky, stars, crescent
present: gift, wrap, birthday, surprise, give
market: buy, sell, stall, fruit, shop
barber: hair, cut, scissors, shave, beard
oven: bake, hot, kitchen, cook, bread
fridge: cold, kitchen, food, ice, door
chess: king, queen, board, checkmate, pawn
firefighter: fire, hose, truck, red, rescue
police: crime, thief, officer, badge, arrest
astronaut: space, rocket, moon, helmet, float
pirate: ship, treasure, parrot, sea, hook
ice cream: cold, cone, scoop, summer, chocolate
watermelon: green, red, seeds, summer, fruit
winter: cold, snow, season, December, coat
breakfast: morning, eggs, toast, cereal, meal
dream: sleep, night, nightmare, wake, bed
toothbrush: teeth, paste, brush, bathroom, clean
magician: trick, rabbit, hat, wand, show
volcano: lava, erupt, mountain, hot, ash
rainbow: colors, rain, sky, arc, sun
library: books, borrow, quiet, read, shelf
bakery: bread, cake, baker, oven, flour
zoo: animals, cage, lion, visit, keeper
hospital: doctor, nurse, sick, bed, emergency
island: sea, water, surrounded, beach, land
robot: machine, metal, computer, artificial, move
dinosaur: extinct, big, fossil, reptile, bones
castle: king, queen, tower, walls, knight
ghost: scary, haunted, dead, spirit, boo
snowman: snow, carrot, winter, build, cold
picnic: basket, blanket, park, food, outside
`;

function parse(text: string): [string, string[]][] {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const [word, rest] = line.split(':');
      return [word.trim(), rest.split(',').map((x) => x.trim())] as [string, string[]];
    });
}

export const CARDS: Record<'tr' | 'en', [string, string[]][]> = { tr: parse(TR), en: parse(EN) };

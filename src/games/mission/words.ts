/** Our own word lists for Gizli Görev: everyday nouns with more than one meaning or link. */
export const WORDS: Record<'tr' | 'en', string[]> = {
  tr: `
yüz kale at ay çay dil göz kır yaş saat diş baş el kol ağız gül ocak kuyu yol köprü
kart top ateş su buz kum taş dağ deniz nehir göl orman ada çöl bulut yıldız güneş kar rüzgar fırtına
kalem kitap defter masa sandalye kapı pencere anahtar kilit duvar çatı merdiven bahçe havuz çeşme
kuş kedi köpek balık aslan kaplan yılan arı kurt tilki tavşan at deve fil maymun kartal karga
elma armut kiraz limon muz üzüm karpuz domates soğan biber ekmek peynir bal şeker tuz yağ
gemi uçak tren araba bisiklet otobüs roket denizaltı balon paraşüt çapa yelken dümen pusula
saray kule cami kilise okul hastane banka müze sinema tiyatro stadyum pazar çarşı fırın eczane
doktor asker polis aşçı pilot korsan kral kraliçe prens şövalye büyücü hayalet robot casus ninja
altın gümüş elmas inci demir bakır cam kağıt ipek yün deri tahta
müzik davul gitar keman piyano zil düdük şarkı dans resim heykel film oyun zar satranç
ayna şemsiye gözlük şapka eldiven ayakkabı kemer düğme iğne makas çekiç çivi ip zincir
kalp beyin kemik kan nefes rüya gölge ses ışık zaman hafıza şans sır
yaz kış bahar sonbahar sabah gece hafta yıl bayram düğün tatil kamp
fare klavye ekran pil kablo uydu radyo televizyon telefon kamera
`.trim().split(/\s+/),
  en: `
face fall bat bank bark bow box bridge cap card cell chest club court crane cross date deck diamond
dragon draft fair fan file fire fish fly fork game glass glove ground hand head heart horn horse
ice iron jam key king kiwi knife knight lab lap lead light line lion lock log mail mark match
mine mint mole moon mouse nail net night note nut oil olive orange organ palm pan paper park
pass pen pilot pipe pirate pit plane plate play point pole pool port press queen racket ring robot
rock root rose round rule saw scale school screen seal shadow ship shoe shot sink slip snow soldier
space spell spider spike spring spy square stamp star stick storm straw string suit sun swing table
tail tap teacher temple tie time tooth torch tower track train trip trunk tube turkey wall watch
wave web whale wheel whip wind window witch wood yard anchor arrow balloon basket beach bear bed bell
bottle bread bubble button cake camera candle castle cat chair cloud coin compass crown desert dog
drum egg eye feather forest ghost giant gold guitar hat honey island jungle kite ladder lamp leaf
magnet map mask mirror mountain museum needle ocean owl parachute piano pillow pyramid rainbow river
rocket sail salt sand shark sheep shield snake sock spoon submarine sword telescope tent thread tiger
treasure umbrella violin volcano wallet wolf
`.trim().split(/\s+/),
};

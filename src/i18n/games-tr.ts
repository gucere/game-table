/** Turkish taglines and rules for every game. */
export const GAME_TEXT_TR: Record<string, { tagline: string; rules?: string }> = {
  garbage: {
    tagline: 'Kapalı kartlarını astan ona kadar sırayla aç.',
    rules: 'On kartı iki sıra halinde kapalı diz; kimse bakamaz. Desteden çek veya kullanabileceğin açık kartı al. As birinci, sayılar kendi yuvasına gider. Vale joker görevi görür; istersen Papazı joker seçebilirsin. Yerleştirdiğin kartın altındaki kapalı kartı açıp onunla devam et. Gerçek sayı kartıyla jokerin yerini değiştirip jokeri başka kapalı yuvada kullanabilirsin. Oynayamadığın kartı atınca sıran biter. Tüm yuvalarını ilk dolduran eli kazanır, sonraki ele bir kart eksik başlar ve ilk oynar. Son tek kartlık eli kazanan maçı kazanır. Hızlı oyun altı yuvaya düşünce, tek el seçeneği ise ilk el bitince sona erer.',
  },
  'dost-kazigi': {
    tagline: 'Kartları eşleştir, cezaları arkadaşlarına yükle.',
    rules: 'Tek desteyle oynanır; ortaya dört açık kart, herkese dört kart dağıtılır. Elinde eşleşme varsa kullanmalısın: bir kartını aynı değerdeki tek bir masa kartıyla veya ceza yığınının üstündeki aynı değerli grubun tamamıyla birleştir. Grubu kendin ve kaynak yığının sahibi dışında bir oyuncuya ver. Kendi cezanı da başkasına aktarabilirsin. Hiç eşleşmen yoksa bir kartı masaya bırak. Eller boşalınca dörder kart dağıtılır. Deste bitince ceza yığınları sayılır: 3 = 30, Vale = 20, As/Kız/Papaz = 10, diğerleri sayı değeri. Masada eşleşmeden kalanlar sayılmaz. Seçilen el sayısı sonunda toplam cezası en az olan kazanır; eşitlikte zafer paylaşılır. Sıra oturma sırasıyla ilerler.',
  },
  batak: {
    tagline: 'El için ihale yap, kozu seç, batma.',
    rules:
      '4 oyuncu, kişi başı 13 kart. Herkes kaç el alacağını söyler (en az 5); en yüksek ihaleyi yapan kozu seçer ve ilk oynar.\nElinde varsa aynı renkten oyna ve masadaki en büyük kartı geçebiliyorsan geç. O renk yoksa koz atmak (ve mümkünse yükseltmek) zorunludur. Biri koz atmadan koz açılamaz.\nPuanlama: ihaleyi alan, tutturursa aldığı el kadar yazar, tutturamazsa ihale kadar düşer. Diğerleri aldıkları el kadar yazar.',
  },
  'balayi-batagi': {
    tagline: 'Kart seçmeli iki kişilik Batak.',
    rules:
      '2 oyuncu. Dağıtım yerine sırayla destenin üstteki kartına bakılır: ya tutarsın (sonraki kart görülmeden atılır) ya da atarsın ve sonrakini kapalı alırsın. Herkesin 13 kartı olunca ihale yapılır (en az 7), koz seçilir ve 13 el oynanır.\nVarsa aynı renkten oyna, geçebiliyorsan geç; o renk yoksa koz at (mümkünse yükselt). Biri koz atmadan koz açılamaz.\nPuanlama Batak’taki gibidir.',
  },
  '3-5-8': {
    tagline: 'Üç kişi, sabit hedefler: 8, 5 ve 3 el.',
    rules:
      '3 oyuncu, kişi başı 16 kart, ortada 4 kart. Dağıtan 8 el, solundaki 5 el, diğeri 3 el almak zorundadır. Dağıtan kozu seçer, 4 kart atar ve ortadaki 4 kartı alır. Dağıtanın solundaki oyuncu ilk oynar.\nVarsa aynı renkten oyna; yoksa istediğini at. Her elde aldığın el sayısından hedefin çıkarılarak puan yazılır.',
  },
  'uclu-gommeli': {
    tagline: 'Kart gömmeli üç kişilik Batak.',
    rules:
      '3 oyuncu, kişi başı 16 kart, ortada kapalı 4 kart. El için ihale yapılır (en az 6). İhaleyi alan ortadaki 4 kartı alır, 4 kart gömer, kozu seçer ve ilk oynar.\nVarsa aynı renkten oyna, geçebiliyorsan geç; o renk yoksa koz at (mümkünse yükselt). Biri koz atmadan koz açılamaz.\nPuanlama Batak’taki gibidir.',
  },
  king: {
    tagline: 'Yirmi el ceza ve koz. Zehrini sen seç.',
    rules:
      'Her elden önce sırası gelen oyuncu oyunu seçer. Cezalar: El almaz (el başına −50), Kupa almaz (kupa başına −30), Erkek almaz (her K ya da J için −60), Kız almaz (her kız için −100), Rıfkı (kupa papazı için −320), Son iki (son iki elin her biri için −180). Koz: seçen kozu belirler ve her el +50’dir. Tam oyunda herkes 3 ceza ve 2 koz seçer, her ceza toplam iki kez oynanır. Daima renge uy. Kozda geçebiliyorsan geçmek, renk yoksa koz atmak zorunludur. Ceza oyunlarında renk yoksa elindeki ceza kartını atmak zorundasın; artık eli alamayacak bir ceza kartı (A♥ altındaki K♥ gibi) atılmalıdır. Biri kupa (kozda koz) atmadan kupa açılamaz, elinde sadece o yoksa. Bütün ceza kartları çıkınca ceza eli erken biter. En yüksek toplam kazanır.',
  },
  pisti: {
    tagline: 'Üstteki kartı yakala, yığını topla, “Pişti!” de.',
    rules:
      'Masaya dört kart açılır (yalnızca en üstteki yüzü açık) ve herkese dörder kart dağıtılır. Sırayla yığına bir kart atılır. Attığın kart üstteki kartla aynı değerdeyse ya da vale (J) ise bütün yığını alırsın. Tek kartı eşleştirerek almak pişti’dir: 10 puan, vale üstüne vale 20 puan. Eller bitince deste bitene kadar dörder kart daha dağıtılır; masada kalan kartlar son alana gider. Her dağıtımda: her as ve vale 1, sinek ikilisi 2, karo onlusu 3, en çok kart 3 puan, artı pişti puanları.',
  },
  'papaz-kacti': {
    tagline: 'Çiftleri at, papazdan kaç. Papaz sende kalmasın!',
    rules:
      'Destedeki dört papazdan üçü çıkarılır, böylece kalan papazın eşi olmaz. Bütün kartlar dağıtılır ve herkes çiftlerini (aynı değerde iki kart) atar. Sonra sırayla kartı olan bir sonraki oyuncudan kapalı bir kart çekilir; elindeki bir kartla çift olursa çift atılır. Kartı biten kurtulur. Papaz elinde kalan son oyuncu kaybeder. İpucu: bir karta uzandığında sahibi hangisi olduğunu görür, yüzünü (ya da sohbeti) izle!',
  },
  '51': {
    tagline: 'Kâğıtla okey: 51 ile aç, hepsini yere indir.',
    rules:
      'İki deste ve iki joker. Herkese 14 kart (başlayana 15). Jokerler her kartın yerine geçer. Per: farklı renklerde aynı değerde 3–4 kart; seri: aynı renkten sıralı 3 ya da daha fazla kart, as başta (A-2-3) ya da sonda (Q-K-A) olabilir ama arada dönemez.\nBir elde en az 51 puanlık per/seri indirerek (as 11, serinin başındaysa 1; J/Q/K 10) ya da en az 5 çiftle açılır. Açtıktan sonra yere daha fazla indirebilir ve masadaki perlere işleyebilirsin. Yerden önceki atılanı yalnızca o el indireceksen alabilirsin.\nHer el bir kart atarak biter; son kartını atarak bitirirsin (−51). Diğerleri elinde kalan kartları yazar (joker 25); açmayanlar 102 yazar. Jokerle ya da çiftle bitirmek hepsini ikiye katlar. Joker atmak ya da masadaki bir pere işleyen kartı atmak +51 cezadır. En düşük toplam kazanır.',
  },
  konken: {
    tagline: 'Kâğıtla okey: iki deste, joker serbest, elde kalan yazar.',
    rules:
      'Okey gibi oynanır ama iki deste iskambil ve iki jokerle (jokerler her kartın yerine geçer). Herkese 14 kart (başlayana 15). Ortadan çek ya da solundakinin attığı kartı al, sonra bir kart at. Diğer 14 kartın tamamı per (aynı değer, farklı renk) ve seri (aynı renk, sıralı; as başta ya da sonda) ya da yedi çift olunca 15. kartı atarak bitir. Diğer herkes perlere yerleştiremediği kartları yazar: as 11, J/Q/K 10, joker 25, diğerleri kendi değeri; çiftle ya da joker atarak bitirirsen iki katı. Son elden sonra en düşük toplam kazanır. Kurallar gruptan gruba değişir; bu bizim çeşidimiz.',
  },
  holdem: {
    tagline: 'Herkese iki kart, masada beş kart; yalnızca oyun fişi.',
    rules:
      "Oyun fişleriyle limitsiz Texas Hold'em. Herkese iki kapalı kart verilir; ortak beş kart aşama aşama açılır (flop: 3, turn: 1, river: 1) ve her aşamadan önce ve sondan sonra bir bahis turu olur. Sıran gelince: çekil (fold), bahis yoksa pas (check), gör (call) ya da artır (raise). Dağıtanın solundaki iki oyuncu küçük ve büyük kör bahsi koyar. İki kartın ve masadaki beş karttan oluşan en iyi beşli el potu kazanır; all-in’ler yan pot oluşturur. Eller, en iyiden en kötüye: floş royal/sıralı floş, kare, ful, floş, kent, üçlü, iki çift, çift, yüksek kart. Fişler sadece eğlence için.",
  },
  poker: {
    tagline: 'Klasik poker: beş kart, bir değişim, blöfle kazan.',
    rules:
      "Oyun fişleriyle limitsiz Beş Kart Değişmeli poker. Herkese beş kapalı kart verilir ve bir bahis turu yapılır. Sonra sırayla herkes en fazla dört kartını yenileriyle değiştirebilir. İkinci bahis turundan sonra kartlar açılır: en iyi beşli el kazanır. Kör bahisler Hold'em’deki gibidir. Eller, en iyiden en kötüye: sıralı floş, kare, ful, floş, kent, üçlü, iki çift, çift, yüksek kart. Fişler sadece eğlence için.",
  },
  hearts: {
    tagline: 'Kupalardan ve maça kızından kaç ya da hepsini topla.',
    rules:
      'Kupa (her biri 1 puan) ya da maça kızı (13 puan) içeren elleri almaktan kaçın. Her elden önce üç kart verilir: önce sola, sonra sağa, sonra karşıya, sonra hiç. İlk eli sinek ikilisi açar ve mümkünse ilk elde puanlı kart atılmaz. Elindeyse renge uy; biri kupa atmadan kupa açılamaz. 13 kupanın ve maça kızının hepsini alırsan (“ayı vurmak”) diğer herkes 26 puan yazar. Biri sınıra ulaşınca en düşük puan kazanır.',
  },
  spades: {
    tagline: 'Eşler birlikte ihale yapar; maça hep kozdur.',
    rules:
      'Dört oyuncu, iki takım; eşler karşılıklı oturur. Maça her zaman kozdur ve biri maça atmadan maça açılamaz. Herkes kaç el alacağını söyler; eşlerin ihaleleri toplanır. Takım ihalesini tutturursa ihale edilen her el için 10, fazla her el (“torba”) için 1 puan alır; tutturamazsa ihale edilen her el için 10 kaybeder. Nil (sıfır) diyen hiç el almazsa +100, alırsa −100. Her 10 torba 100 puan götürür. Hedefe ilk ulaşan takım kazanır.',
  },
  okey: {
    tagline: 'Kahvehanelerin taş klasiği.',
    rules:
      'Dört renkte 1–13 arası taşlar (her birinden iki tane) ve iki sahte okey. Göstergenin bir fazlası (aynı renk, +1) okeydir: her taşın yerine geçer. Sahte okeyler o taşın yerine sayılır.\nOrtadan taş çek ya da solundakinin attığı taşı al, sonra bir taş at. 14 taşın per (aynı sayı, farklı renk) ve seri (aynı renk, sıralı; 12-13-1 olur) ya da yedi çift oluşturunca 15. taşı atarak bitir.\nHerkes seçilen puanla başlar. Biri bitirince diğerleri 2 puan kaybeder (çiftle bitirince iki katı, okey atarak bitirince yine iki katı). Biri 0’a inince oyun biter.\nÇanak açıksa: herkes her elde çanağa 1 puan koyar; okey atarak ya da yedi çiftle bitiren çanaktaki bütün puanları da alır. Aksi halde çanak büyümeye devam eder.',
  },
  'okey-101': {
    tagline: '101 ile aç, hepsini yere indir.',
    rules:
      'Herkese 21 taş (başlayana 22). Okey her taşın yerine geçer; sahte okeyler okey taşı sayılır. Seriler dönemez (13-1 olmaz).\nBir elde en az 101 puanlık per ve seri indirerek (bir perin değeri sayılarının toplamıdır) ya da en az 5 çiftle açılır. Açtıktan sonra daha fazla indirebilir ve masadaki perlere işleyebilirsin. Yerden önceki atılanı yalnızca o el indireceksen alabilirsin.\nHer el bir taş atarak biter; son taşını atarak bitirirsin. Diğerleri elinde kalan taşları yazar (okey = 101); açmayanlar 202 yazar. Okeyle ya da çiftle bitirmek hepsini ikiye katlar. Okey atmak ya da masadaki bir pere işleyen taşı atmak +101 cezadır. En düşük toplam kazanır.',
  },
  backgammon: {
    tagline: '15 pulunu evine taşı ve topla.',
    rules:
      'Pullar atılan zarlar kadar ilerletilir; çift gelirse dört kez oynanır. Tek kalan pul (açık pul) kırılıp bara gönderilebilir ve başka hiçbir şey oynamadan önce yeniden girmelidir. 15 pulun hepsi evine girince toplamaya başlayabilirsin. Rakip hiç pul toplamadan kazanmak marstır: 2 puan.',
  },
  mahbusa: {
    tagline: 'Kırmasız tavla: tek kalan pulu altına hapset.',
    rules:
      'Bir tavla çeşidi. İki oyuncu da 15 pulunun hepsini ilk hanesinde dizerek başlar ve onları her zamanki gibi evine taşır; çift zar dört kez oynanır. Kırma yoktur: tek duran rakip pulunun üstüne gelirsen onu altına hapsedersin (⛓). Hapsedilen pul, üstündeki pulların hepsi o haneden ayrılana kadar oynayamaz ve o haneye başkası gelemez. Bütün pulların eve girince topla. Rakip hiç pul toplamadan kazanmak marstır: 2 puan.',
  },
  'gul-bara': {
    tagline: 'İki oyuncunun da aynı yöne yarıştığı tavla.',
    rules:
      'Bir tavla çeşidi. İki oyuncu da 15 pulunun hepsini kendi ilk hanesinde, karşılıklı köşelerde dizerek başlar ve ikisi de tahtada aynı yönde, son çeyrekteki evlerine yarışır. Kırma yoktur ve bir haneyi tutmak için tek pul yeter: oraya başkası gelemez. Dördüncü sırandan itibaren çift atarsan, ardından gelen bütün büyük çiftleri de oynarsın (4-4 atarsan: 4-4, sonra 5-5, sonra 6-6), oynayabildiğin kadar. 15 pulun hepsi eve girince topla. Rakip hiç pul toplamadan kazanmak marstır: 2 puan.',
  },
  'kizma-birader': {
    tagline: 'Dört piyonunu eve yarıştır. Kızma birader!',
    rules:
      'Başlangıç karene piyon çıkarmak için 6 atmalısın (dışarıda piyonun yokken üç hakkın vardır). Piyonları zar kadar saat yönünde ilerlet; 6 atınca tekrar atarsın. Başka bir oyuncunun piyonunun üstüne gelirsen onu başa gönderirsin. Kendi piyonunun üstüne gelemezsin. Tam tur atan piyon dört ev karene girer; tam zar gerekir ve evdeki kendi piyonlarının üstünden atlanmaz. Dört piyonunu eve ilk sokan kazanır.',
  },
  satranc: {
    tagline: 'Birkaç hamle ileriyi düşünen bir botla satranç.',
    rules:
      'Standart satranç. Bir taşa dokununca gidebileceği yerler görünür, sonra kareye dokun. Rok, geçerken alma ve terfi (taşı sen seçersin) desteklenir. Oyun şah mat ile ya da pat, üç kez tekrar, piyon oynanmadan ve taş alınmadan 50 hamle veya iki tarafın da mat edemeyecek olmasıyla berabere biter.',
  },
  dama: {
    tagline: 'Türk daması: düz hamleler, büyük almalar.',
    rules:
      'Her tarafın ikinci ve üçüncü sıralarda 16 taşı vardır. Taşlar bir kare ileri ya da yana gider (asla çapraz ya da geri değil) ve rakip taşın üstünden ileri ya da yana boş kareye atlayarak alır. Alınan taşlar hemen kalkar ve atlamaya devam edebilirsin. Almak zorunludur ve en çok taş alan yolu seçmelisin. Son sıraya ulaşan taş dama (♛) olur: düz çizgide istediği kadar gider ve uzaktan alır, ama alma sırasında geri dönemez. Rakibin bütün taşlarını al ya da hamlesiz bırak, kazan.',
  },
  mangala: {
    tagline: 'Türk mangalası: taşları ek, yakala, hazineni doldur.',
    rules:
      'Her tarafta dörder taşlı altı kuyu ve sağında bir hazine vardır. Sıran gelince kuyularından birindeki bütün taşları al, ilkini aynı kuyuya bırak, sonra saat yönünün tersine her kuyuya birer taş bırak; kendi hazinene bırakılır, rakibinkine bırakılmaz (tek taş bir sonraki kuyuya gider). Son taş hazinene düşerse tekrar oyna. Son taş karşı taraftaki bir kuyuyu çift yaparsa o taşları al. Son taş kendi boş kuyuna düşerse onu ve karşısındaki kuyudaki taşları al. Bir oyuncunun kuyuları boşalınca karşı taraftaki bütün taşları da o alır. En çok taşı olan kazanır.',
  },
  reversi: {
    tagline: 'Kuşat ve çevir. Köşeler kraldır.',
    rules:
      'Önce koyu oynar. Rakibin taşlarından oluşan bir ya da daha fazla düz çizgiyi (yatay, dikey ya da çapraz) kendi taşınla kapatacak şekilde taş koy; hepsi senin rengine döner. Böyle hamlen yoksa pas geçersin. İki oyuncu da oynayamayınca taşı çok olan kazanır. İpucu: köşedeki taşlar hiç çevrilemez.',
  },
  gomoku: {
    tagline: 'Büyük tahtada beşli dizi.',
    rules: 'Önce koyu oynar. Sırayla boş bir noktaya taş koyun. Beş (ya da daha fazla) taşını yatay, dikey ya da çapraz kesintisiz dizen ilk oyuncu kazanır. Açık üçlere ve dörtlere dikkat!',
  },
  'dokuz-tas': {
    tagline: 'Diz, kaydır, üçle, taş al.',
    rules:
      'Her oyuncunun dokuz taşı vardır. Önce sırayla taşlar boş noktalara konur. Sonra sırayla bir taş çizgi boyunca komşu boş noktaya kaydırılır. Bir çizgi üzerinde üç taşını yan yana getirdiğinde (üçleme) rakibin bir taşını alırsın, ama başka seçenek yoksa dışında üçlemedeki bir taşı alamazsın. Üç taşın kalınca istediğin boş noktaya atlayabilirsin. İki taşın kalınca ya da hamlen yoksa kaybedersin.',
  },
  'yilan-merdiven': {
    tagline: 'Merdivenlerden çık, yılanlardan kaç, ilk 100’e ulaş.',
    rules: 'Sırayla zar atıp piyonunu ilerlet. Merdivenin dibine gelirsen tırman; yılanın başına gelirsen kuyruğuna kay. 6 atan tekrar atar. 100’e tam gelmelisin: fazla atarsan fazlası kadar geri dönersin.',
  },
  noktalar: {
    tagline: 'Çizgi çek, kutu kapat, zinciri sürdür.',
    rules: 'Sırayla iki komşu nokta arasına çizgi çekin. Çizgin bir kutunun dördüncü kenarını kapatırsa kutu senindir ve tekrar oynarsın. Bütün kutular alınınca en çok kutusu olan kazanır. İpucu: bir kutunun üçüncü kenarını çizmekten kaçın.',
  },
  fetih: {
    tagline: 'Her oyunda yeni bir altıgen haritayı fethet. Köyler kazandırır, kaleler dayanır.',
    rules:
      'Her oyunda yeni bir harita çıkar. Bölgeler birkaç orduyla dağıtılır. Sıran gelince: 1) Takviye: bölge sayının yarısı kadar (en az 3) ve elindeki her köy 🏠 için 1 ordu alırsın. 2) İstediğin kadar saldır: 2+ ordulu bir bölgenden komşu düşman bölgesine. İki taraf da ordusuna bir zar ekler (saldıran biri hariç hepsini sayar; kale 🏰 savunana +2 verir). Yüksek olan kazanır, beraberlikte savunan kazanır. Kazanırsan bölgeye girersin; kaybedersen saldıran ordunun yarısını kaybedersin. 3) Bağlı bölgelerin arasında bir ordu kaydırması yap; bu sıranı bitirir. Bütün haritayı al ya da turlar bitince en çok bölgeyi elinde tut.',
  },
  'amiral-batti': {
    tagline: 'Deniz savaşı: filonu sakla, onlarınkini batır.',
    rules:
      'Her oyuncu 10×10’luk ızgaraya gizlice 5 gemi yerleştirir (5, 4, 3, 3 ve 2 kare). Gemiler düz çizgide durur ve üst üste binemez. Sonra sırayla düşman ızgarasında bir kareye ateş edilir: isabet mi ıska mı olduğunu ve bir gemi batınca bunu öğrenirsin. Bütün düşman filosunu batıran kazanır.',
  },
  durak: {
    tagline: 'Rus klasiği: kartları elinde kalan son kişi olma.',
    rules:
      '36 kart (6’dan asa), herkese 6 kart. Bütün kartlar dağıtılsa bile destenin en altındaki kart kozu belirler. Saldıran bir kart atar; savunan onu aynı renkten daha büyük bir kartla veya kozla keser, yapamazsa masadakilerin hepsini alır. Varsayılan Arkadaş kurallarında yalnızca ana saldırgan ve savunandan sonra gelen, hâlâ oyunda olan yan saldırgan kart ekleyebilir. Aktarmalı ve Kart eklemeli türlerde savunan dışındaki herkes ekleyebilir; “Kimler saldırabilir” ayarı bunu değiştirebilir. Eklenen kartın değeri masadaki bir kartla aynı olmalıdır; saldırı en fazla 6 karttır ve savunanın elindeki kart sayısını aşamaz. Arkadaş kurallarında ve Aktarmalı türde savunan, hiçbir kartı kesmeden önce aynı değerde herhangi bir renkten kart ekleyerek bütün saldırıyı sıradaki oyuncuya aktarabilir; o oyuncunun yeterli kartı olmalıdır. Aktaran oyuncu ana saldırgan olur, yan saldırgan yeni savunana göre değişir. Kart eklemeli türde aktarma yoktur. Bütün kartları kesen oyuncu sonraki saldırıyı yapar; kartları alan oyuncu ise saldırı sırasını kaçırır. Herkes desteden elini 6 karta tamamlar. Deste bitince elini boşaltan kurtulur. Elinde kart kalan son oyuncu duraktır.',
  },
  bluff: {
    tagline: 'Yüzünü bozmadan yalan söyle. Yalancıları yakala.',
    rules:
      'Bütün kartlar dağıtılır. Başlayan bir değer söyler ve o değerdeymiş gibi 1–4 kartı kapalı atar (doğru ya da yanlış). Sırayla her oyuncu aynı değeri söyleyerek kart atar, pas geçer ya da bir önceki oyun için “Blöf!” der. Yalansa yalancı bütün yığını alır; doğruysa blöf diyen alır. Herkes pas geçerse yığın kaldırılır ve son atan başlar. Bütün kartlarından ilk kurtulan kazanır.',
  },
  'vampir-koylu': {
    tagline: 'Gizli roller, gece ısırıkları, gündüz oylamaları. Vampir kim?',
    rules:
      'Herkese gizlice bir rol verilir; oda sahibi her rolden kaç tane olacağını seçer (ya da oyuncu sayısına göre öneriyi kullanır). Gece vampirler bir kurban seçer, özel roller güçlerini kullanır, diğer herkes gözünü kapatır. Gündüz gecenin haberi açıklanır, herkes konuşur (çevrim içinde 💬 sohbet ya da görüşme) ve oy verir. En çok oyu alan köyden atılır; eşitlikte kimse gitmez. Bütün vampirler (ve varsa Katil) gidince köy kazanır; vampir tarafı geri kalanlar kadar olunca vampirler kazanır. Soytarı gündüz oylanıp atılırsa tek başına kazanır ve oyun biter; Katil son iki kişiden biri olursa kazanır. Her rolün gücü kurulum ekranındaki kartında yazar.',
  },
  tombala: {
    tagline: 'Yılbaşı tombalası: çinko, çinko, TOMBALA!',
    rules:
      'Herkese üç sıralı, 15 sayılı bir kart verilir. 1’den 90’a kadar sayılar tek tek çekilir. Bir sırayı ilk dolduran 1. Çinko, iki sırayı dolduran 2. Çinko, 15 sayının hepsini dolduran TOMBALA der ve oyunu kazanır. Düğme yalnızca kartın gerçekten tamamlanınca yanar ama hızlı ol: ilk basan ödülü alır!',
  },
  'isim-sehir-hayvan': {
    tagline: 'Bir harf, beş kategori, zamana karşı yarış.',
    rules:
      'Bir harf çekilir. Süre bitmeden her kategori için o harfle başlayan bir kelime yaz. Hepsini doldurunca DUR diyebilirsin: diğerlerinin 5 saniyesi kalır. Sonra herkes bütün cevapları görür ve kötü olanları geçersiz sayabilir (diğer oyuncuların yarısından fazlası katılmalı). Kategori başına puan: tek cevap 10, başkası da aynısını yazdıysa 5, geçerli cevabı olan tek kişiysen 20.',
  },
  'draw-guess': {
    tagline: 'Biri çizer, herkes tahmin eder. Çevrim içi parti oyunu.',
    rules:
      'Her turda bir oyuncu bir kelime seçer ve çizer. Diğerleri tahminlerini yazar; Türkçe karakter kullanmadan yazmak da olur (kopek = köpek). Ne kadar hızlı bilirsen o kadar çok puan alırsın; çizen de bilen her oyuncu için puan kazanır. Çizimde harf ya da rakam yok!',
  },
  'adam-asmaca': {
    tagline: 'Çizim bitmeden kelimeyi harf harf bul.',
    rules:
      'Harf tahmin et (dokun ya da klavyeden yaz). Doğru her harf geçtiği her yer için 10 puandır ve tekrar oynarsın; yanlış harf çizime eklenir ve sıra geçer. Son harfi açmak +20’dir. Bildiğini mi düşünüyorsun? Çöz: gizli her harf için 5 ve artı 20 puan, ama yanlış cevap bir hak götürür. 8 hatada adam asılır; kelimeyi bir oyuncu seçtiyse o 50 puan alır.',
  },
  generala: {
    tagline: 'Beş zar, üç atış, doldurulacak on bir kutu.',
    rules:
      'Sıran gelince beş zarı en fazla üç kez at; atışlar arasında tutmak istediğin zarlara dokun. Sonra zarları boş bir kutuya yaz (kutuya 0 da yazılabilir). Birler–Altılar: o yüzlerin toplamı. Kent (1-2-3-4-5, 2-3-4-5-6 ya da 3-4-5-6-1): 20. Ful (üçlü + ikili): 30. Kare: 40. İlk atışta gelirse (“servida”) bunlar 5 puan fazladır. Generala (beşi aynı): 50, ilk atışta gelen Generala oyunu hemen kazandırır. Çift Generala: 100, yalnızca Generala’dan sonra. En yüksek toplam kazanır.',
  },
  'sayi-bulmaca': {
    tagline: '4 haneli şifreyi + ve − ipuçlarıyla kır.',
    rules:
      'Gizli sayı, rakamları birbirinden farklı 4 haneli bir sayıdır (0 ile başlamaz). Her tahminden sonra ipucu alırsın: +n, n rakamın doğru ve doğru yerde olduğunu; −n, n rakamın daha sayıda olup yanlış yerde olduğunu gösterir. Tek başına, bilgisayarın sayısını olabildiğince az tahminle bul. İki oyuncuyla, herkes bir sayı seçer ve sırayla diğerininkini tahmin edersiniz: ilk bulan kazanır.',
  },
  xox: { tagline: 'Üçü yan yana getiren kazanır.' },
  'four-in-a-row': { tagline: 'Taşları bırak, dördünü diz.' },
  rps: { tagline: 'Gizlice seç. Üçe ilk ulaşan kazanır.' },
  'coin-flip': { tagline: 'Meseleyi çöz. Ya da bir arkadaşınla 3 doğru tahmine yarış.' },
  marti: {
    tagline: 'Boğaz üzerinde tek dokunuşla martı uçuşu.',
    rules:
      'Bir uçucu seç (martı, güvercin, leylek, papağan, karga, kanarya ya da bizzat Hazerfen Ahmet Çelebi), sonra kanat çırpmak için dokun, tıkla ya da Boşluk’a bas. Asılı fenerlerle deniz fenerleri arasından uç; geçtiğin her biri bir puandır. Arkadaşlarla herkes aynı parkurda uçar ve en yüksek puan kazanır: çevrim içinde aynı anda, tek cihazda sırayla.',
  },
  'tas-yagmuru': {
    tagline: 'Düşen okey taşları: kuyu dolmadan per ve seri diz.',
    rules:
      'Okey taşları ikişer ikişer kuyuya düşer. Onları kaydır ve döndür; bir satırda ya da sütunda üç ya da daha fazla taş bir okey peri oluştursun: per (aynı sayı, farklı renkler) ya da seri (tek renk, artan ya da azalan sıralı sayılar). Yeşil ✿ taşı jokerdir ve her yere uyar. Perler kaybolur, üstteki taşlar düşer ve oluşan yeni perler zincir bonusu kazandırır. Gittikçe hızlanır; kuyu dolunca oyun biter.',
  },
  yilan: {
    tagline: 'Ye, büyü ve asla kendi kuyruğunu ısırma.',
    rules: 'Ok tuşları, WASD, kaydırma ya da düğmelerle yönlendir. Elmalar 1 puandır ve seni uzatır; arada sırada 5 puanlık altın simitler çıkar ama çabuk kaybolur. Kendi gövdene (duvarlar açıksa duvara) çarpınca oyun biter. Büyüdükçe hızlanırsın.',
  },
  birlestir: {
    tagline: 'Kaydır, birleştir, ikiye katla. Ne kadar büyüyebilirsin?',
    rules: 'Bütün taşları gidebildikleri kadar kaydırmak için kaydır (ya da ok tuşlarını kullan). Çarpışan iki eşit taş toplamlarıyla tek taşa dönüşür ve puanına eklenir. Her hamleden sonra yeni bir taş çıkar. Hiçbir şey kıpırdayamayınca oyun biter.',
  },
  solitaire: {
    tagline: 'Klasik Klondike sabır oyunu.',
    rules: 'Her renk için birer tane olmak üzere dört temeli Astan Papaza kadar kur. Sütunlarda kartları renkleri değişerek azalan sırayla diz. Boş sütuna yalnızca Papaz konabilir. Bir karta dokununca en iyi yere gider ya da ona dokunup sonra gideceği yere dokun.',
  },
  sudoku: {
    tagline: 'Izgarayı doldur: her satır, sütun ve kutuda 1–9.',
    rules: 'Her satır, sütun ve 3×3’lük kutuda 1’den 9’a kadar sayılar birer kez bulunmalı. Bir kare, sonra bir sayı seç. Not modu küçük kurşun kalem işaretleri ekler. Klavye: 1–9, oklar, Backspace, notlar için N.',
  },
  'mayin-tarlasi': {
    tagline: 'Mayına basmadan tarlayı temizle.',
    rules: 'Sayılar o kareye kaç mayının değdiğini gösterir. Kazanmak için her mayını bayrakla ve her güvenli kareyi aç. İlk tıklaman her zaman güvenlidir.',
  },
  'kelime-avi': {
    tagline: 'Harf ızgarasındaki bütün gizli kelimeleri bul.',
    rules: 'Kelimeler düz çizgiler halinde saklanır. Bir kelimeyi işaretlemek için ilk harften son harfe sürükle (ya da iki ucuna dokun). Hepsini olabildiğince hızlı bul.',
  },
  nonogram: {
    tagline: 'Sayı ipuçları gizli bir resmi ortaya çıkarır.',
    rules:
      'Her satırın yanındaki ve her sütunun üstündeki sayılar, oradaki dolu kare dizilerinin uzunluklarıdır; sırayla ve aralarında en az bir boşluk vardır. Izgarayı bütün ipuçlarına uyacak şekilde doldur. Her bulmaca tahmin gerekmeden yalnızca mantıkla çözülebilir. Satırı tutan ipuçları grileşir.',
  },
  kakuro: {
    tagline: 'Toplamlardan oluşan bir bulmaca.',
    rules: 'Beyaz kareleri 1’den 9’a kadar rakamlarla doldur. Beyaz karelerden oluşan her dizi başındaki ipucuna (yatayda solundaki, dikeyde üstündeki sayıya) eşit olmalı ve bir dizide rakam tekrar etmemeli. Bir kareye dokununca toplamlarını hangi rakam kombinasyonlarının verebileceğini görürsün.',
  },
  'tas-esle': {
    tagline: 'Katmanlı yığından okey taşı çiftlerini eşleştir.',
    rules: 'Aynı iki taşı (aynı sayı ve renk) çiftler halinde kaldırarak tahtayı temizle. Yalnızca serbest taşı alabilirsin: üstünde başka taş olmamalı ve sağı ya da solu açık olmalı. Takıldın mı? İpucu kullan, geri al ya da kalan taşları karıştır. Her dağıtım temizlenebilir.',
  },
  'esli-batak': {
    tagline: 'Eşli batak: ihaleyi birlikte al, birlikte bat.',
    rules:
      '4 oyuncu, iki takım; eşler karşılıklı oturur. Kişi başı 13 kart. Takımının kaç el alacağını söyle (en az 7); en yüksek ihaleyi yapan kozu seçer ve ilk oynar.\nElinde varsa aynı renkten oyna ve masadaki en büyük kartı geçebiliyorsan geç. O renk yoksa koz atmak (ve mümkünse yükseltmek) zorunludur. Biri koz atmadan koz açılamaz.\nPuanlama: ihaleyi alan ve eşi birlikte ihaleyi tuttururlarsa ikisi de aldığı el kadar yazar; tutturamazlarsa ihaleyi alan ihale kadar düşer, eşi hiç yazmaz. Diğer takım aldığı el kadar yazar. Takım toplamı en yüksek olan kazanır.',
  },
  'esli-101': {
    tagline: 'Eşli 101 Okey: birlikte aç, birlikte bitir.',
    rules:
      'İki takım; eşler karşılıklı oturur. Her şey 101 gibidir: 101 puanla ya da 5 çiftle aç, sonra per indir ve perlere işle (kendi perlerine, eşininkine ya da herhangi birine). Biri bitirince eşinin elindeki taşlar sayılmaz; diğerleri ellerini her zamanki gibi yazar. Eşlerin toplamları birleştirilir ve toplamı en düşük olan takım kazanır.',
  },
  'iki-dogru-bir-yalan': {
    tagline: 'İki doğru, bir yalan. Arkadaşların hangisi olduğunu bulabilir mi?',
    rules:
      'Oyuncular sırayla anlatıcı olur. Anlatıcı kendisiyle ilgili üç cümle yazar (ikisi doğru, biri yalan) ve yalanı gizlice işaretler. Diğer herkes yalan olduğunu düşündüğü cümleye oy verir. Sonra açıklanır: yalanı bulan her oyuncu 1 puan alır, anlatıcı da kandırdığı her oyuncu için 1 puan alır. Oyun sonunda en çok puanı olan kazanır. En güzeli, arkadaşlarla görüntülü konuşurken ya da aynı masada oynamak.',
  },
  'kim-daha-cok': {
    tagline: 'Hangimiz en çok…? Oy ver, açıkla, gül.',
    rules:
      'Her turda "Hangimiz en çok kendi düğününe geç kalır?" gibi bir soru çıkar. Herkes gizlice en çok kime uyduğunu düşündüğü oyuncuya oy verir (kendine de verebilirsin). Oylar birlikte açılır: en çok oy alan taç 👑 kazanır, ona oy veren herkes ortamı iyi okuduğu için 1 puan alır. Sonunda en çok puanı olan kazanır; taçlar sadece övünmek için.',
  },
  'hava-hokeyi': {
    tagline: 'Tek ekranda iki kişilik hava hokeyi ya da bota karşı.',
    rules:
      'İki oyuncu aynı ekranı paylaşır: alt yarı bir oyuncunun, üst yarı diğerinindir. Tokmağını sürükleyerek pulu rakibin kalesine sok; orta çizgiyi geçemezsin. Bota karşı alt yarıda oynarsın. Telefon ya da tablette iki parmak aynı anda çalışır. Hedef gol sayısına ilk ulaşan kazanır.',
  },
  'zeka-kupu': {
    tagline: 'Klasik zeka küpü: 2×2’den 7×7’ye, çözücüsüyle.',
    rules:
      'Küp karışık başlar. Her yüz tek renk olana kadar katmanları çevir. Bir kareyi sürükleyerek katmanını çevir (orta katmanlar da olur), arka planı sürükleyerek küpü döndür. Klavyede U D L R F B yüzleri çevirir; Shift ile ters yöne döner. Süre ilk hamlenle başlar. 2×2 ya da 3×3’te takıldın mı? "Benim için çöz" Kociemba’nın iki aşamalı algoritmasıyla bir çözüm bulup senin için oynar. Sitenin yazarının kendi küp çözücüsünden uyarlandı.',
  },
  'bes-harf': {
    tagline: 'Beş harfli kelimeyi altı tahminde bul. Arkadaşlarınla aynı kelimede yarış.',
    rules:
      'Gizli beş harfli kelimeyi altı denemede bul. Her tahmin gerçek bir kelime olmalı. Tahminden sonra her harf renklenir: yeşil, harf doğru ve yeri doğru; sarı, harf kelimede var ama başka yerde; gri, harf kelimede yok. Arkadaşlarınla oynarken herkese aynı kelime düşer ve herkes diğerlerinin renklerini görür (harflerini asla). En az tahminde bulan kazanır; eşitlikte önce bitiren. "Günün kelimesi" aynı gün herkese aynı kelimeyi verir.',
  },
  'uzay-savunmasi': {
    tagline: 'Yürüyen drone dalgalarına ve kovana karşı hattı tut.',
    rules:
      'Drone dalgaları bir yandan öbür yana yürür ve kenara her vardığında biraz aşağı iner. Ne kadar azalırlarsa o kadar hızlanırlar. Gemin kendi kendine ateş eder: nişan almak ve atışlardan kaçmak için onu hareket ettir. Küre drone 10, denizanası 20, kristal 30 puan (kristaller sana nişan alır ve 4. dalgadan sonra iki vuruşta ölür). Her beşinci dalgada kovan gelir ve yelpaze gibi atış yapar. Vurulan drone’lar bazen ⚡ hızlı atış, ✦ çift atış ya da 🛡 kalkan düşürür. Üç canın var; drone’lar senin hizana inerse oyun biter.',
  },
  'bilgi-yarisi': {
    tagline: 'Hızlı bilgi yarışı: herkes aynı anda cevaplar, hızlı olan kazanır. Kendi sorularını da getir.',
    rules:
      'Herkes en fazla dört şıklı aynı soruyu görür ve cevaplamak için 20 saniyesi vardır. Doğru cevap 500 puan, hıza göre de 500 puana kadar ek puan getirir; yanlış ya da boş cevap puan getirmez. En yüksek toplam kazanır. Sorular hazır sorulardan, senin sorularından (“Benim sorularım”: aşağıda yazarsın ve bağlantıyla paylaşabilirsin), karışık ya da “Herkes soru yazsın” modundan gelir: bu modda önce herkes diğerleri için soru yazar ve kendi sorusunda bekler.',
  },
  hafiza: {
    tagline: 'İki kart çevir, eşleri bul, neyin nerede olduğunu hatırla.',
    rules:
      'Bütün kartlar kapalı başlar ve her resimden iki tane vardır. Sıra sende iki kart çevir. Aynıysa çift senindir ve tekrar oynarsın; değilse kartlar kapanır ve sıra diğer oyuncuya geçer. Bütün çiftler bulununca en çok çifti olan kazanır. Tek başına oynarken masayı olabildiğince az denemede temizlemeye çalış.',
  },
  'kelime-ustasi': {
    tagline: 'Yedi taşınla bulmaca gibi kelimeler kur. Bonus kareler, boş taşlar, büyük hamleler.',
    rules:
      'Herkesin yedi harf taşı var. Sıra sende taşları tek bir satıra ya da sütuna, tahtadakilerle bulmaca gibi kelime oluşturacak şekilde koy; oluşan her yeni kelime listede olmalı. İlk kelime ortadaki ★ karesinden geçer. Oluşturduğun her kelimenin harf puanlarını topla: renkli kareler harfi (2H, 3H) ya da bütün kelimeyi (2K, 3K) ikiye ya da üçe katlar, ama yalnızca ilk kapatıldıklarında. Yedi taşın hepsini birden kullanmak 50 puan ekler. İki boş taş istediğin harf olur ve 0 puan sayılır. Sonra torbadan taş tamamla. Oynamak yerine taş değiştirebilir (torbada en az yedi taş varken) ya da pas geçebilirsin. Torba boşken biri son taşını kullanınca oyun biter (o kişi diğerlerinin elinde kalan taşların puanını kazanır, diğerleri kendi taşlarının puanını kaybeder) ya da üç tur boyunca kimse puan almazsa biter. Türkçede yalnızca sözlük biçimleri geçerlidir, ek almış kelimeler sayılmaz.',
  },
  'pis-yedili': {
    tagline: 'Rengi ya da sayıyı eşle, yedilerden kaç, elini ilk sen bitir.',
    rules:
      'Herkese 7 kart dağıtılır (5 ve daha fazla oyuncuda iki deste). Sıra sende yerdeki kartla aynı renkte ya da aynı sayıda bir kart at. Atamazsan (ya da istemezsen) bir kart çek; uyuyorsa atabilirsin, yoksa pas geç. Özel kartlar: 7 atılınca sıradaki 2 kart çeker, o da 7 atarsa bir sonraki 4 çeker ve böyle devam eder; 8 sıradakini atlar; 10 yönü değiştirir; vale her kartın üstüne atılır ve atan rengi seçer. Elini ilk bitiren eli kazanır. Puanlı oyunda diğerleri elinde kalan kartları yazar (vale 25, yedi 20, as 11, resimli kartlar ve onlar 10, diğerleri sayısı kadar); biri 101’e ulaşınca en düşük toplam kazanır. Kurallar yöreden yöreye değişir; bunlar yaygın olanlardır.',
  },
  'kelimeyi-anlat': {
    tagline: 'Yasaklı kelimeleri söylemeden kelimeyi anlat. Takım takıma, zamana karşı.',
    rules:
      'İki takım: 1, 3, 5… numaralı oyuncular ile 2, 4, 6… numaralı oyuncular. Takımlar sırayla oynar; sıra sende bir kelime ve söylemen yasak olan kelimeleri görürsün. Takımın sesli tahmin etsin diye kelimeyi anlat: kelimenin kendisini, yasaklı kelimeleri ya da onların parçalarını söylemek, ses taklidiyle anlatmak yok. Bilinen her kelime 1 puan. Pas geçmek bedava (aksi seçilmediyse tur başına 3); yasaklı kelime söylemek 1 puan kaybettirir. Rakip takım da kartı görür ve yasaklı kelimeleri yakalar. Aynı odada ya da sesli sohbet açıkken internetten oynayın. Sonunda puanı fazla olan takım kazanır.',
  },
  'gizli-gorev': {
    tagline: 'İki takım, 25 kelime, tek gizli anahtar. Zekice tek kelimelik ipuçları ver; bombadan uzak dur.',
    rules:
      'İki takım: 1, 3, 5… numaralı oyuncular ile 2, 4, 6… numaralı oyuncular. Her takımın ilk oyuncusu liderdir ve gizli anahtarı görür: 25 kelimeden hangileri hangi takımın, hangileri tarafsız ve hangisi 💣 bomba. Başlayan takımın 9, diğerinin 8 kelimesi vardır. Sıra takımına gelince lider tahtada olmayan tek bir ipucu kelimesi ve bunun kaç kelimeye uyduğunu söyleyen bir sayı verir. Takım arkadaşları kelimeleri tek tek seçer. Kendi kelimeniz çıkarsa sayının bir fazlasına kadar devam edersiniz; tarafsız ya da rakip takımın kelimesi sırayı bitirir; bomba oyunu hemen kaybettirir. Bütün kelimelerini ilk bulan takım kazanır. Liderler yüz ifadesiyle ya da fazladan sözle ipucu vermesin! En iyisi herkes kendi telefonundan, sesli sohbetle ya da aynı odada oynamak.',
  },
  'casus-kim': {
    tagline: 'Casus dışında herkes mekânı biliyor. Sor, blöf yap, casusu bul.',
    rules:
      'Bir oyuncu, yani casus, dışında herkes aynı gizli mekânı görür; casus hiçbir şey görmez. Sırayla birbirinize mekânla ilgili sesli sorular sorun (“Burada ne giyilir?”); casusa yardım etmeyecek kadar belirsiz ama mekânı bildiğinizi gösterecek kadar net cevap verin. Herkes oyun başına bir kez birini suçlayabilir: diğer herkes kabul ederse suçlanan açıklanır. Casus yakalanırsa diğerleri kazanır; masum biri suçlanırsa casus kazanır. Casus istediği an kendini açık edip mekânı tahmin edebilir: doğruysa kazanır, yanlışsa kaybeder. Süre dolunca herkes oy verir; casus en çok oyu alırsa mekânı tahmin etmek için son bir hakkı olur. Aynı odada ya da sesli sohbet açıkken, herkes kendi telefonundan oynayın.',
  },
  trash: {
    tagline: 'Dört kişi, her sıra tek kart: yığını geç, 10 ile çöpe at, ilk sen bitir.',
    rules:
      'Her zaman dört oyuncu (boş yerlere bot oturur) ve tek deste. Herkese 3 kapalı kart, bunların üstüne 3 açık kart ve elde 4 kart; kalan 12 kart destedir. Oyundan önce elindeki kartlarla açık kartlarını istediğin gibi değiştir, sonra Hazır’a bas. Her eli rastgele bir oyuncu başlatır. Sıra sende yığındakine eşit ya da daha büyük tam bir kart at (3 4 5 6 7 9 V K P A) ya da bütün yığını al. Özel kartlar her şeyin üstüne atılır: 2 sıfırlar (sonra her kart olur), 8 altındaki kartı kopyalar (8’lerin altına bakılır), 10 bütün yığını çöpe atar ve sıradaki yeni bir yığın başlatır. Kart attıktan sonra destede kart varsa ve elinde 3 ya da daha az kart kaldıysa bir kart çek. Elin boşalıp deste de bitince açık kartlarını oyna (uyan varsa onu; hiçbiri uymuyorsa biri gösterilir ve onunla birlikte yığını alırsın), sonra kapalı kartlarını körlemesine aç (uymazsa gösterilir ve yığını alırsın). Kartsız kalan ilk oyuncu eli kazanır. Galibiyetler her koltuk için el el sayılır.',
  },
  'sohbet-odasi': {
    tagline: 'Yazışmak, konuşmak, birbirinizi görmek ve ekran paylaşmak için özel bir oda.',
    rules:
      'Bir oda aç ve kodu ya da bağlantıyı arkadaşlarınla paylaş. Herkes yazışabilir (emoji, en fazla 8 MB resim ve dosya), sesli görüşmeye katılabilir, kamerasını açabilir ya da ekranını paylaşabilir. Görüşmeler doğrudan tarayıcılar arasında olur; çok kişiyle yavaş bağlantılarda ağırlaşabilir; ekran paylaşımı bilgisayarlarda çalışır. Hiçbir şey kaydedilmez ya da saklanmaz.',
  },
  kemps: {
    tagline: 'Dörtlüyü topla ve eşine işaret ver, diğer takım fark etmeden.',
    rules:
      'İkişer kişilik iki takım; eşler karşılıklı oturur. Herkesin elinde dört kart, ortada da açık dört kart var. Sıra yok: istediğin an elindeki bir kartı ortadakiyle değiştir. Ortadaki kartları kimse istemeyince herkes “Ortaya yeni kartlar”a basar ve yeni dört kart açılır. Amaç: aynı değerde dört kart. Her takıma altı işaret emojisinden biri gizlice verilir; dörtlün olduğunu eşine söylemek için onu gönder, diğerlerini şaşırtmaca olarak kullan. Eşinde dörtlü olduğunu düşünüyorsan “Kemps!” de; rakipte olduğunu düşünüyorsan ona “Dur!” de. Doğru çağrı takımına bir harf kazandırır, yanlışı diğer takıma; el her durumda biter. K-E-M-P-S kelimesini ilk tamamlayan takım kazanır. En güzeli sesli görüşme açıkken, herkes kendi telefonundan.',
  },
  bric: {
    tagline: 'Klasik eşli oyun: bir kontrat deklare et, sonra tut.',
    rules:
      'Dört oyuncu iki eş çifti: Kuzey–Güney ile Doğu–Batı; eşler karşılıklı oturur. 52 kartın hepsi dağıtılır. Deklare: dağıtandan başlayarak herkes ya deklare yapar (altının üstünde kaç löve alınacağı, 1–7, ve koz rengi ya da Kozsuz), ya pas der, ya rakibin deklaresine kontr ya da kontra sürkontr der. Her deklare bir öncekinden yüksek olmalı (♣ < ♦ < ♥ < ♠ < NT). Bir deklareden sonra üç pas deklareyi bitirir; son deklare kontrattır. O taraftan rengi ilk söyleyen deklaranstır, eşi yerdir. Deklaransın solundaki ilk kartı atar; sonra yerin kartları açılır ve onları deklarans oynar. Renge uymak zorunludur; en büyük koz, yoksa açılan rengin en büyüğü löveyi alır. Kontratı tutan taraf puanını yazar (oyun, şlem, kontr ve fazla löve primleriyle); tutamazsa diğer taraf ceza puanı yazar. Puanlama düplike usulüdür ve eller boyunca toplanır; kırmızı 🔴 zonda olan tarafı gösterir.',
  },
};

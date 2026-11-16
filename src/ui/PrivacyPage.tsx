import { useLang, useT } from '../i18n';

const UPDATED = '2026-11-15';
const REPO = 'https://github.com/gucere/game-table/issues';

/** The privacy note: what the site keeps, where, and how to remove it. One version per language. */
const TEXT: Record<'en' | 'tr', { h: string; p: string[] }[]> = {
  en: [
    {
      h: 'In short',
      p: [
        'Game Table is a free hobby project with no ads, no tracking and no analytics. Nothing is sold or shared for marketing.',
        'You can play without an account. Then everything stays in your own browser.',
      ],
    },
    {
      h: 'Without an account',
      p: [
        'Your settings, name, profiles (including any picture you add), stats and achievements are saved only in this browser’s storage on your device. Clearing the site’s data removes them.',
        'Online rooms connect browsers directly to each other. To find each other, browsers use the free public PeerJS connection service and a Google server that helps find a direct route; these see your IP address and a random room ID. Chat, pictures, files, voice and video go directly between the people in the room and are not stored by us.',
        'Secret Santa emails (if the organizer uses that button) are sent through Google: the names and email addresses go to a Google Apps Script that sends the emails and keeps nothing.',
      ],
    },
    {
      h: 'With an account',
      p: [
        'Accounts use Google Firebase. Signing in (with Google or an email and password) is handled by Firebase Authentication, which keeps your email address and, for Google sign-in, your Google name and photo. We don’t use your Google name or photo. Firebase Authentication may process this data outside the EU.',
        'Your profile is kept in a Firebase database in Frankfurt (EU): the name and avatar you choose, your own picture if you added one, your stats and achievements, and when they were last saved.',
        'This is used only to show your profile and to bring it to your other devices. Database rules let only you read or change it. Other players see your name and avatar (and your picture in private rooms) only while you play with them.',
      ],
    },
    {
      h: 'Friends and messages',
      p: [
        'Signed-in players get a random friend code. Others can find you only with that code; there is no search or list of players. Your friends see your name and avatar (not your email or picture).',
        'Friend requests, your friends list and your messages are kept in the same database. Database rules let only you and that friend read your messages, and only while you are friends. Removing or blocking a friend deletes your messages with them.',
        'The site owner can technically see the database in the Firebase console, like any website owner can see their own server. They don’t read messages and only use the console to keep the site running.',
      ],
    },
    {
      h: 'Leaderboards',
      p: [
        'Some solo games have a public leaderboard that anyone can see, even without an account. Your score goes on it only when you add it (or tick “Always add my best scores”). The leaderboard shows the name and avatar of your profile next to your best score; never your email or picture.',
        'Each player has one entry per leaderboard, their best. Deleting your account removes your entries.',
      ],
    },
    {
      h: 'Removing your data',
      p: [
        'Profile page → Delete my account erases your profile, stats, friends, messages and friend code from the database and deletes your sign-in. Signing out removes the account’s copy from that device.',
        'You can also ask to see, correct or delete your data (your rights under Turkey’s KVKK and the EU’s GDPR) by opening an issue on the project’s GitHub page.',
      ],
    },
    {
      h: 'Age',
      p: ['To make an account you need to be 16 or older, or have a parent’s or guardian’s permission. Public rooms are for people 18 and older.'],
    },
    {
      h: 'Changes',
      p: ['If this note changes, the new version appears here with a new date.'],
    },
  ],
  tr: [
    {
      h: 'Kısaca',
      p: [
        'Oyun Masası reklamsız, takipsiz ve analiz aracı kullanmayan, ücretsiz bir hobi projesidir. Hiçbir veri satılmaz ya da pazarlama için paylaşılmaz.',
        'Hesap açmadan oynayabilirsin. O zaman her şey kendi tarayıcında kalır.',
      ],
    },
    {
      h: 'Hesap olmadan',
      p: [
        'Ayarların, adın, profillerin (eklediğin resim dahil), istatistiklerin ve başarımların yalnızca cihazındaki bu tarayıcının depolamasında saklanır. Sitenin verilerini temizlersen silinirler.',
        'Çevrimiçi odalar tarayıcıları doğrudan birbirine bağlar. Birbirlerini bulmak için tarayıcılar ücretsiz, herkese açık PeerJS bağlantı hizmetini ve doğrudan bir yol bulmaya yardım eden bir Google sunucusunu kullanır; bunlar IP adresini ve rastgele bir oda kimliğini görür. Sohbet, resimler, dosyalar, ses ve görüntü doğrudan odadaki kişiler arasında gider ve tarafımızca saklanmaz.',
        'Yılbaşı çekilişi e-postaları (düzenleyen kişi o düğmeyi kullanırsa) Google üzerinden gönderilir: isimler ve e-posta adresleri e-postaları gönderen ve hiçbir şey saklamayan bir Google Apps Script’e gider.',
      ],
    },
    {
      h: 'Hesapla',
      p: [
        'Hesaplar Google Firebase kullanır. Giriş (Google ile ya da e-posta ve şifreyle) Firebase Authentication tarafından yapılır; bu hizmet e-posta adresini ve Google ile girişte Google adını ve fotoğrafını saklar. Google adını ve fotoğrafını kullanmıyoruz. Firebase Authentication bu verileri AB dışında işleyebilir.',
        'Profilin Frankfurt’taki (AB) bir Firebase veritabanında tutulur: seçtiğin ad ve avatar, eklediysen kendi resmin, istatistiklerin ve başarımların ve en son ne zaman kaydedildikleri.',
        'Bunlar yalnızca profilini göstermek ve diğer cihazlarına taşımak için kullanılır. Veritabanı kuralları bunları yalnızca senin okuyup değiştirmene izin verir. Diğer oyuncular adını ve avatarını (özel odalarda resmini) yalnızca seninle oynarken görür.',
      ],
    },
    {
      h: 'Arkadaşlar ve mesajlar',
      p: [
        'Giriş yapan oyunculara rastgele bir arkadaş kodu verilir. Seni yalnızca bu kodla bulabilirler; oyuncu araması ya da listesi yoktur. Arkadaşların adını ve avatarını görür (e-postanı ya da resmini görmez).',
        'Arkadaşlık istekleri, arkadaş listen ve mesajların aynı veritabanında tutulur. Veritabanı kuralları mesajlarını yalnızca senin ve o arkadaşının, yalnızca arkadaş olduğunuz sürece okumasına izin verir. Bir arkadaşı çıkarmak ya da engellemek onunla olan mesajlarını siler.',
        'Site sahibi, her site sahibinin kendi sunucusunu görebildiği gibi, Firebase konsolunda veritabanını teknik olarak görebilir. Mesajları okumaz; konsolu yalnızca siteyi çalışır tutmak için kullanır.',
      ],
    },
    {
      h: 'Skor tabloları',
      p: [
        'Bazı tek kişilik oyunların, hesabı olmayanlar dahil herkesin görebildiği bir skor tablosu var. Skorun tabloya yalnızca sen eklersen (ya da “En iyi skorlarımı hep ekle”yi işaretlersen) girer. Tabloda en iyi skorunun yanında profilinin adı ve avatarı görünür; e-postan ya da resmin asla görünmez.',
        'Her oyuncunun her tabloda tek bir kaydı, en iyi skoru vardır. Hesabını silmek kayıtlarını da kaldırır.',
      ],
    },
    {
      h: 'Verilerini silmek',
      p: [
        'Profil sayfası → Hesabımı sil, profilini, istatistiklerini, arkadaşlarını, mesajlarını ve arkadaş kodunu veritabanından siler ve giriş bilgini kaldırır. Çıkış yapmak hesabın o cihazdaki kopyasını kaldırır.',
        'Verilerini görmek, düzeltmek ya da sildirmek için (KVKK ve AB’nin GDPR’ı kapsamındaki hakların) projenin GitHub sayfasında bir kayıt (issue) açabilirsin.',
      ],
    },
    {
      h: 'Yaş',
      p: ['Hesap açmak için 16 yaşında ya da daha büyük olmalı veya ebeveyninin ya da velinin iznini almış olmalısın. Herkese açık odalar 18 yaş ve üstü içindir.'],
    },
    {
      h: 'Değişiklikler',
      p: ['Bu not değişirse yeni hâli yeni bir tarihle burada yayımlanır.'],
    },
  ],
};

export function PrivacyPage() {
  const t = useT();
  const lang = useLang();
  const text = TEXT[lang === 'tr' ? 'tr' : 'en'];
  return (
    <div className="panel stack privacy">
      <a href="#/" className="back">
        ← {t('All games')}
      </a>
      <h1>{t('Privacy note')}</h1>
      <p className="small muted">{t('Last updated: {date}', { date: new Date(UPDATED).toLocaleDateString(lang) })}</p>
      {text.map((s) => (
        <section key={s.h} className="stack-sm">
          <h2 className="section-title">{s.h}</h2>
          {s.p.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
      <p className="small">
        <a href={REPO} target="_blank" rel="noreferrer">
          {t('Questions or requests: open an issue on GitHub')}
        </a>
      </p>
    </div>
  );
}

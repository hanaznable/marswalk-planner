# POLARIS Module — Proje kapsamı

Güncelleme: 2026-11-15. Bu belge ürün kapsamını ve aşamaları tanımlar; aşağıdaki
mevcut durum bölümü dışında planlanan özellikler uygulanmış sayılmaz. Güncel
öncelikler ve ekip sorumlulukları [ROADMAP.md](ROADMAP.md) içindedir.
Kapsam, NASA Space Apps Challenge 2026 proje çalışması için
hazırlanmıştır; resmî görev planlama veya astronot güvenliği onayı anlamına gelmez.

## Amaç ve temel kullanıcı akışı

Astronotların Mars yüzeyinde bilimsel keşif rotalarını; gerçek görev verileri,
arazi koşulları, bilimsel hedefler, ekipman ve görev kısıtlarıyla birlikte
inceleyebileceği etkileşimli bir web uygulaması geliştirmek.

1. Veri kapsamı bulunan bir Mars bölgesi seçilir ve veri kaynakları incelenir.
2. Harita katmanları açılır; geçmiş görevler ve bilimsel gözlem adayları incelenir.
3. Başlangıç, hedef, ara duraklar ve dönüş tercihi belirlenir.
4. Bilimsel hedefler, ekipman, yürüyüş hızı ve görev süresi girilir.
5. Uygun veri mevcutsa mesafe odaklı ve arazi kısıtlı rotalar karşılaştırılır.
6. Rota özeti, veri belirsizlikleri ve varsa bütçe uyarıları değerlendirilir.
7. Rota ve rapor dışarı aktarılır.

## Mevcut uygulama

Gerçek Pahrump Hills verisiyle 1 × 1 km harita ve 5 m rota ağı entegredir.
Yükseklik, eğim, gri/iyileştirilmiş RGB görüntü, üç sondaj ilişkili rover konum
vekili, APXS kayıtları, tarihsel Curiosity izi ve Buckskin mineral bulgusu gösterilir.
Başlangıç/ara durak/hedef düzenleme, A* mesafe ve eğim odaklı rota karşılaştırması,
dönüş bacağı, yükseklik profili, senaryo hız/durak süresiyle tahmin, JSON ve
yazdırılabilir rapor çalışır. İsimli görevler tarayıcıda saklanabilir, açılabilir
ve JSON olarak içe/dışa aktarılabilir. Three.js tabanlı salt okunur 3D görünüm ve
POLARIS Module mavi arayüzü uygulanmıştır; noktalar 2D görünümde düzenlenir.

Bilimsel faaliyet önerileri, amaç/ekipman seçimi, bütçeler ve gerçek tehlike
katmanı henüz uygulanmamıştır. CRISM, termal ve jeoloji katmanları beklemektedir.
Mutlak konum ve görüntü/DEM doğruluğu doğrulanmış değildir; prototip yöntem ve
konum sınırlamaları geçerlidir. Jezero seçeneğinde veri yoktur; sentetik bölge
ayrı etiketlenir. Gerçek tehlike verisi ve tam ziyaretçi kaynak kataloğu eksiktir.

## Aşama 1 — İlk çalışan sürüm (MVP)

MVP tek bir bölgenin incelenmiş veri kapsamıyla sınırlandırılır. İlk bölge
Pahrump Hills olarak belirlenmiştir; yeni bölgeler ayrıca veri incelemesi gerektirir.

| Özellik | İlk sürüm davranışı | Bağımlılık / sınır |
| --- | --- | --- |
| Yükseklik katmanı | Gerçek yükseklik verisini gösterme ve kaynağını inceleme | Birimler, çözünürlük, referans sistemi ve eksik değerler doğrulanmalı |
| Eğim katmanı | Yükseklik verisinden türetilen eğimi gösterme | Türetme yöntemi, hücre boyutu ve veri belirsizliği belgelenmeli |
| Termal katman | Kaynak kataloğunda planlanan katman olarak gösterme | Görselleştirme Aşama 2; gerçek veri olmadan açılmaz |
| Mineral katmanı | Kaynak kataloğunda planlanan katman olarak gösterme | Görselleştirme Aşama 2; gerçek veri olmadan açılmaz |
| Geçmiş NASA görevleri | Seçili bölgeye ilişkin doğrulanmış konumları ve analiz özetlerini gösterme | Her kayıt için kaynak; veri yoksa açık boş durum |
| Bilimsel hedef seçimi | Kaynaklandırılmış adayları inceleme ve ara durak olarak seçme | İlk sürümde otomatik bilimsel değer tahmini yok |
| Rota noktaları | Başlangıç, hedef ve sıralı ara durak ekleme, düzenleme, silme | Noktalar kullanılabilir veri kapsamına göre doğrulanmalı |
| Mesafe odaklı rota | Tanımlanan geçilebilir ağ üzerinde en kısa yolu hesaplama | Sonuç yalnızca kullanılan model ve çözünürlük için geçerli |
| Arazi kısıtlı rota | Eğim sınırları ve mevcut tehlike maskeleriyle rota üretme | Veri yokluğu güvenli arazi olarak yorumlanmaz |
| Alternatif rotalar | Mesafe odaklı ve arazi kısıtlı sonuçları yan yana karşılaştırma | İki sonuç aynı olabilir; alternatif uydurulmaz |
| Gidiş dönüş | Son hedeften başlangıca dönüş bacağını da hesaplama | Dönüş ayrı değerlendirilir; mesafe veya süre doğrudan ikiyle çarpılmaz |
| Yürüyüş hızı ve süre | Kullanıcı girdisi olan hız ve durak süreleriyle tahmin üretme | Basit planlama tahmini olarak etiketlenir; fizyolojik model değildir |
| Arazi tehlikeleri | Verinin desteklediği tehlike alanlarını ve eksik kapsamı gösterme | Tüm tehlikelerin algılandığı iddia edilmez |
| Rota özeti | Noktalar, bacaklar, mesafe, süre, dönüş, kısıtlar ve veri eksiklerini listeleme | Hesaplanamayan alanlar boş bırakılır; sıfırla doldurulmaz |
| NASA kaynakları | Kullanılan gerçek varlıkların kaynaklarını ve işleme geçmişini listeleme | Arazi ve ayrı bilim/görüntü kaynakları entegredir; tam ziyaretçi kataloğu henüz eksiktir |
| Dışarı aktarma | Rota ve raporu JSON ve yazdırılabilir görünüm olarak sunma | Kaynaklar, referans sistemi, varsayımlar ve uyarılar eklenir |

### Rota modelinin sınırları

- Mesafe ve koordinat işlemleri Mars verisinin referans sistemiyle uyumlu olmalı.
- Mesafe odaklı rota da temel geçilebilirlik kısıtlarına uymalı; bilinen engellerin
  üzerinden çizilen düz bir çizgi rota olarak sunulmamalı.
- Eğim, arazi riski ve bilimsel değer ayrı alanlar olarak tutulmalı. Kaynağı ve
  anlamı açıklanmayan tek bir “güvenlik puanı” üretilmemeli.
- Kullanıcı eşikleri senaryo varsayımı olarak etiketlenmeli; resmî astronot veya
  ekipman sınırı gibi sunulmamalı.
- Geçerli rota bulunamıyorsa neden gösterilmeli; algoritma kısıtları sessizce
  gevşetmemeli. Kapsam dışı veya eksik hücreler görünür olmalı.
- Dönüş bacağı da toplam görev süresine ve sonraki bütçe kontrollerine katılmalı.

## Aşama 2 — Bilimsel planlama ve görev bütçeleri

### Termal ve mineral katmanları

Gerçek veri sağlandığında katmanlar açılır. Termal veride gözlem zamanı, ölçülen
büyüklük ve birim gösterilir; geçmiş bir ölçüm güncel yüzey koşulu gibi sunulmaz.
Mineral katmanında kaynak sınıflandırması, çözünürlük ve varsa güven bilgisi
korunur. Farklı veri kümelerinin kapsam ve çözünürlük farkları belirtilir.

### Bilimsel gözlem noktası önerileri

Kaynaklandırılmış gözlem adayları; seçilen bilimsel hedef, erişilebilirlik,
ekipman uyumu ve rota sapmasıyla sıralanabilir. Her öneri neden önerildiğini ve
hangi veriye dayandığını açıklar. Sistem yeni bir bilimsel keşif yapılmış gibi
iddiada bulunmaz. İlk yaklaşım açıklanabilir kurallardır; bir yapay zekâ servisi
veya model bağımlılığı zorunlu değildir.

### Ekipmana göre görevler

Kullanıcı taşınan ekipmanı seçer. Bilimsel faaliyetler gerekli ekipmanla
eşleştirilir; uygun olmayan faaliyetler gerekçeleriyle gösterilir. Gözlem ve
numune alma gibi faaliyet türleri, kaynaklandırılmış görev tanımları veya açıkça
belirtilmiş senaryo girdileriyle tanımlanır. Alet kapasitesi veya analiz sonucu
uydurulmaz. Faaliyet süreleri toplam görev süresine eklenir.

### Oksijen, enerji ve diğer bütçeler

- Görev süresi, oksijen ve enerji bütçeleri ayrı izlenir; farklı birimler tek bir
  bütçede birleştirilmez. Diğer sarf kaynakları sonradan eklenebilir.
- Başlangıç kapasitesi, tüketim modeli, rezerv ve uyarı eşikleri açık girdilerdir.
- Yalnızca belgelenmiş model veya açıkça etiketlenmiş kullanıcı senaryosuyla
  tahmin üretilir. Gerekli model yoksa “hesaplanamıyor” gösterilir.
- Gidiş, bilimsel duraklar ve dönüş için toplam ve kalan bütçe gösterilir.
- Eşik aşımı ve dönüş rezervi ihlali uyarı üretir. Varsayımlar ve modelin
  uygulanabilirlik sınırları rapora taşınır.
- Bu özellik canlı yaşam destek telemetrisi veya operasyonel güvenlik onayı
  değildir; bu kapsamda bir donanım bağlantısı planlanmamıştır.

### Bilimsel değer / rota riski karşılaştırması

Bilimsel hedef kapsamı, ek mesafe, görev süresi, arazi risk göstergeleri ve kaynak
tüketimi birlikte karşılaştırılır. Bilimsel değer puanı kullanılırsa bileşenleri,
ölçeği ve ağırlıkları açıklanır; kullanıcı tercihiyle bilimsel ölçüm ayrılır.
Tek bir “en iyi rota” yerine gerekçeleri anlaşılır seçenekler sunulur.

### Yeniden planlama ve ek çıktılar

Noktalar, kapalı alanlar veya görev parametreleri kullanıcı tarafından
değiştirildiğinde rota yeniden hesaplanır. Bu, canlı çevre verisi alındığı
anlamına gelmez. Önceki rota ile değişiklikler karşılaştırılabilir.
CSV rapor ve ek dışa aktarma biçimleri ihtiyaca göre eklenebilir. Coğrafi format
kullanılacaksa Mars koordinatları ve referans sistemi alıcı araçta doğrulanır;
Dünya koordinatı bekleyen bir biçime sessiz dönüşüm yapılmaz.

## Aşama 3 — İsteğe bağlı genişlemeler

| Konu | Önerilen kapsam kararı | Uygulamaya geçiş koşulu |
| --- | --- | --- |
| 3D arazi | İsteğe bağlı salt okunur görünüm uygulandı; rota düzenleme 2D içinde kalır | Aynı yükseklik/görüntü ve planlama durumu kullanılır; abartı yalnızca görseldir, WebGL yoksa 2D sunulur |
| Rover | İlk sürüm astronot odaklı; rover ayrı hareket profili olarak değerlendirilecek | Araç özellikleri, enerji modeli ve geçilebilirlik sınırlarının doğrulanması |
| Dinamik rota | Önce kullanıcı değişikliğine bağlı yeniden hesaplama; canlı güncelleme sonraki kapsam | Güvenilir güncelleme kaynağı, zaman damgaları ve eski verinin yönetimi |
| Gelişmiş alternatifler | Çok ölçütlü rota seçenekleri | Belgelenmiş risk, bilimsel değer ve kaynak modelleri |

Rover eklenirse astronotun hız ve risk modeli yeniden adlandırılarak kullanılmaz.
Birlikte astronot–rover operasyonları ayrıca kapsamlandırılır. 3D görünüm rota
algoritmasının bağımlılığı olmaz; aynı doğrulanmış verinin başka bir sunumudur.

## NASA veri kaynakları ve izlenebilirlik

HiRISE arazi/görüntü ürünleri, Curiosity konumları, APXS gözlem kayıtları ve
yayımlanmış bir CheMin mineral bulgusu entegredir. Güncel ürünler ve işleme
sınırlamaları [docs/data-sources.md](docs/data-sources.md) içinde listelenir.
`src/features/datasets/registry.ts` arazi ve hedef koleksiyonunu kaydeder;
bağlam/RGB kayıtları `src/features/mapLayers/` içinde ayrıdır. Yeni kaynağın
seçili bölgeyi kapsadığı ve kullanılabilirliği ayrıca doğrulanmalıdır.

Her kaynak için en az şu bilgiler kaydedilmeli:

- Görev / araç / cihaz ve ürün veya arşiv kayıt kimliği.
- Resmî kaynak bağlantısı, atıf ve kullanım koşulları.
- Bölge kapsamı, koordinat referans sistemi, birimler ve uzamsal çözünürlük.
- Gözlem zamanı veya kapsadığı dönem; indirme ve işleme bilgileri.
- Eksik veri değerleri, bilinen sınırlamalar ve türetilen ürünün yöntemi.

Geçmiş görev kaydında konum, konumun türü (ör. iniş veya gözlem noktası), yapılan
analiz, ilgili cihaz ve kaynak bağlantısı ayrı tutulur. Harita kapsamı dışındaki
görevler seçili bölgede bulunuyormuş gibi gösterilmez. Veride olmayan analiz
sonuçları veya hassas konumlar tahmin edilerek eklenmez.

## Teknik sınırlar ve modülerlik

- React + TypeScript + Vite; 2D görünüm Leaflet içinde kalır.
- NASA kaynakları ve veri hazırlama, harita bileşenlerinden bağımsızdır.
- Python ön işleme betikleri `scripts/terrain/` içindedir; `scripts/preprocessing/` bu uygulamaya yönlendirir.
- Rota algoritmaları saf TypeScript modülleri olarak hazırlanır; React, Leaflet
  veya Three.js nesnelerine bağımlı olmaz.
- Bilimsel hedefler, geçmiş görevler, ekipman, bütçeler ve dışa aktarma ihtiyaç
  doğdukça ayrı özellik modüllerine ayrılır; boş modüller şimdiden çoğaltılmaz.
- Uygulanan 3D görünüm Three.js kullanır ve isteğe bağlı yüklenir; React Three Fiber kullanılmaz.
- İlk aşamada backend, veritabanı, kimlik doğrulama ve ekip içi eşzamanlı çalışma
  servisi yoktur. Veri ve rota işlemleri tarayıcı ile ön işleme arasında bölünür.
- NASA verisi veya hesap modeli hazır değilse özellik açık yer tutucu olarak
  kalır; sahte sonuçla tamamlanmış gösterilmez.

## MVP kabul kriterleri

1. En az bir bölge için gerçek yükseklik verisi ve türetilmiş eğim doğrulanır;
   kaynak ve kapsam kullanıcı tarafından görülebilir.
2. Başlangıç, hedef, ara durak ve dönüş tercihi düzenlenebilir.
3. Aynı girdilerle mesafe odaklı ve arazi kısıtlı rota hesaplanır; sonuçların
   aynı olması veya rota bulunamaması doğru biçimde açıklanır.
4. Süre tahmini hız ve durak girdileriyle izlenebilir; dönüş toplamda yer alır.
5. Kaynaklandırılmış tarihsel görevler ve bilimsel hedefler yalnızca mevcut veri
   kapsamında gösterilir; eksik kayıtlar uydurulmaz.
6. Rota özeti ve JSON / yazdırılabilir rapor kaynakları, girdileri, varsayımları
   ve belirsizlikleri içerir.
7. Eksik veri, kapsam dışı seçim ve geçilemez rota durumları kontrol edilir.
8. Masaüstü öncelikli duyarlı arayüz ve `npm run dev` çalışması korunur.

## Kesinleştirilecek kararlar

- İlk önerilen bilimsel faaliyetler, bilimsel amaçlar ve ekipman varsayımları neler olacak?
- Tehlike ve ek bilimsel katmanlar için hangi ürünler kapsama/kalite incelemesini geçecek?
- Bütçe hesapları için doğrulanabilir tüketim modeli bulunabilecek mi?
- Rover, gelişmiş alternatifler ve daha geniş harita kapsamı hangi aşamada ele alınacak?

Rover ve canlı çevre verisine dayalı yeniden planlama gelecekte ayrıca
kapsamlandırılacaktır. Kullanıcı nokta/parametre değişiklikleriyle rota yeniden
hesaplama ve isteğe bağlı 3D görünüm mevcut uygulamanın parçasıdır.

# Manuel Kelime Ekleme (Anki-style)

LingoSnap v3.0'dan itibaren, deck'inize iki yoldan kelime/ifade ekleyebilirsiniz:

1. **Çeviri popup'ından** — bir metin çevirip oradaki kelimeye tıklamak (akış: oku → öğren)
2. **Manuel olarak** — Anki tarzı, bir form doldurarak (akış: planlı çalışma)

Bu doküman ikinci yolu — manuel ekleme akışını anlatır.

## Nerede?

**Settings → Tekrar sekmesi → "+ Yeni Kart Ekle (manuel)"** butonu.

İdeal kullanım zamanı:
- Yeni bir konuya çalışmaya başlarken, kelime listenizi önceden yükler
- Bir kitap/makale okurken karşılaşıp orda eklemediğiniz kelimeleri toparlarken
- Hocadan/öğretmenden gelen kelime listelerini girerken

## Akış

```
+ Yeni Kart Ekle
   │
   ▼
┌─────────────────────────────────┐
│ Kelime veya ifade               │
│ [______________________________]│
│                                 │
│ Bağlam cümlesi (opsiyonel)      │
│ [______________________________]│
│ [______________________________]│
│                                 │
│         [ Ara ve Önizle ]       │
└─────────────────────────────────┘
   │
   ▼ (AI ile lookupWord çağrılır)
┌─────────────────────────────────┐
│ word    /ɪpa/    [🔊]    POS    │
│                                 │
│ 1. anlam — sense                │
│    "example sentence"           │
│ 2. anlam — sense                │
│    "example sentence"           │
│ 3. anlam — sense  ◄ bağlama uygun│
│                                 │
│ Eş anlamlı: …                   │
│ Zıt:        …                   │
│                                 │
│ [ Geri ]    [ + Deck'e Ekle ]   │
└─────────────────────────────────┘
   │
   ▼ FSRS-5 scheduler kartı "New" state ile aktive eder
       → bugün/yarın Tekrar kuyruğunda görünür
```

## Form Alanları

### Kelime veya ifade (zorunlu)

Tek kelime, deyim, kalıp ya da phrasal verb olabilir:

- ✅ `bedrock`
- ✅ `get along with`
- ✅ `throw in the towel`
- ✅ `for the time being`
- ✅ `nevertheless`

İngilizce, lowercase, infinitive form tercih edilir ama AI normalize eder
(örn. `running` girersen lemma `run` olarak da kaydedilir).

### Bağlam cümlesi (opsiyonel)

Kelimeyi gördüğünüz / kullanmak istediğiniz **örnek bir cümle**. AI bunu iki yerde kullanır:

1. **Polysemy disambiguation** — birden çok anlamı olan kelimelerde, hangi
   anlamın bağlama uygun olduğunu işaretler ("bağlama uygun" rozeti)
2. **Tekrar egzersizleri** — gelecekteki egzersizlerde "ilk görüldüğü bağlam"
   olarak kaydedilir, ama _yeniden kullanılmaz_ (her egzersiz fresh üretilir)

Boş bırakırsan AI ilk (en yaygın) anlamı seçer.

## AI Tarafından Otomatik Doldurulan Alanlar

`lookupWord` (Groq llama-3.3-70b) şunları üretir:

| Alan | Örnek (`run`) |
|---|---|
| **lemma** | `run` (base form) |
| **partOfSpeech** | verb / noun (poly) |
| **ipa** | `/rʌn/` |
| **meanings[]** | 1. koşmak — to move quickly on foot, 2. işletmek — to operate a business, … |
| **inContextMeaningIndex** | bağlama uygun olan |
| **synonyms** | sprint, jog, dash |
| **antonyms** | walk, stop |
| **examples** | her anlam için ayrı |

Hepsi düzenlenebilir değil — sadece görüntülenir. İleride manuel düzenleme
(Anki'deki gibi front/back override) eklenecek; bkz. **Sınırlamalar**.

## Kart Eklenince Ne Olur?

1. `WordCard` oluşturulur, FSRS-5 state'i `New` (state=0), `due` = şimdi
2. Hem **Tauri Store** hem **Markdown vault** (`{vaultPath}/words/{lemma}.md`) yazılır
3. Bir sonraki "Tekrar" oturumunda kuyrukta yer alır
4. İlk doğru rating'ten sonra FSRS scheduler interval'i ayarlar

## Egzersizler

Eklenen kart için **8 farklı egzersiz tipi** rotation'a girer (mevcut
çevirilerden gelen kartlarla aynı sistem):

- recall_en_to_tr — "X ne demek?"
- production_tr_to_en — TR anlamı verir, EN kelimesini iste
- cloze_sentence — yeni cümlede boşluk doldur
- polysemy_choice — bu bağlamda hangi anlam?
- use_in_sentence — yeni cümlede kullan (free production)
- listen_and_type — TTS dinleme + yazma
- synonym_or_antonym — eş/zıt anlamlı yaz
- context_inference — hiç görmediğin cümlede anlamı tahmin et

Tip seçimi:
- `Settings → Egzersiz Dağılımı` (Dengeli / Üretim ağırlıklı / Tanıma ağırlıklı)
- **Interleaving** — ardışık aynı tipte soru gelmez (son 2 tip 5× cezalı)
- Kart datası yetersizse bazı tipler atlanır (örn. tek anlamlı kart için
  `polysemy_choice` üretilmez)

## CEFR Seviyesi

Settings → Hedef Dil Seviyen ayarı (A1–C2), AI'nın **egzersiz cümlelerinin
zorluğunu** kalibre eder (Krashen'in **i+1** prensibi):

- A1 → kısa, basit cümleler, yaygın kelimeler
- C1+ → daha karmaşık syntax, daha az yaygın kelime/expression

## Sınırlamalar (v3.0)

- ❌ **Manuel translation/example override yok** — AI'nın ürettiği meanings
  değiştirilemez. Yanlış ya da eksik bulursan kartı silip yeniden eklemen gerekir.
- ❌ **Toplu (bulk) ekleme yok** — her seferinde tek kart. Bulk için ileride
  CSV import eklenecek.
- ❌ **Tag UI yok** — `WordCard.tags` alanı var ama UI'dan ekleme/edit yok.
  Vault'taki `.md` dosyalarını manuel olarak Obsidian'da düzenleyebilirsiniz.
- ❌ **Custom front/back yok** — Anki'deki tam serbestlik henüz yok; kart
  yapısı sabit (text + meanings + IPA + synonyms).

## Anki ile Karşılaştırma

| | Anki | LingoSnap |
|---|---|---|
| Spaced repetition | ✅ SM-2 / FSRS | ✅ FSRS-5 |
| Manuel kart ekleme | ✅ Tam serbest front/back | ✅ AI ile yarı-otomatik |
| Card content edit | ✅ | ❌ (v3.0) |
| **Dinamik egzersizler** | ❌ Statik kart | ✅ Her tekrar farklı AI egzersizi |
| **Polysemy desteği** | ⚠️ Manuel | ✅ Otomatik tespit + işaretleme |
| **Sözlük entegrasyonu** | Plugin gerekli | ✅ Built-in (Groq AI) |
| **Semantic answer eval** | ❌ Exact match | ✅ AI judge, synonim/paraphrase OK |
| Bulk import (CSV) | ✅ | ⏳ Yol haritasında |
| Görsel/ses kart yüzü | ✅ | ❌ |
| Multi-deck organization | ✅ | ❌ (tek deck) |
| Mobile sync | ✅ AnkiWeb | ❌ (sadece masaüstü) |

LingoSnap'in **avantajı**: her tekrar fresh egzersiz — aynı kartı bin kez
görsen, soru hiç tekrarlanmaz. Anki'nin **avantajı**: olgun ekosistem, mobil
sync, toplu işlemler.

## SSS

**S: Eklediğim kart hemen mi görünür?**
E: Evet — kuyruk `due` zamanına göre sıralanır, yeni kartlar `due = şimdi`
olduğu için aynı veya bir sonraki tekrar oturumunda gelir.

**S: Aynı kelimeyi iki kez ekleyebilir miyim?**
E: Hayır — lemma kontrolü yapılır. Aynı lemmaya sahip kart varsa "Zaten
deck'te" diye uyarır.

**S: AI yanlış anlam veriyor, ne yapayım?**
E: Bağlam cümlesi gir, AI ona göre doğru anlamı işaretler. Hâlâ yanlışsa
kartı sil ve daha açık bir bağlamla yeniden ekle.

**S: API'sız ekleme yapabilir miyim?**
E: Hayır — AI lookup şart. Tamamen offline manuel kart için Anki kullan,
veya bu feature'ı issue olarak öner.

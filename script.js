// ============ GLOBAL DURUM ============
let db, doc, setDoc, getDoc;

let personeller = [];
let izinler = [];
let vardiyaHafizasi = [];
let kurallar = [];
let marketPersoneller = [];

let duzenlemeModu = false;
let vardiyalarGuncel = [];
let aktifDropdown = null;
let sonBaslangic = null;
let sonGunSayisi = null;
let originalVardiyalar = null;

let marketVardiyalarGuncel = [];
let marketDuzenlemeModu = false;

const GUN_ADLARI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const saatler = { gece: "00:00-08:00", sabah: "08:00-16:00", aksam: "16:00-00:00" };
const KAPASITE = { gece: 2, sabah: 3, aksam: 3 };
const MAX_KADIN = 2;

const defaultPersoneller = [
    { isim: "GARİP", cinsiyet: "E", yetkinlik: "hepsi" },
    { isim: "SİNAN", cinsiyet: "E", yetkinlik: "hepsi" },
    { isim: "SABRİ", cinsiyet: "E", yetkinlik: "hepsi" },
    { isim: "ALİ", cinsiyet: "E", yetkinlik: "hepsi" },
    { isim: "OKAN", cinsiyet: "E", yetkinlik: "hepsi" },
    { isim: "GÜLCAN", cinsiyet: "K", yetkinlik: "hepsi" },
    { isim: "ÖZLEM", cinsiyet: "K", yetkinlik: "hepsi" },
    { isim: "NESİBE", cinsiyet: "K", yetkinlik: "hepsi" }
];

// ============ YARDIMCILAR ============
const $ = (id) => document.getElementById(id);

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "YYYY-MM-DD" metnini yerel saatte gün başlangıcı olarak çözer (UTC kaymasını önler)
function tarihCoz(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function tarihAnahtar(d) {
    const t = new Date(d);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function bugun() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function gunEkle(tarih, n) {
    return new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate() + n);
}

function tarihEtiketi(tarih) {
    const t = new Date(tarih);
    return `${t.getDate()} ${t.toLocaleString('tr', { month: 'long' })} ${GUN_ADLARI[t.getDay()]}`;
}

function mesajGoster(id, tip, metin) {
    const el = $(id);
    if (el) el.innerHTML = `<div class="${tip}">${esc(metin)}</div>`;
}

function kopya(obj) { return JSON.parse(JSON.stringify(obj)); }

function getKadinlar() { return personeller.filter(p => p.cinsiyet === "K").map(p => p.isim); }

function personelBul(isim) { return personeller.find(p => p.isim === isim); }

// ============ KURAL KONTROLLERİ (Benzinlik) ============
function izinKontrol(isim, tarih) {
    const t = tarihAnahtar(tarih);
    return izinler.some(iz => iz.personel === isim && t >= iz.baslangic && t <= iz.bitis);
}

function kuralKontrol(isim, vardiyaTipi, tarih) {
    const gun = tarih.getDay();
    for (const k of kurallar) {
        if (k.tip === "personel" && k.personel !== isim) continue;
        if (k.kural === "sadece_sabah" && vardiyaTipi !== "sabah") return false;
        if (k.kural === "sadece_aksam" && vardiyaTipi !== "aksam") return false;
        if (k.kural === "sadece_gece" && vardiyaTipi !== "gece") return false;
        if (k.kural === "gece_yasak" && vardiyaTipi === "gece") return false;
        if (k.kural === "haftasonu_gece_yasak" && vardiyaTipi === "gece" && (gun === 0 || gun === 6)) return false;
        if (k.kural === "pazartesi_izin" && gun === 1) return false;
    }
    return true;
}

function yetkinlikKontrol(isim, vardiya) {
    const p = personelBul(isim);
    if (!p) return false;
    if (vardiya === "gece" && p.cinsiyet === "K") return false;
    switch (p.yetkinlik) {
        case "hepsi": return true;
        case "sabah_aksam": return vardiya === "sabah" || vardiya === "aksam";
        case "sadece_sabah": return vardiya === "sabah";
        case "sadece_aksam": return vardiya === "aksam";
        case "sadece_gece": return vardiya === "gece";
        default: return false;
    }
}

// onceki: dünkü vardiya ({isim: vardiya}). Akşam (16-00) çalışan ertesi gece (00-08) çalışamaz.
function calisabilir(isim, vardiya, tarih, onceki) {
    if (izinKontrol(isim, tarih)) return false;
    if (!yetkinlikKontrol(isim, vardiya)) return false;
    if (!kuralKontrol(isim, vardiya, tarih)) return false;
    if (vardiya === "gece" && onceki[isim] === "aksam") return false;
    return true;
}

// ============ VERİ KAYIT / YÜKLEME ============
function yerelOku(anahtar) {
    try {
        const v = localStorage.getItem(anahtar);
        return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
}

async function veriKaydet() {
    localStorage.setItem("guzelel_personeller", JSON.stringify(personeller));
    localStorage.setItem("guzelel_izinler", JSON.stringify(izinler));
    localStorage.setItem("guzelel_hafiza", JSON.stringify(vardiyaHafizasi));
    localStorage.setItem("guzelel_kurallar", JSON.stringify(kurallar));
    localStorage.setItem("guzelel_market_personeller", JSON.stringify(marketPersoneller));
    if (!db) return;
    try {
        await Promise.all([
            setDoc(doc(db, "personeller", "liste"), { data: personeller }),
            setDoc(doc(db, "izinler", "liste"), { data: izinler }),
            setDoc(doc(db, "kurallar", "liste"), { data: kurallar }),
            setDoc(doc(db, "hafiza", "gecmis"), { data: vardiyaHafizasi }),
            setDoc(doc(db, "market_personeller", "liste"), { data: marketPersoneller })
        ]);
    } catch (e) { console.error("Firebase kayıt hatası", e); }
}

async function veriYukle() {
    // Önce yerel veri; bulut verisi varsa üzerine yazar. Bulut ulaşılamazsa yerel veri korunur.
    personeller = yerelOku("guzelel_personeller") || kopya(defaultPersoneller);
    izinler = yerelOku("guzelel_izinler") || [];
    vardiyaHafizasi = yerelOku("guzelel_hafiza") || [];
    kurallar = yerelOku("guzelel_kurallar") || [];
    marketPersoneller = yerelOku("guzelel_market_personeller") || [];
    if (!db) return;
    try {
        const oku = async (koleksiyon, belge) => {
            const snap = await getDoc(doc(db, koleksiyon, belge));
            return snap.exists() ? snap.data().data : null;
        };
        const [p, i, h, k, mp] = await Promise.all([
            oku("personeller", "liste"), oku("izinler", "liste"), oku("hafiza", "gecmis"),
            oku("kurallar", "liste"), oku("market_personeller", "liste")
        ]);
        if (p) personeller = p;
        if (i) izinler = i;
        if (h) vardiyaHafizasi = h;
        if (k) kurallar = k;
        if (mp) marketPersoneller = mp;
    } catch (e) { console.error("Firebase yükleme hatası", e); }
}

function takvimAnahtari(onek, baslangic, adet) {
    return `${onek}_${tarihAnahtar(baslangic)}_${adet}`;
}

async function takvimKaydet(onek, koleksiyon, baslangic, adet, veri) {
    const key = takvimAnahtari(onek, baslangic, adet);
    localStorage.setItem(key, JSON.stringify(veri));
    if (!db) return;
    try { await setDoc(doc(db, koleksiyon, key), { data: veri }); } catch (e) { console.error("Takvim kaydedilemedi", e); }
}

async function takvimOku(onek, koleksiyon, baslangic, adet) {
    const key = takvimAnahtari(onek, baslangic, adet);
    const yerel = yerelOku(key);
    if (Array.isArray(yerel) && yerel.length) return yerel;
    if (!db) return null;
    try {
        const snap = await getDoc(doc(db, koleksiyon, key));
        if (snap.exists()) {
            const veri = snap.data().data;
            if (Array.isArray(veri) && veri.length) return veri;
        }
    } catch (e) { console.error("Takvim yüklenemedi", e); }
    return null;
}

async function takvimSil(onek, koleksiyon, baslangic, adet) {
    const key = takvimAnahtari(onek, baslangic, adet);
    localStorage.removeItem(key);
    if (!db) return;
    try { await setDoc(doc(db, koleksiyon, key), { data: [] }); } catch (e) { console.error("Takvim silinemedi", e); }
}

// ============ BENZİNLİK VARDİYA ÜRETİMİ ============
function oncekiGunVardiyalari(baslangic) {
    const dun = tarihAnahtar(gunEkle(baslangic, -1));
    const onceki = {};
    for (const h of vardiyaHafizasi) {
        if (tarihAnahtar(h.tarih) === dun) onceki[h.personel] = h.vardiya;
    }
    return onceki;
}

function vardiyaOlusturYeni(gunAdet, baslangic, hafizaKullan) {
    const sayac = {};
    personeller.forEach(p => sayac[p.isim] = { gece: 0, sabah: 0, aksam: 0, toplam: 0 });
    let onceki = hafizaKullan ? oncekiGunVardiyalari(baslangic) : {};
    // Personel yetmezse sırayla akşam ve sabah kadrosu azaltılır (gece her zaman 2 kişi olmalı)
    const slotSecenekleri = [
        ['gece', 'gece', 'sabah', 'sabah', 'sabah', 'aksam', 'aksam', 'aksam'],
        ['gece', 'gece', 'sabah', 'sabah', 'sabah', 'aksam', 'aksam'],
        ['gece', 'gece', 'sabah', 'sabah', 'aksam', 'aksam'],
        ['gece', 'gece', 'sabah', 'sabah', 'aksam']
    ];
    const vardiyalar = [];
    const uyarilar = [];

    for (let gun = 0; gun < gunAdet; gun++) {
        const tarih = gunEkle(baslangic, gun);
        let atama, kullanilan, dugum, slotlar;

        const coz = (i) => {
            if (i === slotlar.length) return true;
            if (++dugum > 50000) return false;
            const v = slotlar[i];
            const kadinSayisi = atama[v].filter(n => personelBul(n).cinsiyet === "K").length;
            const adaylar = personeller
                .map((p, idx) => ({ p, idx }))
                .filter(({ p }) => !kullanilan.has(p.isim) && calisabilir(p.isim, v, tarih, onceki)
                    && !(p.cinsiyet === "K" && kadinSayisi >= MAX_KADIN))
                .sort((a, b) => {
                    const puan = ({ p, idx }) => sayac[p.isim].toplam * 100 + sayac[p.isim][v] * 10 + ((idx - gun) % personeller.length + personeller.length) % personeller.length;
                    return puan(a) - puan(b);
                });
            for (const { p } of adaylar) {
                atama[v].push(p.isim);
                kullanilan.add(p.isim);
                if (coz(i + 1)) return true;
                atama[v].pop();
                kullanilan.delete(p.isim);
            }
            return false;
        };

        let cozuldu = false;
        for (let s = 0; s < slotSecenekleri.length && !cozuldu; s++) {
            slotlar = slotSecenekleri[s];
            atama = { gece: [], sabah: [], aksam: [] };
            kullanilan = new Set();
            dugum = 0;
            cozuldu = coz(0);
            if (cozuldu && s > 0) uyarilar.push(`${tarih.toLocaleDateString('tr-TR')}: personel yetersiz, kadro eksik (${atama.gece.length}/${atama.sabah.length}/${atama.aksam.length})`);
        }
        if (!cozuldu) {
            return { hata: `${tarih.toLocaleDateString('tr-TR')} için kurallara uygun vardiya dağılımı bulunamadı (yeterli personel/yetkinlik yok).` };
        }

        const yeniOnceki = {};
        for (const v of ['gece', 'sabah', 'aksam']) {
            for (const n of atama[v]) { sayac[n][v]++; sayac[n].toplam++; yeniOnceki[n] = v; }
        }
        onceki = yeniOnceki;

        vardiyalar.push({
            tarih,
            gece: atama.gece,
            sabah: atama.sabah,
            aksam: atama.aksam,
            izinli: personeller.map(p => p.isim).filter(n => !yeniOnceki[n]),
            haftasonu: tarih.getDay() === 0 || tarih.getDay() === 6
        });
    }
    return { vardiyalar, uyarilar };
}

function benzinlikParametreleri() {
    let gunSayisi = parseInt($('gunSayisi').value);
    if (!(gunSayisi >= 1)) gunSayisi = 14;
    gunSayisi = Math.min(gunSayisi, 90);
    const baslangic = tarihCoz($('baslangicTarihi').value) || bugun();
    return { gunSayisi, baslangic };
}

function takvimiGoster(v, mesaj) {
    vardiyalarGuncel = v;
    originalVardiyalar = kopya(v);
    tabloyuGoster(v);
    istatistikGoster(v);
    $('tabloKarti').style.display = 'block';
    mesajGoster('kontrolMesaji', 'basarili', mesaj);
}

function hafizayiGuncelle(vardiyalar) {
    vardiyaHafizasi = [];
    for (const v of vardiyalar) {
        const t = tarihAnahtar(v.tarih);
        for (const tip of ['gece', 'sabah', 'aksam']) {
            for (const p of v[tip]) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: tip, haftasonu: v.haftasonu });
        }
    }
}

// zorla=true: kayıtlı takvimi yok sayıp yeniden üretir
async function takvimOlustur(zorla = false) {
    if (duzenlemeModu) duzenlemeModunuKapat();
    const { gunSayisi, baslangic } = benzinlikParametreleri();
    const hafizaKullan = $('hafizaKullan').value === 'evet';

    if (hafizaKullan && zorla !== true) {
        const kayitli = await takvimOku("guzelel_takvim", "takvimler", baslangic, gunSayisi);
        const gecerli = kayitli && kayitli.every(v => ['gece', 'sabah', 'aksam'].every(t => Array.isArray(v[t])));
        if (gecerli) {
            const v = kayitli.map(x => ({ ...x, tarih: new Date(x.tarih), izinli: x.izinli || [] }));
            sonBaslangic = baslangic; sonGunSayisi = gunSayisi;
            takvimiGoster(v, '✅ Kayıtlı takvim yüklendi.');
            return;
        }
    }

    const sonuc = vardiyaOlusturYeni(gunSayisi, baslangic, hafizaKullan);
    if (sonuc.hata) {
        mesajGoster('kontrolMesaji', 'uyari', '⚠️ ' + sonuc.hata);
        $('tabloKarti').style.display = 'block';
        $('tabloAlan').innerHTML = '';
        $('istatistikAlan').style.display = 'none';
        vardiyalarGuncel = [];
        return;
    }
    sonBaslangic = baslangic; sonGunSayisi = gunSayisi;
    takvimiGoster(sonuc.vardiyalar, '✅ Yeni vardiyalar oluşturuldu. Kaydetmek için Düzenle → Onayla.');
    if (sonuc.uyarilar.length) {
        $('kontrolMesaji').innerHTML += `<div class="uyari">⚠️ ${esc(sonuc.uyarilar.slice(0, 5).join(' | '))}${sonuc.uyarilar.length > 5 ? ` (+${sonuc.uyarilar.length - 5} gün daha)` : ''}</div>`;
    }
}

// ============ BENZİNLİK TABLO ============
function etiket(p) {
    const kadin = getKadinlar().includes(p);
    return `<span class="personel-etiket ${kadin ? 'kadin' : 'erkek'}" data-p="${esc(p)}">${esc(p)}</span>`;
}

function tabloyuGoster(vardiyalar) {
    if (!Array.isArray(vardiyalar) || vardiyalar.length === 0) {
        $('tabloAlan').innerHTML = '<div class="uyari">Henüz vardiya oluşturulmamış.</div>';
        return;
    }
    let html = `<table class="vardiya-tablosu"><thead><tr><th>TARİH / GÜN</th><th>🌙 GECE<br><span style="font-size:10px;">${saatler.gece}</span></th>
            <th>☀️ SABAH<br><span style="font-size:10px;">${saatler.sabah}</span></th>
            <th>🌆 AKŞAM<br><span style="font-size:10px;">${saatler.aksam}</span></th>
            <th>📌 İZİNLİLER</th></tr></thead><tbody>`;
    vardiyalar.forEach((v, i) => {
        const t = new Date(v.tarih);
        const hsNot = (t.getDay() === 0 || t.getDay() === 6) ? ' 🟡' : '';
        const izinli = v.izinli || [];
        html += `<tr data-gun="${i}">
            <td class="tarih-hucre"><strong>${tarihEtiketi(t)}${hsNot}</strong></td>
            <td class="gece-hucre" data-vardiya="gece">${(v.gece || []).map(etiket).join('')}</td>
            <td class="sabah-hucre" data-vardiya="sabah">${(v.sabah || []).map(etiket).join('')}</td>
            <td class="aksam-hucre" data-vardiya="aksam">${(v.aksam || []).map(etiket).join('')}</td>
            <td style="background:#fff1cf;" class="benz-izinli-td" data-gun="${i}">
                <div class="izinli-listesi">
                    ${izinli.length ? izinli.map(p => `<span class="personel-etiket izin benz-izinli-item" data-gun="${i}" data-izinli="${esc(p)}">📌 ${esc(p)}${duzenlemeModu ? ` <span style="font-size:10px; cursor:pointer;" class="izinli-cikar" data-p="${esc(p)}">✖</span>` : ''}</span>`).join('') : '<span class="izinli-ekle-placeholder">(izinli yok)</span>'}
                </div>
                ${duzenlemeModu ? `<button class="izinli-ekle-btn" data-gun="${i}" style="margin-top:5px; padding:2px 8px; font-size:10px;">➕ İzinli Ekle</button>` : ''}
            </td>
        </tr>`;
    });
    html += `</tbody></table>`;
    $('tabloAlan').innerHTML = html;

    if (!duzenlemeModu) return;
    document.querySelectorAll('.gece-hucre span, .sabah-hucre span, .aksam-hucre span').forEach(span => {
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => { e.stopPropagation(); acDropdown(span); });
    });
    document.querySelectorAll('.izinli-ekle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); benzIzinliEkle(parseInt(btn.dataset.gun), btn); });
    });
    document.querySelectorAll('.izinli-cikar').forEach(span => {
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            benzIzinliCikar(parseInt(span.closest('.benz-izinli-td').dataset.gun), span.dataset.p);
        });
    });
    document.querySelectorAll('.benz-izinli-item').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
            if (e.target.classList.contains('izinli-cikar')) return;
            e.stopPropagation();
            benzIzinliDegistir(parseInt(el.dataset.gun), el.dataset.izinli, el);
        });
    });
}

// ============ ORTAK AÇILIR MENÜ ============
// secenekler: [{ metin, islem, baslik }]
function menuAc(anchor, secenekler, sinif = 'personel-dropdown') {
    menuKapat();
    const dropdown = document.createElement('div');
    dropdown.className = sinif;
    const rect = anchor.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    for (const s of secenekler) {
        const opt = document.createElement('div');
        opt.textContent = s.metin;
        if (s.baslik) { opt.style.fontWeight = 'bold'; opt.style.background = '#f0f0f0'; opt.style.cursor = 'default'; }
        else opt.onclick = () => { menuKapat(); s.islem(); };
        dropdown.appendChild(opt);
    }
    document.body.appendChild(dropdown);
    aktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (!dropdown.contains(e.target) && !anchor.contains(e.target)) {
                if (aktifDropdown === dropdown) menuKapat();
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

function menuKapat() {
    if (aktifDropdown) aktifDropdown.remove();
    aktifDropdown = null;
}

function degisiklikIsaretle() {
    tabloyuGoster(vardiyalarGuncel);
    $('kaydetBtn').style.display = 'inline-block';
    mesajGoster('kontrolMesaji', 'uyari', '✏️ Değişiklik yapıldı. Onaylayın.');
}

// ============ BENZİNLİK DÜZENLEME ============
function benzIzinliEkle(gun, anchor) {
    const mevcut = vardiyalarGuncel[gun].izinli;
    const adaylar = personeller.map(p => p.isim).filter(n => !mevcut.includes(n));
    if (!adaylar.length) { alert("Eklenebilecek personel kalmadı."); return; }
    menuAc(anchor, adaylar.map(a => ({
        metin: `➕ ${a}`,
        islem: () => { vardiyalarGuncel[gun].izinli.push(a); degisiklikIsaretle(); }
    })));
}

function benzIzinliCikar(gun, personel) {
    const liste = vardiyalarGuncel[gun].izinli;
    const idx = liste.indexOf(personel);
    if (idx !== -1) liste.splice(idx, 1);
    degisiklikIsaretle();
}

function benzIzinliDegistir(gun, eski, anchor) {
    const liste = vardiyalarGuncel[gun].izinli;
    const adaylar = personeller.map(p => p.isim).filter(n => n !== eski && !liste.includes(n));
    if (!adaylar.length) { alert("Değiştirilebilecek personel yok."); return; }
    menuAc(anchor, adaylar.map(a => ({
        metin: `🔄 ${a}`,
        islem: () => { liste[liste.indexOf(eski)] = a; degisiklikIsaretle(); }
    })));
}

// Bir vardiyanın yeni listesini kurallara göre doğrular; hata metni ya da null döner.
function vardiyaListesiDogrula(gun, vardiya, yeniListe) {
    const v = vardiyalarGuncel[gun];
    const tarih = new Date(v.tarih);
    const dun = gun > 0 ? vardiyalarGuncel[gun - 1] : null;
    const diger = ['gece', 'sabah', 'aksam'].filter(t => t !== vardiya).flatMap(t => v[t]);
    if (new Set(yeniListe).size !== yeniListe.length) return "Aynı kişi birden fazla yazılmış.";
    let kadin = 0;
    for (const n of yeniListe) {
        const p = personelBul(n);
        if (!p) return `${n} sistemde yok!`;
        if (diger.includes(n)) return `${n} aynı gün başka vardiyada çalışıyor.`;
        if (izinKontrol(n, tarih)) return `${n} bu tarihte yıllık izinli.`;
        if (!yetkinlikKontrol(n, vardiya) || !kuralKontrol(n, vardiya, tarih)) return `${n} bu vardiyada çalışamaz!`;
        if (vardiya === 'gece' && dun && dun.aksam.includes(n)) return `${n} dün akşam çalıştı, gece çalışamaz (8 saat dinlenme).`;
        if (p.cinsiyet === 'K') kadin++;
    }
    if (kadin > MAX_KADIN) return `Bir vardiyada en fazla ${MAX_KADIN} kadın çalışabilir.`;
    return null;
}

function vardiyaListesiUygula(gun, vardiya, yeniListe) {
    const hata = vardiyaListesiDogrula(gun, vardiya, yeniListe);
    if (hata) { alert(hata); return; }
    const v = vardiyalarGuncel[gun];
    v[vardiya] = yeniListe;
    const calisan = new Set([...v.gece, ...v.sabah, ...v.aksam]);
    v.izinli = personeller.map(p => p.isim).filter(n => !calisan.has(n));
    degisiklikIsaretle();
}

function acDropdown(span) {
    if (!duzenlemeModu) return;
    const eski = span.dataset.p;
    const td = span.closest('td');
    const gun = parseInt(td.closest('tr').dataset.gun);
    const vardiya = td.dataset.vardiya;
    const mevcut = vardiyalarGuncel[gun][vardiya];
    const tarih = new Date(vardiyalarGuncel[gun].tarih);
    const digerCalisan = ['gece', 'sabah', 'aksam'].filter(t => t !== vardiya).flatMap(t => vardiyalarGuncel[gun][t]);
    const adaylar = personeller.map(p => p.isim)
        .filter(n => !mevcut.includes(n) && !digerCalisan.includes(n) && !izinKontrol(n, tarih)
            && yetkinlikKontrol(n, vardiya) && kuralKontrol(n, vardiya, tarih));

    const secenekler = [{ baslik: true, metin: `📋 Mevcut (${mevcut.length} kişi): ${mevcut.join(', ')}` }];
    secenekler.push({
        metin: '✏️ Listeyi Düzenle (virgülle ayır)',
        islem: () => {
            const str = prompt("Personel isimlerini virgülle ayırarak yazın:", mevcut.join(', '));
            if (str === null) return;
            const liste = str.split(',').map(p => p.trim().toLocaleUpperCase('tr-TR')).filter(Boolean);
            vardiyaListesiUygula(gun, vardiya, liste);
        }
    });
    adaylar.forEach(a => secenekler.push({
        metin: `🔁 ${eski} → ${a}`,
        islem: () => vardiyaListesiUygula(gun, vardiya, mevcut.map(n => n === eski ? a : n))
    }));
    adaylar.forEach(a => secenekler.push({
        metin: `➕ ${a} ekle`,
        islem: () => vardiyaListesiUygula(gun, vardiya, [...mevcut, a])
    }));
    secenekler.push({
        metin: `❌ ${eski} çıkar`,
        islem: () => vardiyaListesiUygula(gun, vardiya, mevcut.filter(n => n !== eski))
    });
    menuAc(span, secenekler);
}

// ============ ONAYLAMA, İPTAL, SIFIRLAMA ============
async function degisiklikleriOnayla() {
    hafizayiGuncelle(vardiyalarGuncel);
    originalVardiyalar = kopya(vardiyalarGuncel);
    const saklanacak = vardiyalarGuncel.map(v => ({
        tarih: new Date(v.tarih).toISOString(),
        gece: [...v.gece], sabah: [...v.sabah], aksam: [...v.aksam],
        izinli: [...(v.izinli || [])], haftasonu: v.haftasonu
    }));
    await takvimKaydet("guzelel_takvim", "takvimler", sonBaslangic, sonGunSayisi, saklanacak);
    await veriKaydet();
    duzenlemeModunuKapat();
    istatistikGoster(vardiyalarGuncel);
    mesajGoster('kontrolMesaji', 'basarili', '✅ Değişiklikler onaylandı ve kaydedildi.');
}

function duzenlemeModunuAc() {
    if (!vardiyalarGuncel.length) return;
    duzenlemeModu = true;
    $('duzenleBtn').style.display = 'none';
    $('kaydetBtn').style.display = 'inline-block';
    $('iptalBtn').style.display = 'inline-block';
    $('durumText').innerHTML = '✏️ DÜZENLEME MODU – Personel ismine tıklayın';
    $('durumText').style.color = '#e67e22';
    tabloyuGoster(vardiyalarGuncel);
}

function duzenlemeModunuKapat() {
    duzenlemeModu = false;
    menuKapat();
    $('duzenleBtn').style.display = 'inline-block';
    $('kaydetBtn').style.display = 'none';
    $('iptalBtn').style.display = 'none';
    $('durumText').innerHTML = '📋 Görüntüleme Modu';
    $('durumText').style.color = '#1e466e';
    tabloyuGoster(vardiyalarGuncel);
}

function degisiklikleriIptal() {
    if (originalVardiyalar) {
        vardiyalarGuncel = kopya(originalVardiyalar).map(v => ({ ...v, tarih: new Date(v.tarih) }));
    }
    duzenlemeModunuKapat();
    istatistikGoster(vardiyalarGuncel);
    mesajGoster('kontrolMesaji', 'uyari', '🔄 İptal edildi, son onaylanmış duruma dönüldü.');
}

async function sifirlaTumDegisiklikler() {
    if (!confirm("Kayıtlı takvim silinecek ve vardiyalar yeniden oluşturulacak. Emin misiniz?")) return;
    const { gunSayisi, baslangic } = benzinlikParametreleri();
    await takvimSil("guzelel_takvim", "takvimler", baslangic, gunSayisi);
    await takvimOlustur(true);
}

function istatistikGoster(vardiyalar) {
    const alan = $('istatistikAlan');
    if (!Array.isArray(vardiyalar) || !vardiyalar.length) { alan.style.display = 'none'; return; }
    const calisma = {};
    personeller.forEach(p => calisma[p.isim] = { gece: 0, sabah: 0, aksam: 0, toplam: 0, hs: 0 });
    for (const v of vardiyalar) {
        for (const tip of ['gece', 'sabah', 'aksam']) {
            for (const p of (v[tip] || [])) {
                if (!calisma[p]) continue;
                calisma[p][tip]++; calisma[p].toplam++;
                if (v.haftasonu) calisma[p].hs++;
            }
        }
    }
    let html = `<h3>📊 PERSONEL ÇALIŞMA İSTATİSTİKLERİ (${vardiyalar.length} Gün)</h3><div class="istatistik-grid">`;
    for (const [isim, d] of Object.entries(calisma)) {
        const cins = personelBul(isim)?.cinsiyet;
        const ort = (d.toplam / vardiyalar.length).toFixed(1);
        html += `<div style="background:white; border-radius:16px; padding:12px; border-left:5px solid ${cins === 'E' ? '#2980b9' : '#e84393'}">
            <strong>${cins === 'E' ? '👨' : '👩'} ${esc(isim)}</strong><br>
            🌙 Gece: ${d.gece} | ☀️ Sabah: ${d.sabah} | 🌆 Akşam: ${d.aksam}<br>
            📊 Toplam: ${d.toplam} (Günlük ort: ${ort})<br>
            🏖️ Hafta Sonu: ${d.hs} gün
        </div>`;
    }
    alan.innerHTML = html + `</div>`;
    alan.style.display = 'block';
}

// ============ CRUD (Benzinlik) ============
const YETKINLIK_ADLARI = {
    hepsi: 'Tüm Vardiyalar', sabah_aksam: 'Sabah+Akşam', sadece_sabah: 'Sadece Sabah',
    sadece_aksam: 'Sadece Akşam', sadece_gece: 'Sadece Gece'
};

function personelListesiniGoster() {
    $('personelListesi').innerHTML = personeller.map((p, idx) => `
        <div class="personel-card ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}">
            ${p.cinsiyet === 'E' ? '👨' : '👩'} <strong>${esc(p.isim)}</strong>
            <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:20px;">${YETKINLIK_ADLARI[p.yetkinlik] || p.yetkinlik}</span>
            <button onclick="personelSil(${idx})">✖</button>
        </div>`).join('');
    const secenekler = '<option value="">Personel seçin</option>' + personeller.map(p => `<option value="${esc(p.isim)}">${esc(p.isim)} (${p.cinsiyet === 'E' ? 'Erkek' : 'Kadın'})</option>`).join('');
    $('izinPersonel').innerHTML = secenekler;
    $('kuralPersonel').innerHTML = secenekler;
}

function izinListesiniGoster() {
    const c = $('izinListesi');
    if (!izinler.length) { c.innerHTML = '<span style="color:#64748b;">Henüz izin yok</span>'; return; }
    c.innerHTML = izinler.map((iz, idx) => `<div class="izin-item"><span><strong>${esc(iz.personel)}</strong> | ${tarihCoz(iz.baslangic).toLocaleDateString('tr-TR')} - ${tarihCoz(iz.bitis).toLocaleDateString('tr-TR')}</span><button onclick="izinSil(${idx})">🗑️</button></div>`).join('');
}

function kuralListesiniGoster() {
    const c = $('kuralListesi');
    if (!kurallar.length) { c.innerHTML = '<span style="color:#64748b;">Henüz kural yok</span>'; return; }
    c.innerHTML = kurallar.map((k, idx) => {
        const aciklama = `[${k.tip === 'genel' ? 'Genel' : esc(k.personel)}] ${k.kural.replace(/_/g, ' ')}`;
        return `<div class="izin-item"><span><strong>${aciklama}</strong></span><button onclick="kuralSil(${idx})">🗑️</button></div>`;
    }).join('');
}

// Veri değişince kayıtlı takvim geçersiz olur; yeniden üretilir.
async function verisiDegisti() {
    await veriKaydet();
    if ($('tabloKarti').style.display !== 'none') await takvimOlustur(true);
}

window.personelSil = async (idx) => {
    if (!confirm(`${personeller[idx].isim} silinsin mi?`)) return;
    const isim = personeller[idx].isim;
    personeller.splice(idx, 1);
    izinler = izinler.filter(i => i.personel !== isim);
    kurallar = kurallar.filter(k => k.personel !== isim);
    vardiyaHafizasi = [];
    personelListesiniGoster(); izinListesiniGoster(); kuralListesiniGoster();
    await verisiDegisti();
};
window.izinSil = async (idx) => {
    izinler.splice(idx, 1);
    izinListesiniGoster();
    await verisiDegisti();
};
window.kuralSil = async (idx) => {
    kurallar.splice(idx, 1);
    kuralListesiniGoster();
    await verisiDegisti();
};

async function personelEkle() {
    const isim = $('yeniIsim').value.trim().toLocaleUpperCase('tr-TR');
    if (!isim) { alert("Personel adı girin"); return; }
    if (personeller.some(p => p.isim === isim)) { alert("Bu personel zaten var"); return; }
    personeller.push({ isim, cinsiyet: $('yeniCinsiyet').value, yetkinlik: $('yeniYetkinlik').value });
    $('yeniIsim').value = '';
    personelListesiniGoster();
    await verisiDegisti();
}

async function izinEkle() {
    const per = $('izinPersonel').value, bas = $('izinBaslangic').value, bit = $('izinBitis').value;
    if (!per || !bas || !bit) { alert("Tüm alanları doldurun"); return; }
    if (bit < bas) { alert("Bitiş tarihi başlangıçtan önce olamaz"); return; }
    izinler.push({ personel: per, baslangic: bas, bitis: bit });
    izinListesiniGoster();
    $('izinPersonel').value = ''; $('izinBaslangic').value = ''; $('izinBitis').value = '';
    await verisiDegisti();
}

async function kuralEkle() {
    const tip = $('kuralTipi').value, personel = $('kuralPersonel').value, kural = $('kuralAdi').value;
    if (tip === 'personel' && !personel) { alert("Personel seçin"); return; }
    const p = tip === 'personel' ? personel : null;
    if (kurallar.some(k => k.tip === tip && k.personel === p && k.kural === kural)) { alert("Bu kural zaten var"); return; }
    kurallar.push({ tip, personel: p, kural });
    kuralListesiniGoster();
    await verisiDegisti();
}

function excelIndir() {
    if (!vardiyalarGuncel.length) { alert("Önce benzinlik takvimi oluşturun"); return; }
    const data = [['GÜZELEL PETROL A.Ş. VARDİYA ÇİZELGESİ'], [`Tarih: ${new Date().toLocaleString('tr-TR')}`], [], ['TARİH', 'GECE', 'SABAH', 'AKŞAM', 'İZİNLİLER']];
    for (const v of vardiyalarGuncel) {
        const t = new Date(v.tarih);
        data.push([`${t.toLocaleDateString('tr-TR')} ${GUN_ADLARI[t.getDay()]}`, (v.gece || []).join(', '), (v.sabah || []).join(', '), (v.aksam || []).join(', '), (v.izinli || []).join(', ')]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Benzinlik");
    XLSX.writeFile(wb, `GUZELEL_Benzinlik_${tarihAnahtar(new Date())}.xlsx`);
}

async function whatsappPaylas() {
    const el = document.querySelector('#tabloAlan table');
    if (!el) { alert("Önce benzinlik takvimi oluşturun"); return; }
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
    canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.download = 'benzinlik_vardiya.png';
        a.href = URL.createObjectURL(blob);
        a.click();
        alert("Tablo resmi indirildi. WhatsApp'tan gönderebilirsiniz.");
        window.open('https://web.whatsapp.com/', '_blank');
    });
}

// ============ MARKET VARDİYASI ============
// Dinlenme kuralı: 00:00'da biten (akşam / 12 saatlik gündüz) personel hemen ardından gece çalışamaz.
function permutasyonlar(a) {
    if (a.length <= 1) return [a];
    return a.flatMap((x, i) => permutasyonlar([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
}

function marketYetkin(p, slot) {
    if (p.yetkinlik === 'ikisi_de') return true;
    return slot === 'gece' ? p.yetkinlik === 'sadece_gece' : p.yetkinlik === 'sadece_gunduz';
}

function marketSayac() {
    const s = {};
    marketPersoneller.forEach(p => s[p.isim] = { gece: 0, gunduz: 0, sabah: 0, aksam: 0 });
    return s;
}

function marketGunuKur(tarih, izinliIsim, oncekiBitiren, sayac) {
    const calisanlar = marketPersoneller.filter(p => p.isim !== izinliIsim);
    const slotlar = izinliIsim ? ['gece', 'gunduz'] : ['gece', 'sabah', 'aksam'];
    const adaylar = permutasyonlar(calisanlar);
    const dinlenmeOk = (perm) => perm[0].isim !== oncekiBitiren;
    const yetkinOk = (perm) => perm.every((p, i) => marketYetkin(p, slotlar[i]));
    const secenekler = [
        adaylar.filter(p => dinlenmeOk(p) && yetkinOk(p)),
        adaylar.filter(dinlenmeOk),
        adaylar
    ];
    const havuz = secenekler.find(h => h.length) || adaylar;
    let en = null, enPuan = Infinity;
    for (const perm of havuz) {
        const puan = perm.reduce((t, p, i) => t + sayac[p.isim][slotlar[i]], 0);
        if (puan < enPuan) { enPuan = puan; en = perm; }
    }
    en.forEach((p, i) => sayac[p.isim][slotlar[i]]++);
    const izinli = izinliIsim ? marketPersoneller.find(p => p.isim === izinliIsim) : null;
    if (izinliIsim) {
        return { tarih, tip: "izin_gunu", gecePersonel: en[0], gunduzPersonel: en[1], izinli };
    }
    return { tarih, tip: "normal", gece8: [en[0]], sabah8: [en[1]], aksam8: [en[2]], izinli: null };
}

function marketBitiren(v) {
    if (!v) return null;
    if (v.tip === "izin_gunu") return v.gunduzPersonel?.isim || null;
    return v.aksam8?.[0]?.isim || null;
}

function marketVardiyaOlustur(haftaSayisi, baslangic) {
    if (marketPersoneller.length !== 3) {
        return { hata: `Market için tam 3 personel gerekli! Mevcut: ${marketPersoneller.length}` };
    }
    const gunler = marketPersoneller.map(p => p.izinGunu);
    if (new Set(gunler).size !== gunler.length) {
        return { hata: "Market personellerinin izin günleri farklı olmalı." };
    }
    const sayac = marketSayac();
    const vardiyalar = [];
    for (let gun = 0; gun < haftaSayisi * 7; gun++) {
        const tarih = gunEkle(baslangic, gun);
        const izinli = marketPersoneller.find(p => p.izinGunu === tarih.getDay());
        vardiyalar.push(marketGunuKur(tarih, izinli ? izinli.isim : null, marketBitiren(vardiyalar[gun - 1]), sayac));
    }
    return { vardiyalar };
}

function marketParametreleri() {
    let hafta = parseInt($('marketHaftaSayisi')?.value);
    if (!(hafta >= 1)) hafta = 4;
    hafta = Math.min(hafta, 12);
    const baslangic = tarihCoz($('marketBaslangicTarihi')?.value) || bugun();
    return { hafta, baslangic };
}

// Kayıtlı veriyi güncel personel nesneleriyle eşler; eşleşmeyen varsa geçersiz sayar.
function marketNormalize(kayit) {
    const bul = (p) => p ? marketPersoneller.find(m => m.isim === p.isim) : null;
    const sonuc = [];
    for (const v of kayit) {
        const tarih = new Date(v.tarih);
        if (v.tip === "izin_gunu") {
            const g = bul(v.gecePersonel), d = bul(v.gunduzPersonel), i = bul(v.izinli);
            if (!g || !d || !i) return null;
            sonuc.push({ tarih, tip: "izin_gunu", gecePersonel: g, gunduzPersonel: d, izinli: i });
        } else if (v.tip === "normal") {
            const a = [v.gece8?.[0], v.sabah8?.[0], v.aksam8?.[0]].map(bul);
            if (a.some(x => !x)) return null;
            sonuc.push({ tarih, tip: "normal", gece8: [a[0]], sabah8: [a[1]], aksam8: [a[2]], izinli: null });
        } else return null;
    }
    return sonuc;
}

function marketPersonelListesiniGoster() {
    const c = $('marketPersonelListesi');
    if (!marketPersoneller.length) { c.innerHTML = '<div class="uyari">⚠️ Henüz market personeli eklenmemiş. Tam 3 personel gerekli.</div>'; return; }
    c.innerHTML = marketPersoneller.map((p, idx) => `
        <div class="personel-card ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}">
            ${p.cinsiyet === 'E' ? '👨' : '👩'} <strong>${esc(p.isim)}</strong>
            <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:20px;">
                ${p.yetkinlik === 'ikisi_de' ? 'Gece+Gündüz' : p.yetkinlik === 'sadece_gece' ? 'Sadece Gece' : 'Sadece Gündüz'} |
                İzin: ${GUN_ADLARI[p.izinGunu]}
            </span>
            <button onclick="marketPersonelSil(${idx})">✖</button>
        </div>`).join('');
}

async function marketPersonelEkle() {
    const isim = $('marketYeniIsim').value.trim().toLocaleUpperCase('tr-TR');
    if (!isim) { alert("Market personel adı girin"); return; }
    if (marketPersoneller.length >= 3) { alert("Market için en fazla 3 personel eklenebilir."); return; }
    if (marketPersoneller.some(p => p.isim === isim)) { alert("Bu market personeli zaten var!"); return; }
    const izinGunu = parseInt($('marketIzinGunu').value);
    if (marketPersoneller.some(p => p.izinGunu === izinGunu)) { alert("Bu izin günü başka bir personele ait. Her personelin izin günü farklı olmalı."); return; }
    marketPersoneller.push({ isim, cinsiyet: $('marketYeniCinsiyet').value, yetkinlik: $('marketYeniYetkinlik').value, izinGunu });
    $('marketYeniIsim').value = '';
    marketPersonelListesiniGoster();
    await veriKaydet();
    await marketTakvimOlustur(true);
}

window.marketPersonelSil = async function (idx) {
    if (!confirm(`${marketPersoneller[idx].isim} silinsin mi?`)) return;
    marketPersoneller.splice(idx, 1);
    marketPersonelListesiniGoster();
    await veriKaydet();
    await marketTakvimOlustur(true);
};

function marketEtiket(p, gun, vardiya, saat) {
    return `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${esc(p.isim)}" data-gun="${gun}" data-vardiya="${vardiya}">${esc(p.isim)}<br><span class="saat-bilgisi">${saat}</span></span>`;
}

function marketTabloyuGoster(vardiyalar) {
    if (!vardiyalar || !vardiyalar.length) {
        $('marketTabloAlan').innerHTML = '<div class="uyari">Henüz market vardiyası oluşturulmamış.</div>';
        return;
    }
    let html = `<table class="market-vardiya-tablosu"><thead>
        <tr><th>TARİH / GÜN</th><th>🌙 GECE (00-08)</th><th>☀️ SABAH (08-16)</th><th>🌆 AKŞAM (16-00)</th><th>📌 İZİNLİLER</th></tr>
        </thead><tbody>`;
    vardiyalar.forEach((v, i) => {
        const izinGunu = v.tip === "izin_gunu";
        html += `<tr data-market-gun="${i}"><td class="tarih-hucre"><strong>${tarihEtiketi(v.tarih)}</strong>${izinGunu ? '<br><span class="izin-gunu-badge">12 SAAT</span>' : ''}</td>`;
        if (!izinGunu) {
            html += `<td class="market-gece">${v.gece8.map(p => marketEtiket(p, i, 'gece8', '00:00-08:00')).join('')}</td>`;
            html += `<td class="market-gunduz">${v.sabah8.map(p => marketEtiket(p, i, 'sabah8', '08:00-16:00')).join('')}</td>`;
            html += `<td class="market-aksam">${v.aksam8.map(p => marketEtiket(p, i, 'aksam8', '16:00-00:00')).join('')}</td>`;
        } else {
            html += `<td class="market-gece">${marketEtiket(v.gecePersonel, i, 'gece12', '00:00-12:00')}</td>`;
            html += `<td class="market-gunduz" colspan="2">${marketEtiket(v.gunduzPersonel, i, 'gunduz12', '12:00-00:00')}</td>`;
        }
        html += `<td style="background:#fdedec;" class="market-izinli-td">${v.izinli ? `<span class="market-izinli-etiket" data-gun="${i}" data-izinli="${esc(v.izinli.isim)}">📌 ${esc(v.izinli.isim)}</span>` : '—'}</td></tr>`;
    });
    $('marketTabloAlan').innerHTML = html + `</tbody></table>`;
    if (!marketDuzenlemeModu) return;
    document.querySelectorAll('.market-personel-etiket').forEach(span => {
        span.style.cursor = 'pointer';
        span.addEventListener('click', (e) => { e.stopPropagation(); marketAcDropdown(span); });
    });
    document.querySelectorAll('.market-izinli-etiket').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => { e.stopPropagation(); marketIzinliSecimDropdown(el); });
    });
}

function marketDegisti(mesaj) {
    marketTabloyuGoster(marketVardiyalarGuncel);
    $('marketKaydetBtn').style.display = 'inline-block';
    mesajGoster('marketKontrolMesaji', 'uyari', mesaj);
}

function marketAlanlari(v) {
    return v.tip === "normal"
        ? { gece8: v.gece8, sabah8: v.sabah8, aksam8: v.aksam8 }
        : { gece12: [v.gecePersonel], gunduz12: [v.gunduzPersonel] };
}

// Seçilen personel yerine aynı gün çalışan başka bir personelle yer değiştirir.
function marketAcDropdown(span) {
    if (!marketDuzenlemeModu) return;
    const eski = span.dataset.p;
    const gun = parseInt(span.dataset.gun);
    const vardiya = span.dataset.vardiya;
    const v = marketVardiyalarGuncel[gun];
    const alanlar = marketAlanlari(v);
    const diger = Object.entries(alanlar).filter(([k]) => k !== vardiya).map(([k, arr]) => [k, arr[0]]);
    menuAc(span, diger.map(([anahtar, kisi]) => ({
        metin: `🔄 ${kisi.isim} ile yer değiştir`,
        islem: () => {
            const benim = marketPersoneller.find(p => p.isim === eski);
            const yaz = (k, p) => {
                if (v.tip === "normal") v[k] = [p];
                else if (k === 'gece12') v.gecePersonel = p;
                else v.gunduzPersonel = p;
            };
            yaz(vardiya, kisi);
            yaz(anahtar, benim);
            marketDegisti('✏️ Değişiklik yapıldı. Onaylayın.');
        }
    })), 'market-personel-dropdown');
}

function marketIzinliSecimDropdown(el) {
    const gun = parseInt(el.dataset.gun);
    const mevcut = el.dataset.izinli;
    menuAc(el, marketPersoneller.filter(p => p.isim !== mevcut).map(p => ({
        metin: `📌 ${p.isim} (izinli yap)`,
        islem: () => marketIzinliDegistir(gun, p.isim)
    })), 'market-personel-dropdown');
}

function marketIzinliDegistir(gun, yeniIzinliIsim) {
    const onceki = gun > 0 ? marketBitiren(marketVardiyalarGuncel[gun - 1]) : null;
    const v = marketVardiyalarGuncel[gun];
    marketVardiyalarGuncel[gun] = marketGunuKur(v.tarih, yeniIzinliIsim, onceki, marketSayac());
    marketDegisti('✏️ İzinli personel değiştirildi. Onaylayın.');
}

async function marketTakvimOlustur(zorla = false) {
    if (marketDuzenlemeModu) marketDuzenlemeModunuKapat();
    const { hafta, baslangic } = marketParametreleri();
    if (zorla !== true) {
        const kayitli = await takvimOku("guzelel_market_takvim", "market_takvimler", baslangic, hafta);
        const v = kayitli ? marketNormalize(kayitli) : null;
        if (v) {
            marketVardiyalarGuncel = v;
            marketTabloyuGoster(v);
            $('marketTabloWrapper').style.display = 'block';
            mesajGoster('marketKontrolMesaji', 'basarili', '✅ Kayıtlı market takvimi yüklendi.');
            return;
        }
    }
    const sonuc = marketVardiyaOlustur(hafta, baslangic);
    if (sonuc.hata) {
        marketVardiyalarGuncel = [];
        $('marketTabloWrapper').style.display = 'none';
        // Sayfa açılışında personel eksikse sessizce bekler; kullanıcı butona bastıysa uyarılır.
        if (marketPersoneller.length === 3 || zorla === 'kullanici') alert(sonuc.hata);
        return;
    }
    marketVardiyalarGuncel = sonuc.vardiyalar;
    marketTabloyuGoster(marketVardiyalarGuncel);
    $('marketTabloWrapper').style.display = 'block';
    mesajGoster('marketKontrolMesaji', 'basarili', '✅ Market vardiyaları oluşturuldu. Kaydetmek için Düzenle → Onayla.');
}

function marketDuzenlemeModunuAc() {
    if (!marketVardiyalarGuncel.length) return;
    marketDuzenlemeModu = true;
    $('marketDuzenleBtn').style.display = 'none';
    $('marketKaydetBtn').style.display = 'inline-block';
    $('marketIptalBtn').style.display = 'inline-block';
    $('marketDurumText').innerHTML = '✏️ DÜZENLEME MODU – Personel/izinliye tıklayın';
    marketTabloyuGoster(marketVardiyalarGuncel);
}

function marketDuzenlemeModunuKapat() {
    marketDuzenlemeModu = false;
    menuKapat();
    $('marketDuzenleBtn').style.display = 'inline-block';
    $('marketKaydetBtn').style.display = 'none';
    $('marketIptalBtn').style.display = 'none';
    $('marketDurumText').innerHTML = '📋 Market Vardiyası';
    marketTabloyuGoster(marketVardiyalarGuncel);
}

async function marketDegisiklikleriKaydet() {
    const { hafta, baslangic } = marketParametreleri();
    const saklanacak = marketVardiyalarGuncel.map(v => v.tip === "normal"
        ? { tip: "normal", tarih: v.tarih.toISOString(), gece8: v.gece8, sabah8: v.sabah8, aksam8: v.aksam8, izinli: null }
        : { tip: "izin_gunu", tarih: v.tarih.toISOString(), gecePersonel: v.gecePersonel, gunduzPersonel: v.gunduzPersonel, izinli: v.izinli });
    await takvimKaydet("guzelel_market_takvim", "market_takvimler", baslangic, hafta, saklanacak);
    marketDuzenlemeModunuKapat();
    mesajGoster('marketKontrolMesaji', 'basarili', '✅ Değişiklikler onaylandı ve kaydedildi.');
}

async function marketDegisiklikleriIptal() {
    marketDuzenlemeModunuKapat();
    await marketTakvimOlustur();
    mesajGoster('marketKontrolMesaji', 'uyari', '🔄 İptal edildi.');
}

// ============ BAŞLATMA ============
function olaylariBagla() {
    $('ekleBtn').addEventListener('click', personelEkle);
    $('izinEkleBtn').addEventListener('click', izinEkle);
    $('kuralEkleBtn').addEventListener('click', kuralEkle);
    $('takvimOlusturBtn').addEventListener('click', () => takvimOlustur());
    $('excelIndirBtn').addEventListener('click', excelIndir);
    $('whatsappBtn').addEventListener('click', whatsappPaylas);
    $('duzenleBtn').addEventListener('click', duzenlemeModunuAc);
    $('kaydetBtn').addEventListener('click', degisiklikleriOnayla);
    $('iptalBtn').addEventListener('click', degisiklikleriIptal);
    $('printBtn').addEventListener('click', () => window.print());
    $('sifirlaBtn').addEventListener('click', sifirlaTumDegisiklikler);

    $('marketEkleBtn').addEventListener('click', marketPersonelEkle);
    $('marketTakvimOlusturBtn').addEventListener('click', () => marketTakvimOlustur('kullanici'));
    $('marketDuzenleBtn').addEventListener('click', marketDuzenlemeModunuAc);
    $('marketKaydetBtn').addEventListener('click', marketDegisiklikleriKaydet);
    $('marketIptalBtn').addEventListener('click', marketDegisiklikleriIptal);

    $('kuralTipi').addEventListener('change', function () {
        $('personelSecimDiv').style.display = this.value === 'personel' ? 'block' : 'none';
    });
}

async function baslat() {
    db = window.db; doc = window.doc; setDoc = window.setDoc; getDoc = window.getDoc;
    olaylariBagla();
    $('baslangicTarihi').value = tarihAnahtar(bugun());
    $('marketBaslangicTarihi').value = tarihAnahtar(bugun());
    await veriYukle();
    personelListesiniGoster();
    izinListesiniGoster();
    kuralListesiniGoster();
    marketPersonelListesiniGoster();
    await takvimOlustur();
    await marketTakvimOlustur();
}

// Firebase modülü 'load' olayından önce yüklenir; yüklenemese bile yerel veriyle çalışılır.
window.addEventListener('load', baslat);

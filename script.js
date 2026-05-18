// ============ FIREBASE & GLOBAL ============
let db;
let doc, setDoc, getDoc;

window.addEventListener('load', () => {
  db = window.db;
  doc = window.doc;
  setDoc = window.setDoc;
  getDoc = window.getDoc;
  veriYukle().then(() => {
    personelListesiniGoster();
    izinListesiniGoster();
    kuralListesiniGoster();
    setTimeout(() => takvimOlustur(), 100);
  });
});

let personeller = [];
let izinler = [];
let vardiyaHafizasi = [];
let kurallar = [];
let duzenlemeModu = false;
let vardiyalarGuncel = [];
let aktifDropdown = null;

const saatler = {
    gece: "00:00-08:00",
    sabah: "08:00-16:00",
    aksam: "16:00-00:00"
};

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

function getErkekler() { return personeller.filter(p => p.cinsiyet === "E").map(p => p.isim); }
function getKadinlar() { return personeller.filter(p => p.cinsiyet === "K").map(p => p.isim); }

function izinKontrol(isim, tarih) {
    for (let izin of izinler) {
        if (izin.personel !== isim) continue;
        let bas = new Date(izin.baslangic);
        let bit = new Date(izin.bitis);
        if (tarih >= bas && tarih <= bit) return true;
    }
    return false;
}

function kuralKontrol(isim, vardiyaTipi, tarih) {
    for (let k of kurallar) {
        if (k.tip === "genel") {
            if (k.kural === "haftasonu_gece_yasak" && vardiyaTipi === "gece" && (tarih.getDay() === 0 || tarih.getDay() === 6)) return false;
        } else if (k.tip === "personel" && k.personel === isim) {
            if (k.kural === "sadece_sabah" && vardiyaTipi !== "sabah") return false;
            if (k.kural === "sadece_aksam" && vardiyaTipi !== "aksam") return false;
            if (k.kural === "sadece_gece" && vardiyaTipi !== "gece") return false;
            if (k.kural === "gece_yasak" && vardiyaTipi === "gece") return false;
            if (k.kural === "haftasonu_gece_yasak" && vardiyaTipi === "gece" && (tarih.getDay() === 0 || tarih.getDay() === 6)) return false;
            if (k.kural === "pazartesi_izin" && tarih.getDay() === 1) return false;
        }
    }
    return true;
}

function yetkinlikKontrol(isim, vardiya) {
    let p = personeller.find(p => p.isim === isim);
    if (!p) return true;
    if (p.yetkinlik === "hepsi") return true;
    if (vardiya === "gece" && p.cinsiyet === "K") return false;
    if (p.yetkinlik === "sabah_aksam" && (vardiya === "sabah" || vardiya === "aksam")) return true;
    if (p.yetkinlik === "sadece_sabah" && vardiya === "sabah") return true;
    if (p.yetkinlik === "sadece_aksam" && vardiya === "aksam") return true;
    if (p.yetkinlik === "sadece_gece" && vardiya === "gece") return true;
    return false;
}

function izinliAkşamKuraliDuzelt(vardiyalar) {
    for (let i = 1; i < vardiyalar.length; i++) {
        let onceki = vardiyalar[i-1];
        let bugun = vardiyalar[i];
        if (bugun.izinli && bugun.izinli.length > 0) {
            for (let izinli of bugun.izinli) {
                if (!onceki.aksam.includes(izinli)) {
                    onceki.aksam.push(izinli);
                    console.log(`Düzeltme: ${izinli} bugün izinli olduğu için ${onceki.tarih.toLocaleDateString()} akşam vardiyasına eklendi.`);
                }
            }
        }
    }
    return vardiyalar;
}

async function veriKaydet() {
    localStorage.setItem("guzelel_personeller", JSON.stringify(personeller));
    localStorage.setItem("guzelel_izinler", JSON.stringify(izinler));
    localStorage.setItem("guzelel_hafiza", JSON.stringify(vardiyaHafizasi));
    localStorage.setItem("guzelel_kurallar", JSON.stringify(kurallar));
    localStorage.setItem("guzelel_market_personeller", JSON.stringify(marketPersoneller));
    if (!db) return;
    try {
        await setDoc(doc(db, "personeller", "liste"), { data: personeller });
        await setDoc(doc(db, "izinler", "liste"), { data: izinler });
        await setDoc(doc(db, "kurallar", "liste"), { data: kurallar });
        await setDoc(doc(db, "hafiza", "gecmis"), { data: vardiyaHafizasi });
        await setDoc(doc(db, "market_personeller", "liste"), { data: marketPersoneller });
    } catch(e) { console.error("Firebase kayıt hatası", e); }
}

async function veriYukle() {
    if (!db) {
        let p = localStorage.getItem("guzelel_personeller");
        personeller = p ? JSON.parse(p) : JSON.parse(JSON.stringify(defaultPersoneller));
        let i = localStorage.getItem("guzelel_izinler");
        izinler = i ? JSON.parse(i) : [];
        let h = localStorage.getItem("guzelel_hafiza");
        vardiyaHafizasi = h ? JSON.parse(h) : [];
        let k = localStorage.getItem("guzelel_kurallar");
        kurallar = k ? JSON.parse(k) : [];
        let mp = localStorage.getItem("guzelel_market_personeller");
        if (mp) marketPersoneller = JSON.parse(mp);
        return;
    }
    try {
        let pDoc = await getDoc(doc(db, "personeller", "liste"));
        personeller = pDoc.exists() ? pDoc.data().data : JSON.parse(JSON.stringify(defaultPersoneller));
        let iDoc = await getDoc(doc(db, "izinler", "liste"));
        izinler = iDoc.exists() ? iDoc.data().data : [];
        let hDoc = await getDoc(doc(db, "hafiza", "gecmis"));
        vardiyaHafizasi = hDoc.exists() ? hDoc.data().data : [];
        let kDoc = await getDoc(doc(db, "kurallar", "liste"));
        kurallar = kDoc.exists() ? kDoc.data().data : [];
        let mpDoc = await getDoc(doc(db, "market_personeller", "liste"));
        if (mpDoc.exists()) marketPersoneller = mpDoc.data().data;
    } catch(e) { console.error("Firebase yükleme hatası", e); }
}

async function kaydetTakvim(vardiyalar, baslangic, gunSayisi) {
    let tarihStr = baslangic instanceof Date ? baslangic.toISOString().slice(0,10) : baslangic;
    let key = `guzelel_takvim_${tarihStr}_${gunSayisi}`;
    let saklanacak = vardiyalar.map(v => ({
        tarih: v.tarih.toISOString(),
        gece: [...v.gece],
        sabah: [...v.sabah],
        aksam: [...v.aksam],
        izinli: [...v.izinli],
        haftasonu: v.haftasonu
    }));
    localStorage.setItem(key, JSON.stringify(saklanacak));
    if (!db) return;
    try { await setDoc(doc(db, "takvimler", key), { data: saklanacak }); } catch(e) { console.error("Takvim kaydedilemedi", e); }
}

async function yukleTakvim(baslangic, gunSayisi) {
    let tarihStr = baslangic instanceof Date ? baslangic.toISOString().slice(0,10) : baslangic;
    let key = `guzelel_takvim_${tarihStr}_${gunSayisi}`;
    let data = localStorage.getItem(key);
    if (data) {
        let parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length && parsed[0].hasOwnProperty('gece')) {
            return parsed.map(v => ({ ...v, tarih: new Date(v.tarih) }));
        }
    }
    if (!db) return null;
    try {
        let docSnap = await getDoc(doc(db, "takvimler", key));
        if (docSnap.exists()) {
            let fireData = docSnap.data().data;
            if (Array.isArray(fireData) && fireData.length && fireData[0].hasOwnProperty('gece')) {
                return fireData.map(v => ({ ...v, tarih: new Date(v.tarih) }));
            }
        }
    } catch(e) { console.error("Takvim yüklenemedi", e); }
    return null;
}

function vardiyaOlusturYeni(gunAdet, baslangic) {
    let vardiyalar = [];
    let erkekler = getErkekler();
    let kadinlar = getKadinlar();
    let tumPersonel = personeller.map(p => p.isim);
    let kaydirma = 0;
    for (let gun = 0; gun < gunAdet; gun++) {
        let tarih = new Date(baslangic);
        tarih.setDate(baslangic.getDate() + gun);
        let izinliNormal = personeller.filter(p => izinKontrol(p.isim, tarih)).map(p => p.isim);
        let kuralIzinliler = personeller.filter(p => {
            for (let k of kurallar) if (k.tip === "personel" && k.personel === p.isim && k.kural === "pazartesi_izin" && tarih.getDay() === 1) return true;
            return false;
        }).map(p => p.isim);
        let sabitIzinliler = [...new Set([...izinliNormal, ...kuralIzinliler])];
        let musaitErkekler = erkekler.filter(e => !sabitIzinliler.includes(e) && yetkinlikKontrol(e, "gece") && kuralKontrol(e, "gece", tarih));
        if (musaitErkekler.length < 2) {
            alert(`Gece için yeterli erkek yok: ${tarih.toLocaleDateString('tr-TR')}`);
            return null;
        }
        let gece = [];
        let geciciIndex = (gun * 2 + kaydirma) % musaitErkekler.length;
        for (let i = 0; i < 2; i++) gece.push(musaitErkekler[(geciciIndex + i) % musaitErkekler.length]);
        let calisabilecekler = tumPersonel.filter(p => !sabitIzinliler.includes(p) && !gece.includes(p));
        if (calisabilecekler.length < 6) {
            alert(`Yeterli personel yok: ${tarih.toLocaleDateString('tr-TR')}`);
            return null;
        }
        let sirali = [...calisabilecekler];
        let kayma = (gun * 3 + kaydirma) % sirali.length;
        sirali = [...sirali.slice(kayma), ...sirali.slice(0, kayma)];
        let kalanKadinlar = sirali.filter(p => kadinlar.includes(p));
        let kalanErkekler = sirali.filter(p => erkekler.includes(p));
        let sabah = [];
        let alinacakKadin = Math.min(2, kalanKadinlar.length);
        for (let i = 0; i < alinacakKadin; i++) sabah.push(kalanKadinlar[i]);
        let eksik = 3 - sabah.length;
        for (let i = 0; i < eksik; i++) if (kalanErkekler.length) sabah.push(kalanErkekler[i]);
        let secilenler = [...sabah];
        let kalanlar = sirali.filter(p => !secilenler.includes(p));
        let aksam = kalanlar.slice(0, 3);
        let dinlenenler = calisabilecekler.filter(p => ![...sabah, ...aksam].includes(p));
        let tumIzinliler = [...new Set([...sabitIzinliler, ...dinlenenler])];
        let aksamKadin = aksam.filter(p => kadinlar.includes(p)).length;
        if (aksamKadin === 3) {
            for (let i = 0; i < aksam.length; i++) {
                if (kadinlar.includes(aksam[i])) {
                    let sabahErkek = sabah.find(p => erkekler.includes(p));
                    if (sabahErkek) {
                        let kadin = aksam[i];
                        aksam[i] = sabahErkek;
                        sabah[sabah.indexOf(sabahErkek)] = kadin;
                        break;
                    }
                }
            }
        }
        while (sabah.length < 3 && aksam.length > 3) sabah.push(aksam.pop());
        while (aksam.length < 3 && sabah.length > 3) aksam.push(sabah.pop());
        vardiyalar.push({
            tarih: new Date(tarih),
            gece: gece,
            sabah: sabah,
            aksam: aksam,
            izinli: tumIzinliler,
            haftasonu: (tarih.getDay() === 0 || tarih.getDay() === 6)
        });
        kaydirma = (kaydirma + 1) % tumPersonel.length;
    }
    vardiyalar = izinliAkşamKuraliDuzelt(vardiyalar);
    return vardiyalar;
}

async function takvimOlustur() {
    let gunSayisi = parseInt(document.getElementById('gunSayisi').value);
    let baslangicStr = document.getElementById('baslangicTarihi').value;
    let baslangic = baslangicStr ? new Date(baslangicStr) : new Date();
    let hafizaKullan = document.getElementById('hafizaKullan').value;
    let key = `guzelel_takvim_${baslangic.toISOString().slice(0,10)}_${gunSayisi}`;
    if (hafizaKullan !== 'evet') localStorage.removeItem(key);
    let kayitli = await yukleTakvim(baslangic, gunSayisi);
    if (kayitli && kayitli.length) {
        vardiyalarGuncel = kayitli;
        if (hafizaKullan === 'evet') {
            vardiyaHafizasi = [];
            for (let v of kayitli) for (let p of v.gece) vardiyaHafizasi.push({ tarih: new Date(v.tarih), personel: p, vardiya: "gece", haftasonu: v.haftasonu });
            for (let v of kayitli) for (let p of v.sabah) vardiyaHafizasi.push({ tarih: new Date(v.tarih), personel: p, vardiya: "sabah", haftasonu: v.haftasonu });
            for (let v of kayitli) for (let p of v.aksam) vardiyaHafizasi.push({ tarih: new Date(v.tarih), personel: p, vardiya: "aksam", haftasonu: v.haftasonu });
            await veriKaydet();
        }
        tabloyuGoster(vardiyalarGuncel);
        istatistikGoster(vardiyalarGuncel);
        document.getElementById('tabloKarti').style.display = 'block';
        document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Kayıtlı takvim yüklendi.</div>';
        window.sonVardiyalar = vardiyalarGuncel;
        window.sonBaslangic = baslangic;
        window.sonGunSayisi = gunSayisi;
        window.originalVardiyalar = JSON.parse(JSON.stringify(vardiyalarGuncel));
        return;
    }
    let v = vardiyaOlusturYeni(gunSayisi, baslangic);
    if (!v) return;
    vardiyalarGuncel = v;
    window.originalVardiyalar = JSON.parse(JSON.stringify(v));
    tabloyuGoster(v);
    istatistikGoster(v);
    document.getElementById('tabloKarti').style.display = 'block';
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Yeni vardiyalar oluşturuldu.</div>';
    window.sonVardiyalar = v;
    window.sonBaslangic = baslangic;
    window.sonGunSayisi = gunSayisi;
}

function tabloyuGoster(vardiyalar) {
    if (!vardiyalar || !Array.isArray(vardiyalar) || vardiyalar.length === 0) {
        document.getElementById('tabloAlan').innerHTML = '<div class="uyari">Henüz vardiya oluşturulmamış.</div>';
        return;
    }
    let html = `<table class="vardiya-tablosu"><thead><tr><th>TARİH / GÜN</th><th>🌙 GECE<br><span style="font-size:10px;">${saatler.gece}</span></th>
            <th>☀️ SABAH<br><span style="font-size:10px;">${saatler.sabah}</span></th>
            <th>🌆 AKŞAM<br><span style="font-size:10px;">${saatler.aksam}</span></th>
            <th>📌 İZİNLİLER</th></tr></thead><tbody>`;
    for (let i = 0; i < vardiyalar.length; i++) {
        let v = vardiyalar[i];
        if (!v || typeof v !== 'object') continue;
        let tarihObj = new Date(v.tarih);
        let gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][tarihObj.getDay()];
        let tarihStr = `${tarihObj.getDate()} ${tarihObj.toLocaleString('tr', { month: 'long' })} ${gunAdi}`;
        let hsNot = (tarihObj.getDay() === 0 || tarihObj.getDay() === 6) ? ' 🟡' : '';
        let geceListe = v.gece || [];
        let sabahListe = v.sabah || [];
        let aksamListe = v.aksam || [];
        let izinliListe = v.izinli || [];
        html += `<tr data-gun="${i}">
            <td class="tarih-hucre"><strong>${tarihStr}${hsNot}</strong></td>
            <td class="gece-hucre" data-vardiya="gece">${geceListe.map(p => `<span class="personel-etiket erkek" data-p="${p}">${p}</span>`).join('')}</td>
            <td class="sabah-hucre" data-vardiya="sabah">${sabahListe.map(p => `<span class="personel-etiket ${getKadinlar().includes(p) ? 'kadin' : 'erkek'}" data-p="${p}">${p}</span>`).join('')}</td>
            <td class="aksam-hucre" data-vardiya="aksam">${aksamListe.map(p => `<span class="personel-etiket ${getKadinlar().includes(p) ? 'kadin' : 'erkek'}" data-p="${p}">${p}</span>`).join('')}</td>
            <td style="background:#fff1cf;" class="benz-izinli-td" data-gun="${i}">
                <div class="izinli-listesi" id="izinliListe_${i}">
                    ${izinliListe.length ? izinliListe.map(p => `<span class="personel-etiket izin benz-izinli-item" data-gun="${i}" data-izinli="${p}">📌 ${p} <span style="font-size:10px; cursor:pointer;" class="izinli-cikar" data-p="${p}">✖</span></span>`).join('') : '<span class="izinli-ekle-placeholder">(izinli yok)</span>'}
                </div>
                <button class="izinli-ekle-btn" data-gun="${i}" style="margin-top:5px; padding:2px 8px; font-size:10px;">➕ İzinli Ekle</button>
            </td>
        </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('tabloAlan').innerHTML = html;

    if (duzenlemeModu) {
        document.querySelectorAll('.gece-hucre span, .sabah-hucre span, .aksam-hucre span').forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', (e) => { e.stopPropagation(); acDropdown(span); });
        });
        document.querySelectorAll('.izinli-ekle-btn').forEach(btn => {
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let gun = parseInt(btn.getAttribute('data-gun'));
                benzIzinliEkle(gun);
            });
        });
        document.querySelectorAll('.izinli-cikar').forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', (e) => {
                e.stopPropagation();
                let gun = parseInt(span.closest('.benz-izinli-td').getAttribute('data-gun'));
                let personel = span.getAttribute('data-p');
                benzIzinliCikar(gun, personel);
            });
        });
        document.querySelectorAll('.benz-izinli-item').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('izinli-cikar')) return;
                e.stopPropagation();
                let gun = parseInt(el.getAttribute('data-gun'));
                let mevcut = el.getAttribute('data-izinli');
                benzIzinliDegistir(gun, mevcut);
            });
        });
    }
}

// ============ MARKET VARDİYASI ============
let marketPersoneller = []; // Başlangıçta boş, veriYukle'den sonra doldurulacak

let marketVardiyalarGuncel = [];
let marketDuzenlemeModu = false;
let marketAktifDropdown = null;

function kimIzinli(tarih, personeller) {
    let gun = tarih.getDay();
    for (let p of personeller) if (p.izinGunu === gun) return p.isim;
    return null;
}

function marketPersonelListesiniGoster() {
    const container = document.getElementById('marketPersonelListesi');
    if (!container) return;
    if (marketPersoneller.length === 0) { container.innerHTML = '<div class="uyari">⚠️ Henüz market personeli eklenmemiş.</div>'; return; }
    const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    container.innerHTML = marketPersoneller.map((p, idx) => `
        <div class="personel-card ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}">
            ${p.cinsiyet === 'E' ? '👨' : '👩'} <strong>${p.isim}</strong>
            <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:20px;">
                ${p.yetkinlik === 'ikisi_de' ? 'Gece+Gündüz' : p.yetkinlik === 'sadece_gece' ? 'Sadece Gece' : 'Sadece Gündüz'} |
                İzin: ${gunler[p.izinGunu]}
            </span>
            <button onclick="marketPersonelSil(${idx})">✖</button>
        </div>
    `).join('');
}

async function marketPersonelEkle() {
    let isim = document.getElementById('marketYeniIsim')?.value.trim().toUpperCase();
    if (!isim) { alert("Market personel adı girin"); return; }
    let cinsiyet = document.getElementById('marketYeniCinsiyet')?.value;
    let yetkinlik = document.getElementById('marketYeniYetkinlik')?.value;
    let izinGunu = parseInt(document.getElementById('marketIzinGunu')?.value);
    if (marketPersoneller.some(p => p.isim === isim)) { alert("Bu market personeli zaten var!"); return; }
    marketPersoneller.push({ isim, cinsiyet, yetkinlik, izinGunu });
    document.getElementById('marketYeniIsim').value = '';
    marketPersonelListesiniGoster();
    await veriKaydet();
    marketTakvimOlustur();
}

window.marketPersonelSil = async function(idx) {
    if (confirm(`${marketPersoneller[idx].isim} silinsin mi?`)) {
        marketPersoneller.splice(idx, 1);
        marketPersonelListesiniGoster();
        await veriKaydet();
        marketTakvimOlustur();
    }
};

async function marketKaydetTakvim(vardiyalar, baslangic, haftaSayisi) {
    let tarihStr = baslangic instanceof Date ? baslangic.toISOString().slice(0,10) : baslangic;
    let key = `guzelel_market_takvim_${tarihStr}_${haftaSayisi}`;
    let saklanacak = vardiyalar.map(v => {
        if (v.tip === "normal") {
            return { tip: "normal", tarih: v.tarih.toISOString(), gece8: v.gece8, sabah8: v.sabah8, aksam8: v.aksam8, izinli: null };
        } else {
            return { tip: "izin_gunu", tarih: v.tarih.toISOString(), gecePersonel: v.gecePersonel, gunduzPersonel: v.gunduzPersonel, izinli: v.izinli };
        }
    });
    localStorage.setItem(key, JSON.stringify(saklanacak));
    if (!db) return;
    try { await setDoc(doc(db, "market_takvimler", key), { data: saklanacak }); } catch(e) { console.error("Market takvim kaydedilemedi", e); }
}

async function marketYukleTakvim(baslangic, haftaSayisi) {
    let tarihStr = baslangic instanceof Date ? baslangic.toISOString().slice(0,10) : baslangic;
    let key = `guzelel_market_takvim_${tarihStr}_${haftaSayisi}`;
    let data = localStorage.getItem(key);
    if (data) {
        let v = JSON.parse(data);
        return v.map(v => ({ ...v, tarih: new Date(v.tarih) }));
    }
    if (!db) return null;
    try {
        let docSnap = await getDoc(doc(db, "market_takvimler", key));
        if (docSnap.exists()) return docSnap.data().data.map(v => ({ ...v, tarih: new Date(v.tarih) }));
    } catch(e) { console.error("Market takvim yüklenemedi", e); }
    return null;
}

function marketVardiyaOlustur(haftaSayisi, baslangic) {
    let vardiyalar = [];
    let gunSayisi = haftaSayisi * 7;
    if (marketPersoneller.length !== 3) {
        alert("Market için 3 personel gerekli! Mevcut: " + marketPersoneller.length);
        return null;
    }
    for (let gun = 0; gun < gunSayisi; gun++) {
        let tarih = new Date(baslangic);
        tarih.setDate(baslangic.getDate() + gun);
        let izinliIsim = kimIzinli(tarih, marketPersoneller);
        let izinliPersonel = marketPersoneller.find(p => p.isim === izinliIsim);
        let calisanlar = marketPersoneller.filter(p => p.isim !== izinliIsim);
        if (izinliIsim) {
            let geceAday = calisanlar.filter(p => p.yetkinlik === "ikisi_de" || p.yetkinlik === "sadece_gece");
            let gunduzAday = calisanlar.filter(p => p.yetkinlik === "ikisi_de" || p.yetkinlik === "sadece_gunduz");
            let gecePersonel = geceAday.length > 0 ? geceAday[0] : calisanlar[0];
            let gunduzPersonel = gunduzAday.length > 0 ? gunduzAday[0] : (gecePersonel === calisanlar[0] ? calisanlar[1] : calisanlar[0]);
            vardiyalar.push({
                tarih: tarih,
                tip: "izin_gunu",
                gecePersonel: gecePersonel,
                gunduzPersonel: gunduzPersonel,
                izinli: izinliPersonel
            });
        } else {
            let sirali = [...marketPersoneller];
            let kayma = gun % 3;
            sirali = [...sirali.slice(kayma), ...sirali.slice(0, kayma)];
            vardiyalar.push({
                tarih: tarih,
                tip: "normal",
                gece8: [sirali[0]],
                sabah8: [sirali[1]],
                aksam8: [sirali[2]],
                izinli: null
            });
        }
    }
    return vardiyalar;
}

function marketTabloyuGoster(vardiyalar) {
    if (!vardiyalar || vardiyalar.length === 0) {
        const alan = document.getElementById('marketTabloAlan');
        if (alan) alan.innerHTML = '<div class="uyari">Henüz market vardiyası oluşturulmamış.</div>';
        return;
    }
    let html = `<table class="market-vardiya-tablosu"><thead>
        <tr><th>TARİH / GÜN</th><th>🌙 GECE (00-08)</th><th>☀️ SABAH (08-16)</th><th>🌆 AKŞAM (16-00)</th><th>📌 İZİNLİLER</th></tr>
        </thead><tbody>`;
    for (let i = 0; i < vardiyalar.length; i++) {
        let v = vardiyalar[i];
        if (!v || typeof v !== 'object') continue;
        let tarihObj = new Date(v.tarih);
        let gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][tarihObj.getDay()];
        let tarihStr = `${tarihObj.getDate()} ${tarihObj.toLocaleString('tr', { month: 'long' })} ${gunAdi}`;
        let izinGunuMu = (v.tip === "izin_gunu");
        html += `<tr data-market-gun="${i}">
            <td class="tarih-hucre"><strong>${tarihStr}</strong>${izinGunuMu ? '<br><span class="izin-gunu-badge">12 SAAT</span>' : ''}</td>`;
        if (!izinGunuMu) {
            let gece8 = v.gece8 || [];
            let sabah8 = v.sabah8 || [];
            let aksam8 = v.aksam8 || [];
            html += `<td class="market-gece" data-market-vardiya="gece8" data-gun="${i}">${gece8.map(p => `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${p.isim}" data-gun="${i}" data-vardiya="gece8">${p.isim}<br><span class="saat-bilgisi">00:00-08:00</span></span>`).join('')}</td>`;
            html += `<td class="market-gunduz" data-market-vardiya="sabah8" data-gun="${i}">${sabah8.map(p => `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${p.isim}" data-gun="${i}" data-vardiya="sabah8">${p.isim}<br><span class="saat-bilgisi">08:00-16:00</span></span>`).join('')}</td>`;
            html += `<td class="market-aksam" data-market-vardiya="aksam8" data-gun="${i}">${aksam8.map(p => `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${p.isim}" data-gun="${i}" data-vardiya="aksam8">${p.isim}<br><span class="saat-bilgisi">16:00-00:00</span></span>`).join('')}</td>`;
        } else {
            let gece12 = v.gecePersonel ? [v.gecePersonel] : [];
            let gunduz12 = v.gunduzPersonel ? [v.gunduzPersonel] : [];
            html += `<td class="market-gece" data-market-vardiya="gece12" data-gun="${i}">${gece12.map(p => `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${p.isim}" data-gun="${i}" data-vardiya="gece12">${p.isim}<br><span class="saat-bilgisi">00:00-12:00</span></span>`).join('')}</td>`;
            html += `<td class="market-gunduz" data-market-vardiya="gunduz12" data-gun="${i}" colspan="2">${gunduz12.map(p => `<span class="market-personel-etiket ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}" data-p="${p.isim}" data-gun="${i}" data-vardiya="gunduz12">${p.isim}<br><span class="saat-bilgisi">12:00-00:00</span></span>`).join('')}</td>`;
        }
        html += `<td style="background:#fdedec;" class="market-izinli-td" data-gun="${i}">${v.izinli ? `<span class="market-izinli-etiket" data-gun="${i}" data-izinli="${v.izinli.isim}">📌 ${v.izinli.isim}</span>` : '—'}</td>`;
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('marketTabloAlan').innerHTML = html;
    if (marketDuzenlemeModu) {
        document.querySelectorAll('.market-personel-etiket').forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', (e) => { e.stopPropagation(); marketAcDropdown(span); });
        });
        document.querySelectorAll('.market-izinli-etiket').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => { e.stopPropagation(); marketIzinliSecimDropdown(el); });
        });
    }
}

function marketAcDropdown(span) {
    if (!marketDuzenlemeModu) return;
    if (marketAktifDropdown) marketAktifDropdown.remove();
    let eskiPersonel = span.getAttribute('data-p');
    let gun = parseInt(span.getAttribute('data-gun'));
    let vardiyaTipi = span.getAttribute('data-vardiya');
    let v = marketVardiyalarGuncel[gun];
    let adaylar = marketPersoneller.filter(p => p.isim !== eskiPersonel).map(p => p.isim);
    let dropdown = document.createElement('div');
    dropdown.className = 'market-personel-dropdown';
    let rect = span.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    adaylar.forEach(adm => {
        let opt = document.createElement('div');
        opt.textContent = `🔄 ${adm}`;
        opt.onclick = () => {
            let yeniPersonel = marketPersoneller.find(p => p.isim === adm);
            if (!yeniPersonel) return;
            if (v.tip === "normal") {
                if (vardiyaTipi === 'gece8') v.gece8 = [yeniPersonel];
                else if (vardiyaTipi === 'sabah8') v.sabah8 = [yeniPersonel];
                else if (vardiyaTipi === 'aksam8') v.aksam8 = [yeniPersonel];
            } else {
                if (vardiyaTipi === 'gece12') v.gecePersonel = yeniPersonel;
                else if (vardiyaTipi === 'gunduz12') v.gunduzPersonel = yeniPersonel;
            }
            marketTabloyuGoster(marketVardiyalarGuncel);
            document.getElementById('marketKaydetBtn').style.display = 'inline-block';
            document.getElementById('marketKontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. Onaylayın.</div>';
            dropdown.remove();
            marketAktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    marketAktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !span.contains(e.target)) {
                dropdown.remove();
                marketAktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

function marketIzinliSecimDropdown(element) {
    let gun = parseInt(element.getAttribute('data-gun'));
    let mevcutIzinli = element.getAttribute('data-izinli');
    let adaylar = marketPersoneller.filter(p => p.isim !== mevcutIzinli).map(p => p.isim);
    let dropdown = document.createElement('div');
    dropdown.className = 'market-personel-dropdown';
    let rect = element.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    adaylar.forEach(adm => {
        let opt = document.createElement('div');
        opt.textContent = `📌 ${adm} (izinli yap)`;
        opt.onclick = () => {
            marketIzinliDegistir(gun, adm);
            dropdown.remove();
            marketAktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    marketAktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !element.contains(e.target)) {
                dropdown.remove();
                marketAktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

function marketIzinliDegistir(gunIndex, yeniIzinliIsim) {
    let v = marketVardiyalarGuncel[gunIndex];
    let yeniIzinli = marketPersoneller.find(p => p.isim === yeniIzinliIsim);
    if (!yeniIzinli) return;
    let calisanlar = marketPersoneller.filter(p => p.isim !== yeniIzinliIsim);
    if (calisanlar.length === 2) {
        let geceAday = calisanlar.filter(p => p.yetkinlik === "ikisi_de" || p.yetkinlik === "sadece_gece");
        let gunduzAday = calisanlar.filter(p => p.yetkinlik === "ikisi_de" || p.yetkinlik === "sadece_gunduz");
        let gecePersonel = geceAday.length > 0 ? geceAday[0] : calisanlar[0];
        let gunduzPersonel = gunduzAday.length > 0 ? gunduzAday[0] : (gecePersonel === calisanlar[0] ? calisanlar[1] : calisanlar[0]);
        v.tip = "izin_gunu";
        v.gecePersonel = gecePersonel;
        v.gunduzPersonel = gunduzPersonel;
        v.izinli = yeniIzinli;
        delete v.gece8; delete v.sabah8; delete v.aksam8;
    } else {
        let sirali = [...calisanlar, yeniIzinli];
        let kayma = gunIndex % 3;
        sirali = [...sirali.slice(kayma), ...sirali.slice(0, kayma)];
        v.tip = "normal";
        v.gece8 = [sirali[0]];
        v.sabah8 = [sirali[1]];
        v.aksam8 = [sirali[2]];
        v.izinli = null;
        delete v.gecePersonel; delete v.gunduzPersonel;
    }
    marketTabloyuGoster(marketVardiyalarGuncel);
    document.getElementById('marketKaydetBtn').style.display = 'inline-block';
    document.getElementById('marketKontrolMesaji').innerHTML = '<div class="uyari">✏️ İzinli personel değiştirildi. Onaylayın.</div>';
}

async function marketTakvimOlustur() {
    let haftaSayisi = parseInt(document.getElementById('marketHaftaSayisi')?.value || 4);
    let baslangicStr = document.getElementById('marketBaslangicTarihi')?.value;
    let baslangic = baslangicStr ? new Date(baslangicStr) : new Date();
    let kayitli = await marketYukleTakvim(baslangic, haftaSayisi);
    if (kayitli) {
        marketVardiyalarGuncel = kayitli;
        marketTabloyuGoster(marketVardiyalarGuncel);
        document.getElementById('marketTabloWrapper').style.display = 'block';
        document.getElementById('marketKontrolMesaji').innerHTML = '<div class="basarili">✅ Kayıtlı market takvimi yüklendi.</div>';
        return;
    }
    let vardiyalar = marketVardiyaOlustur(haftaSayisi, baslangic);
    if (!vardiyalar) return;
    marketVardiyalarGuncel = vardiyalar;
    marketTabloyuGoster(marketVardiyalarGuncel);
    document.getElementById('marketTabloWrapper').style.display = 'block';
    document.getElementById('marketKontrolMesaji').innerHTML = '<div class="basarili">✅ Market vardiyaları oluşturuldu.</div>';
}

function marketDuzenlemeModunuAc() {
    marketDuzenlemeModu = true;
    document.getElementById('marketDuzenleBtn').style.display = 'none';
    document.getElementById('marketKaydetBtn').style.display = 'inline-block';
    document.getElementById('marketIptalBtn').style.display = 'inline-block';
    document.getElementById('marketDurumText').innerHTML = '✏️ DÜZENLEME MODU – Personel/izinliye tıklayın';
    marketTabloyuGoster(marketVardiyalarGuncel);
}

function marketDuzenlemeModunuKapat() {
    marketDuzenlemeModu = false;
    document.getElementById('marketDuzenleBtn').style.display = 'inline-block';
    document.getElementById('marketKaydetBtn').style.display = 'none';
    document.getElementById('marketIptalBtn').style.display = 'none';
    document.getElementById('marketDurumText').innerHTML = '📋 Market Vardiyası';
    marketTabloyuGoster(marketVardiyalarGuncel);
}

async function marketDegisiklikleriKaydet() {
    await marketKaydetTakvim(marketVardiyalarGuncel, new Date(document.getElementById('marketBaslangicTarihi').value), parseInt(document.getElementById('marketHaftaSayisi').value));
    document.getElementById('marketKontrolMesaji').innerHTML = '<div class="basarili">✅ Değişiklikler onaylandı ve kaydedildi.</div>';
    marketDuzenlemeModunuKapat();
}

function marketDegisiklikleriIptal() {
    marketTakvimOlustur();
    marketDuzenlemeModunuKapat();
    document.getElementById('marketKontrolMesaji').innerHTML = '<div class="uyari">🔄 İptal edildi.</div>';
}

// ============ BENZİNLİK İZİN YÖNETİMİ (Ekle, Çıkar, Değiştir) ============
function benzIzinliEkle(gun) {
    if (!duzenlemeModu) return;
    let mevcutIzinliler = vardiyalarGuncel[gun].izinli;
    let adaylar = personeller.filter(p => !mevcutIzinliler.includes(p.isim)).map(p => p.isim);
    if (adaylar.length === 0) { alert("Eklenebilecek personel kalmadı."); return; }
    let dropdown = document.createElement('div');
    dropdown.className = 'personel-dropdown';
    let btn = document.querySelector(`.benz-izinli-td[data-gun="${gun}"] .izinli-ekle-btn`);
    if (!btn) return;
    let rect = btn.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    adaylar.forEach(adm => {
        let opt = document.createElement('div');
        opt.textContent = `➕ ${adm}`;
        opt.onclick = () => {
            vardiyalarGuncel[gun].izinli.push(adm);
            tabloyuGoster(vardiyalarGuncel);
            document.getElementById('kaydetBtn').style.display = 'inline-block';
            document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ İzinli eklendi. Onaylayın.</div>';
            dropdown.remove();
            if (aktifDropdown) aktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    if (aktifDropdown) aktifDropdown.remove();
    aktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.remove();
                if (aktifDropdown === dropdown) aktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

function benzIzinliCikar(gun, personel) {
    if (!duzenlemeModu) return;
    let idx = vardiyalarGuncel[gun].izinli.indexOf(personel);
    if (idx !== -1) vardiyalarGuncel[gun].izinli.splice(idx, 1);
    tabloyuGoster(vardiyalarGuncel);
    document.getElementById('kaydetBtn').style.display = 'inline-block';
    document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ İzinli çıkarıldı. Onaylayın.</div>';
}

function benzIzinliDegistir(gun, eskiPersonel) {
    if (!duzenlemeModu) return;
    let adaylar = personeller.filter(p => p.isim !== eskiPersonel && !vardiyalarGuncel[gun].izinli.includes(p.isim)).map(p => p.isim);
    if (adaylar.length === 0) { alert("Değiştirilebilecek personel yok."); return; }
    let dropdown = document.createElement('div');
    dropdown.className = 'personel-dropdown';
    let span = document.querySelector(`.benz-izinli-item[data-izinli="${eskiPersonel}"]`);
    if (!span) return;
    let rect = span.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    adaylar.forEach(adm => {
        let opt = document.createElement('div');
        opt.textContent = `🔄 ${adm}`;
        opt.onclick = () => {
            let liste = vardiyalarGuncel[gun].izinli;
            let idx = liste.indexOf(eskiPersonel);
            if (idx !== -1) liste[idx] = adm;
            tabloyuGoster(vardiyalarGuncel);
            document.getElementById('kaydetBtn').style.display = 'inline-block';
            document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ İzinli değiştirildi. Onaylayın.</div>';
            dropdown.remove();
            if (aktifDropdown) aktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    if (aktifDropdown) aktifDropdown.remove();
    aktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !span.contains(e.target)) {
                dropdown.remove();
                if (aktifDropdown === dropdown) aktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

// ============ DÜZENLEME DROPDOWN (Benzinlik vardiyası) ============
function acDropdown(span) {
    if (!duzenlemeModu) return;
    if (aktifDropdown) aktifDropdown.remove();
    let eskiPersonel = span.getAttribute('data-p');
    let td = span.closest('td');
    let gun = parseInt(td.closest('tr').getAttribute('data-gun'));
    let vardiyaTipi = td.getAttribute('data-vardiya');
    let tarih = vardiyalarGuncel[gun].tarih;
    let izinliler = personeller.filter(p => izinKontrol(p.isim, tarih)).map(p => p.isim);
    let mevcutListe = vardiyalarGuncel[gun][vardiyaTipi];
    let adaylar = personeller.filter(p => !izinliler.includes(p.isim) && !(vardiyaTipi === 'gece' && p.cinsiyet === 'K') && yetkinlikKontrol(p.isim, vardiyaTipi) && kuralKontrol(p.isim, vardiyaTipi, tarih)).map(p => p.isim);
    let dropdown = document.createElement('div');
    dropdown.className = 'personel-dropdown';
    let rect = span.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    let baslik = document.createElement('div');
    baslik.textContent = `📋 Mevcut (${mevcutListe.length} kişi): ${mevcutListe.join(', ')}`;
    baslik.style.fontWeight = 'bold'; baslik.style.padding = '8px'; baslik.style.background = '#f0f0f0';
    dropdown.appendChild(baslik);
    let duzenleSec = document.createElement('div');
    duzenleSec.textContent = '✏️ Listeyi Düzenle (virgülle ayır)';
    duzenleSec.style.background = '#e0e0e0';
    duzenleSec.onclick = () => {
        let yeniListeStr = prompt("Personel isimlerini virgülle ayırarak yazın:", mevcutListe.join(', '));
        if (yeniListeStr) {
            let yeniListe = yeniListeStr.split(',').map(p => p.trim().toUpperCase());
            let gecerli = true;
            for (let p of yeniListe) {
                let per = personeller.find(pr => pr.isim === p);
                if (!per) { alert(`${p} sistemde yok!`); gecerli = false; break; }
                if (vardiyaTipi === 'gece' && per.cinsiyet === 'K') { alert(`${p} kadın gece çalışamaz!`); gecerli = false; break; }
                if (!yetkinlikKontrol(p, vardiyaTipi)) { alert(`${p} bu vardiyada çalışamaz!`); gecerli = false; break; }
                if (!kuralKontrol(p, vardiyaTipi, tarih)) { alert(`${p} bu gün bu vardiyada çalışamaz!`); gecerli = false; break; }
            }
            if (gecerli) {
                vardiyalarGuncel[gun][vardiyaTipi] = yeniListe;
                tabloyuGoster(vardiyalarGuncel);
                document.getElementById('kaydetBtn').style.display = 'inline-block';
                document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. Onaylayın.</div>';
            }
        }
        dropdown.remove(); aktifDropdown = null;
    };
    dropdown.appendChild(duzenleSec);
    let hr = document.createElement('hr'); dropdown.appendChild(hr);
    mevcutListe.forEach(p => {
        let opt = document.createElement('div');
        opt.textContent = `🔁 ${p} → değiştir`;
        opt.onclick = () => {
            let yeni = prompt(`${p} yerine hangi personel gelsin?`, "");
            if (yeni) {
                let yeniIsim = yeni.trim().toUpperCase();
                let per = personeller.find(pr => pr.isim === yeniIsim);
                if (!per) { alert(`${yeniIsim} sistemde yok!`); dropdown.remove(); aktifDropdown=null; return; }
                if (vardiyaTipi === 'gece' && per.cinsiyet === 'K') { alert(`${yeniIsim} kadın gece çalışamaz!`); dropdown.remove(); aktifDropdown=null; return; }
                if (!yetkinlikKontrol(yeniIsim, vardiyaTipi) || !kuralKontrol(yeniIsim, vardiyaTipi, tarih)) { alert(`${yeniIsim} bu vardiyada çalışamaz!`); dropdown.remove(); aktifDropdown=null; return; }
                let liste = vardiyalarGuncel[gun][vardiyaTipi];
                let idx = liste.indexOf(p);
                if (idx !== -1) liste[idx] = yeniIsim;
                tabloyuGoster(vardiyalarGuncel);
                document.getElementById('kaydetBtn').style.display = 'inline-block';
                document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. Onaylayın.</div>';
            }
            dropdown.remove(); aktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    let ekleBaslik = document.createElement('div');
    ekleBaslik.textContent = '➕ Bu vardiyaya ekle:'; ekleBaslik.style.fontWeight = 'bold'; ekleBaslik.style.padding = '5px';
    dropdown.appendChild(ekleBaslik);
    let kalanAdaylar = adaylar.filter(a => !mevcutListe.includes(a));
    if (kalanAdaylar.length === 0) {
        let bos = document.createElement('div'); bos.textContent = '(eklenecek uygun personel yok)'; bos.style.color = '#999'; dropdown.appendChild(bos);
    } else {
        kalanAdaylar.forEach(adm => {
            let opt = document.createElement('div');
            opt.textContent = `➕ ${adm}`;
            opt.onclick = () => {
                vardiyalarGuncel[gun][vardiyaTipi].push(adm);
                tabloyuGoster(vardiyalarGuncel);
                document.getElementById('kaydetBtn').style.display = 'inline-block';
                document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. Onaylayın.</div>';
                dropdown.remove(); aktifDropdown = null;
            };
            dropdown.appendChild(opt);
        });
    }
    let cikarBaslik = document.createElement('div');
    cikarBaslik.textContent = '➖ Bu vardiyadan çıkar:'; cikarBaslik.style.fontWeight = 'bold'; cikarBaslik.style.padding = '5px'; cikarBaslik.style.marginTop = '5px';
    dropdown.appendChild(cikarBaslik);
    mevcutListe.forEach(p => {
        let opt = document.createElement('div');
        opt.textContent = `❌ ${p}`;
        opt.onclick = () => {
            let liste = vardiyalarGuncel[gun][vardiyaTipi];
            let idx = liste.indexOf(p);
            if (idx !== -1) liste.splice(idx, 1);
            tabloyuGoster(vardiyalarGuncel);
            document.getElementById('kaydetBtn').style.display = 'inline-block';
            document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. Onaylayın.</div>';
            dropdown.remove(); aktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    aktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !span.contains(e.target)) {
                dropdown.remove(); aktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

// ============ ONAYLAMA, İPTAL, SIFIRLAMA ============
async function degisiklikleriOnayla() {
    vardiyaHafizasi = [];
    for (let v of vardiyalarGuncel) {
        let t = new Date(v.tarih);
        for (let p of v.gece) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "gece", haftasonu: v.haftasonu });
        for (let p of v.sabah) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "sabah", haftasonu: v.haftasonu });
        for (let p of v.aksam) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "aksam", haftasonu: v.haftasonu });
    }
    window.originalVardiyalar = JSON.parse(JSON.stringify(vardiyalarGuncel));
    await kaydetTakvim(vardiyalarGuncel, window.sonBaslangic, window.sonGunSayisi);
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Değişiklikler onaylandı.</div>';
    document.getElementById('kaydetBtn').style.display = 'none';
    duzenlemeModunuKapat();
    istatistikGoster(vardiyalarGuncel);
    await veriKaydet();
}

function duzenlemeModunuAc() {
    duzenlemeModu = true;
    document.getElementById('duzenleBtn').style.display = 'none';
    document.getElementById('kaydetBtn').style.display = 'inline-block';
    document.getElementById('iptalBtn').style.display = 'inline-block';
    document.getElementById('durumText').innerHTML = '✏️ DÜZENLEME MODU – Personel ismine tıklayın';
    document.getElementById('durumText').style.color = '#e67e22';
    tabloyuGoster(vardiyalarGuncel);
}

function duzenlemeModunuKapat() {
    duzenlemeModu = false;
    document.getElementById('duzenleBtn').style.display = 'inline-block';
    document.getElementById('kaydetBtn').style.display = 'none';
    document.getElementById('iptalBtn').style.display = 'none';
    document.getElementById('durumText').innerHTML = '📋 Görüntüleme Modu';
    document.getElementById('durumText').style.color = '#1e466e';
    tabloyuGoster(vardiyalarGuncel);
}

function degisiklikleriIptal() {
    if (window.originalVardiyalar) {
        vardiyalarGuncel = JSON.parse(JSON.stringify(window.originalVardiyalar));
        tabloyuGoster(vardiyalarGuncel);
    }
    duzenlemeModunuKapat();
    document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">🔄 İptal edildi, son onaylanmış duruma dönüldü.</div>';
}

function sifirlaTumDegisiklikler() {
    if (confirm("Tüm değişiklikler silinecek ve vardiyalar başlangıç haline dönecek. Emin misiniz?")) {
        let baslangicStr = document.getElementById('baslangicTarihi').value;
        let gunSayisi = parseInt(document.getElementById('gunSayisi').value);
        let baslangic = baslangicStr ? new Date(baslangicStr) : new Date();
        let key = `guzelel_takvim_${baslangic.toISOString().slice(0,10)}_${gunSayisi}`;
        localStorage.removeItem(key);
        if (db) {
            try { setDoc(doc(db, "takvimler", key), { data: [] }); } catch(e) {}
        }
        takvimOlustur();
        document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">🔄 Tüm değişiklikler sıfırlandı, başlangıç tablosuna dönüldü.</div>';
    }
}

function istatistikGoster(vardiyalar) {
    if (!vardiyalar || !Array.isArray(vardiyalar) || vardiyalar.length === 0) {
        document.getElementById('istatistikAlan').innerHTML = '<div class="uyari">İstatistik gösterilemiyor.</div>';
        document.getElementById('istatistikAlan').style.display = 'block';
        return;
    }
    let calisma = {};
    personeller.forEach(p => calisma[p.isim] = { gece:0, sabah:0, aksam:0, toplam:0, hs:0 });
    for (let v of vardiyalar) {
        if (!v) continue;
        if (v.gece && Array.isArray(v.gece)) for (let p of v.gece) { calisma[p].gece++; calisma[p].toplam++; }
        if (v.sabah && Array.isArray(v.sabah)) for (let p of v.sabah) { calisma[p].sabah++; calisma[p].toplam++; }
        if (v.aksam && Array.isArray(v.aksam)) for (let p of v.aksam) { calisma[p].aksam++; calisma[p].toplam++; }
        if (v.haftasonu) {
            let tum = [];
            if (v.gece) tum.push(...v.gece);
            if (v.sabah) tum.push(...v.sabah);
            if (v.aksam) tum.push(...v.aksam);
            for (let p of tum) calisma[p].hs++;
        }
    }
    let html = `<h3>📊 PERSONEL ÇALIŞMA İSTATİSTİKLERİ (${vardiyalar.length} Gün)</h3><div class="istatistik-grid">`;
    for (let [isim, d] of Object.entries(calisma)) {
        let cins = personeller.find(p => p.isim === isim)?.cinsiyet;
        let ort = (d.toplam / vardiyalar.length).toFixed(1);
        html += `<div style="background:white; border-radius:16px; padding:12px; border-left:5px solid ${cins === 'E' ? '#2980b9' : '#e84393'}">
            <strong>${cins === 'E' ? '👨' : '👩'} ${isim}</strong><br>
            🌙 Gece: ${d.gece} | ☀️ Sabah: ${d.sabah} | 🌆 Akşam: ${d.aksam}<br>
            📊 Toplam: ${d.toplam} (Günlük ort: ${ort})<br>
            🏖️ Hafta Sonu: ${d.hs} gün
        </div>`;
    }
    html += `</div>`;
    document.getElementById('istatistikAlan').innerHTML = html;
    document.getElementById('istatistikAlan').style.display = 'block';
}

// ============ CRUD İŞLEMLERİ (Benzinlik) ============
function personelListesiniGoster() {
    const container = document.getElementById('personelListesi');
    container.innerHTML = personeller.map((p, idx) => `
        <div class="personel-card ${p.cinsiyet === 'E' ? 'erkek' : 'kadin'}">
            ${p.cinsiyet === 'E' ? '👨' : '👩'} <strong>${p.isim}</strong>
            <span style="font-size:11px; background:#e2e8f0; padding:2px 8px; border-radius:20px;">${p.yetkinlik === 'hepsi' ? 'Tüm Vardiyalar' : p.yetkinlik === 'sabah_aksam' ? 'Sabah+Akşam' : p.yetkinlik === 'sadece_sabah' ? 'Sadece Sabah' : p.yetkinlik === 'sadece_aksam' ? 'Sadece Akşam' : 'Sadece Gece'}</span>
            <button onclick="personelSil(${idx})">✖</button>
        </div>
    `).join('');
    const izinSelect = document.getElementById('izinPersonel');
    izinSelect.innerHTML = '<option value="">Personel seçin</option>' + personeller.map(p => `<option value="${p.isim}">${p.isim} (${p.cinsiyet === 'E' ? 'Erkek' : 'Kadın'})</option>`).join('');
    const kuralSelect = document.getElementById('kuralPersonel');
    if (kuralSelect) kuralSelect.innerHTML = '<option value="">Personel seçin</option>' + personeller.map(p => `<option value="${p.isim}">${p.isim}</option>`).join('');
}

function izinListesiniGoster() {
    const container = document.getElementById('izinListesi');
    if (!izinler.length) { container.innerHTML = '<span style="color:#64748b;">Henüz izin yok</span>'; return; }
    container.innerHTML = izinler.map((iz, idx) => `<div class="izin-item"><span><strong>${iz.personel}</strong> | ${new Date(iz.baslangic).toLocaleDateString('tr-TR')} - ${new Date(iz.bitis).toLocaleDateString('tr-TR')}</span><button onclick="izinSil(${idx})">🗑️</button></div>`).join('');
}

function kuralListesiniGoster() {
    const container = document.getElementById('kuralListesi');
    if (!kurallar.length) { container.innerHTML = '<span style="color:#64748b;">Henüz kural yok</span>'; return; }
    container.innerHTML = kurallar.map((k, idx) => {
        let aciklama = k.tip === 'genel' ? `[Genel] ${k.kural.replace(/_/g, ' ')}` : `[${k.personel}] ${k.kural.replace(/_/g, ' ')}`;
        return `<div class="izin-item"><span><strong>${aciklama}</strong></span><button onclick="kuralSil(${idx})">🗑️</button></div>`;
    }).join('');
}

window.personelSil = async (idx) => {
    if (confirm(`${personeller[idx].isim} silinsin mi?`)) {
        personeller.splice(idx, 1);
        vardiyaHafizasi = [];
        await veriKaydet();
        personelListesiniGoster();
        if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
    }
};
window.izinSil = async (idx) => {
    izinler.splice(idx, 1);
    vardiyaHafizasi = [];
    await veriKaydet();
    izinListesiniGoster();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
};
window.kuralSil = async (idx) => {
    kurallar.splice(idx, 1);
    await veriKaydet();
    kuralListesiniGoster();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
};

async function personelEkle() {
    let isim = document.getElementById('yeniIsim').value.trim().toUpperCase();
    let cins = document.getElementById('yeniCinsiyet').value;
    let yet = document.getElementById('yeniYetkinlik').value;
    if (!isim) { alert("Personel adı girin"); return; }
    if (personeller.some(p => p.isim === isim)) { alert("Zaten var"); return; }
    personeller.push({ isim, cinsiyet: cins, yetkinlik: yet });
    document.getElementById('yeniIsim').value = '';
    await veriKaydet();
    personelListesiniGoster();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

async function izinEkle() {
    let per = document.getElementById('izinPersonel').value;
    let bas = document.getElementById('izinBaslangic').value;
    let bit = document.getElementById('izinBitis').value;
    if (!per || !bas || !bit) { alert("Tüm alanları doldurun"); return; }
    izinler.push({ personel: per, baslangic: bas, bitis: bit });
    await veriKaydet();
    izinListesiniGoster();
    document.getElementById('izinPersonel').value = '';
    document.getElementById('izinBaslangic').value = '';
    document.getElementById('izinBitis').value = '';
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

async function kuralEkle() {
    let tip = document.getElementById('kuralTipi').value;
    let personel = document.getElementById('kuralPersonel').value;
    let kuralAd = document.getElementById('kuralAdi').value;
    if (tip === 'personel' && !personel) { alert("Personel seçin"); return; }
    kurallar.push({ tip, personel: tip === 'personel' ? personel : null, kural: kuralAd });
    await veriKaydet();
    kuralListesiniGoster();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

function excelIndir() {
    if (!window.sonVardiyalar) { alert("Önce benzinlik takvim oluşturun"); return; }
    let data = [['GÜZELEL PETROL A.Ş. VARDİYA ÇİZELGESİ'], [`Tarih: ${new Date().toLocaleString('tr-TR')}`], [], ['TARİH', 'GECE', 'SABAH', 'AKŞAM', 'İZİNLİLER']];
    for (let v of window.sonVardiyalar) {
        let gun = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][new Date(v.tarih).getDay()];
        data.push([`${new Date(v.tarih).toLocaleDateString('tr-TR')} ${gun}`, (v.gece||[]).join(', '), (v.sabah||[]).join(', '), (v.aksam||[]).join(', '), (v.izinli||[]).join(', ')]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:28},{wch:22},{wch:28},{wch:28},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Benzinlik");
    XLSX.writeFile(wb, `GUZELEL_Benzinlik_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function whatsappPaylas() {
    if (!window.sonVardiyalar) { alert("Önce benzinlik takvim oluşturun"); return; }
    let el = document.querySelector('#tabloAlan table');
    if (!el) return;
    let canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
    canvas.toBlob(blob => {
        let a = document.createElement('a');
        a.download = 'benzinlik_vardiya.png';
        a.href = URL.createObjectURL(blob);
        a.click();
        alert("Tablo resmi indirildi. WhatsApp'tan gönderebilirsiniz.");
        window.open('https://web.whatsapp.com/', '_blank');
    });
}

// ============ EVENT LISTENER'LAR ============
document.getElementById('ekleBtn')?.addEventListener('click', personelEkle);
document.getElementById('izinEkleBtn')?.addEventListener('click', izinEkle);
document.getElementById('kuralEkleBtn')?.addEventListener('click', kuralEkle);
document.getElementById('takvimOlusturBtn')?.addEventListener('click', takvimOlustur);
document.getElementById('excelIndirBtn')?.addEventListener('click', excelIndir);
document.getElementById('whatsappBtn')?.addEventListener('click', whatsappPaylas);
document.getElementById('duzenleBtn')?.addEventListener('click', duzenlemeModunuAc);
document.getElementById('kaydetBtn')?.addEventListener('click', degisiklikleriOnayla);
document.getElementById('iptalBtn')?.addEventListener('click', degisiklikleriIptal);
document.getElementById('printBtn')?.addEventListener('click', () => window.print());

document.getElementById('marketEkleBtn')?.addEventListener('click', marketPersonelEkle);
document.getElementById('marketTakvimOlusturBtn')?.addEventListener('click', marketTakvimOlustur);
document.getElementById('marketDuzenleBtn')?.addEventListener('click', marketDuzenlemeModunuAc);
document.getElementById('marketKaydetBtn')?.addEventListener('click', marketDegisiklikleriKaydet);
document.getElementById('marketIptalBtn')?.addEventListener('click', marketDegisiklikleriIptal);

let sifirlaBtn = document.getElementById('sifirlaBtn');
if (sifirlaBtn) sifirlaBtn.addEventListener('click', sifirlaTumDegisiklikler);

document.getElementById('kuralTipi')?.addEventListener('change', function() {
    document.getElementById('personelSecimDiv').style.display = this.value === 'personel' ? 'block' : 'none';
});

document.getElementById('baslangicTarihi').value = new Date().toISOString().slice(0,10);
if (document.getElementById('marketBaslangicTarihi')) document.getElementById('marketBaslangicTarihi').value = new Date().toISOString().slice(0,10);

setTimeout(() => {
    personelListesiniGoster();
    izinListesiniGoster();
    kuralListesiniGoster();
    takvimOlustur();
    if (document.getElementById('marketPersonelListesi')) {
        marketPersonelListesiniGoster();
        marketTakvimOlustur();
    }
}, 100);
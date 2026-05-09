// Firebase referansları
let db;
let doc, setDoc, getDoc;

// Sayfa yüklendiğinde Firebase'i kullanıma hazırla
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

// ============ VERİ LİSTELERİ ============
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

// Varsayılan personel
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

// ============ YARDIMCI FONKSİYONLAR ============
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

// ============ VERİ YÖNETİMİ (Firebase + LocalStorage) ============
async function veriKaydet() {
    // LocalStorage yedeği
    localStorage.setItem("guzelel_personeller", JSON.stringify(personeller));
    localStorage.setItem("guzelel_izinler", JSON.stringify(izinler));
    localStorage.setItem("guzelel_hafiza", JSON.stringify(vardiyaHafizasi));
    localStorage.setItem("guzelel_kurallar", JSON.stringify(kurallar));
    
    if (!db) return;
    try {
        await setDoc(doc(db, "personeller", "liste"), { data: personeller });
        await setDoc(doc(db, "izinler", "liste"), { data: izinler });
        await setDoc(doc(db, "kurallar", "liste"), { data: kurallar });
        await setDoc(doc(db, "hafiza", "gecmis"), { data: vardiyaHafizasi });
    } catch (e) { console.error("Veri kaydedilemedi:", e); }
}

async function veriYukle() {
    if (!db) {
        let p = localStorage.getItem("guzelel_personeller");
        if (p) personeller = JSON.parse(p);
        else personeller = JSON.parse(JSON.stringify(defaultPersoneller));
        let i = localStorage.getItem("guzelel_izinler");
        if (i) izinler = JSON.parse(i);
        else izinler = [];
        let h = localStorage.getItem("guzelel_hafiza");
        if (h) vardiyaHafizasi = JSON.parse(h);
        else vardiyaHafizasi = [];
        let k = localStorage.getItem("guzelel_kurallar");
        if (k) kurallar = JSON.parse(k);
        else kurallar = [];
        return;
    }
    try {
        let pDoc = await getDoc(doc(db, "personeller", "liste"));
        if (pDoc.exists()) personeller = pDoc.data().data;
        else personeller = JSON.parse(JSON.stringify(defaultPersoneller));
        let iDoc = await getDoc(doc(db, "izinler", "liste"));
        if (iDoc.exists()) izinler = iDoc.data().data;
        else izinler = [];
        let hDoc = await getDoc(doc(db, "hafiza", "gecmis"));
        if (hDoc.exists()) vardiyaHafizasi = hDoc.data().data;
        else vardiyaHafizasi = [];
        let kDoc = await getDoc(doc(db, "kurallar", "liste"));
        if (kDoc.exists()) kurallar = kDoc.data().data;
        else kurallar = [];
    } catch (e) { console.error("Veri yüklenemedi:", e); }
}

// ============ TARİH ARALIĞI BAZLI TAKVİM KAYIT ============
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
    try {
        await setDoc(doc(db, "takvimler", key), { data: saklanacak });
    } catch(e) { console.error("Takvim kaydedilemedi:", e); }
}

async function yukleTakvim(baslangic, gunSayisi) {
    let tarihStr = baslangic instanceof Date ? baslangic.toISOString().slice(0,10) : baslangic;
    let key = `guzelel_takvim_${tarihStr}_${gunSayisi}`;
    let data = localStorage.getItem(key);
    if (data) {
        let vardiyalar = JSON.parse(data);
        return vardiyalar.map(v => ({ ...v, tarih: new Date(v.tarih) }));
    }
    if (!db) return null;
    try {
        let docSnap = await getDoc(doc(db, "takvimler", key));
        if (docSnap.exists()) {
            let vardiyalar = docSnap.data().data;
            return vardiyalar.map(v => ({ ...v, tarih: new Date(v.tarih) }));
        }
    } catch(e) { console.error("Takvim yüklenemedi:", e); }
    return null;
}

// ============ DETERMİNİSTİK VARDİYA OLUŞTURMA (SADECE YENİ İÇİN) ============
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

        /* Sabah ve Akşam Vardiyası Oluşturma (max 2 kadın kuralı) */
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
        secilenler.push(...aksam);
        let dinlenenler = calisabilecekler.filter(p => !secilenler.includes(p));
        let tumIzinliler = [...new Set([...sabitIzinliler, ...dinlenenler])];

        /* Akşamda 3 kadın varsa düzelt */
        let aksamKadin = aksam.filter(p => kadinlar.includes(p)).length;
        if (aksamKadin === 3) for (let i = 0; i < aksam.length; i++) {
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
        let yeniCalisanlar = [...sabah, ...aksam];
        dinlenenler = calisabilecekler.filter(p => !yeniCalisanlar.includes(p));
        tumIzinliler = [...new Set([...sabitIzinliler, ...dinlenenler])];
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
    return vardiyalar;
}

// ============ ANA VARDİYA OLUŞTUR / YÜKLE ============
async function takvimOlustur() {
    let gunSayisi = parseInt(document.getElementById('gunSayisi').value);
    let baslangicStr = document.getElementById('baslangicTarihi').value;
    let baslangic = baslangicStr ? new Date(baslangicStr) : new Date();
    let hafizaKullan = document.getElementById('hafizaKullan').value;
    let kayitli = await yukleTakvim(baslangic, gunSayisi);
    
    if (kayitli) {
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
        document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Kayıtlı takvim yüklendi (en son onaylanmış hali).</div>';
        window.sonVardiyalar = vardiyalarGuncel;
        window.sonBaslangic = baslangic;
        window.sonGunSayisi = gunSayisi;
        return;
    }
    
    let v = vardiyaOlusturYeni(gunSayisi, baslangic);
    if (!v) return;
    vardiyalarGuncel = v;
    window.originalVardiyalar = JSON.parse(JSON.stringify(v));
    tabloyuGoster(v);
    istatistikGoster(v);
    document.getElementById('tabloKarti').style.display = 'block';
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Yeni vardiyalar oluşturuldu. Düzenleyip onaylayabilirsiniz.</div>';
    window.sonVardiyalar = v;
    window.sonBaslangic = baslangic;
    window.sonGunSayisi = gunSayisi;
}

// ============ TABLO GÖSTERİMİ VE DÜZENLEME ============
function tabloyuGoster(vardiyalar) {
    let html = `<table class="vardiya-tablosu">
        <thead><tr><th>TARİH / GÜN</th><th>🌙 GECE<br><span style="font-size:10px;">${saatler.gece}</span></th>
        <th>☀️ SABAH<br><span style="font-size:10px;">${saatler.sabah}</span></th>
        <th>🌆 AKŞAM<br><span style="font-size:10px;">${saatler.aksam}</span></th>
        <th>📌 İZİNLİLER</th></tr></thead><tbody>`;
    for (let i = 0; i < vardiyalar.length; i++) {
        let v = vardiyalar[i];
        let tarihObj = new Date(v.tarih);
        let gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][tarihObj.getDay()];
        let tarihStr = `${tarihObj.getDate()} ${tarihObj.toLocaleString('tr', { month: 'long' })} ${gunAdi}`;
        let hsNot = (tarihObj.getDay() === 0 || tarihObj.getDay() === 6) ? ' 🟡' : '';
        html += `<tr data-gun="${i}">
            <td class="tarih-hucre"><strong>${tarihStr}${hsNot}</strong></td>
            <td class="gece-hucre" data-vardiya="gece">${v.gece.map(p => `<span class="personel-etiket erkek" data-p="${p}">${p}</span>`).join('')}</td>
            <td class="sabah-hucre" data-vardiya="sabah">${v.sabah.map(p => `<span class="personel-etiket ${getKadinlar().includes(p) ? 'kadin' : 'erkek'}" data-p="${p}">${p}</span>`).join('')}</td>
            <td class="aksam-hucre" data-vardiya="aksam">${v.aksam.map(p => `<span class="personel-etiket ${getKadinlar().includes(p) ? 'kadin' : 'erkek'}" data-p="${p}">${p}</span>`).join('')}</td>
            <td style="background:#fff1cf;">${v.izinli.length ? v.izinli.map(p => `<span class="personel-etiket izin">${p}</span>`).join('') : '—'}</td>
        </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('tabloAlan').innerHTML = html;
    
    if (duzenlemeModu) {
        document.querySelectorAll('.gece-hucre span, .sabah-hucre span, .aksam-hucre span').forEach(span => {
            span.style.cursor = 'pointer';
            span.addEventListener('click', (e) => { e.stopPropagation(); acDropdown(span); });
        });
    }
}

async function acDropdown(span) {
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
    
    // Mevcut listeyi göster
    let baslik = document.createElement('div');
    baslik.textContent = `Mevcut (${mevcutListe.length} kişi): ${mevcutListe.join(', ')}`;
    baslik.style.fontWeight = 'bold'; baslik.style.padding = '8px'; baslik.style.background = '#f0f0f0';
    dropdown.appendChild(baslik);
    
    // "Listeyi Düzenle (Elle)" seçeneği
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
    
    // Mevcut listeyi değiştir
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
    
    let hr2 = document.createElement('hr'); dropdown.appendChild(hr2);
    
    let ekleBaslik = document.createElement('div');
    ekleBaslik.textContent = '➕ Kalan personelden ekle:';
    ekleBaslik.style.fontWeight = 'bold'; ekleBaslik.style.padding = '5px';
    dropdown.appendChild(ekleBaslik);
    
    let kalanAdaylar = adaylar.filter(a => !mevcutListe.includes(a));
    if (kalanAdaylar.length === 0) {
        let bos = document.createElement('div');
        bos.textContent = '(eklenecek uygun personel yok)';
        bos.style.color = '#999';
        dropdown.appendChild(bos);
    } else kalanAdaylar.forEach(adm => {
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
    
    let cikarBaslik = document.createElement('div');
    cikarBaslik.textContent = '➖ Bu vardiyadan çıkar:';
    cikarBaslik.style.fontWeight = 'bold'; cikarBaslik.style.padding = '5px'; cikarBaslik.style.marginTop = '5px';
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
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Değişiklikler onaylandı ve hafızaya kaydedildi.</div>';
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
    document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">🔄 İptal edildi, son onaylanmış tabloya dönüldü.</div>';
}

function istatistikGoster(vardiyalar) {
    let calisma = {};
    personeller.forEach(p => calisma[p.isim] = { gece:0, sabah:0, aksam:0, toplam:0, hs:0 });
    for (let v of vardiyalar) {
        for (let p of v.gece) { calisma[p].gece++; calisma[p].toplam++; }
        for (let p of v.sabah) { calisma[p].sabah++; calisma[p].toplam++; }
        for (let p of v.aksam) { calisma[p].aksam++; calisma[p].toplam++; }
        if (v.haftasonu) for (let p of [...v.gece, ...v.sabah, ...v.aksam]) calisma[p].hs++;
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

// ============ CRUD İŞLEMLERİ (PERSONEL, İZİN, KURAL) ============
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
        personelListesiniGoster();
        await veriKaydet();
        if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
    }
};

window.izinSil = async (idx) => {
    izinler.splice(idx, 1);
    vardiyaHafizasi = [];
    izinListesiniGoster();
    await veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
};

window.kuralSil = async (idx) => {
    kurallar.splice(idx, 1);
    kuralListesiniGoster();
    await veriKaydet();
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
    personelListesiniGoster();
    await veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

async function izinEkle() {
    let per = document.getElementById('izinPersonel').value;
    let bas = document.getElementById('izinBaslangic').value;
    let bit = document.getElementById('izinBitis').value;
    if (!per || !bas || !bit) { alert("Tüm alanları doldurun"); return; }
    izinler.push({ personel: per, baslangic: bas, bitis: bit });
    izinListesiniGoster();
    document.getElementById('izinPersonel').value = '';
    document.getElementById('izinBaslangic').value = '';
    document.getElementById('izinBitis').value = '';
    await veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

async function kuralEkle() {
    let tip = document.getElementById('kuralTipi').value;
    let personel = document.getElementById('kuralPersonel').value;
    let kuralAd = document.getElementById('kuralAdi').value;
    if (tip === 'personel' && !personel) { alert("Personel seçin"); return; }
    kurallar.push({ tip, personel: tip === 'personel' ? personel : null, kural: kuralAd });
    kuralListesiniGoster();
    await veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

function excelIndir() {
    if (!window.sonVardiyalar) { alert("Önce takvim oluşturun"); return; }
    let data = [['GÜZELEL PETROL A.Ş. VARDİYA ÇİZELGESİ'], [`Tarih: ${new Date().toLocaleString('tr-TR')}`], [], ['TARİH', 'GECE', 'SABAH', 'AKŞAM', 'İZİNLİLER']];
    for (let v of window.sonVardiyalar) {
        let gun = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'][new Date(v.tarih).getDay()];
        data.push([`${new Date(v.tarih).toLocaleDateString('tr-TR')} ${gun}`, v.gece.join(', '), v.sabah.join(', '), v.aksam.join(', '), v.izinli.join(', ')]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:28},{wch:22},{wch:28},{wch:28},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vardiya");
    XLSX.writeFile(wb, `GUZELEL_Vardiya_${new Date().toISOString().slice(0,10)}.xlsx`);
}

async function whatsappPaylas() {
    if (!window.sonVardiyalar) { alert("Önce takvim oluşturun"); return; }
    let el = document.querySelector('#tabloAlan table');
    if (!el) return;
    let canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
    canvas.toBlob(blob => {
        let a = document.createElement('a');
        a.download = 'vardiya.png';
        a.href = URL.createObjectURL(blob);
        a.click();
        alert("Tablo resmi indirildi. WhatsApp'tan gönderebilirsiniz.");
        window.open('https://web.whatsapp.com/', '_blank');
    });
}

// ============ EVENT LISTENER'LAR ============
document.getElementById('ekleBtn').addEventListener('click', personelEkle);
document.getElementById('izinEkleBtn').addEventListener('click', izinEkle);
document.getElementById('kuralEkleBtn').addEventListener('click', kuralEkle);
document.getElementById('takvimOlusturBtn').addEventListener('click', takvimOlustur);
document.getElementById('excelIndirBtn').addEventListener('click', excelIndir);
document.getElementById('whatsappBtn').addEventListener('click', whatsappPaylas);
document.getElementById('duzenleBtn').addEventListener('click', duzenlemeModunuAc);
document.getElementById('kaydetBtn').addEventListener('click', degisiklikleriOnayla);
document.getElementById('iptalBtn').addEventListener('click', degisiklikleriIptal);
document.getElementById('printBtn').addEventListener('click', () => window.print());

document.getElementById('kuralTipi').addEventListener('change', function() {
    document.getElementById('personelSecimDiv').style.display = this.value === 'personel' ? 'block' : 'none';
});

document.getElementById('baslangicTarihi').value = new Date().toISOString().slice(0,10);
// ============ KALICI VERİ (localStorage) ============
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

// Varsayılan personel (ilk yüklemede)
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

function veriYukle() {
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
}

function veriKaydet() {
    localStorage.setItem("guzelel_personeller", JSON.stringify(personeller));
    localStorage.setItem("guzelel_izinler", JSON.stringify(izinler));
    localStorage.setItem("guzelel_hafiza", JSON.stringify(vardiyaHafizasi));
    localStorage.setItem("guzelel_kurallar", JSON.stringify(kurallar));
}

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

// ============ KURAL KONTROLÜ ============
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

// ============ DETERMİNİSTİK VARDİYA OLUŞTURMA (SABİT DÖNGÜ) ============
function vardiyaOlustur(gunAdet, baslangic, hafizaKullan) {
    let vardiyalar = [];
    let erkekler = getErkekler();
    let kadinlar = getKadinlar();
    
    // Döngü indeksleri
    let geceIndex = 0;
    let sabahIndex = 0;
    let aksamIndex = 0;
    
    if (hafizaKullan !== 'evet') vardiyaHafizasi = [];
    
    for (let gun = 0; gun < gunAdet; gun++) {
        let tarih = new Date(baslangic);
        tarih.setDate(baslangic.getDate() + gun);
        let haftasonu = (tarih.getDay() === 0 || tarih.getDay() === 6);
        
        // İzinliler (normal izin + pazartesi izin kuralı)
        let izinliler = personeller.filter(p => izinKontrol(p.isim, tarih)).map(p => p.isim);
        let kuralIzinliler = personeller.filter(p => {
            for (let k of kurallar) {
                if (k.tip === "personel" && k.personel === p.isim && k.kural === "pazartesi_izin" && tarih.getDay() === 1) return true;
            }
            return false;
        }).map(p => p.isim);
        let tumIzinliler = [...new Set([...izinliler, ...kuralIzinliler])];
        
        // MUSAİT ERKEKLER (gece için)
        let musaitErkekler = erkekler.filter(e => !tumIzinliler.includes(e) && yetkinlikKontrol(e, "gece") && kuralKontrol(e, "gece", tarih));
        
        // Gece vardiyası (2 erkek, döngüsel)
        let gece = [];
        if (musaitErkekler.length >= 2) {
            for (let i = 0; i < 2; i++) {
                let idx = (geceIndex + i) % musaitErkekler.length;
                gece.push(musaitErkekler[idx]);
            }
            geceIndex = (geceIndex + 2) % musaitErkekler.length;
        }
        
        // Kalan tüm personel (gece ve izinliler hariç)
        let kalanlar = personeller.filter(p => !tumIzinliler.includes(p.isim) && !gece.includes(p.isim)).map(p => p.isim);
        let kalanErkekler = kalanlar.filter(p => erkekler.includes(p));
        let kalanKadinlar = kalanlar.filter(p => kadinlar.includes(p));
        
        // Sabah vardiyası (3 kişi, max 2 kadın)
        let sabah = [];
        // Önce kadınları al (max 2)
        let alinacakKadin = Math.min(2, kalanKadinlar.length, 3);
        for (let i = 0; i < alinacakKadin; i++) {
            let idx = (sabahIndex + i) % kalanKadinlar.length;
            sabah.push(kalanKadinlar[idx]);
        }
        // Kalan kontenjanı erkeklerden doldur
        let kalanKont = 3 - sabah.length;
        for (let i = 0; i < kalanKont; i++) {
            if (kalanErkekler.length === 0) break;
            let idx = (sabahIndex + i) % kalanErkekler.length;
            sabah.push(kalanErkekler[idx]);
        }
        sabahIndex = (sabahIndex + 3) % (kalanErkekler.length + kalanKadinlar.length || 1);
        
        // Akşam vardiyası (kalanlar)
        let aksam = kalanlar.filter(p => !sabah.includes(p));
        // Akşamda max kadın sınırını kontrol et
        let aksamKadin = aksam.filter(p => kadinlar.includes(p)).length;
        if (aksamKadin > 2) {
            // Fazla kadını sabah ile takas et
            let fazla = aksamKadin - 2;
            for (let i = 0; i < fazla; i++) {
                let aksamKadini = aksam.find(p => kadinlar.includes(p));
                let sabahErkegi = sabah.find(p => erkekler.includes(p));
                if (aksamKadini && sabahErkegi) {
                    aksam = aksam.filter(p => p !== aksamKadini);
                    sabah = sabah.filter(p => p !== sabahErkegi);
                    aksam.push(sabahErkegi);
                    sabah.push(aksamKadini);
                }
            }
        }
        
        // Sabah ve akşam 3'er kişi olmalı, değilse düzelt
        while (sabah.length < 3 && aksam.length > 3) sabah.push(aksam.pop());
        while (aksam.length < 3 && sabah.length > 3) aksam.push(sabah.pop());
        
        vardiyalar.push({ tarih, gece, sabah, aksam, izinli: tumIzinliler, haftasonu });
        
        // Hafızaya ekle
        for (let p of gece) vardiyaHafizasi.push({ tarih: new Date(tarih), personel: p, vardiya: "gece", haftasonu });
        for (let p of sabah) vardiyaHafizasi.push({ tarih: new Date(tarih), personel: p, vardiya: "sabah", haftasonu });
        for (let p of aksam) vardiyaHafizasi.push({ tarih: new Date(tarih), personel: p, vardiya: "aksam", haftasonu });
    }
    veriKaydet();
    return vardiyalar;
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

function acDropdown(span) {
    if (!duzenlemeModu) return;
    if (aktifDropdown) aktifDropdown.remove();
    let eskiPersonel = span.getAttribute('data-p');
    let td = span.closest('td');
    let gun = parseInt(td.closest('tr').getAttribute('data-gun'));
    let vardiyaTipi = td.getAttribute('data-vardiya');
    let tarih = vardiyalarGuncel[gun].tarih;
    let izinliler = personeller.filter(p => izinKontrol(p.isim, tarih)).map(p => p.isim);
    let adaylar = personeller.filter(p => !izinliler.includes(p.isim) && !(vardiyaTipi === 'gece' && p.cinsiyet === 'K') && yetkinlikKontrol(p.isim, vardiyaTipi) && kuralKontrol(p.isim, vardiyaTipi, tarih)).map(p => p.isim);
    let dropdown = document.createElement('div');
    dropdown.className = 'personel-dropdown';
    let rect = span.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    adaylar.forEach(adm => {
        let opt = document.createElement('div');
        opt.textContent = adm;
        opt.onclick = () => {
            let liste = vardiyalarGuncel[gun][vardiyaTipi];
            let idx = liste.indexOf(eskiPersonel);
            if (idx !== -1) liste[idx] = adm;
            tabloyuGoster(vardiyalarGuncel);
            document.getElementById('kaydetBtn').style.display = 'inline-block';
            document.getElementById('kontrolMesaji').innerHTML = '<div class="uyari">✏️ Değişiklik yapıldı. "Değişiklikleri Onayla" butonuna tıklayın.</div>';
            dropdown.remove();
            aktifDropdown = null;
        };
        dropdown.appendChild(opt);
    });
    document.body.appendChild(dropdown);
    aktifDropdown = dropdown;
    setTimeout(() => {
        const kapat = (e) => {
            if (dropdown && !dropdown.contains(e.target) && !span.contains(e.target)) {
                dropdown.remove();
                aktifDropdown = null;
                document.removeEventListener('click', kapat);
            }
        };
        document.addEventListener('click', kapat);
    }, 10);
}

function degisiklikleriOnayla() {
    vardiyaHafizasi = [];
    for (let v of vardiyalarGuncel) {
        let t = new Date(v.tarih);
        for (let p of v.gece) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "gece", haftasonu: v.haftasonu });
        for (let p of v.sabah) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "sabah", haftasonu: v.haftasonu });
        for (let p of v.aksam) vardiyaHafizasi.push({ tarih: t, personel: p, vardiya: "aksam", haftasonu: v.haftasonu });
    }
    window.originalVardiyalar = vardiyalarGuncel.map(v => ({ ...v, tarih: new Date(v.tarih), gece: [...v.gece], sabah: [...v.sabah], aksam: [...v.aksam], izinli: [...v.izinli] }));
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Değişiklikler onaylandı ve hafızaya kaydedildi.</div>';
    document.getElementById('kaydetBtn').style.display = 'none';
    duzenlemeModunuKapat();
    istatistikGoster(vardiyalarGuncel);
    veriKaydet();
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

function takvimOlustur() {
    let gunSayisi = parseInt(document.getElementById('gunSayisi').value);
    let baslangicStr = document.getElementById('baslangicTarihi').value;
    let baslangic = baslangicStr ? new Date(baslangicStr) : new Date();
    let hafizaKullan = document.getElementById('hafizaKullan').value;
    let v = vardiyaOlustur(gunSayisi, baslangic, hafizaKullan);
    if (!v) return;
    vardiyalarGuncel = v;
    window.originalVardiyalar = JSON.parse(JSON.stringify(v));
    tabloyuGoster(v);
    istatistikGoster(v);
    document.getElementById('tabloKarti').style.display = 'block';
    document.getElementById('kontrolMesaji').innerHTML = '<div class="basarili">✅ Vardiyalar oluşturuldu.</div>';
    window.sonVardiyalar = v;
    window.sonBaslangic = baslangic;
}

// ============ CRUD İŞLEMLERİ ============
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

window.personelSil = (idx) => {
    if (confirm(`${personeller[idx].isim} silinsin mi?`)) {
        personeller.splice(idx, 1);
        vardiyaHafizasi = [];
        personelListesiniGoster();
        veriKaydet();
        if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
    }
};

window.izinSil = (idx) => {
    izinler.splice(idx, 1);
    vardiyaHafizasi = [];
    izinListesiniGoster();
    veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
};

window.kuralSil = (idx) => {
    kurallar.splice(idx, 1);
    kuralListesiniGoster();
    veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
};

function personelEkle() {
    let isim = document.getElementById('yeniIsim').value.trim().toUpperCase();
    let cins = document.getElementById('yeniCinsiyet').value;
    let yet = document.getElementById('yeniYetkinlik').value;
    if (!isim) { alert("Personel adı girin"); return; }
    if (personeller.some(p => p.isim === isim)) { alert("Zaten var"); return; }
    personeller.push({ isim, cinsiyet: cins, yetkinlik: yet });
    document.getElementById('yeniIsim').value = '';
    personelListesiniGoster();
    veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

function izinEkle() {
    let per = document.getElementById('izinPersonel').value;
    let bas = document.getElementById('izinBaslangic').value;
    let bit = document.getElementById('izinBitis').value;
    if (!per || !bas || !bit) { alert("Tüm alanları doldurun"); return; }
    izinler.push({ personel: per, baslangic: bas, bitis: bit });
    izinListesiniGoster();
    document.getElementById('izinPersonel').value = '';
    document.getElementById('izinBaslangic').value = '';
    document.getElementById('izinBitis').value = '';
    veriKaydet();
    if (document.getElementById('tabloKarti').style.display !== 'none') takvimOlustur();
}

function kuralEkle() {
    let tip = document.getElementById('kuralTipi').value;
    let personel = document.getElementById('kuralPersonel').value;
    let kuralAd = document.getElementById('kuralAdi').value;
    if (tip === 'personel' && !personel) { alert("Personel seçin"); return; }
    kurallar.push({ tip, personel: tip === 'personel' ? personel : null, kural: kuralAd });
    kuralListesiniGoster();
    veriKaydet();
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

// ============ EVENT LISTENER'LAR VE BAŞLANGIÇ ============
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
veriYukle();
personelListesiniGoster();
izinListesiniGoster();
kuralListesiniGoster();
setTimeout(() => takvimOlustur(), 100);
// Vardiya tipleri ve saatleri
const vardiyaTipleri = {
    'S': { aciklama: 'Sabah', saat: '08:00-16:00', class: 'sabah', emoji: '🌅' },
    'A': { aciklama: 'Akşam', saat: '16:00-00:00', class: 'aksam', emoji: '🌆' },
    'G': { aciklama: 'Gece', saat: '00:00-08:00', class: 'gece', emoji: '🌙' },
    'I': { aciklama: 'İZİN', saat: '---', class: 'izin', emoji: '😴' }
};

// Personel listesi
let personeller = []; // {isim, cinsiyet}

// Sayfa yüklendiğinde
document.getElementById('ekleBtn').addEventListener('click', personelEkle);
document.getElementById('olusturBtn').addEventListener('click', takvimOlustur);
document.getElementById('kaydetBtn').addEventListener('click', txtKaydet);
document.getElementById('excelBtn').addEventListener('click', excelKaydet);

document.getElementById('personelInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') personelEkle();
});

// Personel ekle
function personelEkle() {
    let isim = document.getElementById('personelInput').value.trim();
    let cinsiyet = document.getElementById('cinsiyetSelect').value;
    
    if (!isim) {
        alert('Lütfen personel adı girin!');
        return;
    }
    
    if (personeller.some(p => p.isim === isim)) {
        alert('Bu personel zaten eklenmiş!');
        return;
    }
    
    personeller.push({ isim: isim, cinsiyet: cinsiyet });
    personelListesiniGoster();
    document.getElementById('personelInput').value = '';
}

function personelListesiniGoster() {
    let container = document.getElementById('personelListesi');
    
    if (personeller.length === 0) {
        container.innerHTML = '<p style="color: gray;">👈 Henüz personel eklenmedi.</p>';
        return;
    }
    
    container.innerHTML = personeller.map((p, index) => `
        <div class="personel-badge ${p.cinsiyet === 'K' ? 'kadin' : ''}">
            ${p.cinsiyet === 'K' ? '👩' : '👨'} ${p.isim} (${p.cinsiyet === 'K' ? 'Kadın' : 'Erkek'})
            <button onclick="personelSil(${index})">✖</button>
        </div>
    `).join('');
}

window.personelSil = function(index) {
    personeller.splice(index, 1);
    personelListesiniGoster();
};

// HER GÜN İÇİN VARDİYA KONTROLÜ
function vardiyaKontrolEt(gunlukVardiyalar) {
    let sabahSayisi = 0;
    let aksamSayisi = 0;
    let geceSayisi = 0;
    let geceKadinVarMi = false;
    
    for (let vardiya of gunlukVardiyalar) {
        if (vardiya === 'S') sabahSayisi++;
        else if (vardiya === 'A') aksamSayisi++;
        else if (vardiya === 'G') geceSayisi++;
    }
    
    // Gece vardiyasında kadın kontrolü (personel listesine göre)
    for (let i = 0; i < gunlukVardiyalar.length; i++) {
        if (gunlukVardiyalar[i] === 'G' && personeller[i].cinsiyet === 'K') {
            geceKadinVarMi = true;
            break;
        }
    }
    
    let hatalar = [];
    if (sabahSayisi < 3) hatalar.push(`Sabah vardiyasında ${sabahSayisi} kişi var (EN AZ 3 gerekli)`);
    if (aksamSayisi < 3) hatalar.push(`Akşam vardiyasında ${aksamSayisi} kişi var (EN AZ 3 gerekli)`);
    if (geceSayisi < 2) hatalar.push(`Gece vardiyasında ${geceSayisi} kişi var (EN AZ 2 gerekli)`);
    if (geceKadinVarMi) hatalar.push(`❌ Gece vardiyasında KADIN personel var! Bu yasak!`);
    
    return {
        uygun: hatalar.length === 0,
        hatalar: hatalar,
        sabah: sabahSayisi,
        aksam: aksamSayisi,
        gece: geceSayisi
    };
}

// Vardiya döngüsünü oluştur
function vardiyaDongusuOlustur(donguListesi, personelSayisi, toplamGun) {
    let personelVardiyalari = [];
    let donguUzunluk = donguListesi.length;
    
    for (let p = 0; p < personelSayisi; p++) {
        let vardiyalar = [];
        for (let gun = 0; gun < toplamGun; gun++) {
            let index = (gun + p) % donguUzunluk;
            vardiyalar.push(donguListesi[index]);
        }
        personelVardiyalari.push(vardiyalar);
    }
    
    return personelVardiyalari;
}

// Takvim oluştur ve kontrol et
function takvimOlustur() {
    // Döngüyü al
    let donguInput = document.getElementById('donguInput').value;
    let donguListesi = donguInput.toUpperCase().split(' ').filter(item => item !== '');
    
    if (donguListesi.length === 0) {
        alert('Geçerli bir döngü girin!');
        return;
    }
    
    let gecersizler = donguListesi.filter(item => !vardiyaTipleri[item]);
    if (gecersizler.length > 0) {
        alert(`Geçersiz vardiya kodları: ${gecersizler.join(', ')}`);
        return;
    }
    
    if (personeller.length === 0) {
        alert('En az bir personel ekleyin!');
        return;
    }
    
    let toplamGun = parseInt(document.getElementById('gunSayisi').value);
    let baslangicTarihi = document.getElementById('baslangicTarihi').value;
    let baslangic = baslangicTarihi ? new Date(baslangicTarihi) : new Date();
    
    // Vardiyaları oluştur
    let personelVardiyalari = vardiyaDongusuOlustur(donguListesi, personeller.length, toplamGun);
    
    // HER GÜN KONTROL ET
    let kontrolSonuclari = [];
    let genelUygun = true;
    
    for (let gun = 0; gun < toplamGun; gun++) {
        let gunlukVardiyalar = [];
        for (let p = 0; p < personeller.length; p++) {
            gunlukVardiyalar.push(personelVardiyalari[p][gun]);
        }
        let sonuc = vardiyaKontrolEt(gunlukVardiyalar);
        kontrolSonuclari.push(sonuc);
        if (!sonuc.uygun) genelUygun = false;
    }
    
    tabloyuGoster(personelVardiyalari, baslangic, toplamGun, donguListesi, kontrolSonuclari, genelUygun);
    
    window.sonVeriler = {
        personelVardiyalari: personelVardiyalari,
        personeller: personeller,
        baslangic: baslangic,
        toplamGun: toplamGun,
        donguListesi: donguListesi,
        kontrolSonuclari: kontrolSonuclari
    };
}

function tabloyuGoster(personelVardiyalari, baslangic, toplamGun, donguListesi, kontrolSonuclari, genelUygun) {
    let container = document.getElementById('takvim');
    let sonucKarti = document.getElementById('sonucKarti');
    
    // Genel durum mesajı
    let durumHtml = genelUygun ? 
        '<div class="kontrol-basarili">✅ TÜM GÜNLER KURALLARA UYGUN! Sabah≥3, Akşam≥3, Gece≥2, Gece kadın yok!</div>' :
        '<div class="kontrol-hatasi">❌ BAZI GÜNLER KURALLARA UYMUYOR! Aşağıdaki hataları inceleyin!</div>';
    
    // Tablo başlığı
    let html = durumHtml + '<div style="overflow-x: auto;"><table><thead><tr>';
    html += '<th>Personel / Gün<br><small>👤 | Saat</small></th>';
    
    for (let gun = 0; gun < toplamGun; gun++) {
        let tarih = new Date(baslangic);
        tarih.setDate(baslangic.getDate() + gun);
        let tarihStr = `${tarih.getDate()}/${tarih.getMonth()+1}`;
        let gunAdi = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'][tarih.getDay()];
        
        // Hata varsa kırmızı işaret
        let hataIkon = kontrolSonuclari[gun].uygun ? '' : ' ❌';
        html += `<th>${gun+1}<br><small>${tarihStr}<br>${gunAdi}${hataIkon}</small></th>`;
    }
    html += `</tr></thead><tbody>`;
    
    // Her personel için satır
    for (let p = 0; p < personeller.length; p++) {
        let personel = personeller[p];
        let vardiyalar = personelVardiyalari[p];
        let cinsiyetSembol = personel.cinsiyet === 'K' ? '👩' : '👨';
        
        html += `<tr class="personel-satiri">
                    <td style="font-weight: bold; background: #f0f0f0;">
                        ${cinsiyetSembol} ${personel.isim}<br>
                        <small>${personel.cinsiyet === 'K' ? 'Kadın' : 'Erkek'}</small>
                    </td>`;
        
        for (let gun = 0; gun < toplamGun; gun++) {
            let kod = vardiyalar[gun];
            let bilgi = vardiyaTipleri[kod];
            html += `<td class="vardiya-hucresi ${bilgi.class}" style="font-size: 12px;">
                        <strong>${kod}</strong> ${bilgi.emoji}<br>
                        <small>${bilgi.saat}</small>
                     </td>`;
        }
        html += `</tr>`;
    }
    
    html += `</tbody></table></div>`;
    
    // Günlük özet (hangi günlerde ne hatası var)
    html += `<div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
        <strong>📋 Günlük Kontrol Raporu:</strong><br>`;
    
    for (let gun = 0; gun < toplamGun; gun++) {
        let sonuc = kontrolSonuclari[gun];
        if (!sonuc.uygun) {
            html += `<span style="color: red;">❌ ${gun+1}. Gün:</span> ${sonuc.hatalar.join(', ')}<br>`;
        }
    }
    
    html += `<br><span style="color: green;">✅ Uygun günler: ${kontrolSonuclari.filter(s => s.uygun).length}/${toplamGun}</span>
    </div>`;
    
    // Lejant
    html += `<div class="legend"><strong>📖 Lejant:</strong>`;
    for (let [kod, bilgi] of Object.entries(vardiyaTipleri)) {
        html += `<div class="legend-item"><div class="legend-renk ${bilgi.class}"></div><span><strong>${kod}</strong> = ${bilgi.aciklama} (${bilgi.saat})</span></div>`;
    }
    html += `<div class="legend-item"><span>🔄 Döngü: ${donguListesi.join(' → ')} (${donguListesi.length} gün)</span></div>`;
    html += `<div class="legend-item"><span>📏 Kurallar: Sabah≥3, Akşam≥3, Gece≥2, Gecede Kadın Yasak</span></div></div>`;
    
    container.innerHTML = html;
    sonucKarti.style.display = 'block';
}

function txtKaydet() {
    if (!window.sonVeriler) {
        alert('Önce bir takvim oluşturun!');
        return;
    }
    
    let v = window.sonVeriler;
    let icerik = "=== PROFESYONEL VARDİYA TAKVİMİ ===\n";
    icerik += `Oluşturulma: ${new Date().toLocaleString('tr-TR')}\n`;
    icerik += `Standart Döngü: ${v.donguListesi.join(' ')}\n`;
    icerik += `Toplam Gün: ${v.toplamGun}\n`;
    icerik += `Personel Sayısı: ${v.personeller.length}\n`;
    icerik += "-".repeat(80) + "\n\n";
    
    // Tablo başlığı
    icerik += "Gün\tTarih\t";
    for (let p of v.personeller) {
        icerik += `${p.isim} (${p.cinsiyet === 'K' ? 'K' : 'E'})\t`;
    }
    icerik += "\n" + "-".repeat(80) + "\n";
    
    for (let gun = 0; gun < v.toplamGun; gun++) {
        let tarih = new Date(v.baslangic);
        tarih.setDate(v.baslangic.getDate() + gun);
        let tarihStr = tarih.toLocaleDateString('tr-TR');
        icerik += `${gun+1}\t${tarihStr}\t`;
        
        for (let p = 0; p < v.personeller.length; p++) {
            let kod = v.personelVardiyalari[p][gun];
            icerik += `${kod}\t`;
        }
        icerik += "\n";
    }
    
    indirDosya(icerik, 'vardiya_takvimi.txt', 'text/plain');
}

function excelKaydet() {
    if (!window.sonVeriler) {
        alert('Önce bir takvim oluşturun!');
        return;
    }
    
    let v = window.sonVeriler;
    let csvSatirlari = [];
    
    let baslik = ['Gün', 'Tarih', 'Gün Adı', ...v.personeller.map(p => `${p.isim} (${p.cinsiyet === 'K' ? 'Kadın' : 'Erkek'})`)];
    csvSatirlari.push(baslik.join(','));
    
    for (let gun = 0; gun < v.toplamGun; gun++) {
        let tarih = new Date(v.baslangic);
        tarih.setDate(v.baslangic.getDate() + gun);
        let tarihStr = tarih.toLocaleDateString('tr-TR');
        let gunAdi = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][tarih.getDay()];
        
        let satir = [gun+1, tarihStr, gunAdi];
        for (let p = 0; p < v.personeller.length; p++) {
            let kod = v.personelVardiyalari[p][gun];
            let bilgi = vardiyaTipleri[kod];
            satir.push(`${kod} - ${bilgi.aciklama} ${bilgi.saat}`);
        }
        csvSatirlari.push(satir.map(h => `"${h}"`).join(','));
    }
    
    indirDosya(csvSatirlari.join('\n'), 'vardiya_takvimi.csv', 'text/csv;charset=utf-8;');
}

function indirDosya(icerik, dosyaAdi, tip) {
    const blob = new Blob([icerik], { type: tip });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = dosyaAdi;
    link.click();
    URL.revokeObjectURL(link.href);
}
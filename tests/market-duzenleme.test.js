const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function uygulama() {
    const mesajlar = [];
    const elemanlar = new Map();
    const context = vm.createContext({
        document: {
            getElementById(id) {
                if (!elemanlar.has(id)) elemanlar.set(id, { innerHTML: '', style: {} });
                return elemanlar.get(id);
            },
            querySelectorAll: () => []
        },
        window: { addEventListener() {} }, console,
        alert: mesaj => mesajlar.push(mesaj),
        confirm: () => true
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), context);
    vm.runInContext(`
        marketPersoneller = ['A', 'B', 'C'].map((isim, i) => ({
            isim, izinGunu: i + 1, cinsiyet: 'E', yetkinlik: 'ikisi_de'
        }));
        const tarih = new Date(2026, 10, 18);
        marketVardiyalarGuncel = [{
            tarih, tip: 'normal', gece8: [marketPersoneller[0]],
            sabah8: [marketPersoneller[1]], aksam8: [marketPersoneller[2]], izinli: null
        }];
    `, context);
    return { context, mesajlar, elemanlar };
}

test('normal günde izinli seçilir ve daha sonra kaldırılır', () => {
    const { context, elemanlar } = uygulama();
    vm.runInContext('marketDuzenlemeModunuAc()', context);
    assert.match(elemanlar.get('marketTabloAlan').innerHTML, /İzinli seç/);
    vm.runInContext("marketIzinliDegistir(0, 'A')", context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'izin_gunu');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'A');
    vm.runInContext('marketIzinliDegistir(0, null)', context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'normal');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli', context), null);
});

test('vardiyadaki kişi, diğer vardiyadaki veya izinli personelle değiştirilebilir', () => {
    const { context } = uygulama();
    vm.runInContext("marketVardiyaKisiDegistir(0, 'gece8', marketPersoneller[1])", context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].gece8[0].isim', context), 'B');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].sabah8[0].isim', context), 'A');
    vm.runInContext("marketIzinliDegistir(0, 'A'); marketVardiyaKisiDegistir(0, 'gece12', marketPersoneller[0])", context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].gecePersonel.isim', context), 'A');
    assert.notEqual(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'A');
    assert.ok(vm.runInContext('marketNormalize(marketKayitVerisi())', context));
});

test('geçici personel yalnız uygun tarihte seçilir ve mevcut izinli korunur', () => {
    const { context, mesajlar } = uygulama();
    vm.runInContext(`
        marketPersoneller.push({isim:'G', cinsiyet:'E', yetkinlik:'ikisi_de', gecici:true, baslangic:'2026-11-18', bitis:'2026-11-18'});
        marketIzinliDegistir(0, 'A');
    `, context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'normal');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'A');
    assert.equal(vm.runInContext("Object.values(marketAlanlari(marketVardiyalarGuncel[0])).flat().filter(p => p.isim === 'G').length", context), 1);
    vm.runInContext("marketPersoneller[3].bitis = '2026-11-17'; marketVardiyaKisiDegistir(0, 'gece8', marketPersoneller[3])", context);
    assert.match(mesajlar.at(-1), /müsait değil/);
});

test('yetkinlik ve sonraki gün dinlenme ihlali değişikliği engeller', () => {
    const { context, mesajlar } = uygulama();
    vm.runInContext("marketPersoneller[1].yetkinlik = 'sadece_gunduz'; marketVardiyaKisiDegistir(0, 'gece8', marketPersoneller[1])", context);
    assert.match(mesajlar.at(-1), /yetkin değil/);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].gece8[0].isim', context), 'A');
    vm.runInContext(`
        marketPersoneller[1].yetkinlik = 'ikisi_de';
        marketVardiyalarGuncel.push({tarih:gunEkle(tarih, 1), tip:'normal', gece8:[marketPersoneller[0]], sabah8:[marketPersoneller[1]], aksam8:[marketPersoneller[2]], izinli:null});
        marketVardiyaKisiDegistir(0, 'aksam8', marketPersoneller[0]);
    `, context);
    assert.match(mesajlar.at(-1), /dinlenme/);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].aksam8[0].isim', context), 'C');
});

test('iptal düzenlemeye başlamadan önce görülen çizelgeyi geri getirir', async () => {
    const { context } = uygulama();
    vm.runInContext("marketDuzenlemeModunuAc(); marketIzinliDegistir(0, 'A')", context);
    await vm.runInContext('marketDegisiklikleriIptal()', context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'normal');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli', context), null);
});

test('kaydedilmiş manuel çizelge, atanmamış geçici personel yüzünden değiştirilmez', async () => {
    const { context } = uygulama();
    vm.runInContext(`
        marketIzinliDegistir(0, 'A');
        const kayit = marketKayitVerisi();
        marketPersoneller.push({isim:'G', cinsiyet:'E', yetkinlik:'ikisi_de', gecici:true, baslangic:'2026-11-18', bitis:'2026-11-18'});
        marketParametreleri = () => ({hafta:1, baslangic:tarih});
        takvimOku = async () => kayit;
        marketVardiyaOlustur = () => { throw new Error('Kayıtlı takvim yeniden oluşturulmamalı'); };
    `, context);
    await vm.runInContext('marketTakvimOlustur()', context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'A');
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'izin_gunu');
});

test('izinli değiştirilirken mevcut ödünç personel korunur', () => {
    const { context } = uygulama();
    vm.runInContext(`
        personeller = [{isim:'D', cinsiyet:'E', yetkinlik:'hepsi'}];
        vardiyalarGuncel = [-1,0,1].map(n => ({tarih:gunEkle(tarih,n), gece:[], sabah:[], aksam:[]}));
        marketIzinliDegistir(0, 'A');
        marketOduncEkle(0, personeller[0]);
        marketIzinliDegistir(0, 'B');
    `, context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'B');
    assert.equal(vm.runInContext("Object.values(marketAlanlari(marketVardiyalarGuncel[0])).flat().filter(p => p.odunc).length", context), 1);
});

test('kadro ekleme onaylanmazsa düzenlenmiş çizelge ve personel korunur', async () => {
    const { context } = uygulama();
    vm.runInContext("marketIzinliDegistir(0, 'A')", context);
    for (const [id, value] of Object.entries({
        marketYeniIsim: 'G', marketYeniCinsiyet: 'E', marketYeniYetkinlik: 'ikisi_de',
        marketKadro: 'gecici', marketGeciciBas: '2026-11-18', marketGeciciBit: '2026-11-18'
    })) {
        vm.runInContext(`$( ${JSON.stringify(id)} )`, context).value = value;
    }
    context.confirm = () => false;
    await vm.runInContext('marketPersonelEkle()', context);
    assert.equal(vm.runInContext('marketPersoneller.length', context), 3);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].izinli.isim', context), 'A');
});

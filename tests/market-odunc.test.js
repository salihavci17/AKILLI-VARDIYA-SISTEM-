const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function uygulama() {
    const mesajlar = [];
    const elemanlar = new Map();
    const document = {
        getElementById(id) {
            if (!elemanlar.has(id)) elemanlar.set(id, { innerHTML: '', style: {} });
            return elemanlar.get(id);
        },
        querySelectorAll: () => []
    };
    const context = vm.createContext({
        document, window: { addEventListener() {} }, console,
        alert: mesaj => mesajlar.push(mesaj)
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), context);
    vm.runInContext(`
        const kisi = (isim) => ({ isim, cinsiyet: 'E', yetkinlik: 'ikisi_de' });
        marketPersoneller = [kisi('A'), kisi('B'), kisi('C')];
        personeller = [{ isim: 'D', cinsiyet: 'E', yetkinlik: 'hepsi' }];
        const tarih = new Date(2026, 10, 18);
        marketVardiyalarGuncel = [{
            tarih, tip: 'izin_gunu', gecePersonel: marketPersoneller[0],
            gunduzPersonel: marketPersoneller[1], izinli: marketPersoneller[2]
        }];
        vardiyalarGuncel = [-1, 0, 1].map(n => ({
            tarih: gunEkle(tarih, n), gece: [], sabah: [], aksam: [], izinli: ['D']
        }));
    `, context);
    return { context, mesajlar, elemanlar };
}

test('ödünç düğmesi düzenleme açılmadan 12 saatlik günlerde görünür', () => {
    const { context, elemanlar } = uygulama();
    vm.runInContext('marketTabloyuGoster(marketVardiyalarGuncel)', context);
    assert.match(elemanlar.get('marketTabloAlan').innerHTML, /Benzinlikten ödünç ekle/);
});

test('ödünç personel uygun yerleşime atanır ve kayıtlı çizelgeden yeniden yüklenir', () => {
    const { context } = uygulama();
    vm.runInContext('marketOduncEkle(0, personeller[0])', context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'normal');
    assert.equal(vm.runInContext('Object.values(marketAlanlari(marketVardiyalarGuncel[0])).flat().filter(p => p.odunc).length', context), 1);
    assert.equal(vm.runInContext('marketNormalize(marketKayitVerisi())[0].tip', context), 'normal');
    assert.equal(vm.runInContext('Object.keys(marketOduncHaritasi(marketVardiyalarGuncel[0].tarih))[0]', context), 'D');
});

test('benzinlikte aynı gün çalışan veya komşu vardiyaya göre dinlenemeyen personel atanmaz', () => {
    const { context } = uygulama();
    vm.runInContext("vardiyalarGuncel[1].sabah = ['D']", context);
    assert.equal(vm.runInContext('marketOduncYerlesimi(0, personeller[0])', context), null);
    vm.runInContext("vardiyalarGuncel[1].sabah = []; vardiyalarGuncel[0].aksam = ['D']; marketPersoneller[0].yetkinlik = 'sadece_gunduz'; marketPersoneller[1].yetkinlik = 'sadece_gunduz'", context);
    assert.equal(vm.runInContext('marketOduncYerlesimi(0, personeller[0])', context), null);
});

test('benzinlik günleri eksikse ödünç menüsü açıkça uyarır', () => {
    const { context, mesajlar } = uygulama();
    vm.runInContext('vardiyalarGuncel.pop(); marketOduncEkleDropdown({ dataset: { gun: "0" } })', context);
    assert.match(mesajlar[0], /önceki ve sonraki günü kapsayan benzinlik vardiyası/);
});

test('sonraki market gününün dinlenme kuralı ve kayıtlı ödünç korunur', () => {
    const { context } = uygulama();
    vm.runInContext(`
        const g = marketVardiyalarGuncel[0];
        marketVardiyalarGuncel.push({
            tarih: gunEkle(g.tarih, 1), tip: 'normal',
            gece8: [marketPersoneller[0]], sabah8: [marketPersoneller[1]],
            aksam8: [marketPersoneller[2]], izinli: null
        });
        marketOduncEkle(0, personeller[0]);
    `, context);
    assert.equal(vm.runInContext('marketDinlenmeIhlali(0)', context), null);
    assert.notEqual(vm.runInContext("marketVardiyalarGuncel[0].aksam8[0].isim", context), 'A');
    vm.runInContext("marketPersoneller.push({ isim: 'G', gecici: true, baslangic: '2026-11-18', bitis: '2026-11-19' })", context);
    assert.equal(vm.runInContext('marketTakvimindeGeciciEksigi(marketVardiyalarGuncel)', context), false);
});

test('ödünç kaldırılınca iki kişilik izin günü geri gelir', () => {
    const { context } = uygulama();
    vm.runInContext('marketOduncEkle(0, personeller[0]); marketOduncKaldir(0)', context);
    assert.equal(vm.runInContext('marketVardiyalarGuncel[0].tip', context), 'izin_gunu');
    assert.equal(vm.runInContext('Object.keys(marketOduncHaritasi(marketVardiyalarGuncel[0].tarih)).length', context), 0);
});

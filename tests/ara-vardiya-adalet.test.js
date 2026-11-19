const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function uygulama() {
    const elemanlar = new Map();
    const saved = new Map();
    const localStorage = {
        getItem: key => saved.get(key) || null,
        setItem: (key, value) => saved.set(key, value),
        removeItem: key => saved.delete(key)
    };
    const context = vm.createContext({
        document: {
            getElementById(id) {
                if (!elemanlar.has(id)) elemanlar.set(id, { innerHTML: '', style: {} });
                return elemanlar.get(id);
            },
            querySelectorAll: () => []
        },
        localStorage,
        window: { addEventListener() {} },
        console,
        alert() {}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8'), context);
    context.saved = saved;
    context.elements = elemanlar;
    return context;
}

function personelSayisi(context, erkek, kadin) {
    const liste = [
        ...Array.from({ length: erkek }, (_, i) => ({ isim: `E${i}`, cinsiyet: 'E', yetkinlik: 'hepsi' })),
        ...Array.from({ length: kadin }, (_, i) => ({ isim: `K${i}`, cinsiyet: 'K', yetkinlik: 'hepsi' }))
    ];
    vm.runInContext(`personeller = ${JSON.stringify(liste)}`, context);
    return liste;
}

test('10 uygun personelde bir ara vardiya ekler; ara vardiyayı yalnız kadınlara verir', () => {
    const context = uygulama();
    personelSayisi(context, 6, 4);
    const { vardiyalar, hata } = vm.runInContext(
        'vardiyaUret(1, new Date(2026, 10, 19), false, 0)', context
    );
    assert.equal(hata, undefined);
    assert.equal(vardiyalar[0].araSabah.length + vardiyalar[0].araAksam.length, 1);
    for (const isim of [...vardiyalar[0].araSabah, ...vardiyalar[0].araAksam]) {
        assert.equal(vm.runInContext(`personelBul(${JSON.stringify(isim)}).cinsiyet`, context), 'K');
    }
    assert.ok(vardiyalar[0].haftalikIzinli);
    assert.equal(vardiyalar[0].izinli.length, 1);
});

test('8 veya 9 uygun personelde ana vardiya kapsamını ara vardiya uğruna azaltmaz', () => {
    for (const [erkek, kadin] of [[5, 3], [6, 3]]) {
        const context = uygulama();
        personelSayisi(context, erkek, kadin);
        const sonuc = vm.runInContext(
            'vardiyaUret(1, new Date(2026, 10, 19), false, 0)', context
        );
        assert.equal(sonuc.hata, undefined);
        assert.equal(sonuc.vardiyalar[0].araSabah.length + sonuc.vardiyalar[0].araAksam.length, 0);
    }
});

test('11 uygun personelde iki ara vardiyayı ve günlük tek haftalık izni korur', () => {
    const context = uygulama();
    personelSayisi(context, 6, 5);
    const { vardiyalar, hata } = vm.runInContext(
        'vardiyaUret(1, new Date(2026, 10, 19), false, 0)', context
    );
    assert.equal(hata, undefined);
    assert.equal(vardiyalar[0].araSabah.length, 1);
    assert.equal(vardiyalar[0].araAksam.length, 1);
    assert.equal(new Set([
        ...vardiyalar[0].gece, ...vardiyalar[0].sabah, ...vardiyalar[0].aksam,
        ...vardiyalar[0].araSabah, ...vardiyalar[0].araAksam, vardiyalar[0].haftalikIzinli
    ]).size, 11);
    for (const isim of [...vardiyalar[0].araSabah, ...vardiyalar[0].araAksam]) {
        assert.equal(vm.runInContext(`personelBul(${JSON.stringify(isim)}).cinsiyet`, context), 'K');
    }
});

test('haftalık takvimde günlük dinlenme ve ara vardiya kuralları korunur', () => {
    const context = uygulama();
    personelSayisi(context, 6, 4);
    const sonuc = vm.runInContext(
        'vardiyaOlusturYeni(7, new Date(2026, 10, 19), false, 6)', context
    );
    assert.equal(sonuc.hata, undefined);
    assert.equal(sonuc.vardiyalar.length, 7);
    for (const gun of sonuc.vardiyalar) {
        assert.ok(gun.haftalikIzinli);
        assert.equal(gun.izinli.length, 1);
        assert.ok(gun.araSabah.length + gun.araAksam.length <= 1);
        for (const isim of [...gun.araSabah, ...gun.araAksam]) {
            assert.equal(vm.runInContext(`personelBul(${JSON.stringify(isim)}).cinsiyet`, context), 'K');
        }
    }
});

test('yıllık izin haftalık izinden ayrı kalır ve elle ara vardiyaya yalnız uygun kadın eklenir', () => {
    const context = uygulama();
    personelSayisi(context, 6, 4);
    vm.runInContext(`
        const tarih = new Date(2026, 10, 19);
        izinler = [{ personel: 'E0', baslangic: '2026-11-19', bitis: '2026-11-19' }];
        vardiyalarGuncel = [{
            tarih, gece: ['E1', 'E2'], araSabah: [], sabah: [], araAksam: [],
            aksam: [], haftalikIzinli: 'E3', izinli: ['E3'], yedek: [], haftasonu: false
        }];
        duzenlemeModu = true;
    `, context);

    const sonuc = vm.runInContext('vardiyaUret(1, new Date(2026, 10, 19), false, 0)', context);
    assert.notEqual(sonuc.vardiyalar[0].haftalikIzinli, 'E0');
    assert.equal(vm.runInContext(
        "vardiyaListesiDogrula(0, 'araSabah', ['K0'])", context
    ), null);
    vm.runInContext("vardiyaListesiUygula(0, 'araSabah', ['K0'])", context);
    assert.equal(vm.runInContext('JSON.stringify(vardiyalarGuncel[0].araSabah)', context), '["K0"]');
    assert.equal(vm.runInContext('vardiyalarGuncel[0].haftalikIzinli', context), 'E3');
    assert.match(vm.runInContext(
        "vardiyaListesiDogrula(0, 'araAksam', ['E4'])", context
    ) || '', /çalışamaz/);
});

test('adalet hesabı market saatlerini, gece/hafta sonu yükünü ve haftalık izni kapsar', () => {
    const context = uygulama();
    personelSayisi(context, 2, 0);
    vm.runInContext(`
        const tarih = new Date(2026, 10, 21);
        marketVardiyalarGuncel = [{
            tarih, tip: 'normal',
            gece8: [{ isim: 'E0' }], sabah8: [{ isim: 'MARKET1' }],
            aksam8: [{ isim: 'MARKET2' }]
        }];
        vardiyalarGuncel = [{
            tarih, gece: [], araSabah: [], sabah: [], araAksam: [], aksam: [],
            haftalikIzinli: 'E1', izinli: ['E1'], yedek: [], haftasonu: true
        }];
    `, context);
    const rapor = vm.runInContext('adaletOzeti(vardiyalarGuncel)', context);
    assert.equal(rapor.toplamFark, 8);
    assert.equal(rapor.geceFark, 8);
    assert.equal(rapor.hsFark, 8);
    assert.equal(rapor.izinFark, 1);
    assert.equal(rapor.skor, 60);
    vm.runInContext('istatistikGoster(vardiyalarGuncel)', context);
    assert.match(context.elements.get('istatistikAlan').innerHTML, /Market: 8 saat/);
    assert.match(context.elements.get('istatistikAlan').innerHTML, /Gece yükü: 8 saat/);
});

test('onaylanan kayıt ara vardiyaları, haftalık izni ve yedekleri saklar', async () => {
    const context = uygulama();
    vm.runInContext(`
        const tarih = new Date(2026, 10, 19);
        personeller = [
            { isim: 'E0', cinsiyet: 'E', yetkinlik: 'hepsi' },
            { isim: 'E1', cinsiyet: 'E', yetkinlik: 'hepsi' },
            { isim: 'K0', cinsiyet: 'K', yetkinlik: 'hepsi' },
            { isim: 'E2', cinsiyet: 'E', yetkinlik: 'hepsi' }
        ];
        vardiyalarGuncel = [{
            tarih, gece: ['E0'], araSabah: ['K0'], sabah: [], araAksam: [],
            aksam: ['E1'], haftalikIzinli: 'E2', yedek: [],
            izinli: ['E2'], haftasonu: false
        }];
        sonBaslangic = tarih;
        sonGunSayisi = 1;
    `, context);

    await vm.runInContext('degisiklikleriOnayla()', context);
    const kayit = JSON.parse(context.saved.get('guzelel_takvim_2026-11-19_1'));
    assert.deepEqual(kayit[0].araSabah, ['K0']);
    assert.deepEqual(kayit[0].araAksam, []);
    assert.equal(kayit[0].haftalikIzinli, 'E2');
    assert.deepEqual(kayit[0].yedek, []);
});

export const SUPPLEMENTAL_POLICE_PRIORITY_INDEX_URLS = [
    "https://www.police.pref.aomori.jp/koutubu/sidou/torisimari_sisin.html",
    "https://www.pref.iwate.jp/kenkei/kotsu/anzen/3000502.html",
    "https://www.pref.yamagata.jp/800030/kensei/police/koutsuuanzen/sokudo-shishin.html",
    "https://www.police.pref.gunma.jp/687314.html",
];
export const SUPPLEMENTAL_POLICE_PRIORITY_SOURCE_URLS = [
    "https://www.police.pref.aomori.jp/koutubu/sidou/sisin/kosokutai_sisin.pdf",
    "https://www.pref.iwate.jp/kenkei/_res/projects/project_kenkei/_page_/003/000/502/s_r0809_03iwate.pdf",
    "https://www.pref.yamagata.jp/documents/33236/09sakata.pdf",
    "https://www.pref.gunma.jp/uploaded/attachment/695515.pdf",
];
export const SUPPLEMENTAL_POLICE_PRIORITY_TERMS_URLS = [
    "https://www.police.pref.aomori.jp/abouthp.html",
    "https://www.pref.iwate.jp/about/link.html",
    "https://www.pref.yamagata.jp/kensei/shoukai/aboutthissite/mensekijikou.html",
    "https://www.police.pref.gunma.jp/687314.html",
];
export const SUPPLEMENTAL_POLICE_COORDINATE_SOURCE_URLS = [
    "https://www.openstreetmap.org/node/3747688856",
    "https://www.openstreetmap.org/node/675616373",
    "https://www.openstreetmap.org/way/121539227",
    "https://www.openstreetmap.org/way/112174379",
];
const REPRESENTATIVE_POINT_NOTE = "警察が公表した速度取締り重点路線上の代表点です。現在の取締り実施場所や可搬式・移動式取締りを示す情報ではありません。交通ルールを守って走行してください。";
export const SUPPLEMENTAL_POLICE_PRIORITY_POINTS = [
    {
        id: "official-police-representative-02-aomori-route-4",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "青森県 東北自動車道 弘前線（代表点）",
        longitude: 140.6857613,
        latitude: 40.8114443,
        sourceOrganization: "青森県警察 高速道路交通警察隊 / © OpenStreetMap contributors",
        sourceUpdatedAt: "2026-01-01",
        evidence: "令和8年1月の速度取締り指針に掲載された重点区間。座標はOpenStreetMap node 3747688856（青森IC）から独立取得。",
        note: REPRESENTATIVE_POINT_NOTE,
    },
    {
        id: "official-police-representative-03-iwate-route-4",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "岩手県 国道4号 岩手町（代表点）",
        longitude: 141.2133898,
        latitude: 39.9687384,
        sourceOrganization: "岩手県警察 岩手警察署 / © OpenStreetMap contributors",
        sourceUpdatedAt: "2026-09-17",
        evidence: "岩手警察署の速度取締り指針に掲載された重点路線。座標はOpenStreetMap node 675616373（国道4号沿い）から独立取得。",
        note: REPRESENTATIVE_POINT_NOTE,
    },
    {
        id: "official-police-representative-06-yamagata-route-7",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "山形県 国道7号 遊佐町菅里（代表点）",
        longitude: 139.8697565,
        latitude: 39.0424673,
        sourceOrganization: "山形県警察 酒田警察署 / © OpenStreetMap contributors",
        sourceUpdatedAt: "2026-01-01",
        evidence: "令和8年1月の速度等取締り指針に掲載された重点路線。座標はOpenStreetMap way 121539227から独立取得。",
        note: REPRESENTATIVE_POINT_NOTE,
    },
    {
        id: "official-police-representative-10-gunma-route-17",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "群馬県 国道17号 前橋市（代表点）",
        longitude: 139.0568881,
        latitude: 36.4256336,
        sourceOrganization: "群馬県警察 前橋警察署 / © OpenStreetMap contributors",
        sourceUpdatedAt: "2026-04-01",
        evidence: "令和8年4月の速度取締り指針に掲載された重点路線。座標はOpenStreetMap way 112174379から独立取得。",
        note: REPRESENTATIVE_POINT_NOTE,
    },
];
//# sourceMappingURL=supplementalPolicePriorityPoints.js.map
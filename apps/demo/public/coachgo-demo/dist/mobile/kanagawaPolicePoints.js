const SOURCE_ORGANIZATION = "神奈川県警察 高津警察署";
export const KANAGAWA_POLICE_SOURCE_URL = "https://www.police.pref.kanagawa.jp/ps/takatsu/entry_2.html";
const NOTE = "公開された重点区間の代表点を概略表示しています。現在の取締り実施を示す情報ではありません。交通ルールを守って走行してください。";
export const KANAGAWA_POLICE_PRIORITY_POINTS = [
    {
        id: "kanagawa-takatsu-route-246",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "国道246号 梶ヶ谷交差点付近",
        longitude: 139.6066,
        latitude: 35.5904,
        sourceOrganization: SOURCE_ORGANIZATION,
        sourceUpdatedAt: "2023-07-25",
        evidence: "槍ヶ崎側道から梶ヶ谷交差点まで・重点時間帯7時から18時・規制速度60km/h",
        note: NOTE,
    },
    {
        id: "kanagawa-takatsu-daisan-keihin",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "第三京浜道路下 市道区間",
        longitude: 139.6285,
        latitude: 35.5747,
        sourceOrganization: SOURCE_ORGANIZATION,
        sourceUpdatedAt: "2023-07-25",
        evidence: "橘中学校から第三京浜入口まで・重点時間帯7時から18時・規制速度40km/h",
        note: NOTE,
    },
    {
        id: "kanagawa-takatsu-shitte-kurokawa",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "尻手黒川道路 梶ヶ谷六丁目付近",
        longitude: 139.619,
        latitude: 35.5874,
        sourceOrganization: SOURCE_ORGANIZATION,
        sourceUpdatedAt: "2023-07-25",
        evidence: "JR貨物ターミナルから梶ヶ谷六丁目まで・重点時間帯7時から18時・規制速度50km/h",
        note: NOTE,
    },
    {
        id: "kanagawa-takatsu-tama-ensen",
        kind: "POLICE_PRIORITY",
        monitorCategory: "POLICE_ENFORCEMENT",
        name: "多摩沿線道路 二子橋から宇奈根",
        longitude: 139.615,
        latitude: 35.609,
        sourceOrganization: SOURCE_ORGANIZATION,
        sourceUpdatedAt: "2023-07-25",
        evidence: "二子橋から宇奈根まで・重点時間帯7時から18時・規制速度40km/h",
        note: NOTE,
    },
];
//# sourceMappingURL=kanagawaPolicePoints.js.map
(function () {
  'use strict';

  const API = '/rehainfo/schedule/api';
  const STORAGE_KEY = 'rehainfo-source-ui-demo-v1';
  const originalFetch = window.fetch.bind(window);

  const therapists = [
    { id: 'PT01', name: '開発 太郎', subLabel: 'PT', nameKana: 'カイハツ タロウ', employmentType: '常勤', phone: '', email: 'pt01@example.local', team: 'PTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'PT02', name: '理学 花子', subLabel: 'PT', nameKana: 'リガク ハナコ', employmentType: '常勤', phone: '', email: 'pt02@example.local', team: 'PTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'OT01', name: '作業 一郎', subLabel: 'OT', nameKana: 'サギョウ イチロウ', employmentType: '常勤', phone: '', email: 'ot01@example.local', team: 'OTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'OT02', name: '高橋 美穂', subLabel: 'OT', nameKana: 'タカハシ ミホ', employmentType: '常勤', phone: '', email: 'ot02@example.local', team: 'OTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'ST01', name: '言語 美咲', subLabel: 'ST', nameKana: 'ゲンゴ ミサキ', employmentType: '常勤', phone: '', email: 'st01@example.local', team: 'STチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'ST02', name: '山本 遥', subLabel: 'ST', nameKana: 'ヤマモト ハルカ', employmentType: '常勤', phone: '', email: 'st02@example.local', team: 'STチーム1', ward: null, monthlyTargetUnits: null }
  ];

  const patients = [
    ['P0001', '高橋 恵子', '女性・回復期', '回復期A病棟'],
    ['P0002', '田中 隆', '男性・回復期', '回復期A病棟'],
    ['P0003', '伊藤 久美子', '女性・回復期', '回復期B病棟'],
    ['P0004', '渡辺 一郎', '男性・一般', '一般病棟'],
    ['P0005', '小林 幸子', '女性・回復期', '回復期B病棟'],
    ['P0006', '佐藤 清', '男性・一般', '一般病棟'],
    ['P0007', '山本 和子', '女性・回復期', '回復期A病棟'],
    ['P0008', '中村 正一', '男性・回復期', '回復期B病棟'],
    ['P0009', '鈴木 恵子', '女性・一般', '一般病棟'],
    ['P0010', '加藤 博', '男性・回復期', '回復期A病棟']
  ].map(function (item) {
    return { id: item[0], name: item[1], subLabel: item[2], nameKana: null, employmentType: null, phone: null, email: null, team: null, ward: item[3], monthlyTargetUnits: null };
  });

  const orcaMasters = [
    ['180755710', 'H001', '脳血管疾患等リハビリテーション料（１）（理学療法士による場合）', 'PT', 185],
    ['180745310', 'H002', '運動器リハビリテーション料（１）（理学療法士による場合）', 'PT', 185],
    ['180755810', 'H001', '脳血管疾患等リハビリテーション料（１）（作業療法士による場合）', 'OT', 185],
    ['180745410', 'H002', '運動器リハビリテーション料（１）（作業療法士による場合）', 'OT', 185],
    ['180755910', 'H001', '脳血管疾患等リハビリテーション料（１）（言語聴覚士による場合）', 'ST', 185],
    ['180750510', 'H003', '呼吸器リハビリテーション料（１）', 'ST', 180]
  ].map(function (item) {
    return { code: item[0], sectionCode: item[1], name: item[2], therapistRole: item[3], pointsPerUnit: item[4], effectiveFrom: '2026-06-01' };
  });

  const baseEntries = [
    [1001, '09:00', '09:40', 'P0001', 'PT01', 2, '歩行・バランス練習', '180755710'],
    [1002, '10:00', '10:40', 'P0002', 'PT01', 2, '関節可動域・筋力訓練', '180745310'],
    [1003, '11:00', '12:00', 'P0003', 'PT01', 3, '起立・移乗動作訓練', '180755710'],
    [1004, '13:40', '14:40', 'P0004', 'PT01', 3, '階段・屋外歩行練習', '180755710'],
    [1005, '10:00', '10:40', 'P0005', 'PT02', 2, '歩行・バランス練習', '180755710'],
    [1006, '13:00', '14:00', 'P0006', 'PT02', 3, '起立・移乗動作訓練', '180745310'],
    [1007, '09:00', '09:40', 'P0007', 'OT01', 2, '更衣・整容動作訓練', '180755810'],
    [1008, '11:00', '11:40', 'P0008', 'OT01', 2, '上肢機能訓練', '180745410'],
    [1009, '10:00', '11:00', 'P0009', 'OT02', 3, 'ADL訓練', '180755810'],
    [1010, '14:00', '14:40', 'P0010', 'OT02', 2, '認知・作業課題', '180755810'],
    [1011, '09:00', '09:40', 'P0003', 'ST01', 2, '嚥下訓練', '180755910'],
    [1012, '13:00', '13:40', 'P0008', 'ST02', 2, '言語訓練', '180755910']
  ];

  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }

  function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function therapist(id) {
    return therapists.find(function (item) { return item.id === id; });
  }

  function patient(id) {
    return patients.find(function (item) { return item.id === id; });
  }

  function billing(code) {
    return orcaMasters.find(function (item) { return item.code === code; });
  }

  function enrich(entry) {
    const assigned = therapist(entry.therapistId);
    const target = patient(entry.patientId);
    const item = billing(entry.orcaCode);
    return Object.assign({
      status: '予約', conflictOverride: false, versionNo: 1, requiredRole: null,
      preferredPeriod: null, billingAutoSelected: true, unassigned: false
    }, entry, {
      patientName: target ? target.name : entry.patientName || '担当未定',
      therapistName: assigned ? assigned.name : entry.therapistName || '担当未定',
      therapistRole: assigned ? assigned.subLabel : entry.requiredRole || '',
      billingName: item ? item.name : '',
      billingUnitPoints: item ? item.pointsPerUnit : 0,
      billingPoints: item ? item.pointsPerUnit * Number(entry.units || 0) : 0,
      billingMasterVersion: '厚労省 医科診療行為マスター 2026-06-01',
      billingSelectionReason: entry.billingSelectionReason || '患者の疾患別リハ情報と担当職種から自動選択しました。'
    });
  }

  function defaultEntries(date) {
    return baseEntries.map(function (item) {
      return enrich({ id: item[0], date: date, startTime: item[1], endTime: item[2], patientId: item[3], therapistId: item[4], units: item[5], note: item[6], orcaCode: item[7] });
    });
  }

  function entriesFor(date) {
    const store = readStore();
    if (!Array.isArray(store[date])) {
      store[date] = defaultEntries(date);
      writeStore(store);
    }
    return store[date];
  }

  function saveEntries(date, entries) {
    const store = readStore();
    store[date] = entries;
    writeStore(store);
  }

  function availability(date) {
    return therapists.map(function (item, index) {
      return { date: date, therapistId: item.id, therapistName: item.name, role: item.subLabel, scheduledStart: index === 5 ? '09:00' : '08:30', scheduledEnd: '17:30', workType: '通常勤務', clockIn: '08:28', breakStart: '12:00', breakEnd: '13:00', clockOut: '', status: '勤務中' };
    });
  }

  function bootstrap(date) {
    const entries = entriesFor(date).map(enrich);
    const capacity = {};
    therapists.forEach(function (item) {
      const used = entries.filter(function (entry) { return entry.therapistId === item.id && !entry.unassigned; }).reduce(function (sum, entry) { return sum + Number(entry.units || 0); }, 0);
      capacity[item.id] = Math.max(0, 10 - used);
    });
    return {
      date: date, patients: patients, therapists: therapists, periodStart: date, periodEnd: date,
      entries: entries, maxDailyUnits: 9, minimumGapMinutes: 2,
      monthlyUnits: { total: 8140, reserved: 8140 },
      staffAvailability: availability(date),
      patientEvents: [
        { id: 2001, date: date, startTime: '10:00', endTime: '10:40', patientId: 'P0004', patientName: '渡辺 一郎', eventType: 'CT', title: 'CT検査', conflictLevel: 'BLOCK', sourceSystem: '電子カルテ連携デモ' },
        { id: 2002, date: date, startTime: '14:00', endTime: '14:40', patientId: 'P0007', patientName: '山本 和子', eventType: '診察', title: '主治医診察', conflictLevel: 'WARNING', sourceSystem: '電子カルテ連携デモ' }
      ],
      unassignedEntries: entries.filter(function (entry) { return entry.unassigned; }),
      capacity: capacity, orcaMasters: orcaMasters,
      billingMasterVersion: '厚労省 医科診療行為マスター 2026-06-01'
    };
  }

  async function demoApi(url, options) {
    const parsed = new URL(url, location.origin);
    const path = parsed.pathname.slice(API.length);
    const method = String(options.method || 'GET').toUpperCase();
    const payload = options.body ? JSON.parse(options.body) : {};
    const date = parsed.searchParams.get('date') || payload.date || new Date().toISOString().slice(0, 10);

    if (method === 'GET' && path === '/bootstrap') return json(bootstrap(date));
    if (method === 'GET' && path === '/billing-checks') {
      const role = (therapist(parsed.searchParams.get('therapistId')) || {}).subLabel || 'PT';
      const item = orcaMasters.find(function (candidate) { return candidate.therapistRole === role; });
      return json({ ruleVersion: '公開デモ用ルール 2026-09', suggestion: { item: item, reason: 'リハビリ内容・疾患別リハ情報・療法士職種から候補を表示しています。' }, checks: [{ level: 'OK', message: '当日の患者単位数は上限内です。' }, { level: 'OK', message: '療法士と患者の予定重複はありません。' }] });
    }

    const actualMatch = /^\/entries\/(\d+)\/actual$/.exec(path);
    if (method === 'GET' && actualMatch) {
      const all = Object.values(readStore()).flat();
      const entry = all.find(function (item) { return String(item.id) === actualMatch[1]; });
      return json({ success: Boolean(entry), actual: { status: entry ? entry.status : '予約', actualTherapistId: entry ? entry.therapistId : '', location: 'リハビリ室', actualStart: entry ? entry.startTime : '', actualEnd: entry ? entry.endTime : '', actualUnits: entry ? entry.units : 1, cancelReason: '', note: '' } }, entry ? 200 : 404);
    }

    const workflowMatch = /^\/entries\/(\d+)\/workflow$/.exec(path);
    if (method === 'PUT' && workflowMatch) {
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].map(function (entry) { return String(entry.id) === workflowMatch[1] ? Object.assign({}, entry, { status: payload.status, versionNo: Number(entry.versionNo || 0) + 1 }) : entry; }); });
      writeStore(store);
      return json({ success: true });
    }

    const entryMatch = /^\/entries\/(\d+)$/.exec(path);
    if (method === 'DELETE' && entryMatch) {
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].filter(function (entry) { return String(entry.id) !== entryMatch[1]; }); });
      writeStore(store);
      return json({ success: true });
    }
    if (method === 'PUT' && entryMatch) {
      const entries = entriesFor(payload.date);
      const next = enrich(Object.assign({}, payload, { id: Number(entryMatch[1]), versionNo: Number(payload.versionNo || 0) + 1 }));
      saveEntries(payload.date, entries.map(function (entry) { return String(entry.id) === entryMatch[1] ? next : entry; }));
      return json({ success: true, entry: next, gapAdjusted: false });
    }
    if (method === 'POST' && path === '/entries') {
      const next = enrich(Object.assign({}, payload, { id: Date.now(), versionNo: 1 }));
      const entries = entriesFor(payload.date);
      entries.push(next);
      saveEntries(payload.date, entries);
      return json({ success: true, entry: next, gapAdjusted: false }, 201);
    }
    if (method === 'POST' && path === '/bulk-complete') {
      const ids = (payload.ids || []).map(String);
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].map(function (entry) { return ids.includes(String(entry.id)) ? Object.assign({}, entry, { status: '実施済み' }) : entry; }); });
      writeStore(store);
      return json({ success: true, updated: ids.length });
    }
    if (method === 'POST' && path === '/copy') {
      const source = entriesFor(payload.sourceDate);
      let copied = 0;
      (payload.targetDates || []).forEach(function (targetDate) {
        const clones = source.map(function (entry, index) { return Object.assign({}, entry, { id: Date.now() + copied + index, date: targetDate, status: '予約' }); });
        saveEntries(targetDate, clones);
        copied += clones.length;
      });
      return json({ success: true, copied: copied, skipped: 0 });
    }
    return json({ success: false, message: '公開デモではこの操作を利用できません。' }, 404);
  }

  window.fetch = function (input, options) {
    const url = typeof input === 'string' ? input : input.url;
    if (new URL(url, location.origin).pathname.startsWith(API)) return demoApi(url, options || {});
    return originalFetch(input, options);
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-demo-link]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        window.alert(link.dataset.demoLink + 'は、rehainfo実コードの次の公開対象です。この画面ではスケジュール機能を操作できます。');
      });
    });
  });
}());

(function () {
  'use strict';

  const API = '/rehainfo/schedule/api';
  const THERAPIST_API = '/rehainfo/therapists/api';
  const ATTENDANCE_API = '/rehainfo/attendance/api';
  const BILLING_API = '/rehainfo/billing-management/api';
  const OPERATIONS_API = '/rehainfo/schedule-management/api';
  const AI_API = '/rehainfo/ai-schedule/api';
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
    ['DEMO260901', '佐藤 和子', '女性・回復期', '回復期3階A'],
    ['DEMO260902', '鈴木 正一', '男性・回復期', '回復期2階B'],
    ['DEMO260903', '高橋 幸子', '女性・整形外科', '整形外科4階'],
    ['DEMO260904', '田中 博', '男性・神経内科', '神経内科5階'],
    ['DEMO260905', '伊藤 洋子', '女性・回復期', '回復期2階A'],
    ['DEMO260906', '渡辺 清', '男性・循環器', '循環器6階'],
    ['DEMO260907', '山本 恵子', '女性・呼吸器', '呼吸器5階'],
    ['DEMO260908', '中村 隆', '男性・回復期', '回復期3階B'],
    ['DEMO260909', '小林 久美子', '女性・外科', '外科4階'],
    ['DEMO260910', '加藤 一郎', '男性・回復期', '回復期2階B']
  ].map(function (item) {
    return { id: item[0], name: item[1], subLabel: item[2], nameKana: null, employmentType: null, phone: null, email: null, team: null, ward: item[3], monthlyTargetUnits: null };
  });

  const patientListRows = [
    ['DEMO260901', '佐藤 和子', 'サトウ カズコ', '女性', '1948/04/12', '77歳', '脳血管疾患等', '2026/08/18', '入院', '回復期3階A'],
    ['DEMO260902', '鈴木 正一', 'スズキ ショウイチ', '男性', '1952/11/03', '73歳', '運動器', '2026/08/20', '入院', '回復期2階B'],
    ['DEMO260903', '高橋 幸子', 'タカハシ サチコ', '女性', '1941/07/26', '85歳', '運動器', '2026/08/22', '入院', '整形外科4階'],
    ['DEMO260904', '田中 博', 'タナカ ヒロシ', '男性', '1958/01/19', '68歳', '脳血管疾患等', '2026/08/25', '入院', '神経内科5階'],
    ['DEMO260905', '伊藤 洋子', 'イトウ ヨウコ', '女性', '1949/09/07', '77歳', '廃用症候群', '2026/08/28', '入院', '回復期2階A'],
    ['DEMO260906', '渡辺 清', 'ワタナベ キヨシ', '男性', '1955/06/15', '71歳', '心大血管疾患', '2026/09/01', '外来', '循環器6階'],
    ['DEMO260907', '山本 恵子', 'ヤマモト ケイコ', '女性', '1946/02/08', '80歳', '呼吸器', '2026/09/02', '入院', '呼吸器5階'],
    ['DEMO260908', '中村 隆', 'ナカムラ タカシ', '男性', '1960/12/21', '65歳', '脳血管疾患等', '2026/09/03', '入院', '回復期3階B'],
    ['DEMO260909', '小林 久美子', 'コバヤシ クミコ', '女性', '1951/05/30', '75歳', '廃用症候群', '2026/09/04', '外来', '外科4階'],
    ['DEMO260910', '加藤 一郎', 'カトウ イチロウ', '男性', '1944/10/11', '81歳', '運動器', '2026/09/05', '入院', '回復期2階B']
  ].map(function (item, index) {
    return {
      patientId: item[0], patientName: item[1], patientNameKana: item[2], gender: item[3], birth: item[4], age: item[5],
      rehabilitationClass: item[6], startDate: item[7], entryExit: item[8], wardName: item[9], serviceName: 'スマートリハビリテーション病院',
      recId: String(9001 + index), groupId: 'DEMO-GROUP', fitbitId: '', patientActive: 'T', treatmentTimes: index + 1,
      rehabStartTime: null, assigned: index < 8
    };
  });

  window.REHAINFO_DEMO_PATIENT_COLUMNS = {
    '患者ID': 'patientId', '患者氏名': 'patientName', '患者氏名（カナ）': 'patientNameKana', '性別': 'gender',
    '生年月日': 'birth', '年齢': 'age', 'リハビリテーション区分': 'rehabilitationClass', '起算日': 'startDate',
    '入外区分': 'entryExit', '病棟名': 'wardName'
  };
  window.REHAINFO_DEMO_PATIENTS = patientListRows;

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
    [1001, '09:00', '09:40', 'DEMO260901', 'PT01', 2, '歩行・バランス練習', '180755710'],
    [1002, '10:00', '10:40', 'DEMO260902', 'PT01', 2, '関節可動域・筋力訓練', '180745310'],
    [1003, '11:00', '12:00', 'DEMO260903', 'PT01', 3, '起立・移乗動作訓練', '180755710'],
    [1004, '13:40', '14:40', 'DEMO260904', 'PT01', 3, '階段・屋外歩行練習', '180755710'],
    [1005, '10:00', '10:40', 'DEMO260905', 'PT02', 2, '歩行・バランス練習', '180755710'],
    [1006, '13:00', '14:00', 'DEMO260906', 'PT02', 3, '起立・移乗動作訓練', '180745310'],
    [1007, '09:00', '09:40', 'DEMO260907', 'OT01', 2, '更衣・整容動作訓練', '180755810'],
    [1008, '11:00', '11:40', 'DEMO260908', 'OT01', 2, '上肢機能訓練', '180745410'],
    [1009, '10:00', '11:00', 'DEMO260909', 'OT02', 3, 'ADL訓練', '180755810'],
    [1010, '14:00', '14:40', 'DEMO260910', 'OT02', 2, '認知・作業課題', '180755810'],
    [1011, '09:00', '09:40', 'DEMO260903', 'ST01', 2, '嚥下訓練', '180755910'],
    [1012, '13:00', '13:40', 'DEMO260908', 'ST02', 2, '言語訓練', '180755910']
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

  function daysInMonth(month) {
    const parts = month.split('-');
    return new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
  }

  function attendanceMonth(month) {
    const records = [];
    therapists.forEach(function (item, therapistIndex) {
      for (let day = 1; day <= daysInMonth(month); day += 1) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const weekday = new Date(`${date}T12:00:00`).getDay();
        const off = weekday === 0 || weekday === 6;
        records.push({
          date: date, therapistId: item.id, therapistName: item.name, role: item.subLabel,
          workType: off ? '公休' : therapistIndex === 1 && day % 5 === 0 ? '遅番' : '通常勤務',
          scheduledStart: off ? '' : '08:30', scheduledEnd: off ? '' : '17:30',
          clockIn: off ? '' : '08:28', clockOut: '', breakStart: off ? '' : '12:00', breakEnd: off ? '' : '13:00',
          status: off ? '公休' : '勤務中'
        });
      }
    });
    return { therapists: therapists, records: records };
  }

  function billingData(date) {
    const month = date.slice(0, 7);
    const rows = therapists.map(function (item, index) {
      return {
        therapistId: item.id, therapistRole: item.subLabel, therapistName: item.name,
        dailyScheduledPoints: 1480 + index * 120, dailyConfirmedPoints: 1110 + index * 90, dailyTargetPoints: 1800,
        weeklyScheduledPoints: 8200 + index * 500, weeklyConfirmedPoints: 7400 + index * 420, weeklyTargetPoints: 9000,
        monthlyScheduledPoints: 35000 + index * 1800, monthlyConfirmedPoints: 32600 + index * 1650, monthlyTargetPoints: 39000,
        monthlyResultImported: true, monthlyResultUnits: 170 + index * 8, monthlyWorkedDays: 20
      };
    });
    return {
      success: true, date: date, weekStart: date, weekEnd: date, targetMonth: month, canEdit: true, therapists: rows,
      totals: { dailyScheduledPoints: 10680, dailyConfirmedPoints: 7965, weeklyScheduledPoints: 56700, weeklyConfirmedPoints: 50700, monthlyScheduledPoints: 237000, monthlyConfirmedPoints: 220350 },
      hospitalPerformance: {
        hospitalName: 'スマートリハビリテーション病院', label: `${month} 院内計画・確定実績`, therapistCount: therapists.length, operatingDays: 20,
        targetPoints: 240000, targetUnits: 1200, resultPoints: 220350, resultUnits: 1102, achievementRate: 91.8, unitAchievementRate: 91.8,
        pointDifference: -19650, averageUnitsPerTherapist: 183.7, averageUnitsPerWorkedDay: 9.2,
        roleBreakdown: ['PT', 'OT', 'ST'].map(function (role) { return { role: role, therapistCount: 2, targetUnits: 400, resultUnits: 367, targetPoints: 80000, resultPoints: 73450, achievementRate: 91.8, averageUnitsPerWorkedDay: 9.2 }; }),
        dataNotice: '公開版は架空データのみを使用しています。'
      }
    };
  }

  function operationsData(month) {
    const enrichedEntries = entriesFor(`${month}-10`).map(enrich);
    const therapistRows = therapists.map(function (item, index) {
      return { therapist_id: item.id, therapist_role: item.subLabel, therapist_name: item.name, reservation_count: 18 + index, reserved_units: 40 + index * 2, coded_count: 18 + index, uncoded_count: 0, scheduled_billing_points: 7400 + index * 360, confirmed_billing_points: 6900 + index * 320, utilization_rate: 86 + index };
    });
    return {
      role: 'MANAGER', approved: false, canApprove: true,
      totals: { reservation_count: 123, reserved_units: 270, coded_count: 123, uncoded_count: 0, scheduled_billing_points: 49800, confirmed_billing_points: 46100 },
      therapists: therapistRows,
      hospitals: [{ service_id: 'DEMO-HOSPITAL', group_id: 'DEMO-GROUP', reservation_count: 123, reserved_units: 270, coded_count: 123, uncoded_count: 0, scheduled_billing_points: 49800, confirmed_billing_points: 46100 }],
      patients: patientListRows.slice(0, 6).map(function (item, index) { return { rec_id: item.patientId, patient_name: item.patientName, reservation_count: 4 + index, reserved_units: 8 + index, actual_units: 7 + index, cancelled_units: 1 }; }),
      pending: enrichedEntries.slice(0, 3).map(function (item) { return { schedule_date: item.date, start_time: item.startTime, patient_name: item.patientName, therapist_name: item.therapistName, units: item.units, orca_code: item.orcaCode, billing_points: item.billingPoints, status: item.status }; }),
      history: [{ create_at: new Date().toISOString(), action: '登録', status: '予約', patient_name: '佐藤 和子', therapist_name: '開発 太郎', detail: '公開デモ予約を登録', create_by: '公開デモ' }]
    };
  }

  function aiPatients() {
    return patientListRows.map(function (item, index) { return { id: item.patientId, name: item.patientName, patientType: index % 2 ? '継続患者' : '回復期患者', ward: item.wardName }; });
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
        { id: 2001, date: date, startTime: '10:00', endTime: '10:40', patientId: 'DEMO260904', patientName: '田中 博', eventType: 'CT', title: 'CT検査', conflictLevel: 'BLOCK', sourceSystem: '電子カルテ連携デモ' },
        { id: 2002, date: date, startTime: '14:00', endTime: '14:40', patientId: 'DEMO260907', patientName: '山本 恵子', eventType: '診察', title: '主治医診察', conflictLevel: 'WARNING', sourceSystem: '電子カルテ連携デモ' }
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

  async function sourceApi(url, options) {
    const parsed = new URL(url, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    const payload = options.body ? JSON.parse(options.body) : {};
    if (parsed.pathname.startsWith(API)) return demoApi(url, options);
    if (parsed.pathname.startsWith(THERAPIST_API)) {
      if (method === 'GET') return json({ therapists: therapists });
      if (method === 'PUT' || method === 'POST') return json({ success: true });
    }
    if (parsed.pathname.startsWith(ATTENDANCE_API)) {
      if (method === 'GET') return json(attendanceMonth(parsed.searchParams.get('month') || new Date().toISOString().slice(0, 7)));
      return json({ success: true });
    }
    if (parsed.pathname.startsWith(BILLING_API)) {
      if (method === 'GET') return json(billingData(parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10)));
      return json({ success: true });
    }
    if (parsed.pathname.startsWith(OPERATIONS_API)) {
      const month = parsed.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      if (parsed.pathname.endsWith('/dashboard')) return json(operationsData(month));
      if (parsed.pathname.endsWith('/integration')) return json({ source: 'fictional-public-demo', month: month, externalClinicalSystemsConnected: false, generatedAt: new Date().toISOString() });
      if (parsed.pathname.endsWith('/approve')) return json({ success: true });
    }
    if (parsed.pathname.startsWith(AI_API)) {
      if (parsed.pathname.endsWith('/patients')) return json({ patients: aiPatients(), plans: [] });
      if (parsed.pathname.endsWith('/generate')) return json({ success: false, message: '公開版ではAI案を保存しません。' }, 409);
    }
    return null;
  }

  window.fetch = function (input, options) {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, location.origin).pathname;
    if ([API, THERAPIST_API, ATTENDANCE_API, BILLING_API, OPERATIONS_API, AI_API].some(function (prefix) { return path.startsWith(prefix); })) {
      return sourceApi(url, options || {});
    }
    return originalFetch(input, options);
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('patientListTable') || document.getElementById('table-div')) {
      const applyPatientFilters = function () {
        const kana = (document.getElementById('condition_patientName') || {}).value || '';
        const id = (document.getElementById('condition_patientId') || {}).value || '';
        const assignedOnly = Boolean((document.getElementById('radio_api') || {}).checked);
        const additionalField = (document.getElementById('select_additional') || {}).value || '';
        const additionalValue = (document.getElementById('patientListAdditionalSearchForm') || {}).value || '';
        const rows = patientListRows.filter(function (item) {
          return (!kana || item.patientNameKana.includes(kana)) && (!id || item.patientId.includes(id))
            && (!assignedOnly || item.assigned) && (!additionalField || !additionalValue || String(item[additionalField] || '').includes(additionalValue));
        });
        if (typeof window.patientListApplyFilteredRows === 'function') window.patientListApplyFilteredRows(rows);
      };
      window.onChangeInput = applyPatientFilters;
      ['condition_patientName', 'condition_patientId'].forEach(function (id) {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', applyPatientFilters);
      });
      const assigned = document.getElementById('radio_api');
      if (assigned) assigned.addEventListener('change', applyPatientFilters);
      window.onPatientClick = function () { window.alert('公開版は架空データの一覧確認用です。患者カルテは開きません。'); };
    }

    document.addEventListener('submit', function (event) {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.action && !form.action.endsWith('/rehainfo/login')) {
        event.preventDefault();
        window.alert('この公開版ではローカル実画面の表示確認のみ行えます。');
      }
    }, true);
  });
}());

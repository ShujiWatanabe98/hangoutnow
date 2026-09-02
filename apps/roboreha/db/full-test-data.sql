-- ぐんまロボケアセンター 本格テストデータ（2026年8月実績・9月予約）
-- 再実行可能。既存の手入力予約は削除しない。

UPDATE stores
   SET name='ぐんまロボケアセンター', open_time=time '10:00', close_time=time '18:00',
       closed_weekdays=ARRAY[3,4]::smallint[]
 WHERE id='10000000-0000-0000-0000-000000000001';

UPDATE facility_equipment_models SET quantity=CASE id
  WHEN '41000000-0000-0000-0000-000000000005' THEN 2
  WHEN '41000000-0000-0000-0000-000000000006' THEN 3
  WHEN '41000000-0000-0000-0000-000000000004' THEN 2
  ELSE 1 END,hal_capacity_per_unit=CASE category WHEN 'bench' THEN 2 ELSE 1 END,updated_at=now()
WHERE id IN ('41000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000004','41000000-0000-0000-0000-000000000005','41000000-0000-0000-0000-000000000006');

UPDATE staff_members SET active=true WHERE store_id='10000000-0000-0000-0000-000000000001';
UPDATE staff_members SET active=false
 WHERE store_id='10000000-0000-0000-0000-000000000001'
   AND id NOT IN ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000006');
UPDATE staff_members SET role='reception', qualification=NULL
 WHERE id='20000000-0000-0000-0000-000000000003';

-- 既存利用者を残し、ぐんま拠点の有効利用者が合計100名になるまで追加する。
WITH current_count AS (
  SELECT count(*)::int AS existing_total FROM customers
   WHERE store_id='10000000-0000-0000-0000-000000000001' AND active=true
), generated AS (
  SELECT seq AS n,
    (ARRAY['青木','阿部','池田','石井','井上','遠藤','岡田','加藤','木村','小林','斎藤','佐藤','清水','鈴木','高橋','田中','中島','中村','橋本','林','藤田','前田','松本','山口','山田','吉田'])[((seq-1)%26)+1] AS family,
    (ARRAY['一郎','和子','健','明子','誠','恵','直樹','美咲','浩二','由美'])[((seq-1)%10)+1] AS given,
    (ARRAY['アオキ','アベ','イケダ','イシイ','イノウエ','エンドウ','オカダ','カトウ','キムラ','コバヤシ','サイトウ','サトウ','シミズ','スズキ','タカハシ','タナカ','ナカジマ','ナカムラ','ハシモト','ハヤシ','フジタ','マエダ','マツモト','ヤマグチ','ヤマダ','ヨシダ'])[((seq-1)%26)+1] AS family_kana,
    (ARRAY['イチロウ','カズコ','ケン','アキコ','マコト','メグミ','ナオキ','ミサキ','コウジ','ユミ'])[((seq-1)%10)+1] AS given_kana
  FROM current_count, generate_series(1, greatest(0,100-current_count.existing_total)) seq
)
INSERT INTO customers (
  id,store_id,customer_code,name,name_kana,birth_date,phone,email,postal_code,address,
  diagnosis_name,primary_condition,goal,preferred_payment_method,emergency_contact,active,created_at
)
SELECT md5('gunma-test-customer-'||n)::uuid,
  '10000000-0000-0000-0000-000000000001', 'T-'||lpad(n::text,4,'0'),
  family||' '||given||n, family_kana||' '||given_kana,
  make_date(1938+((n*7)%55),((n-1)%12)+1,least(28,((n*3)%28)+1)),
  '090-'||lpad((2000+n)::text,4,'0')||'-'||lpad((3000+n)::text,4,'0'),
  'test'||lpad(n::text,3,'0')||'@gunma.example.test',
  (ARRAY['370-0841','370-0829','371-0022','372-0056','373-0851'])[((n-1)%5)+1],
  (ARRAY['群馬県高崎市栄町','群馬県前橋市千代田町','群馬県伊勢崎市宮子町','群馬県太田市飯田町','群馬県桐生市本町'])[((n-1)%5)+1]||n||'番地',
  (ARRAY['脳卒中（脳梗塞・脳出血）','パーキンソン病','脊髄損傷','脳性麻痺','筋ジストロフィー','変形性膝関節症','大腿骨頸部骨折術後','廃用症候群','多発性硬化症','末梢神経障害'])[((n-1)%10)+1],
  (ARRAY['片麻痺・歩行不安定','すくみ足・小刻み歩行','下肢筋力低下','体幹バランス低下','易疲労・筋力低下','膝痛・立ち上がり困難','術後の歩行耐久性低下','長期臥床後の体力低下','ふらつき・感覚低下','足関節の動かしにくさ'])[((n-1)%10)+1],
  (ARRAY['杖で近所を安全に歩く','転倒せず買い物に行く','介助量を減らして立つ','屋外歩行を再開する','疲れずに家の中を移動する','階段を一段ずつ上る','家族と旅行に行く','一人でトイレまで歩く','歩行速度を上げる','仕事への復帰を目指す'])[((n-1)%10)+1],
  (ARRAY['cash','credit_card','qr','ticket'])[((n-1)%4)+1],
  jsonb_build_object('name',family||' '||given||'家族','relation','家族','phone','027-'||lpad((4000+n)::text,4,'0')||'-'||lpad((5000+n)::text,4,'0')),
  true, timestamptz '2026-07-01 10:00:00+09' + n*interval '2 hours'
FROM generated
ON CONFLICT (store_id,customer_code) DO UPDATE SET
  primary_condition=EXCLUDED.primary_condition,goal=EXCLUDED.goal,
  diagnosis_name=EXCLUDED.diagnosis_name,preferred_payment_method=EXCLUDED.preferred_payment_method,active=true;

UPDATE customers c SET preferred_payment_method=(ARRAY['cash','credit_card','qr','ticket'])[((x.rn-1)%4)+1]
FROM (SELECT id,row_number() OVER (ORDER BY customer_code) rn FROM customers
       WHERE store_id='10000000-0000-0000-0000-000000000001' AND active=true) x
WHERE c.id=x.id AND c.preferred_payment_method IS NULL;

-- 6名全員の営業日シフト。水・木は完全休業。
DELETE FROM staff_shifts
 WHERE store_id='10000000-0000-0000-0000-000000000001'
   AND work_date BETWEEN date '2026-08-01' AND date '2026-09-30';
INSERT INTO staff_shifts (id,staff_id,store_id,work_date,shift_start,shift_end,status)
SELECT md5('gunma-shift-'||s.id||'-'||d.day::date)::uuid,s.id,
  '10000000-0000-0000-0000-000000000001',d.day::date,
  (d.day::date+time '10:00') AT TIME ZONE 'Asia/Tokyo',
  (d.day::date+time '18:00') AT TIME ZONE 'Asia/Tokyo','confirmed'
FROM staff_members s
CROSS JOIN generate_series(date '2026-08-01',date '2026-09-30',interval '1 day') d(day)
WHERE s.store_id='10000000-0000-0000-0000-000000000001' AND s.active=true
  AND extract(isodow FROM d.day) NOT IN (3,4)
ON CONFLICT (staff_id,work_date) DO UPDATE SET shift_start=EXCLUDED.shift_start,shift_end=EXCLUDED.shift_end,status='confirmed',updated_at=now();

-- 8月は全営業日に出退勤実績を登録。
INSERT INTO attendance_records (id,staff_id,store_id,work_date,clock_in,clock_out,break_minutes,status,approved_by,approved_at,note)
SELECT md5('gunma-attendance-'||ss.staff_id||'-'||ss.work_date)::uuid,ss.staff_id,ss.store_id,ss.work_date,
  ss.shift_start+(extract(day from ss.work_date)::int%3)*interval '2 minutes',
  ss.shift_end-(extract(day from ss.work_date)::int%4)*interval '2 minutes',60,'approved',
  '20000000-0000-0000-0000-000000000004',ss.shift_end,'本格テストデータ'
FROM staff_shifts ss
WHERE ss.store_id='10000000-0000-0000-0000-000000000001'
  AND ss.work_date BETWEEN date '2026-08-01' AND date '2026-08-31'
ON CONFLICT (staff_id,work_date) DO UPDATE SET clock_in=EXCLUDED.clock_in,clock_out=EXCLUDED.clock_out,
  break_minutes=EXCLUDED.break_minutes,status='approved',approved_by=EXCLUDED.approved_by,approved_at=EXCLUDED.approved_at,note=EXCLUDED.note,updated_at=now();

-- 以前のデモ用営業時間外データを営業枠内へ正規化する。
DELETE FROM billing_records WHERE appointment_id=md5('gunma-test-appointment-2026-08-29-10-1')::uuid;
DELETE FROM vital_checks WHERE appointment_id=md5('gunma-test-appointment-2026-08-29-10-1')::uuid;
DELETE FROM clinical_sessions WHERE appointment_id=md5('gunma-test-appointment-2026-08-29-10-1')::uuid;
DELETE FROM appointments WHERE id=md5('gunma-test-appointment-2026-08-29-10-1')::uuid;
UPDATE appointments SET start_at=timestamptz '2026-08-29 10:00:00+09',end_at=timestamptz '2026-08-29 11:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000001';
UPDATE appointments SET therapist_id='20000000-0000-0000-0000-000000000002',hal_unit_id='40000000-0000-0000-0000-000000000002',rehab_space_id='42000000-0000-0000-0000-000000000002',start_at=timestamptz '2026-08-29 10:00:00+09',end_at=timestamptz '2026-08-29 11:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000009';
UPDATE appointments SET start_at=timestamptz '2026-08-30 15:00:00+09',end_at=timestamptz '2026-08-30 16:00:00+09'
 WHERE id='80000000-0000-0000-0000-000000000008';
UPDATE appointments SET start_at=timestamptz '2026-08-30 11:30:00+09',end_at=timestamptz '2026-08-30 12:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000002';
UPDATE appointments SET start_at=timestamptz '2026-08-31 10:00:00+09',end_at=timestamptz '2026-08-31 11:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000003';
UPDATE appointments SET start_at=timestamptz '2026-08-30 14:00:00+09',end_at=timestamptz '2026-08-30 15:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000004';
UPDATE appointments SET start_at=timestamptz '2026-08-30 16:00:00+09',end_at=timestamptz '2026-08-30 17:00:00+09'
 WHERE id='80000000-0000-0000-0000-000000000010';
-- seed.sql の相対日付は実行日によって水・木の定休日になるため、営業日に固定する。
UPDATE appointments SET start_at=timestamptz '2026-08-28 10:00:00+09',end_at=timestamptz '2026-08-28 11:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000005';
UPDATE appointments SET start_at=timestamptz '2026-08-21 13:00:00+09',end_at=timestamptz '2026-08-21 14:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000006';
UPDATE appointments SET start_at=timestamptz '2026-08-14 15:00:00+09',end_at=timestamptz '2026-08-14 16:30:00+09'
 WHERE id='80000000-0000-0000-0000-000000000007';
UPDATE clinical_sessions cs SET hal_unit_id=a.hal_unit_id,operator_id=a.therapist_id,started_at=a.start_at+interval '5 minutes',ended_at=a.end_at-interval '5 minutes'
 FROM appointments a WHERE cs.appointment_id=a.id AND a.id IN ('80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000009');
UPDATE billing_records b SET paid_at=CASE WHEN b.status='paid' THEN a.end_at+interval '10 minutes' ELSE NULL END,updated_at=a.end_at+interval '10 minutes'
 FROM appointments a WHERE b.appointment_id=a.id AND a.id IN ('80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000009');

-- テスト予約候補。下肢HALはトレッドミル、単関節HALはベンチを必ず使用。
CREATE TEMP TABLE test_appointment_candidates ON COMMIT DROP AS
WITH days AS (
  SELECT day::date work_date,row_number() OVER (ORDER BY day)::int day_no
  FROM generate_series(date '2026-08-01',date '2026-09-30',interval '1 day') day
  WHERE extract(isodow FROM day) NOT IN (3,4)
), slots(hour) AS (VALUES (10),(12),(14),(16)), lanes(lane,therapist_id,hal_id,space_id,product_id,duration) AS (
  VALUES
   (1,'20000000-0000-0000-0000-000000000001'::uuid,'40000000-0000-0000-0000-000000000001'::uuid,'42000000-0000-0000-0000-000000000001'::uuid,'50000000-0000-0000-0000-000000000001'::uuid,90),
   (3,'20000000-0000-0000-0000-000000000005'::uuid,'40000000-0000-0000-0000-000000000003'::uuid,'42000000-0000-0000-0000-000000000003'::uuid,'50000000-0000-0000-0000-000000000002'::uuid,60)
), people AS (
  SELECT array_agg(id ORDER BY customer_code) ids FROM customers
  WHERE store_id='10000000-0000-0000-0000-000000000001' AND active=true
)
SELECT md5('gunma-test-appointment-'||d.work_date||'-'||s.hour||'-'||l.lane)::uuid id,
  d.work_date,l.lane,l.therapist_id,l.hal_id,l.space_id,l.product_id,l.duration,
  ((d.work_date+make_time(s.hour,0,0)) AT TIME ZONE 'Asia/Tokyo') start_at,
  ((d.work_date+make_time(s.hour,0,0)) AT TIME ZONE 'Asia/Tokyo')+l.duration*interval '1 minute' end_at,
  people.ids[((d.day_no*12+(s.hour-10)/2*3+l.lane-1)%array_length(people.ids,1))+1] customer_id
FROM days d CROSS JOIN slots s CROSS JOIN lanes l CROSS JOIN people;

INSERT INTO appointments (id,store_id,customer_id,therapist_id,hal_unit_id,rehab_space_id,product_id,status,start_at,end_at,note)
SELECT c.id,'10000000-0000-0000-0000-000000000001',c.customer_id,c.therapist_id,c.hal_id,c.space_id,c.product_id,
  CASE WHEN c.work_date<=date '2026-08-31' THEN 'completed'
       WHEN (extract(day from c.work_date)::int+c.lane)%3=0 THEN 'reserved' ELSE 'confirmed' END,
  c.start_at,c.end_at,
  CASE WHEN c.work_date<=date '2026-08-31' THEN '8月実施済み本格テストデータ' ELSE '9月予約本格テストデータ' END
FROM test_appointment_candidates c
WHERE NOT EXISTS (SELECT 1 FROM appointments a WHERE a.id=c.id)
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.status<>'cancelled'
    AND tstzrange(a.start_at,a.end_at,'[)') && tstzrange(c.start_at,c.end_at,'[)')
    AND (a.customer_id=c.customer_id OR a.therapist_id=c.therapist_id OR a.hal_unit_id=c.hal_id OR a.rehab_space_id=c.space_id));

-- 初診デモ利用者は完了履歴を持たせない。
UPDATE appointments a SET customer_id=(
  SELECT c.id FROM customers c
   WHERE c.store_id=a.store_id AND c.active=true AND c.id<>'30000000-0000-0000-0000-000000000004'
     AND NOT EXISTS (SELECT 1 FROM appointments other WHERE other.id<>a.id AND other.customer_id=c.id
       AND other.status<>'cancelled' AND other.start_at<a.end_at AND other.end_at>a.start_at)
   ORDER BY c.customer_code DESC LIMIT 1)
WHERE a.customer_id='30000000-0000-0000-0000-000000000004'
  AND a.note='8月実施済み本格テストデータ';

-- 8月完了分の施術、バイタル、会計データ。
INSERT INTO clinical_sessions (id,appointment_id,hal_unit_id,operator_id,exercise_log,soap,started_at,ended_at)
SELECT md5('gunma-session-'||a.id)::uuid,a.id,a.hal_unit_id,a.therapist_id,
  jsonb_build_array(jsonb_build_object('exercise',CASE h.model_type WHEN 'lower_limb' THEN '歩行練習' ELSE '反復運動' END,'minutes',p.duration_minutes-10,'steps',700+(extract(day from a.start_at)::int*23)%900)),
  jsonb_build_object('S','体調良好','O','安全にプログラムを完遂','A',CASE extract(day from a.start_at)::int%3 WHEN 0 THEN '歩行安定性が改善' WHEN 1 THEN '介助量が軽減' ELSE '持久力が向上' END,'P','次回も状態に合わせて継続'),
  a.start_at+interval '5 minutes',a.end_at-interval '5 minutes'
FROM appointments a JOIN service_products p ON p.id=a.product_id JOIN hal_units h ON h.id=a.hal_unit_id
WHERE a.note='8月実施済み本格テストデータ' AND a.status='completed'
ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO vital_checks (id,appointment_id,measured_by,systolic,diastolic,pulse,temperature,decision,staff_note,measured_at)
SELECT md5('gunma-vital-'||a.id)::uuid,a.id,a.therapist_id,
  112+(extract(day from a.start_at)::int%20),68+(extract(hour from a.start_at)::int%12),66+(extract(day from a.start_at)::int%22),
  36.2+((extract(day from a.start_at)::int%5)::numeric/10),'allow','実施前確認済み',a.start_at-interval '10 minutes'
FROM appointments a WHERE a.note='8月実施済み本格テストデータ'
ON CONFLICT (id) DO NOTHING;

INSERT INTO billing_records (id,appointment_id,store_id,customer_id,amount_yen,status,payment_method,confirmed_by,paid_at,created_at,updated_at)
SELECT md5('gunma-billing-'||a.id)::uuid,a.id,a.store_id,a.customer_id,p.price_yen,'paid',
  (ARRAY['cash','credit_card','qr','ticket'])[((extract(day from a.start_at)::int+extract(hour from a.start_at)::int)%4)+1],
  '20000000-0000-0000-0000-000000000003',a.end_at+interval '10 minutes',a.end_at,a.end_at+interval '10 minutes'
FROM appointments a JOIN service_products p ON p.id=a.product_id
WHERE a.note='8月実施済み本格テストデータ'
ON CONFLICT (appointment_id) DO NOTHING;

-- 5回券・10回券購入者を各20名以上作成し、残数と購入履歴を管理する。
WITH buyers AS (
  SELECT id,row_number() OVER (ORDER BY customer_code) rn FROM customers
  WHERE store_id='10000000-0000-0000-0000-000000000001' AND active=true
  ORDER BY customer_code LIMIT 50
)
INSERT INTO ticket_purchase_history (id,customer_id,store_id,product_id,ticket_type,purchased_uses,amount_yen,payment_method,purchased_at,expires_on,status)
SELECT md5('gunma-ticket-purchase-'||b.id)::uuid,b.id,'10000000-0000-0000-0000-000000000001',
  CASE WHEN b.rn%4=0 THEN '50000000-0000-0000-0000-000000000002'::uuid ELSE '50000000-0000-0000-0000-000000000001'::uuid END,
  CASE WHEN b.rn%2=0 THEN 10 ELSE 5 END,CASE WHEN b.rn%2=0 THEN 10 ELSE 5 END,
  CASE WHEN b.rn%2=0 THEN 178000 ELSE 94000 END,
  (ARRAY['cash','credit_card','qr'])[((b.rn-1)%3)+1],
  timestamptz '2026-08-01 12:00:00+09'+b.rn*interval '12 hours',date '2027-02-28','active'
FROM buyers b ON CONFLICT (id) DO NOTHING;

WITH purchases AS (
  SELECT DISTINCT ON (customer_id,product_id) customer_id,product_id,purchased_uses,expires_on
  FROM ticket_purchase_history WHERE store_id='10000000-0000-0000-0000-000000000001' AND status='active'
  ORDER BY customer_id,product_id,purchased_at DESC
)
INSERT INTO ticket_wallets (id,customer_id,product_id,remaining_uses,expires_on)
SELECT md5('gunma-ticket-wallet-'||customer_id||'-'||product_id)::uuid,customer_id,product_id,greatest(1,purchased_uses-((extract(day from expires_on)::int)%4)),expires_on
FROM purchases
ON CONFLICT (customer_id,product_id) DO UPDATE SET remaining_uses=EXCLUDED.remaining_uses,expires_on=EXCLUDED.expires_on;

INSERT INTO stores (id, code, name, address, phone, visit_enabled, status, manager_name, contact_email, open_time, close_time, closed_weekdays, feature_flags) VALUES
  ('10000000-0000-0000-0000-000000000001', 'GUMMA', 'ぐんまロボケアセンター', '群馬県高崎市栄町3-11', '027-310-8282', true, 'active', '小林 正人', 'gunma@example.test', time '10:00', time '18:00', ARRAY[3,4]::smallint[], '{"appointments":true,"customers":true,"messages":true,"intake":true,"equipment":true,"physical":true,"clinical":true,"billing":true,"staff":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'TSUKUBA', 'つくばロボケアセンター', '茨城県つくば市研究学園5-19', '029-828-8282', true, 'active', '伊藤 達也', 'tsukuba@example.test', time '10:00', time '18:00', ARRAY[3,4]::smallint[], '{"appointments":true,"customers":true,"messages":true,"intake":true,"equipment":true,"physical":true,"clinical":true,"billing":true,"staff":true}'::jsonb),
  ('10000000-0000-0000-0000-000000000003', 'YOTSUYA', '四ツ谷ロボケアセンター', '東京都新宿区四谷1-2', '03-6380-8282', false, 'preparing', '井上 奈緒', 'yotsuya@example.test', time '10:00', time '18:00', ARRAY[3,4]::smallint[], '{"appointments":true,"customers":true,"messages":true,"intake":true,"equipment":true,"physical":true,"clinical":true,"billing":true,"staff":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name, address=EXCLUDED.address,
  phone=EXCLUDED.phone, visit_enabled=EXCLUDED.visit_enabled, status=EXCLUDED.status,
  manager_name=EXCLUDED.manager_name, contact_email=EXCLUDED.contact_email,
  open_time=EXCLUDED.open_time, close_time=EXCLUDED.close_time, closed_weekdays=EXCLUDED.closed_weekdays,
  feature_flags=COALESCE(stores.feature_flags, EXCLUDED.feature_flags);

INSERT INTO staff_members (id, store_id, employee_code, name, role, qualification, hal_training_valid_until) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'TR-001', '山田 直樹', 'therapist', '理学療法士', current_date + 180),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'TR-002', '佐藤 美咲', 'trainer', 'HAL安全使用講習修了', current_date + 240),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'RC-001', '高橋 花', 'reception', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE staff_members SET role=CASE id
  WHEN '20000000-0000-0000-0000-000000000003' THEN 'reception'
  ELSE 'therapist' END, qualification=CASE id
  WHEN '20000000-0000-0000-0000-000000000002' THEN '理学療法士・HAL安全使用講習修了'
  WHEN '20000000-0000-0000-0000-000000000003' THEN NULL
  ELSE qualification END, active=true
WHERE id IN ('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003');

INSERT INTO staff_members (id, store_id, employee_code, name, role, qualification, hal_training_valid_until) VALUES
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'MG-001', '小林 正人', 'manager', '理学療法士・拠点リーダー', current_date + 300)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, qualification=EXCLUDED.qualification, active=true;

INSERT INTO staff_members (id, store_id, employee_code, name, role, qualification, hal_training_valid_until) VALUES
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'TR-003', '伊藤 健太', 'therapist', '作業療法士・HAL安全使用講習修了', current_date + 270),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'HT-001', '松本 彩', 'trainer', 'HAL安全使用講習修了', current_date + 250)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, qualification=EXCLUDED.qualification,
  hal_training_valid_until=EXCLUDED.hal_training_valid_until, active=true;

INSERT INTO customers (id, store_id, customer_code, name, name_kana, birth_date, phone, email, primary_condition, goal, emergency_contact) VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'C-1042', '佐々木 明里', 'ササキ アカリ', '1964-05-14', '090-1234-5678', 'akari@example.test', '脳梗塞後遺症', '近所の公園まで杖で歩く', '{"name":"佐々木 健","relation":"家族","phone":"090-0000-1001"}'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'C-1043', '田中 一郎', 'タナカ イチロウ', '1958-11-02', '090-1234-6789', 'ichiro@example.test', '脊髄損傷', '立位時間を伸ばす', '{"name":"田中 恵","relation":"妻","phone":"090-0000-1002"}'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'C-1044', '鈴木 遥', 'スズキ ハルカ', '1972-02-21', '090-1234-7890', 'haruka@example.test', 'パーキンソン病', '転倒せずに買い物へ行く', '{"name":"鈴木 実","relation":"夫","phone":"090-0000-1003"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, store_id, customer_code, name, name_kana, birth_date, phone, email, primary_condition, goal, emergency_contact) VALUES
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'C-1045', '中村 和子', 'ナカムラ カズコ', '1968-09-08', '090-1234-8901', 'kazuko@example.test', '初診・歩行不安', '安全に屋外歩行を再開する', '{"name":"中村 翔","relation":"長男","phone":"090-0000-1004"}')
ON CONFLICT (id) DO NOTHING;

UPDATE customers SET diagnosis_name = CASE id
  WHEN '30000000-0000-0000-0000-000000000001' THEN '脳卒中（脳梗塞・脳出血）'
  WHEN '30000000-0000-0000-0000-000000000002' THEN '脊髄損傷'
  WHEN '30000000-0000-0000-0000-000000000003' THEN 'パーキンソン病'
  WHEN '30000000-0000-0000-0000-000000000004' THEN 'その他・診断名不明'
  ELSE diagnosis_name END
WHERE id IN (
  '30000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000004'
);

INSERT INTO customer_cautions (id, store_id, customer_id, severity, category, title, detail, response_note, active, created_by) VALUES
  ('ca000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'caution', 'mobility', '左足のつまずきに注意', '疲労時に左足の振り出しが小さくなります。歩行開始前に体調と足元を確認してください。', '歩行時は左側後方から見守り、疲労が見られたら休憩を提案する。', true, '20000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'high', 'support', '移乗時は2名で介助', '下肢の支持が不安定なため、立位・移乗は必ずスタッフ2名で対応してください。', '車いすのブレーキと足台を確認し、主担当と補助担当を決めてから開始する。', true, '20000000-0000-0000-0000-000000000004'),
  ('ca000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'caution', 'mobility', '方向転換時のすくみ足', '狭い場所や方向転換で足が止まりやすいため、急がせず声かけを行ってください。', '床の目印と一定のリズムの声かけを使用する。', true, '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO UPDATE SET severity=EXCLUDED.severity, category=EXCLUDED.category, title=EXCLUDED.title,
  detail=EXCLUDED.detail, response_note=EXCLUDED.response_note, active=EXCLUDED.active, updated_at=now();

INSERT INTO questionnaire_templates (id, store_id, title, introduction_text, consent_text, updated_by) VALUES
  ('f1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ぐんまロボケアセンター 初診問診票', '安全で効果的なリハビリ計画を作るため、現在の状態と生活上のお困りごとをお知らせください。', '利用規約と安全確認事項を確認し、問診内容をリハビリ計画と施設内の申し送りに利用することに同意します。', '20000000-0000-0000-0000-000000000004')
ON CONFLICT (store_id) DO UPDATE SET title=EXCLUDED.title, introduction_text=EXCLUDED.introduction_text,
  consent_text=EXCLUDED.consent_text, updated_by=EXCLUDED.updated_by, updated_at=now();

INSERT INTO questionnaire_template_items (id, template_id, item_key, label, help_text, field_type, required, unit, min_value, max_value, options, sort_order, system_field) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'chief_complaint', '現在もっとも困っていること', '症状が起きる場面や生活への影響も入力してください。', 'long_text', true, NULL, NULL, NULL, '[]', 10, 'chiefComplaint'),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'medical_history', '既往歴・手術歴', '時期が分かる場合は一緒に入力してください。', 'long_text', false, NULL, NULL, NULL, '[]', 20, 'medicalHistory'),
  ('f2000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'medications', '服薬内容', '薬の名前が不明な場合はお薬手帳をご持参ください。', 'long_text', false, NULL, NULL, NULL, '[]', 30, 'medications'),
  ('f2000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 'walking_aid', '使用中の歩行補助具', NULL, 'single_choice', false, NULL, NULL, NULL, '["なし","杖","歩行器","車いす","装具"]', 40, 'walkingAid'),
  ('f2000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001', 'pain_scale', '現在の痛みの強さ', '0は痛みなし、10は想像できる最も強い痛みです。', 'number', false, '点', 0, 10, '[]', 50, 'painScale'),
  ('f2000000-0000-0000-0000-000000000006', 'f1000000-0000-0000-0000-000000000001', 'pacemaker', 'ペースメーカー等の植込み機器', NULL, 'boolean', false, NULL, NULL, NULL, '[]', 60, 'pacemaker'),
  ('f2000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 'fracture_risk', '骨折リスク・骨粗しょう症', NULL, 'boolean', false, NULL, NULL, NULL, '[]', 70, 'fractureRisk'),
  ('f2000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000001', 'skin_issue', '装着部位の皮膚トラブル', NULL, 'boolean', false, NULL, NULL, NULL, '[]', 80, 'skinIssue'),
  ('f2000000-0000-0000-0000-000000000009', 'f1000000-0000-0000-0000-000000000001', 'fall_history', '過去6か月の転倒歴', NULL, 'boolean', false, NULL, NULL, NULL, '[]', 90, 'fallHistory'),
  ('f2000000-0000-0000-0000-000000000010', 'f1000000-0000-0000-0000-000000000001', 'fall_count', '過去6か月の転倒回数', '転倒していない場合は0を入力してください。', 'number', false, '回', 0, 100, '[]', 100, NULL),
  ('f2000000-0000-0000-0000-000000000011', 'f1000000-0000-0000-0000-000000000001', 'walking_minutes', '休まずに歩ける時間', '現在のおおよその時間で構いません。', 'number', false, '分', 0, 180, '[]', 110, NULL),
  ('f2000000-0000-0000-0000-000000000012', 'f1000000-0000-0000-0000-000000000001', 'daily_activity', '日常生活で支援が必要な動作', NULL, 'multiple_choice', false, NULL, NULL, NULL, '["立ち上がり","移乗","屋内歩行","屋外歩行","階段","着替え"]', 120, NULL),
  ('f2000000-0000-0000-0000-000000000013', 'f1000000-0000-0000-0000-000000000001', 'rehab_goal', 'HALを使って実現したいこと', 'ご本人やご家族が大切にしている目標を入力してください。', 'long_text', false, NULL, NULL, NULL, '[]', 130, NULL),
  ('f2000000-0000-0000-0000-000000000014', 'f1000000-0000-0000-0000-000000000001', 'standing_video', '立ち上がり動作の動画', '全身が映る位置で、無理のない範囲で撮影してください。', 'video', false, NULL, NULL, NULL, '[]', 140, NULL),
  ('f2000000-0000-0000-0000-000000000015', 'f1000000-0000-0000-0000-000000000001', 'walking_video', '歩行状態の動画', '正面と側面から、腰・膝・足が映るように撮影してください。', 'video', false, NULL, NULL, NULL, '[]', 150, NULL)
ON CONFLICT (template_id, item_key) DO UPDATE SET label=EXCLUDED.label, help_text=EXCLUDED.help_text,
  field_type=EXCLUDED.field_type, required=EXCLUDED.required, unit=EXCLUDED.unit, min_value=EXCLUDED.min_value,
  max_value=EXCLUDED.max_value, options=EXCLUDED.options, sort_order=EXCLUDED.sort_order,
  system_field=EXCLUDED.system_field, active=true, updated_at=now();

INSERT INTO message_conversations (id,store_id,customer_id,created_at,updated_at) VALUES
  ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '20 minutes'),
  ('d0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',now()-interval '1 day',now()-interval '3 hours'),
  ('d0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003',now()-interval '1 day',now()-interval '5 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id,conversation_id,sender_type,sender_customer_id,sender_staff_id,body,sent_at,read_at) VALUES
  ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','facility',NULL,'20000000-0000-0000-0000-000000000003','こんにちは。ぐんまロボケアセンターです。次回のご予約についてご不明な点があれば、こちらからご連絡ください。',now()-interval '2 days',now()-interval '2 days'+interval '10 minutes'),
  ('e0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001','customer','30000000-0000-0000-0000-000000000001',NULL,'ありがとうございます。次回も動きやすい服装で伺えばよいですか？',now()-interval '1 day',now()-interval '1 day'+interval '5 minutes'),
  ('e0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001','facility',NULL,'20000000-0000-0000-0000-000000000003','はい、動きやすい服装でお越しください。室内用シューズもお持ちください。',now()-interval '20 minutes',NULL),
  ('e0000000-0000-0000-0000-000000000004','d0000000-0000-0000-0000-000000000002','customer','30000000-0000-0000-0000-000000000002',NULL,'次回の予約時間を確認したいです。',now()-interval '3 hours',NULL),
  ('e0000000-0000-0000-0000-000000000005','d0000000-0000-0000-0000-000000000003','customer','30000000-0000-0000-0000-000000000003',NULL,'持ち物について教えてください。',now()-interval '5 hours',NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO hal_units (id, store_id, asset_code, serial_number, product_class, model_type, model_number, size_label, laterality, status, battery_percent, last_inspected_at) VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'HAL-L01', 'FL08-DEMO-001', 'wellbeing', 'lower_limb', 'HAL-FL08', 'L', 'bilateral', 'available', 92, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'HAL-L02', 'FL07-DEMO-002', 'wellbeing', 'lower_limb', 'HAL-FL07', 'S', 'bilateral', 'available', 74, now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'HAL-S01', 'FS01-DEMO-003', 'wellbeing', 'single_joint', 'HAL-FS01', NULL, 'not_applicable', 'available', 58, now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'HAL-W01', 'BB04-DEMO-004', 'care', 'lumbar', 'HAL-BB04', 'S', 'not_applicable', 'inspection', 41, now() - interval '8 days'),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'HAL-W02', 'BB04-DEMO-005', 'care', 'lumbar', 'HAL-BB04', 'L', 'not_applicable', 'available', 88, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

UPDATE hal_units SET usage_count = CASE asset_code
  WHEN 'HAL-L01' THEN 48 WHEN 'HAL-L02' THEN 35 WHEN 'HAL-S01' THEN 62 WHEN 'HAL-W01' THEN 27 WHEN 'HAL-W02' THEN 12 ELSE usage_count END
WHERE store_id = '10000000-0000-0000-0000-000000000001';

UPDATE hal_units
   SET size_label = CASE asset_code
         WHEN 'HAL-L01' THEN 'L' WHEN 'HAL-L02' THEN 'S'
         WHEN 'HAL-W01' THEN 'S' WHEN 'HAL-W02' THEN 'L'
         ELSE NULL END,
       body_part = CASE model_type
         WHEN 'lower_limb' THEN 'lower_limb'
         WHEN 'single_joint' THEN 'upper_limb'
         WHEN 'lumbar' THEN 'lumbar' END,
       image_url = CASE model_type
         WHEN 'lower_limb' THEN '/equipment/hal-lower-limb.png'
         WHEN 'single_joint' THEN '/equipment/hal-single-joint-upper.webp'
         WHEN 'lumbar' THEN '/equipment/hal-lumbar.webp' END,
       image_source_url = CASE model_type
         WHEN 'lower_limb' THEN 'user-provided-image'
         WHEN 'single_joint' THEN 'https://store.cyberdyne.jp/html/user_data/assets/img/top/singlejoint_1.webp'
         WHEN 'lumbar' THEN 'https://store.cyberdyne.jp/html/user_data/assets/img/products/BB/BB04_1%201.webp' END
 WHERE store_id = '10000000-0000-0000-0000-000000000001';

INSERT INTO service_products (id, store_id, code, name, duration_minutes, price_yen, required_model_type) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'NHF-90', 'Neuro HALFIT® 90分', 90, 19800, 'lower_limb'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'NHF-SJ-60', '単関節プログラム 60分', 60, 16500, 'single_joint'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'HAL-W-30', '腰タイプ 30分', 30, 5500, 'lumbar')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, store_id, customer_id, therapist_id, hal_unit_id, product_id, status, start_at, end_at, note) VALUES
  ('80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '7 days' + time '10:00', current_date - interval '7 days' + time '11:30', '歩行評価を実施'),
  ('80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '14 days' + time '13:00', current_date - interval '14 days' + time '14:30', '立位練習'),
  ('80000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '21 days' + time '15:00', current_date - interval '21 days' + time '16:30', '歩行・バランス練習')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, store_id, customer_id, therapist_id, hal_unit_id, product_id, status, start_at, end_at, note) VALUES
  ('80000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'completed', current_date + time '15:00', current_date + time '16:00', '会計確認待ちデモ'),
  ('80000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'completed', current_date + time '10:00', current_date + time '11:30', '本日支払い済みデモ')
ON CONFLICT (id) DO UPDATE SET customer_id=EXCLUDED.customer_id,therapist_id=EXCLUDED.therapist_id,
  hal_unit_id=EXCLUDED.hal_unit_id,product_id=EXCLUDED.product_id,status=EXCLUDED.status,
  start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,note=EXCLUDED.note;

INSERT INTO clinical_sessions (id, appointment_id, hal_unit_id, operator_id, exercise_log, soap, started_at, ended_at) VALUES
  ('a0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '[{"exercise":"歩行練習","minutes":55,"steps":1240}]', '{"S":"疲労なし","O":"歩容安定","A":"改善","P":"継続"}', current_date - interval '7 days' + time '10:05', current_date - interval '7 days' + time '11:25'),
  ('a0000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '[{"exercise":"立位練習","minutes":45}]', '{}', current_date - interval '14 days' + time '13:05', current_date - interval '14 days' + time '14:25'),
  ('a0000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '[{"exercise":"歩行・バランス","minutes":60}]', '{}', current_date - interval '21 days' + time '15:05', current_date - interval '21 days' + time '16:25'),
  ('a0000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '[{"exercise":"右膝反復運動","minutes":42,"repetitions":80}]', '{"S":"痛みなし","O":"反復80回","A":"良好","P":"次回負荷調整"}', current_date + time '15:05', current_date + time '15:55'),
  ('a0000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '[{"exercise":"歩行練習","minutes":60,"steps":1380}]', '{"S":"体調良好","O":"歩行速度向上","A":"良好","P":"継続"}', current_date + time '10:05', current_date + time '11:25')
ON CONFLICT (id) DO UPDATE SET hal_unit_id=EXCLUDED.hal_unit_id,operator_id=EXCLUDED.operator_id,
  exercise_log=EXCLUDED.exercise_log,soap=EXCLUDED.soap,
  started_at=EXCLUDED.started_at,ended_at=EXCLUDED.ended_at;

INSERT INTO billing_records (id, appointment_id, store_id, customer_id, amount_yen, status, payment_method, confirmed_by, paid_at, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 19800, 'paid', 'credit_card', '20000000-0000-0000-0000-000000000003', current_date - interval '7 days' + time '11:35', current_date - interval '7 days', current_date - interval '7 days'),
  ('b0000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 19800, 'paid', 'cash', '20000000-0000-0000-0000-000000000003', current_date - interval '14 days' + time '14:35', current_date - interval '14 days', current_date - interval '14 days'),
  ('b0000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 19800, 'paid', 'qr', '20000000-0000-0000-0000-000000000003', current_date - interval '21 days' + time '16:35', current_date - interval '21 days', current_date - interval '21 days'),
  ('b0000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 16500, 'pending', NULL, NULL, NULL, current_date + time '15:55', current_date + time '15:55'),
  ('b0000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 19800, 'paid', 'credit_card', '20000000-0000-0000-0000-000000000003', current_date + time '11:35', current_date + time '11:25', current_date + time '11:35')
ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, payment_method=EXCLUDED.payment_method,
  confirmed_by=EXCLUDED.confirmed_by, paid_at=EXCLUDED.paid_at, amount_yen=EXCLUDED.amount_yen, updated_at=EXCLUDED.updated_at;

INSERT INTO attendance_records (staff_id, store_id, work_date, clock_in, clock_out, break_minutes, status, approved_by, approved_at, note) VALUES
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '08:20', current_date + time '17:30', 60, 'approved', '20000000-0000-0000-0000-000000000004', current_date + time '17:35', 'リーダー'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '08:45', current_date + time '18:00', 60, 'submitted', NULL, NULL, NULL),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '09:00', current_date + time '18:00', 60, 'approved', '20000000-0000-0000-0000-000000000004', current_date + time '18:05', NULL),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '08:30', NULL, 60, 'draft', NULL, NULL, '勤務中'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '08:50', current_date + time '17:50', 60, 'submitted', NULL, NULL, NULL),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', current_date, current_date + time '09:10', current_date + time '18:10', 60, 'approved', '20000000-0000-0000-0000-000000000004', current_date + time '18:15', NULL)
ON CONFLICT (staff_id, work_date) DO UPDATE SET clock_in=EXCLUDED.clock_in, clock_out=EXCLUDED.clock_out,
  break_minutes=EXCLUDED.break_minutes, status=EXCLUDED.status, approved_by=EXCLUDED.approved_by,
  approved_at=EXCLUDED.approved_at, note=EXCLUDED.note, updated_at=now();

DELETE FROM staff_shifts
 WHERE store_id='10000000-0000-0000-0000-000000000001'
   AND work_date>=current_date
   AND extract(isodow FROM work_date) IN (3,4);

INSERT INTO staff_shifts (staff_id, store_id, work_date, shift_start, shift_end, status)
SELECT staff_id, '10000000-0000-0000-0000-000000000001', work_date,
       (work_date + start_time) AT TIME ZONE 'Asia/Tokyo',
       (work_date + end_time) AT TIME ZONE 'Asia/Tokyo', 'confirmed'
FROM (
  SELECT '20000000-0000-0000-0000-000000000001'::uuid AS staff_id,
         day::date AS work_date, time '09:30' AS start_time, time '18:00' AS end_time
    FROM generate_series(current_date, current_date + 14, interval '1 day') day
   WHERE extract(isodow FROM day) NOT IN (3,4)
  UNION ALL
  SELECT '20000000-0000-0000-0000-000000000002'::uuid,
         day::date, time '10:00', time '17:30'
    FROM generate_series(current_date, current_date + 14, interval '1 day') day
   WHERE extract(isodow FROM day) IN (1,2,6)
  UNION ALL
  SELECT '20000000-0000-0000-0000-000000000003'::uuid,
         day::date, time '09:30', time '18:00'
    FROM generate_series(current_date, current_date + 14, interval '1 day') day
   WHERE extract(isodow FROM day) NOT IN (3,4)
) shifts
ON CONFLICT (staff_id, work_date) DO UPDATE SET shift_start=EXCLUDED.shift_start,
  shift_end=EXCLUDED.shift_end, status=EXCLUDED.status, updated_at=now();

INSERT INTO staff_shifts (staff_id,store_id,work_date,shift_start,shift_end,status)
SELECT staff.id,'10000000-0000-0000-0000-000000000001',day::date,
       (day::date + CASE staff.id
         WHEN '20000000-0000-0000-0000-000000000004'::uuid THEN time '08:30'
         WHEN '20000000-0000-0000-0000-000000000002'::uuid THEN time '10:00'
         ELSE time '09:00' END) AT TIME ZONE 'Asia/Tokyo',
       (day::date + CASE staff.id
         WHEN '20000000-0000-0000-0000-000000000004'::uuid THEN time '17:30'
         WHEN '20000000-0000-0000-0000-000000000002'::uuid THEN time '17:30'
         ELSE time '18:00' END) AT TIME ZONE 'Asia/Tokyo','confirmed'
FROM (VALUES
  ('20000000-0000-0000-0000-000000000001'::uuid),
  ('20000000-0000-0000-0000-000000000002'::uuid),
  ('20000000-0000-0000-0000-000000000003'::uuid),
  ('20000000-0000-0000-0000-000000000004'::uuid)
) staff(id)
CROSS JOIN generate_series(current_date - 30,current_date - 1,interval '1 day') day
WHERE extract(isodow FROM day) BETWEEN 1 AND 5
ON CONFLICT (staff_id,work_date) DO NOTHING;

INSERT INTO attendance_records (staff_id,store_id,work_date,clock_in,clock_out,break_minutes,status,approved_by,approved_at,note)
SELECT ss.staff_id,ss.store_id,ss.work_date,ss.shift_start + interval '5 minutes',ss.shift_end - interval '5 minutes',60,'approved',
       '20000000-0000-0000-0000-000000000004',ss.shift_end,'月次集計用デモ実績'
FROM staff_shifts ss
WHERE ss.store_id='10000000-0000-0000-0000-000000000001'
  AND ss.work_date BETWEEN current_date - 30 AND current_date - 1
ON CONFLICT (staff_id,work_date) DO NOTHING;

INSERT INTO facility_equipment_models (id, store_id, category, equipment_name, model_number, quantity, note) VALUES
  ('41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'hal', '自立支援用HAL 下肢タイプ', 'HAL-FL08', 1, 'デモ登録'),
  ('41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'hal', '自立支援用HAL 下肢タイプ', 'HAL-FL07', 1, 'デモ登録'),
  ('41000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'hal', '自立支援用HAL 単関節タイプ', 'HAL-FS01', 1, 'デモ登録'),
  ('41000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'hal', 'HAL腰タイプ 介護・自立支援用（小・大）', 'HAL-BB04', 2, '小サイズ1台・大サイズ1台'),
  ('41000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'treadmill', '免荷式トレッドミル', '施設標準', 2, 'デモ登録'),
  ('41000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'bench', '昇降式トレーニングベンチ', '施設標準', 3, 'デモ登録')
ON CONFLICT (id) DO NOTHING;

INSERT INTO measurement_protocols
  (store_id,code,name,version,unit,lower_is_better,instructions,video_supported)
VALUES
  ('10000000-0000-0000-0000-000000000001','walk_time','歩行時間','1.0','秒',true,'設定した歩行距離を通常速度で歩き、直線区間の時間を記録します。',true),
  ('10000000-0000-0000-0000-000000000001','gait_speed','歩行速度','1.0','m/s',false,'歩行距離を歩行時間で除して算出します。',true),
  ('10000000-0000-0000-0000-000000000001','single_leg_stance','片脚立位','1.0','秒',false,'左右それぞれ最大3回測定し、介助や支持物の使用を記録します。',true),
  ('10000000-0000-0000-0000-000000000001','tug','TUG','1.0','秒',true,'立ち上がり、3m歩行、方向転換、着座までを測定します。',true),
  ('10000000-0000-0000-0000-000000000001','chair_stand_5','5回立ち上がり','1.0','秒',true,'椅子から5回立ち上がるまでの時間を測定します。',true),
  ('10000000-0000-0000-0000-000000000001','grip_strength','握力','1.0','kg',false,'左右それぞれ測定し、測定姿勢を統一します。',false),
  ('10000000-0000-0000-0000-000000000001','bbs','BBS','1.0','点',false,'Berg Balance Scaleの合計点を記録します。',false),
  ('10000000-0000-0000-0000-000000000001','chair_stand_30s','30秒立ち上がり','1.0','回',false,'30秒間に完了した立ち上がり回数を記録します。',true)
ON CONFLICT (store_id,code,version) DO UPDATE SET
  name=EXCLUDED.name,unit=EXCLUDED.unit,lower_is_better=EXCLUDED.lower_is_better,
  instructions=EXCLUDED.instructions,video_supported=EXCLUDED.video_supported,updated_at=now();

INSERT INTO training_programs (store_id,code,name,description,target_tags) VALUES
  ('10000000-0000-0000-0000-000000000001','WEIGHT_SHIFT','左右荷重移動','手すり等を使用し、安全を確保して左右への荷重移動を練習します。','["symmetry","stance"]'),
  ('10000000-0000-0000-0000-000000000001','FOOT_CLEARANCE','足部クリアランス練習','つまずきを避けるため、足部の振り出しとクリアランスを意識します。','["foot_clearance","step"]'),
  ('10000000-0000-0000-0000-000000000001','TRUNK_CONTROL','体幹安定練習','座位または立位で体幹の正中位と安定性を確認します。','["trunk","balance"]'),
  ('10000000-0000-0000-0000-000000000001','CADENCE','歩行リズム練習','安全な速度で一定のリズムを保つ歩行練習を行います。','["cadence","speed"]')
ON CONFLICT (store_id,code) DO UPDATE SET
  name=EXCLUDED.name,description=EXCLUDED.description,target_tags=EXCLUDED.target_tags,updated_at=now();

UPDATE facility_equipment_models
   SET hal_capacity_per_unit = CASE category WHEN 'bench' THEN 2 ELSE 1 END
 WHERE store_id = '10000000-0000-0000-0000-000000000001';

UPDATE facility_equipment_models
   SET equipment_name='HAL腰タイプ 介護・自立支援用（小・大）', quantity=2,
       note='小サイズ1台・大サイズ1台', updated_at=now()
 WHERE id='41000000-0000-0000-0000-000000000004';

INSERT INTO rehabilitation_spaces (id,store_id,space_code,name,space_type,capacity_hal_units) VALUES
  ('42000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','TM-01','トレッドミル 1','treadmill',1),
  ('42000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','TM-02','トレッドミル 2','treadmill',1),
  ('42000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','BN-01','ベンチ 1','bench',2),
  ('42000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','BN-02','ベンチ 2','bench',2),
  ('42000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','BN-03','ベンチ 3','bench',2)
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,space_type=EXCLUDED.space_type,
  capacity_hal_units=EXCLUDED.capacity_hal_units,active=true,updated_at=now();

INSERT INTO service_products (id, store_id, code, name, duration_minutes, price_yen, required_model_type) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'NHF-90', 'Neuro HALFIT® 90分', 90, 19800, 'lower_limb'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'NHF-SJ-60', '単関節プログラム 60分', 60, 16500, 'single_joint'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'HAL-W-30', '腰タイプ 30分', 30, 5500, 'lumbar')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_wallets (id, customer_id, product_id, remaining_uses, expires_on)
VALUES ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 6, current_date + 92)
ON CONFLICT (id) DO NOTHING;

INSERT INTO safety_rule_sets (id, store_id, name, systolic_stop_low, systolic_stop_high, diastolic_stop_low, diastolic_stop_high, pulse_stop_low, pulse_stop_high, temperature_stop_low, temperature_stop_high, effective_from, source_note)
VALUES ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'デモ運用基準 v1', 80, 160, 50, 110, 40, 120, 35.0, 37.5, current_date - 30, '要件定義の例示値を含むデモ基準。実運用前に医療・安全責任者の承認が必要。')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id, store_id, customer_id, therapist_id, hal_unit_id, product_id, status, start_at, end_at, note) VALUES
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'confirmed', current_date + time '09:30', current_date + time '11:00', '立位・歩行中心'),
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'confirmed', current_date + time '11:30', current_date + time '12:30', '右膝の反復運動'),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'confirmed', current_date + interval '1 day' + time '10:00', current_date + interval '1 day' + time '11:30', '歩行練習・10m歩行評価')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointments (id,store_id,customer_id,therapist_id,hal_unit_id,product_id,status,start_at,end_at,note)
VALUES ('80000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002',
  'confirmed',current_date+time '16:00',current_date+time '17:00','療法士3名表示・リハスペース操作用デモ')
ON CONFLICT (id) DO UPDATE SET therapist_id=EXCLUDED.therapist_id,hal_unit_id=EXCLUDED.hal_unit_id,
  product_id=EXCLUDED.product_id,status=EXCLUDED.status,start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,note=EXCLUDED.note;

UPDATE appointments a SET rehab_space_id = CASE
  WHEN a.id IN ('80000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000010') THEN '42000000-0000-0000-0000-000000000003'::uuid
  WHEN a.id IN ('80000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000006') THEN '42000000-0000-0000-0000-000000000002'::uuid
  ELSE '42000000-0000-0000-0000-000000000001'::uuid END
WHERE a.store_id='10000000-0000-0000-0000-000000000001'
  AND a.id IN ('80000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000009','80000000-0000-0000-0000-000000000010');

UPDATE appointments a SET rehab_space_id = (
  SELECT rs.id FROM rehabilitation_spaces rs
   WHERE rs.store_id=a.store_id AND rs.active=true
     AND rs.space_type=CASE (SELECT h.model_type FROM hal_units h WHERE h.id=a.hal_unit_id)
       WHEN 'lower_limb' THEN 'treadmill' ELSE 'bench' END
   ORDER BY (SELECT count(*) FROM appointments occupied
              WHERE occupied.rehab_space_id=rs.id AND occupied.id<>a.id
                AND occupied.status IN ('reserved','confirmed','checked_in','in_session')
                AND tstzrange(occupied.start_at,occupied.end_at,'[)') && tstzrange(a.start_at,a.end_at,'[)')),
            rs.space_code
   LIMIT 1
)
WHERE a.store_id='10000000-0000-0000-0000-000000000001' AND a.rehab_space_id IS NULL;

INSERT INTO appointments (id, store_id, customer_id, therapist_id, hal_unit_id, product_id, status, start_at, end_at, note) VALUES
  ('80000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'confirmed', current_date + time '14:00', current_date + time '15:30', '予約カレンダー操作用デモ'),
  ('80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '7 days' + time '10:00', current_date - interval '7 days' + time '11:30', '歩行評価を実施'),
  ('80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '14 days' + time '13:00', current_date - interval '14 days' + time '14:30', '立位練習'),
  ('80000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'completed', current_date - interval '21 days' + time '15:00', current_date - interval '21 days' + time '16:30', '歩行・バランス練習')
ON CONFLICT (id) DO NOTHING;

INSERT INTO clinical_assessments (id, appointment_id, customer_id, evaluator_id, pre_metrics, post_metrics, delta_summary, summary_text, notes, assessed_at)
VALUES (
  '90000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000005',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '{"walk10mSeconds": 18.4, "gaitSpeed": 0.54, "tugSeconds": 24.1, "bbs": 38, "chairStand30s": 6}',
  '{"walk10mSeconds": 16.1, "gaitSpeed": 0.62, "tugSeconds": 21.8, "bbs": 40, "chairStand30s": 7}',
  '{"walk10mSeconds": -2.3, "gaitSpeed": 0.08, "tugSeconds": -2.3, "bbs": 2, "chairStand30s": 1}',
  '10m歩行時間とTUGが短縮し、歩行速度・BBS・30秒立ち上がり回数が向上しました。',
  '疲労の訴えなし。左立脚期の安定性が向上。',
  current_date - interval '7 days' + time '11:20'
)
ON CONFLICT (id) DO NOTHING;

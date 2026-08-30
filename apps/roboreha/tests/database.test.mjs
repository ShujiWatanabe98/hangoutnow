import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://roboreha:roboreha@localhost:55432/roboreha";

test("demo database has the core resources", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM customers) AS customers,
        (SELECT count(*)::int FROM staff_members) AS staff,
        (SELECT count(*)::int FROM hal_units) AS hal_units,
        (SELECT count(*)::int FROM facility_equipment_models) AS equipment_models,
        (SELECT count(*)::int FROM appointments) AS appointments
    `);
    assert.ok(result.rows[0].customers >= 3);
    assert.ok(result.rows[0].staff >= 3);
    assert.ok(result.rows[0].hal_units >= 4);
    assert.ok(result.rows[0].equipment_models >= 6);
    assert.ok(result.rows[0].appointments >= 3);
  } finally {
    await client.end();
  }
});

test("equipment master contains HAL, treadmill, and bench quantities", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT category, sum(quantity)::int AS quantity
        FROM facility_equipment_models
       GROUP BY category
    `);
    const totals = Object.fromEntries(
      result.rows.map((row) => [row.category, row.quantity]),
    );
    assert.ok(totals.hal >= 1);
    assert.ok(totals.treadmill >= 1);
    assert.ok(totals.bench >= 1);
  } finally {
    await client.end();
  }
});

test("clinical assessments keep HAL before and after metrics with a summary", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT pre_metrics, post_metrics, delta_summary, summary_text
        FROM clinical_assessments
       WHERE id = '90000000-0000-0000-0000-000000000001'
    `);
    assert.equal(result.rowCount, 1);
    assert.equal(typeof result.rows[0].pre_metrics.walk10mSeconds, "number");
    assert.equal(typeof result.rows[0].post_metrics.walk10mSeconds, "number");
    assert.equal(typeof result.rows[0].delta_summary.walk10mSeconds, "number");
    assert.ok(result.rows[0].summary_text.length > 0);
  } finally {
    await client.end();
  }
});

test("appointment changes and before/after video metadata are auditable", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const log = await client.query(`
      INSERT INTO appointment_change_logs (appointment_id, action, after_state, changed_by)
      VALUES ('80000000-0000-0000-0000-000000000005', 'move', '{"test":true}'::jsonb,
              '20000000-0000-0000-0000-000000000003')
      RETURNING id
    `);
    const videos = await client.query(`
      INSERT INTO assessment_videos
        (assessment_id, phase, original_file_name, storage_key, mime_type, size_bytes)
      VALUES
        ('90000000-0000-0000-0000-000000000001', 'before', 'before.webm', 'test-before.webm', 'video/webm', 8),
        ('90000000-0000-0000-0000-000000000001', 'after', 'after.webm', 'test-after.webm', 'video/webm', 8)
      RETURNING phase
    `);
    assert.equal(log.rowCount, 1);
    assert.deepEqual(videos.rows.map((row) => row.phase).sort(), [
      "after",
      "before",
    ]);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("Gunma center has one leader, six staff, and attendance records", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT s.name,
        (SELECT count(*)::int FROM staff_members st WHERE st.store_id=s.id AND st.active) AS staff_count,
        (SELECT count(*)::int FROM staff_members st WHERE st.store_id=s.id AND st.active AND st.role='manager') AS leaders,
        (SELECT count(*)::int FROM attendance_records ar JOIN staff_members ast ON ast.id=ar.staff_id WHERE ar.store_id=s.id AND ar.work_date=current_date AND ast.active) AS attendance
      FROM stores s WHERE s.id='10000000-0000-0000-0000-000000000001'
    `);
    assert.equal(result.rows[0].name, "ぐんまロボケアセンター");
    assert.equal(result.rows[0].staff_count, 6);
    assert.equal(result.rows[0].leaders, 1);
    assert.equal(result.rows[0].attendance, 6);
  } finally {
    await client.end();
  }
});

test("attendance calendar keeps planned shifts and monthly actual work totals", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM staff_shifts WHERE store_id='10000000-0000-0000-0000-000000000001' AND work_date BETWEEN current_date-30 AND current_date) AS planned_days,
        count(*) FILTER (WHERE clock_in IS NOT NULL AND clock_out IS NOT NULL)::int AS completed_days,
        COALESCE(sum(EXTRACT(EPOCH FROM (clock_out-clock_in))/60-break_minutes) FILTER (WHERE clock_out IS NOT NULL),0)::int AS worked_minutes
      FROM attendance_records
      WHERE store_id='10000000-0000-0000-0000-000000000001' AND work_date BETWEEN current_date-30 AND current_date
    `);
    assert.ok(result.rows[0].planned_days >= 40);
    assert.ok(result.rows[0].completed_days >= 40);
    assert.ok(result.rows[0].worked_minutes > 0);
  } finally {
    await client.end();
  }
});

test("billing contains only completed clinical sessions and paid sales", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT count(*)::int AS billings,
        count(*) FILTER (WHERE br.status='pending')::int AS pending,
        count(*) FILTER (WHERE br.status='paid')::int AS paid,
        bool_and(cs.started_at IS NOT NULL AND cs.ended_at IS NOT NULL) AS all_finished
      FROM billing_records br JOIN clinical_sessions cs ON cs.appointment_id=br.appointment_id
      WHERE br.store_id='10000000-0000-0000-0000-000000000001'
    `);
    assert.ok(result.rows[0].billings >= 5);
    assert.ok(result.rows[0].pending >= 1);
    assert.ok(result.rows[0].paid >= 1);
    assert.equal(result.rows[0].all_finished, true);
  } finally {
    await client.end();
  }
});

test("admin demo has multiple centers and a first-visit customer", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT (SELECT count(*)::int FROM stores) AS stores,
        NOT EXISTS (SELECT 1 FROM appointments WHERE customer_id='30000000-0000-0000-0000-000000000004' AND status='completed') AS first_visit
    `);
    assert.ok(result.rows[0].stores >= 3);
    assert.equal(result.rows[0].first_visit, true);
  } finally {
    await client.end();
  }
});

test("customer profiles keep diagnosis separate from current symptoms", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT diagnosis_name,primary_condition FROM customers WHERE id='30000000-0000-0000-0000-000000000001'`,
    );
    assert.equal(result.rows[0].diagnosis_name, "脳卒中（脳梗塞・脳出血）");
    assert.equal(result.rows[0].primary_condition, "脳梗塞後遺症");
  } finally {
    await client.end();
  }
});

for (const scenario of [
  {
    name: "customer overlap is rejected",
    expectedConstraint: "no_customer_overlap",
    customer: "30000000-0000-0000-0000-000000000001",
    therapist: "20000000-0000-0000-0000-000000000001",
    hal: "40000000-0000-0000-0000-000000000001",
  },
  {
    name: "therapist overlap is rejected",
    expectedConstraint: "no_therapist_overlap",
    customer: "30000000-0000-0000-0000-000000000002",
    therapist: "20000000-0000-0000-0000-000000000002",
    hal: "40000000-0000-0000-0000-000000000001",
  },
  {
    name: "HAL unit overlap is rejected",
    expectedConstraint: "no_hal_overlap",
    customer: "30000000-0000-0000-0000-000000000002",
    therapist: "20000000-0000-0000-0000-000000000001",
    hal: "40000000-0000-0000-0000-000000000002",
  },
]) {
  test(scenario.name, async () => {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const base = await client.query(
        `SELECT start_at, end_at FROM appointments WHERE id = '80000000-0000-0000-0000-000000000004'`,
      );
      await client.query("BEGIN");
      await client.query(
        `UPDATE facility_equipment_models SET quantity=20, hal_capacity_per_unit=1 WHERE category='treadmill'`,
      );
      await assert.rejects(
        client.query(
          `INSERT INTO appointments
            (store_id, customer_id, therapist_id, hal_unit_id, product_id, status, start_at, end_at)
           VALUES
            ('10000000-0000-0000-0000-000000000001', $1, $2, $3,
             '50000000-0000-0000-0000-000000000001', 'reserved', $4, $5)`,
          [
            scenario.customer,
            scenario.therapist,
            scenario.hal,
            base.rows[0].start_at,
            base.rows[0].end_at,
          ],
        ),
        (error) =>
          error.code === "23P01" &&
          error.constraint === scenario.expectedConstraint,
      );
      await client.query("ROLLBACK");
    } finally {
      await client.end();
    }
  });
}

test("lower-limb reservations cannot exceed configured treadmill HAL capacity", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const base = await client.query(
      `SELECT start_at, end_at FROM appointments WHERE id='80000000-0000-0000-0000-000000000004'`,
    );
    await client.query("BEGIN");
    await client.query(
      `UPDATE facility_equipment_models SET quantity=0 WHERE category='treadmill'`,
    );
    await assert.rejects(
      client.query(
        `INSERT INTO appointments (store_id,customer_id,therapist_id,hal_unit_id,product_id,status,start_at,end_at)
        VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001','reserved',$1,$2)`,
        [base.rows[0].start_at, base.rows[0].end_at],
      ),
      (error) =>
        error.code === "P0001" && error.message.includes("トレッドミル"),
    );
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("bench and treadmill models expose configurable HAL capacity and HAL units expose usage count", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const equipment = await client.query(
      `SELECT category,hal_capacity_per_unit FROM facility_equipment_models WHERE category IN ('bench','treadmill')`,
    );
    assert.ok(equipment.rows.every((row) => row.hal_capacity_per_unit >= 1));
    const devices = await client.query(`SELECT usage_count FROM hal_units`);
    assert.ok(devices.rows.every((row) => row.usage_count >= 0));
  } finally {
    await client.end();
  }
});

test("customer booking calendar closes Wednesday and Thursday", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `SELECT count(DISTINCT work_date)::int AS days,count(DISTINCT staff_id)::int AS therapists,bool_and(shift_end>shift_start) AS valid FROM staff_shifts WHERE store_id='10000000-0000-0000-0000-000000000001' AND work_date BETWEEN current_date+1 AND current_date+7 AND status='confirmed'`,
    );
    assert.equal(result.rows[0].days, 5);
    assert.equal(result.rows[0].therapists, 6);
    assert.equal(result.rows[0].valid, true);
  } finally {
    await client.end();
  }
});

test("smartphone customer registrations are linked to the customer ledger", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const customer = await client.query(`INSERT INTO customers
      (store_id,customer_code,name,name_kana,birth_date,phone,postal_code,address,emergency_contact)
      VALUES ('10000000-0000-0000-0000-000000000001','TEST-REG','登録 試験','トウロク シケン','1950-01-02','09000000000','371-0000','群馬県前橋市','{"name":"登録 家族","relation":"子","phone":"09011111111"}'::jsonb)
      RETURNING id`);
    const registration = await client.query(
      `INSERT INTO customer_registrations
      (customer_id,store_id,registration_channel,consent_privacy,consent_contact)
      VALUES ($1,'10000000-0000-0000-0000-000000000001','smartphone',true,true)
      RETURNING customer_id,status,submitted_at`,
      [customer.rows[0].id],
    );
    assert.equal(registration.rows[0].customer_id, customer.rows[0].id);
    assert.equal(registration.rows[0].status, "registered");
    assert.ok(registration.rows[0].submitted_at);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("schedule exposes three therapists and individual rehabilitation spaces", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM staff_members WHERE store_id='10000000-0000-0000-0000-000000000001' AND active AND role='therapist') AS therapists,
      (SELECT count(*)::int FROM rehabilitation_spaces WHERE store_id='10000000-0000-0000-0000-000000000001' AND active AND space_type='treadmill') AS treadmills,
      (SELECT count(*)::int FROM rehabilitation_spaces WHERE store_id='10000000-0000-0000-0000-000000000001' AND active AND space_type='bench') AS benches,
      (SELECT count(*)::int FROM appointments WHERE store_id='10000000-0000-0000-0000-000000000001' AND rehab_space_id IS NOT NULL) AS assigned`);
    assert.equal(result.rows[0].therapists, 3);
    assert.equal(result.rows[0].treadmills, 2);
    assert.equal(result.rows[0].benches, 3);
    assert.ok(result.rows[0].assigned >= 10);
  } finally {
    await client.end();
  }
});

test("rehabilitation space rules reject an incompatible HAL type", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      client.query(
        `UPDATE appointments SET rehab_space_id='42000000-0000-0000-0000-000000000003' WHERE id='80000000-0000-0000-0000-000000000004'`,
      ),
      (error) =>
        error.code === "P0001" && error.message.includes("トレッドミル"),
    );
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("facility and customer messages keep sender, unread, and read state", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const customerUnread = await client.query(`
      INSERT INTO messages(conversation_id,sender_type,sender_customer_id,body)
      VALUES('d0000000-0000-0000-0000-000000000001','customer','30000000-0000-0000-0000-000000000001','既読状態のテスト')
      RETURNING id,read_at
    `);
    const facilityUnread = await client.query(`
      INSERT INTO messages(conversation_id,sender_type,sender_staff_id,body)
      VALUES('d0000000-0000-0000-0000-000000000001','facility','20000000-0000-0000-0000-000000000003','利用者側既読状態のテスト')
      RETURNING id,read_at
    `);
    assert.equal(customerUnread.rows[0].read_at, null);
    assert.equal(facilityUnread.rows[0].read_at, null);
    await client.query(
      `UPDATE messages SET read_at=now()
        WHERE conversation_id='d0000000-0000-0000-0000-000000000001'
          AND sender_type='customer' AND read_at IS NULL`,
    );
    const facilityOpened = await client.query(`SELECT
      (SELECT read_at IS NOT NULL FROM messages WHERE id=$1) AS customer_read,
      (SELECT read_at IS NULL FROM messages WHERE id=$2) AS facility_still_unread`,
      [customerUnread.rows[0].id, facilityUnread.rows[0].id]);
    assert.equal(facilityOpened.rows[0].customer_read, true);
    assert.equal(facilityOpened.rows[0].facility_still_unread, true);
    await client.query(
      `UPDATE messages SET read_at=now()
        WHERE conversation_id='d0000000-0000-0000-0000-000000000001'
          AND sender_type='facility' AND read_at IS NULL`,
    );
    const customerOpened = await client.query(`SELECT read_at FROM messages WHERE id=$1`, [facilityUnread.rows[0].id]);
    assert.ok(customerOpened.rows[0].read_at);
    const result = await client.query(`
      SELECT
        (SELECT count(*)::int FROM message_conversations WHERE store_id='10000000-0000-0000-0000-000000000001') AS conversations,
        count(*)::int AS messages,
        bool_and(
          (sender_type='customer' AND sender_customer_id IS NOT NULL AND sender_staff_id IS NULL)
          OR (sender_type='facility' AND sender_staff_id IS NOT NULL AND sender_customer_id IS NULL)
        ) AS valid_senders
      FROM messages
    `);
    assert.ok(result.rows[0].conversations >= 3);
    assert.ok(result.rows[0].messages >= 5);
    assert.equal(result.rows[0].valid_senders, true);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("AI chat requires consent and audits record use without pretending to be staff", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const consent = await client.query(
      `INSERT INTO ai_chat_consents(customer_id,store_id,consent_version,notices) VALUES('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test-version','["test"]'::jsonb) RETURNING accepted_at`,
    );
    assert.ok(consent.rows[0].accepted_at);
    const aiMessage = await client.query(
      `INSERT INTO messages(conversation_id,sender_type,body,read_at) VALUES('d0000000-0000-0000-0000-000000000001','ai','AIテスト応答',now()) RETURNING id,sender_customer_id,sender_staff_id`,
    );
    assert.equal(aiMessage.rows[0].sender_customer_id, null);
    assert.equal(aiMessage.rows[0].sender_staff_id, null);
    const question = await client.query(
      `INSERT INTO messages(conversation_id,sender_type,sender_customer_id,body,read_at) VALUES('d0000000-0000-0000-0000-000000000001','customer','30000000-0000-0000-0000-000000000001','質問',now()) RETURNING id`,
    );
    const audit = await client.query(
      `INSERT INTO ai_chat_interactions(conversation_id,customer_id,question_message_id,answer_message_id,input_method,response_style,safety_classification,context_summary,provider,model_name) VALUES('d0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',$1,$2,'voice','安心重視','routine','{"assessmentUsed":true}'::jsonb,'test','test-model') RETURNING input_method,response_style,context_summary`,
      [question.rows[0].id, aiMessage.rows[0].id],
    );
    assert.equal(audit.rows[0].input_method, "voice");
    assert.equal(audit.rows[0].response_style, "安心重視");
    assert.equal(audit.rows[0].context_summary.assessmentUsed, true);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("full Gunma test data has 100 customers, six staff, and configured business days", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM customers WHERE store_id='10000000-0000-0000-0000-000000000001' AND active) AS customers,
      (SELECT count(*)::int FROM staff_members WHERE store_id='10000000-0000-0000-0000-000000000001' AND active) AS staff,
      open_time::text,close_time::text,closed_weekdays
      FROM stores WHERE id='10000000-0000-0000-0000-000000000001'`);
    assert.equal(result.rows[0].customers, 100);
    assert.equal(result.rows[0].staff, 6);
    assert.equal(result.rows[0].open_time, "10:00:00");
    assert.equal(result.rows[0].close_time, "18:00:00");
    assert.deepEqual(result.rows[0].closed_weekdays, [3, 4]);
  } finally {
    await client.end();
  }
});

test("August records fill every open day and September bookings respect hours and holidays", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`SET TIME ZONE 'Asia/Tokyo'`);
    const result = await client.query(`SELECT
      (SELECT count(DISTINCT start_at::date)::int FROM appointments WHERE store_id='10000000-0000-0000-0000-000000000001' AND status='completed' AND start_at::date BETWEEN '2026-08-01' AND '2026-08-31') AS august_days,
      (SELECT count(*)::int FROM generate_series('2026-08-01'::date,'2026-08-31','1 day') d WHERE extract(isodow FROM d) NOT IN (3,4)) AS august_open_days,
      (SELECT count(*)::int FROM appointments WHERE store_id='10000000-0000-0000-0000-000000000001' AND start_at::date BETWEEN '2026-09-01' AND '2026-09-30' AND status IN ('reserved','confirmed')) AS september_bookings,
      (SELECT count(*)::int FROM appointments WHERE store_id='10000000-0000-0000-0000-000000000001' AND start_at::date BETWEEN '2026-08-01' AND '2026-09-30' AND (start_at::time<'10:00' OR end_at::time>'18:00' OR extract(isodow FROM start_at) IN (3,4))) AS invalid_slots`);
    assert.equal(result.rows[0].august_days, result.rows[0].august_open_days);
    assert.ok(result.rows[0].september_bookings > 0);
    assert.equal(result.rows[0].invalid_slots, 0);
  } finally {
    await client.end();
  }
});

test("five and ten use ticket purchases and every payment method are represented", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const tickets = await client.query(
      `SELECT ticket_type,count(*)::int AS count FROM ticket_purchase_history WHERE store_id='10000000-0000-0000-0000-000000000001' AND status='active' GROUP BY ticket_type ORDER BY ticket_type`,
    );
    assert.deepEqual(
      tickets.rows.map((row) => row.ticket_type),
      [5, 10],
    );
    assert.ok(tickets.rows.every((row) => row.count >= 20));
    const methods = await client.query(
      `SELECT count(DISTINCT payment_method)::int AS methods FROM billing_records WHERE store_id='10000000-0000-0000-0000-000000000001' AND status='paid'`,
    );
    assert.equal(methods.rows[0].methods, 4);
  } finally {
    await client.end();
  }
});

test("today's difficult customers expose active caution notes and response guidance", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`SELECT count(*)::int AS cautions,
      count(*) FILTER (WHERE severity='high')::int AS high,
      bool_and(length(title)>0 AND length(detail)>0 AND length(response_note)>0) AS complete
      FROM customer_cautions
      WHERE store_id='10000000-0000-0000-0000-000000000001' AND active=true`);
    assert.ok(result.rows[0].cautions >= 3);
    assert.ok(result.rows[0].high >= 1);
    assert.equal(result.rows[0].complete, true);
  } finally {
    await client.end();
  }
});

test("facility questionnaire template includes editable rehabilitation number and video fields", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result =
      await client.query(`SELECT t.title,t.introduction_text,t.consent_text,
      count(i.id)::int AS items,
      count(*) FILTER (WHERE i.field_type='number')::int AS number_items,
      count(*) FILTER (WHERE i.field_type='video')::int AS video_items
      FROM questionnaire_templates t
      JOIN questionnaire_template_items i ON i.template_id=t.id AND i.active=true
      WHERE t.store_id='10000000-0000-0000-0000-000000000001'
      GROUP BY t.id`);
    assert.match(result.rows[0].title, /ぐんまロボケアセンター/);
    assert.ok(result.rows[0].introduction_text.length > 0);
    assert.ok(result.rows[0].consent_text.length > 0);
    assert.ok(result.rows[0].items >= 15);
    assert.ok(result.rows[0].number_items >= 3);
    assert.ok(result.rows[0].video_items >= 2);
  } finally {
    await client.end();
  }
});

test("HAL equipment keeps photos and the requested body-part and size variants", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`SELECT
      count(*) FILTER (WHERE model_type='lower_limb' AND size_label='S' AND image_url IS NOT NULL)::int AS lower_small,
      count(*) FILTER (WHERE model_type='lower_limb' AND size_label='L' AND image_url IS NOT NULL)::int AS lower_large,
      count(*) FILTER (WHERE model_type='single_joint' AND body_part='upper_limb' AND image_url IS NOT NULL)::int AS joint_upper,
      count(*) FILTER (WHERE model_type='lumbar' AND size_label='S' AND image_url IS NOT NULL)::int AS lumbar_small,
      count(*) FILTER (WHERE model_type='lumbar' AND size_label='L' AND image_url IS NOT NULL)::int AS lumbar_large
      FROM hal_units WHERE store_id='10000000-0000-0000-0000-000000000001'`);
    assert.ok(result.rows[0].lower_small >= 1);
    assert.ok(result.rows[0].lower_large >= 1);
    assert.ok(result.rows[0].joint_upper >= 1);
    assert.ok(result.rows[0].lumbar_small >= 1);
    assert.ok(result.rows[0].lumbar_large >= 1);
  } finally {
    await client.end();
  }
});

test("RoboReha FG Lite has physical function protocols and local-analysis storage", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`SELECT
      (SELECT count(*)::int FROM measurement_protocols WHERE store_id='10000000-0000-0000-0000-000000000001' AND active) AS protocols,
      (SELECT count(*)::int FROM measurement_protocols WHERE store_id='10000000-0000-0000-0000-000000000001' AND video_supported) AS video_protocols,
      (SELECT count(*)::int FROM training_programs WHERE store_id='10000000-0000-0000-0000-000000000001' AND active) AS programs,
      to_regclass('public.physical_function_sessions') IS NOT NULL AS sessions_table,
      to_regclass('public.motion_analysis_jobs') IS NOT NULL AS jobs_table,
      to_regclass('public.gait_analysis_results') IS NOT NULL AS results_table`);
    assert.ok(result.rows[0].protocols >= 8);
    assert.ok(result.rows[0].video_protocols >= 3);
    assert.ok(result.rows[0].programs >= 4);
    assert.equal(result.rows[0].sessions_table, true);
    assert.equal(result.rows[0].jobs_table, true);
    assert.equal(result.rows[0].results_table, true);
  } finally {
    await client.end();
  }
});

test("RoboReha FG Lite keeps patient helper HAL conditions and clinician review auditable", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query(`INSERT INTO physical_function_sessions
      (store_id,appointment_id,customer_id,evaluator_id,hal_unit_id,capture_condition,hal_size,
       assistance_level,assistive_device,walking_distance_m,camera_view)
      SELECT store_id,id,customer_id,therapist_id,hal_unit_id,'with_hal_lower_limb','L','light','walker',4,'side'
        FROM appointments WHERE id='80000000-0000-0000-0000-000000000005'
      ON CONFLICT (appointment_id) DO UPDATE SET updated_at=now() RETURNING id,evaluator_id`);
    const sessionId = session.rows[0].id;
    const video = await client.query(`INSERT INTO physical_function_videos
      (session_id,test_code,phase,original_file_name,storage_key,mime_type,size_bytes,consent_confirmed)
      VALUES ($1,'gait','hal_assisted','test.mp4',$2,'video/mp4',1024,true) RETURNING id`,
      [sessionId, `test-${Date.now()}.mp4`]);
    const job = await client.query(`INSERT INTO motion_analysis_jobs
      (session_id,video_id,engine_version,status,patient_track_id,helper_track_ids,pose_summary,quality_flags)
      VALUES ($1,$2,'roboreha-pose-lite-test','needs_review','person-1','["person-2"]'::jsonb,
        '{"patient":"person-1","potient":"person-1","helper":["person-2"]}'::jsonb,'["HAL装着による遮蔽"]'::jsonb)
      RETURNING id`, [sessionId, video.rows[0].id]);
    const gait = await client.query(`INSERT INTO gait_analysis_results
      (job_id,session_id,walking_time_seconds,walking_speed_mps,step_count,cadence_spm,confidence)
      VALUES ($1,$2,4,1,8,120,0.72) RETURNING id,clinician_reviewed`, [job.rows[0].id, sessionId]);
    assert.equal(gait.rows[0].clinician_reviewed, false);
    const details = await client.query(`SELECT pfs.capture_condition,pfs.hal_size,pfs.assistance_level,
      j.patient_track_id,j.helper_track_ids,j.pose_summary,j.quality_flags,v.consent_confirmed
      FROM physical_function_sessions pfs
      JOIN physical_function_videos v ON v.session_id=pfs.id
      JOIN motion_analysis_jobs j ON j.video_id=v.id
      WHERE pfs.id=$1`, [sessionId]);
    assert.equal(details.rows[0].capture_condition, "with_hal_lower_limb");
    assert.equal(details.rows[0].hal_size, "L");
    assert.equal(details.rows[0].assistance_level, "light");
    assert.equal(details.rows[0].patient_track_id, "person-1");
    assert.deepEqual(details.rows[0].helper_track_ids, ["person-2"]);
    assert.equal(details.rows[0].pose_summary.potient, "person-1");
    assert.equal(details.rows[0].consent_confirmed, true);
    await client.query(`UPDATE gait_analysis_results SET clinician_reviewed=true,reviewed_by=$1,reviewed_at=now()
      WHERE id=$2`, [session.rows[0].evaluator_id, gait.rows[0].id]);
    const reviewed = await client.query(`SELECT clinician_reviewed,reviewed_at IS NOT NULL AS reviewed_at FROM gait_analysis_results WHERE id=$1`, [gait.rows[0].id]);
    assert.equal(reviewed.rows[0].clinician_reviewed, true);
    assert.equal(reviewed.rows[0].reviewed_at, true);
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }
});

test("every center starts with all nine admin-controlled features enabled", async () => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT s.code,count(flags.key)::int AS feature_count,bool_and(flags.value::boolean) AS all_enabled
        FROM stores s
        CROSS JOIN LATERAL jsonb_each_text(s.feature_flags) flags
       GROUP BY s.code
       ORDER BY s.code`);
    assert.ok(result.rows.length >= 3);
    assert.ok(result.rows.every((row) => row.feature_count === 9 && row.all_enabled === true));
  } finally {
    await client.end();
  }
});
